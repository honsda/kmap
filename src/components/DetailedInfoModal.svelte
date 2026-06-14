<script>
  import { gridActions, radicalList, radicalData } from '../stores/gridStore.js';
  import * as wanakana from 'wanakana';

  let {
    isOpen = false,
    data = null,
    kanjiDataMap = {},
    onClose = () => {}
  } = $props();

  function addKanjiBlock(kanji) {
    const res = gridActions.addSpecificCombination(
      data.id,
      kanji,
      $radicalList,
      $radicalData,
      kanjiDataMap
    );
    if (res.success) {
      onClose();
    }
  }

  function addStandaloneKanjiBlock(kanji) {
    const res = gridActions.addStandaloneKanji(kanji);
    if (res.success) {
      onClose();
    }
  }

  // Sort common kanji by stroke count
  let sortedCommonKanji = $derived.by(() => {
    if (!data || !data.common_kanji) return [];
    return [...data.common_kanji].sort((a, b) => {
      const strokeA = kanjiDataMap[a]?.strokeCount ?? 99;
      const strokeB = kanjiDataMap[b]?.strokeCount ?? 99;
      return strokeA - strokeB;
    });
  });

  let wordExamples = $state([]);
  let loadingWords = $state(false);
  let synonymsOpen = $state(false);
  let synonyms = $state([]);
  let loadingSynonyms = $state(false);

  async function fetchSynonyms(meaningStr) {
    if (!meaningStr) {
      synonyms = [];
      return;
    }
    const mainMeaning = meaningStr.split(/[,;]/)[0].trim().toLowerCase();
    loadingSynonyms = true;
    try {
      const res = await fetch(`https://api.datamuse.com/words?ml=${encodeURIComponent(mainMeaning)}&max=20`);
      if (res.ok) {
        const words = await res.json();
        const englishSynonyms = new Set(words.map(w => w.word.toLowerCase()));
        englishSynonyms.add(mainMeaning);
        
        const relatedKanjis = [];
        
        for (const [k, kInfo] of Object.entries(kanjiDataMap)) {
          if (k === data.character) continue;
          if (!kInfo.meanings) continue;
          
          const kMeaningsList = typeof kInfo.meanings === 'string' 
            ? kInfo.meanings.split(/[,;]/).map(m => m.trim().toLowerCase()) 
            : (Array.isArray(kInfo.meanings) ? kInfo.meanings.map(m => m.trim().toLowerCase()) : []);
            
          if (kMeaningsList.some(m => englishSynonyms.has(m))) {
             relatedKanjis.push(k);
          }
        }
        
        synonyms = relatedKanjis.slice(0, 8);
      }
    } catch (e) {
      console.error(e);
      synonyms = [];
    } finally {
      loadingSynonyms = false;
    }
  }

  $effect(() => {
    if (isOpen && data && data.character) {
      fetchWords(data.character);
      const meaningStr = typeof data.meaning === 'string' ? data.meaning : (Array.isArray(data.meaning) ? data.meaning[0] : (data.meanings ? (Array.isArray(data.meanings) ? data.meanings[0] : data.meanings) : ''));
      fetchSynonyms(meaningStr);
    } else {
      wordExamples = [];
      synonyms = [];
    }
  });

  // Sentence patterns to wrap words in natural-sounding example sentences
  const sentencePatterns = [
    { jp: (w) => `${w}は大切です。`, en: (m) => `${m} is important.` },
    { jp: (w) => `${w}を使います。`, en: (m) => `I use ${m.toLowerCase()}.` },
    { jp: (w) => `これは${w}です。`, en: (m) => `This is ${m.toLowerCase()}.` },
    { jp: (w) => `${w}が好きです。`, en: (m) => `I like ${m.toLowerCase()}.` },
    { jp: (w) => `${w}を見ました。`, en: (m) => `I saw ${m.toLowerCase()}.` },
    { jp: (w) => `${w}がありました。`, en: (m) => `There was ${m.toLowerCase()}.` },
  ];

  async function fetchWords(char) {
    wordExamples = [];
    loadingWords = true;
    try {
      // kanjiapi.dev has Access-Control-Allow-Origin: * (fully CORS-friendly)
      const res = await fetch(`https://kanjiapi.dev/v1/words/${encodeURIComponent(char)}`);
      if (!res.ok) throw new Error('Network error');
      const words = await res.json();

      if (words && words.length > 0) {
        // Score words: prefer common (has priorities), short words, with the character in them
        const scored = words
          .filter(w => {
            const v = w.variants?.[0];
            return v && v.written && v.written.includes(char) && w.meanings?.[0]?.glosses?.length > 0;
          })
          .map(w => {
            const v = w.variants[0];
            const hasPriority = v.priorities && v.priorities.length > 0;
            const wordLen = v.written.length;
            // Lower score = better. Prefer common short words.
            const score = (hasPriority ? 0 : 100) + wordLen;
            return {
              word: v.written,
              reading: v.pronounced || '',
              meaning: w.meanings[0].glosses.slice(0, 3).join('; '),
              score
            };
          })
          .sort((a, b) => a.score - b.score)
          .slice(0, 3);

        // Generate usage sentences for each word
        wordExamples = scored.map((entry, i) => {
          const pattern = sentencePatterns[i % sentencePatterns.length];
          return {
            ...entry,
            sentenceJp: pattern.jp(entry.word),
            sentenceEn: pattern.en(entry.meaning)
          };
        });
      }
    } catch (err) {
      console.error('Failed to fetch word examples:', err);
      wordExamples = [];
    } finally {
      loadingWords = false;
    }
  }

  // Highlight the kanji character in a string
  function highlightChar(text, char) {
    if (!text || !char) return text;
    const parts = text.split(char);
    return parts;
  }

  function handleKeydown(e) {
    if (isOpen && e.key === 'Escape') {
      onClose();
    }
  }
</script>

<svelte:window onkeydown={handleKeydown} />

{#if isOpen && data}
  <div 
    class="fixed top-0 right-0 h-screen w-96 bg-white border-l-2 border-red-650 z-40 flex flex-col shadow-2xl animate-in slide-in-from-right duration-300 text-black rounded-none pointer-events-auto"
    role="dialog"
    aria-modal="true"
  >
    <!-- Header -->
    <div class="p-6 border-b border-zinc-200 flex items-center justify-between">
      <div class="flex items-center gap-4">
        <div class="text-5xl font-bold text-black bg-white w-16 h-16 rounded-none flex items-center justify-center border border-zinc-300 shadow-inner">
          {data.character}
        </div>
        <div>
          <h2 class="text-xl font-bold text-black tracking-tight">{typeof data.meaning === 'string' ? data.meaning.toUpperCase() : (Array.isArray(data.meaning) ? data.meaning.join(', ').toUpperCase() : (data.meanings ? (Array.isArray(data.meanings) ? data.meanings.join(', ').toUpperCase() : data.meanings.toUpperCase()) : 'UNKNOWN'))}</h2>
          <div class="flex items-center gap-2 mt-1">
            <p class="text-[11px] text-zinc-550 font-medium">Details & Constituent Kanji</p>
            {#if data.jlpt}
              <span class="px-1.5 py-0.5 text-[9px] font-bold bg-red-100 text-red-700 rounded-sm uppercase">N{data.jlpt}</span>
            {/if}
          </div>
        </div>
      </div>
      <button 
        onclick={onClose}
        class="h-8 w-8 rounded-none flex items-center justify-center text-zinc-500 hover:text-white hover:bg-red-650 transition-colors cursor-pointer text-xs"
        title="Close Sidebar"
      >
        ✕
      </button>
    </div>

    <!-- Content -->
    <div class="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-thin scrollbar-thumb-zinc-200">
      <!-- Readings Grid -->
      <div class="grid grid-cols-2 gap-4 bg-zinc-50 p-4 rounded-none border border-zinc-200">
        <div>
          <span class="text-zinc-500 font-semibold text-[9px] uppercase tracking-wider block">Onyomi</span>
          {#if data.onyomi && data.onyomi.length > 0}
            <span class="text-zinc-800 font-mono text-sm block mt-1 font-bold">
              {data.onyomi.join(', ')}
            </span>
            <span class="text-zinc-500 font-mono text-[10px] block mt-0.5 capitalize">
              {wanakana.toRomaji(data.onyomi.join(', '))}
            </span>
          {:else}
            <span class="text-zinc-800 font-mono text-sm block mt-1 font-bold">—</span>
          {/if}
        </div>
        <div>
          <span class="text-zinc-500 font-semibold text-[9px] uppercase tracking-wider block">Kunyomi</span>
          {#if data.kunyomi && data.kunyomi.length > 0}
            <span class="text-zinc-800 font-mono text-sm block mt-1 font-bold">
              {data.kunyomi.join(', ')}
            </span>
            <span class="text-zinc-500 font-mono text-[10px] block mt-0.5 capitalize">
              {wanakana.toRomaji(data.kunyomi.join(', '))}
            </span>
          {:else}
            <span class="text-zinc-800 font-mono text-sm block mt-1 font-bold">—</span>
          {/if}
        </div>
      </div>

      <!-- Constituent Radicals Section -->
      {#if data.radicals && data.radicals.length > 0}
        <div class="space-y-3 pb-1 border-b border-zinc-200">
          <h3 class="text-xs font-bold text-black uppercase tracking-wider">Constituent Radicals</h3>
          <div class="flex flex-wrap gap-2 mt-1">
            {#each data.radicals as rad}
              <div class="flex items-center gap-2 px-2.5 py-1.5 bg-zinc-50 border border-zinc-200 cursor-help" title={$radicalData[rad]?.meaning || 'Unknown'}>
                <span class="text-xl font-bold text-red-650">{rad}</span>
                <span class="text-[10px] font-medium text-zinc-600 capitalize">{$radicalData[rad]?.meaning || 'Unknown'}</span>
              </div>
            {/each}
          </div>
        </div>
      {/if}

      <!-- Synonyms Section -->
      {#if synonyms.length > 0 || loadingSynonyms}
        <div class="pb-1 border-b border-zinc-200">
          <button
            onclick={() => synonymsOpen = !synonymsOpen}
            class="flex items-center justify-between w-full py-1 cursor-pointer group"
          >
            <h3 class="text-xs font-bold text-black uppercase tracking-wider">Related Kanji (Synonyms)</h3>
            <svg
              class="w-4 h-4 text-red-600 transition-transform duration-200 {synonymsOpen ? 'rotate-180' : ''}"
              fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"
            >
              <path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          {#if synonymsOpen}
            <div class="mt-2">
              {#if loadingSynonyms}
                <div class="flex items-center gap-2 py-2 text-[11px] text-zinc-500 font-medium">
                  <span class="h-3 w-3 rounded-full border border-zinc-350 border-t-red-650 animate-spin"></span>
                  Finding related kanji...
                </div>
              {:else}
                <div class="flex flex-wrap gap-2">
                  {#each synonyms as syn}
                    {@const kInfo = kanjiDataMap[syn]}
                    <button
                      onclick={() => addStandaloneKanjiBlock(syn)}
                      class="px-2.5 py-1.5 bg-white border border-zinc-300 hover:border-red-650 hover:text-red-650 transition-colors flex items-center gap-2 cursor-pointer group"
                      title={kInfo ? (typeof kInfo.meanings === 'string' ? kInfo.meanings : kInfo.meanings.join(', ')) : 'Unknown'}
                    >
                      <span class="text-lg font-bold group-hover:text-red-650 text-black">{syn}</span>
                      <span class="text-[9px] text-zinc-500 capitalize max-w-[60px] truncate">{kInfo ? (typeof kInfo.meanings === 'string' ? kInfo.meanings.split(/[,;]/)[0] : kInfo.meanings[0]) : ''}</span>
                    </button>
                  {/each}
                </div>
              {/if}
            </div>
          {/if}
        </div>
      {/if}

      <!-- Word Examples Section -->
      <div class="space-y-3 pb-1 border-b border-zinc-200">
        <h3 class="text-xs font-bold text-black uppercase tracking-wider">Word Examples</h3>
        
        {#if loadingWords}
          <div class="flex items-center gap-2 py-4 text-[11px] text-zinc-500 font-medium">
            <span class="h-3 w-3 rounded-full border border-zinc-350 border-t-red-650 animate-spin"></span>
            Loading examples...
          </div>
        {:else if wordExamples.length === 0}
          <div class="text-[11px] text-zinc-550 italic py-2">
            No word examples available for this character.
          </div>
        {:else}
          <div class="space-y-2.5">
            {#each wordExamples as entry}
              <div class="bg-zinc-50 border border-zinc-200 p-3 rounded-none space-y-2">
                <!-- Word with highlighted kanji -->
                <div class="flex items-baseline gap-2">
                  <p class="text-base font-bold text-black tracking-normal leading-relaxed select-all">
                    {#each highlightChar(entry.word, data.character) as part, i}
                      {part}{#if i < highlightChar(entry.word, data.character).length - 1}<span class="text-red-600 underline decoration-red-400 decoration-2 underline-offset-2">{data.character}</span>{/if}
                    {/each}
                  </p>
                  {#if entry.reading && entry.reading !== entry.word}
                    <span class="text-[11px] text-zinc-500 font-mono">【{entry.reading}】</span>
                  {/if}
                </div>
                <!-- English meaning -->
                <p class="text-[11px] text-zinc-600 font-medium leading-normal select-all">
                  {entry.meaning}
                </p>
                <!-- Usage sentence -->
                {#if entry.sentenceJp}
                  <div class="border-t border-zinc-200 pt-1.5 mt-1">
                    <p class="text-xs text-black leading-relaxed select-all">
                      {#each highlightChar(entry.sentenceJp, data.character) as part, i}
                        {part}{#if i < highlightChar(entry.sentenceJp, data.character).length - 1}<span class="text-red-600 font-bold">{data.character}</span>{/if}
                      {/each}
                    </p>
                    <p class="text-[10px] text-zinc-500 italic mt-0.5 select-all">
                      {entry.sentenceEn}
                    </p>
                  </div>
                {/if}
              </div>
            {/each}
          </div>
        {/if}
      </div>

      <!-- Kanji Grid Section -->
      {#if data.common_kanji}
        <div class="space-y-3">
          <div class="flex items-center justify-between pb-1 border-b border-zinc-200">
            <h3 class="text-sm font-bold text-black uppercase tracking-wider">Common Kanji ({data.common_kanji?.length || 0})</h3>
            <span class="text-[10px] text-zinc-550 font-medium">Sorted by strokes • Click to add</span>
          </div>

          {#if sortedCommonKanji.length === 0}
            <div class="text-center py-8 text-zinc-550 text-sm bg-zinc-50 rounded-none border border-zinc-200 border-dashed">
              No common kanji found containing this radical.
            </div>
          {:else}
            <div class="space-y-2">
              {#each sortedCommonKanji as kanji}
                {@const kDetails = kanjiDataMap[kanji]}
                <button
                  onclick={() => addKanjiBlock(kanji)}
                  class="w-full text-left p-3 rounded-none border border-zinc-200 bg-white hover:border-red-650 hover:bg-zinc-50 transition-all flex items-center gap-3 cursor-pointer group"
                  title="Add '{kanji}' to sandbox"
                >
                  <!-- Kanji Char -->
                  <div class="text-3xl font-bold text-black bg-zinc-50 border border-zinc-200 w-12 h-12 flex items-center justify-center group-hover:border-red-650 group-hover:text-red-650 transition-colors">
                    {kanji}
                  </div>
                  <!-- Details -->
                  <div class="flex-1 min-w-0 space-y-0.5">
                    <div class="flex items-center justify-between">
                      <span class="text-xs font-bold text-black truncate">
                        {kDetails?.meanings || 'Kanji Block'}
                      </span>
                      <div class="flex items-center gap-1.5 shrink-0 ml-1">
                        {#if kDetails?.jlpt}
                          <span class="text-[8px] font-mono bg-red-100 text-red-700 px-1 font-bold uppercase">N{kDetails.jlpt}</span>
                        {/if}
                        {#if kDetails?.strokeCount}
                          <span class="text-[8px] font-mono text-zinc-400">{kDetails.strokeCount} strokes</span>
                        {/if}
                      </div>
                    </div>
                    {#if kDetails}
                      <div class="text-[9px] text-zinc-550 truncate font-mono">
                        {#if kDetails.onyomi?.length}
                          <span class="text-red-650 font-semibold">ON:</span> {kDetails.onyomi.slice(0, 2).join(', ')}
                        {/if}
                        {#if kDetails.kunyomi?.length}
                          <span class="text-zinc-600 font-semibold ml-2">KUN:</span> {kDetails.kunyomi.slice(0, 2).join(', ')}
                        {/if}
                      </div>
                    {/if}
                  </div>
                </button>
              {/each}
            </div>
          {/if}
        </div>
      {/if}
    </div>
  </div>
{/if}
