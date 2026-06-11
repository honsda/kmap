const fs = require('fs');
const path = require('path');
const https = require('https');
const zlib = require('zlib');

// Paths
const SCRIPTS_DIR = __dirname;
const PROJECT_ROOT = path.join(SCRIPTS_DIR, '..');
const PUBLIC_DATA_DIR = path.join(PROJECT_ROOT, 'public', 'data');
const SRC_DATA_DIR = path.join(PROJECT_ROOT, 'src', 'data');

// URLs
const UNICODE_MAP_URL = 'https://www.unicode.org/Public/UCD/latest/ucd/EquivalentUnifiedIdeograph.txt';
const KANJIVG_RADICAL_URL = 'https://raw.githubusercontent.com/yagays/kanjivg-radical/master/element2kanji.json';
const KANJI_ALIVE_RADICALS_URL = 'https://raw.githubusercontent.com/kanjialive/kanji-data-media/master/language-data/japanese-radicals.csv';
const KANJIDIC2_URL = 'http://www.edrdg.org/kanjidic/kanjidic2.xml.gz';

// Helper: Ensure directory exists
function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

// Helper: Download a file
function downloadFile(url, destPath) {
  return new Promise((resolve, reject) => {
    console.log(`Downloading ${url}...`);
    const file = fs.createWriteStream(destPath);
    https.get(url, (response) => {
      if (response.statusCode !== 200) {
        reject(new Error(`Failed to download ${url}: HTTP status ${response.statusCode}`));
        return;
      }
      response.pipe(file);
      file.on('finish', () => {
        file.close(() => {
          console.log(`Saved ${destPath}`);
          resolve();
        });
      });
    }).on('error', (err) => {
      fs.unlink(destPath, () => {});
      reject(err);
    });
  });
}

// Helper: Simple CSV Parser
function parseCSV(text) {
  const lines = text.split(/\r?\n/);
  const result = [];
  for (let line of lines) {
    if (!line.trim()) continue;
    const cells = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        cells.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    cells.push(current.trim());
    result.push(cells);
  }
  return result;
}

// Main process
async function main() {
  try {
    ensureDir(path.join(SCRIPTS_DIR, 'cache'));
    ensureDir(PUBLIC_DATA_DIR);
    ensureDir(SRC_DATA_DIR);

    const unicodeMapPath = path.join(SCRIPTS_DIR, 'cache', 'EquivalentUnifiedIdeograph.txt');
    const kanjivgRadicalPath = path.join(SCRIPTS_DIR, 'cache', 'element2kanji.json');
    const kanjiAlivePath = path.join(SCRIPTS_DIR, 'cache', 'japanese-radicals.csv');
    const kanjidicPath = path.join(SCRIPTS_DIR, 'cache', 'kanjidic2.xml.gz');

    // 1. Download datasets if they don't exist locally
    if (!fs.existsSync(unicodeMapPath)) {
      await downloadFile(UNICODE_MAP_URL, unicodeMapPath);
    }
    if (!fs.existsSync(kanjivgRadicalPath)) {
      await downloadFile(KANJIVG_RADICAL_URL, kanjivgRadicalPath);
    }
    if (!fs.existsSync(kanjiAlivePath)) {
      await downloadFile(KANJI_ALIVE_RADICALS_URL, kanjiAlivePath);
    }
    if (!fs.existsSync(kanjidicPath)) {
      await downloadFile(KANJIDIC2_URL, kanjidicPath);
    }

    console.log('All files downloaded. Starting processing...');

    // 2. Parse EquivalentUnifiedIdeograph.txt to map Kangxi Radicals -> CJK Unified Ideographs
    console.log('Parsing Unicode Normalization Map...');
    const normalizationMap = {};
    const unicodeContent = fs.readFileSync(unicodeMapPath, 'utf8');
    const unicodeLines = unicodeContent.split('\n');
    for (let line of unicodeLines) {
      const cleanLine = line.split('#')[0].trim();
      if (!cleanLine) continue;
      const parts = cleanLine.split(';');
      if (parts.length >= 2) {
        const srcHex = parts[0].trim();
        const dstHex = parts[1].trim();
        const srcChar = String.fromCodePoint(parseInt(srcHex, 16));
        const dstChar = String.fromCodePoint(parseInt(dstHex, 16));
        normalizationMap[srcChar] = dstChar;
      }
    }

    // 3. Decompress and parse KANJIDIC2 XML
    console.log('Decompressing and parsing KANJIDIC2 (this may take a few seconds)...');
    const gzipBuffer = fs.readFileSync(kanjidicPath);
    const xmlContent = zlib.gunzipSync(gzipBuffer).toString('utf8');
    
    const kanjiMap = {};
    const characters = xmlContent.split('<character>');
    console.log(`Found ${characters.length - 1} characters in KANJIDIC2`);

    for (let i = 1; i < characters.length; i++) {
      const block = characters[i].split('</character>')[0];
      const literalMatch = block.match(/<literal>([^<]+)<\/literal>/);
      if (!literalMatch) continue;
      const literal = literalMatch[1];

      const onyomi = [];
      const kunyomi = [];
      const meanings = [];

      // Readings
      const readingRegex = /<reading\s+type="([^"]+)">([^<]+)<\/reading>/g;
      let readingMatch;
      while ((readingMatch = readingRegex.exec(block)) !== null) {
        const type = readingMatch[1];
        const val = readingMatch[2];
        if (type === 'ja_on') {
          onyomi.push(val);
        } else if (type === 'ja_kun') {
          kunyomi.push(val);
        }
      }

      // Meanings (only English, which have no attributes like m_lang)
      const meaningRegex = /<meaning([^>]*)>([^<]+)<\/meaning>/g;
      let meaningMatch;
      while ((meaningMatch = meaningRegex.exec(block)) !== null) {
        const attrs = meaningMatch[1];
        const val = meaningMatch[2];
        if (!attrs || !attrs.includes('m_lang=')) {
          meanings.push(val);
        }
      }

      kanjiMap[literal] = {
        onyomi,
        kunyomi,
        meanings: meanings.join(', ')
      };
    }

    // 4. Parse element2kanji.json
    console.log('Parsing KanjiVG element mappings...');
    const element2kanji = JSON.parse(fs.readFileSync(kanjivgRadicalPath, 'utf8'));

    // 5. Parse Kanji Alive CSV and merge datasets
    console.log('Merging datasets and generating files...');
    const csvContent = fs.readFileSync(kanjiAlivePath, 'utf8');
    const csvRows = parseCSV(csvContent);

    const headers = csvRows[0];
    const radicalColIndex = headers.indexOf('Radical');
    const meaningColIndex = headers.indexOf('Meaning');
    const readingJColIndex = headers.indexOf('Reading-J');
    const strokeColIndex = headers.indexOf('Stroke#');

    if (radicalColIndex === -1 || meaningColIndex === -1) {
      throw new Error('Could not find required columns in japanese-radicals.csv');
    }

    const mergedRadicalData = {};
    const radicalList = [];

    for (let i = 1; i < csvRows.length; i++) {
      const row = csvRows[i];
      if (row.length < 3) continue;

      const originalRadical = row[radicalColIndex];
      if (!originalRadical) continue;

      // Normalize character to CJK Unified Ideograph
      const normalizedRadical = normalizationMap[originalRadical] || originalRadical;

      // Query KANJIDIC2 info
      const kanjiInfo = kanjiMap[normalizedRadical] || {};
      
      let onyomi = kanjiInfo.onyomi || [];
      let kunyomi = kanjiInfo.kunyomi || [];
      
      // Fallback reading from CSV if not found in KANJIDIC2
      if (onyomi.length === 0 && kunyomi.length === 0) {
        const csvReading = row[readingJColIndex] || '';
        kunyomi = csvReading.split(',').map(s => s.trim()).filter(Boolean);
      }

      // Meaning
      const meaning = kanjiInfo.meanings || row[meaningColIndex] || 'Unknown';

      // Kanji list containing this radical
      let commonKanji = element2kanji[normalizedRadical] || [];
      if (commonKanji.length === 0 && originalRadical !== normalizedRadical) {
        commonKanji = element2kanji[originalRadical] || [];
      }

      // Save to merged radical_data
      mergedRadicalData[normalizedRadical] = {
        meaning: meaning,
        onyomi: onyomi,
        kunyomi: kunyomi,
        common_kanji: commonKanji
      };

      // Add to list of available radicals
      radicalList.push({
        character: normalizedRadical,
        original_character: originalRadical,
        meaning: meaning,
        onyomi: onyomi,
        kunyomi: kunyomi,
        stroke_count: parseInt(row[strokeColIndex]) || 0,
        reading: row[readingJColIndex] || ''
      });
    }

    // Write final output files to both public/data and src/data
    const dataJSON = JSON.stringify(mergedRadicalData, null, 2);
    const listJSON = JSON.stringify(radicalList, null, 2);

    fs.writeFileSync(path.join(PUBLIC_DATA_DIR, 'radical_data.json'), dataJSON);
    fs.writeFileSync(path.join(PUBLIC_DATA_DIR, 'radical_list.json'), listJSON);

    fs.writeFileSync(path.join(SRC_DATA_DIR, 'radical_data.json'), dataJSON);
    fs.writeFileSync(path.join(SRC_DATA_DIR, 'radical_list.json'), listJSON);

    console.log('Success! Outputs generated:');
    console.log(`- ${path.join(PUBLIC_DATA_DIR, 'radical_data.json')}`);
    console.log(`- ${path.join(PUBLIC_DATA_DIR, 'radical_list.json')}`);

  } catch (error) {
    console.error('Error during data building:', error);
    process.exit(1);
  }
}

main();
