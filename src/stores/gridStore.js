import { writable } from 'svelte/store';

// Grid layout parameters
export const CELL_SIZE = 120; // Size of each cell in pixels

// Create initial empty grid state
export const gridStore = writable([]); // Array of blocks: { id, type, character, x, y, addedAt, parentId, triggeredById, data }
export const radicalData = writable({});
export const radicalList = writable([]);

// Helper to find an empty spot spirally around a starting coordinate
export function findEmptyCoords(blocks, startX, startY) {
  let radius = 0;
  while (true) {
    for (let dx = -radius; dx <= radius; dx++) {
      for (let dy = -radius; dy <= radius; dy++) {
        const x = startX + dx;
        const y = startY + dy;
        if (x >= 0 && x < 33 && y >= 0 && y < 33) {
          if (!blocks.some(b => b.x === x && b.y === y)) {
            return { x, y };
          }
        }
      }
    }
    radius++;
    if (radius > 30) return { x: startX, y: startY };
  }
}

// Helper to get all block IDs belonging to the tree rooted at rootId
export function getTreeBlockIds(currentBlocks, rootId) {
  const ids = new Set([rootId]);
  let addedNew = true;
  while (addedNew) {
    addedNew = false;
    for (const b of currentBlocks) {
      if (b.parentId && ids.has(b.parentId) && !ids.has(b.id)) {
        ids.add(b.id);
        addedNew = true;
      }
    }
  }
  return ids;
}

// Helper to find the root block ID of a given block
export function getRootBlockId(currentBlocks, blockId) {
  let current = currentBlocks.find(b => b.id === blockId);
  while (current && current.parentId) {
    const parent = currentBlocks.find(b => b.id === current.parentId);
    if (!parent) break;
    current = parent;
  }
  return current ? current.id : blockId;
}

// Helper to get all constituent radicals that formed/reached a block
export function getBlockConstituentRadicals(currentBlocks, block, kanjiDataMap) {
  if (!block) return [];
  if (block.type === 'kanji') {
    return kanjiDataMap[block.character]?.radicals || [];
  }
  // If it's a radical block:
  if (!block.parentId) {
    return [block.character];
  }
  const parent = currentBlocks.find(b => b.id === block.parentId);
  if (parent) {
    const parentRadicals = getBlockConstituentRadicals(currentBlocks, parent, kanjiDataMap);
    const result = [...parentRadicals];
    if (!result.includes(block.character)) {
      result.push(block.character);
    }
    return result;
  }
  return [block.character];
}

// Check if a block can evolve, and get the list of candidate evolutions (radical + target kanji)
export function getAvailableEvolutions(currentBlocks, block, radicalDataMap, kanjiDataMap) {
  const blockRadicals = getBlockConstituentRadicals(currentBlocks, block, kanjiDataMap);
  if (blockRadicals.length === 0) return [];

  // Find existing kanjis in this tree to avoid duplicates
  const rootId = getRootBlockId(currentBlocks, block.id);
  const treeIds = getTreeBlockIds(currentBlocks, rootId);
  const existingKanjis = new Set(
    currentBlocks
      .filter(b => b.type === 'kanji' && treeIds.has(b.id))
      .map(b => b.character)
  );

  let candidates = [];
  for (const [kanjiChar, kInfo] of Object.entries(kanjiDataMap)) {
    if (existingKanjis.has(kanjiChar)) continue;
    if (!kInfo.radicals || kInfo.radicals.length === 0) continue;

    const hasAll = blockRadicals.every(r => kInfo.radicals.includes(r));
    if (hasAll) {
      const missing = kInfo.radicals.filter(r => !blockRadicals.includes(r));
      if (missing.length > 0) {
        candidates.push({
          kanji: kanjiChar,
          missingRadicals: missing,
          diffCount: missing.length
        });
      }
    }
  }

  if (candidates.length === 0) return [];

  // Find the minimum number of missing radicals
  const minDiff = Math.min(...candidates.map(c => c.diffCount));

  // Only keep candidates with the minimum diff count
  const bestCandidates = candidates.filter(c => c.diffCount === minDiff);

  return bestCandidates.map(c => {
    const firstMissing = c.missingRadicals[0];
    const rDetails = radicalDataMap[firstMissing];
    return {
      radical: { character: firstMissing, meaning: rDetails?.meaning || 'Radical' },
      kanji: c.kanji,
      missingRadicals: c.missingRadicals
    };
  });
}

// Custom actions for the grid sandbox
export const gridActions = {
  // Add a block to the grid
  addBlock(type, character, data, radicalDataMap = {}, parentId = null) {
    let result = { success: true, message: '' };

    gridStore.update(currentBlocks => {
      // Find the parent block if parentId is provided
      const parentBlock = parentId ? currentBlocks.find(b => b.id === parentId) : null;

      // Prevent duplicate kanji under the same starting point
      if (type === 'kanji' && parentId) {
        const exists = currentBlocks.some(b => b.type === 'kanji' && b.parentId === parentId && b.character === character);
        if (exists) {
          result = { success: false, message: 'This Kanji is already on the grid.' };
          return currentBlocks;
        }
      }

      // If parentBlock exists, position around it. Otherwise, position around the oldest radical or center.
      let startX = 16;
      let startY = 16;
      if (parentBlock) {
        startX = parentBlock.x;
        startY = parentBlock.y;
      } else {
        const rootRadical = currentBlocks
          .filter(b => b.type === 'radical')
          .sort((a, b) => a.addedAt - b.addedAt)[0];
        if (rootRadical) {
          startX = rootRadical.x;
          startY = rootRadical.y;
        }
      }

      // Find coordinate for main block
      const mainCoords = findEmptyCoords(currentBlocks, startX, startY);
      const addedAt = Date.now();
      const mainBlockId = Math.random().toString(36).substring(2, 9);
      
      const newMainBlock = {
        id: mainBlockId,
        type,
        character,
        x: mainCoords.x,
        y: mainCoords.y,
        addedAt,
        parentId: parentBlock ? parentBlock.id : null,
        triggeredById: null,
        data
      };

      let newBlocks = [...currentBlocks, newMainBlock];

      // If we just added a radical block and there was a parent block, automatically form a kanji block!
      if (type === 'radical' && parentBlock) {
        const parentDetails = radicalDataMap[parentBlock.character] || {};
        const parentKanjiList = parentDetails.common_kanji || [];

        const addedDetails = radicalDataMap[character] || {};
        const addedKanjiList = addedDetails.common_kanji || [];

        const parentSet = new Set(parentKanjiList);
        const intersection = addedKanjiList.filter(k => parentSet.has(k));

        // Find existing kanjis on grid under this parent radical
        const existingKanjis = new Set(
          currentBlocks
            .filter(b => b.type === 'kanji' && b.parentId === parentBlock.id)
            .map(b => b.character)
        );

        // Find the first intersecting kanji that is not already on the board under this parent
        const formedKanji = intersection.find(k => !existingKanjis.has(k));

        if (formedKanji) {
          // Find coordinate for the new kanji block
          const kanjiCoords = findEmptyCoords(newBlocks, mainCoords.x, mainCoords.y);
          const kanjiBlockId = Math.random().toString(36).substring(2, 9);

          const newKanjiBlock = {
            id: kanjiBlockId,
            type: 'kanji',
            character: formedKanji,
            x: kanjiCoords.x,
            y: kanjiCoords.y,
            addedAt: addedAt + 1,
            parentId: parentBlock.id,
            triggeredById: mainBlockId,
            data: { character: formedKanji }
          };

          newBlocks.push(newKanjiBlock);
        }
      }

      return newBlocks;
    });

    return result;
  },

  // Combine starting radical with a random radical to form a new, non-duplicate kanji
  addRandomCombinedBlock(radicalListArray, radicalDataMap, kanjiDataMap = {}, startingBlockId = null) {
    let result = { success: true, message: '' };

    gridStore.update(currentBlocks => {
      // Find starting radicals: either the custom startingBlockId or root/starting radicals on screen (newest first)
      const startBlocks = startingBlockId 
        ? [currentBlocks.find(b => b.id === startingBlockId)].filter(Boolean)
        : currentBlocks
            .filter(b => b.type === 'radical' && b.parentId === null)
            .sort((a, b) => b.addedAt - a.addedAt);

      // If no starting radical on screen, add a completely random radical as the root node
      if (startBlocks.length === 0) {
        if (radicalListArray.length === 0) {
          result = { success: false, message: 'No radicals available.' };
          return currentBlocks;
        }
        const randomItem = radicalListArray[Math.floor(Math.random() * radicalListArray.length)];
        const mainCoords = findEmptyCoords(currentBlocks, 16, 16);
        const mainBlockId = Math.random().toString(36).substring(2, 9);
        const newMainBlock = {
          id: mainBlockId,
          type: 'radical',
          character: randomItem.character,
          x: mainCoords.x,
          y: mainCoords.y,
          addedAt: Date.now(),
          parentId: null,
          triggeredById: null,
          data: randomItem
        };
        return [...currentBlocks, newMainBlock];
      }

      // Check candidate combinations for the startBlocks
      let chosenStartBlock = null;
      let chosenCandidates = [];

      for (const block of startBlocks) {
        const rootDetails = radicalDataMap[block.character] || {};
        const rootKanjiList = rootDetails.common_kanji || [];

        // Find all kanji characters already present on the grid under this starting radical
        const treeIds = getTreeBlockIds(currentBlocks, block.id);
        const existingKanjis = new Set(
          currentBlocks
            .filter(b => b.type === 'kanji' && (treeIds.has(b.id) || b.parentId === block.id))
            .map(b => b.character)
        );

        const availableKanjis = rootKanjiList.filter(k => !existingKanjis.has(k));
        if (availableKanjis.length === 0) continue;

        const blockCandidates = [];
        for (const matchedKanji of availableKanjis) {
          const kInfo = kanjiDataMap[matchedKanji];
          if (kInfo && kInfo.radicals && kInfo.radicals.length === 2) {
            if (kInfo.radicals.includes(block.character)) {
              const otherRadicalChar = kInfo.radicals.find(r => r !== block.character);
              if (otherRadicalChar) {
                const radicalItem = radicalListArray.find(r => r.character === otherRadicalChar) || {
                  character: otherRadicalChar,
                  meaning: radicalDataMap[otherRadicalChar]?.meaning || 'Radical',
                  onyomi: radicalDataMap[otherRadicalChar]?.onyomi || [],
                  kunyomi: radicalDataMap[otherRadicalChar]?.kunyomi || [],
                  stroke_count: 1
                };
                blockCandidates.push({ radical: radicalItem, kanji: matchedKanji });
              }
            }
          }
        }

        if (blockCandidates.length > 0) {
          chosenStartBlock = block;
          chosenCandidates = blockCandidates;
          break; // Found one!
        }
      }

      if (!chosenStartBlock || chosenCandidates.length === 0) {
        result = { 
          success: false, 
          message: 'All 2-component Kanjis for starting radicals are on the grid! Evolve existing blocks to form more complex ones.' 
        };
        return currentBlocks;
      }

      // Choose a random valid candidate
      const chosen = chosenCandidates[Math.floor(Math.random() * chosenCandidates.length)];

      const mainCoords = findEmptyCoords(currentBlocks, chosenStartBlock.x, chosenStartBlock.y);
      const addedAt = Date.now();
      const mainBlockId = Math.random().toString(36).substring(2, 9);
      
      const newMainBlock = {
        id: mainBlockId,
        type: 'radical',
        character: chosen.radical.character,
        x: mainCoords.x,
        y: mainCoords.y,
        addedAt,
        parentId: chosenStartBlock.id,
        triggeredById: null,
        data: chosen.radical
      };

      const kanjiCoords = findEmptyCoords([...currentBlocks, newMainBlock], mainCoords.x, mainCoords.y);
      const kanjiBlockId = Math.random().toString(36).substring(2, 9);

      const newKanjiBlock = {
        id: kanjiBlockId,
        type: 'kanji',
        character: chosen.kanji,
        x: kanjiCoords.x,
        y: kanjiCoords.y,
        addedAt: addedAt + 1,
        parentId: chosenStartBlock.id,
        triggeredById: mainBlockId,
        data: { character: chosen.kanji }
      };

      return [...currentBlocks, newMainBlock, newKanjiBlock];
    });

    return result;
  },

  // Evolve a radical or kanji block by combining it with a random radical to form the next level kanji
  evolveBlock(blockId, radicalListArray, radicalDataMap, kanjiDataMap) {
    let result = { success: true, message: '' };

    gridStore.update(currentBlocks => {
      const block = currentBlocks.find(b => b.id === blockId);
      if (!block) {
        result = { success: false, message: 'Block not found.' };
        return currentBlocks;
      }

      const candidates = getAvailableEvolutions(
        currentBlocks, 
        block, 
        radicalDataMap, 
        kanjiDataMap
      );

      if (candidates.length === 0) {
        result = { success: false, message: 'This block has reached its final form and cannot evolve any further!' };
        return currentBlocks;
      }

      // Choose a random candidate
      const chosen = candidates[Math.floor(Math.random() * candidates.length)];

      const missingRadicals = chosen.missingRadicals || [chosen.radical.character];
      
      let newBlocks = [...currentBlocks];
      let addedRadicalIds = [];
      const addedAt = Date.now();

      for (let i = 0; i < missingRadicals.length; i++) {
        const radChar = missingRadicals[i];
        const radicalItem = radicalListArray.find(r => r.character === radChar) || {
          character: radChar,
          meaning: radicalDataMap[radChar]?.meaning || 'Radical',
          onyomi: radicalDataMap[radChar]?.onyomi || [],
          kunyomi: radicalDataMap[radChar]?.kunyomi || [],
          stroke_count: 1
        };

        const mainCoords = findEmptyCoords(newBlocks, block.x, block.y);
        const mainBlockId = Math.random().toString(36).substring(2, 9);
        
        const newMainBlock = {
          id: mainBlockId,
          type: 'radical',
          character: radChar,
          x: mainCoords.x,
          y: mainCoords.y,
          addedAt: addedAt + i * 10,
          parentId: block.id,
          triggeredById: null,
          data: radicalItem
        };

        newBlocks.push(newMainBlock);
        addedRadicalIds.push(mainBlockId);
      }

      // Add the kanji block
      const kanjiCoords = findEmptyCoords(newBlocks, block.x, block.y);
      const kanjiBlockId = Math.random().toString(36).substring(2, 9);

      const newKanjiBlock = {
        id: kanjiBlockId,
        type: 'kanji',
        character: chosen.kanji,
        x: kanjiCoords.x,
        y: kanjiCoords.y,
        addedAt: addedAt + (missingRadicals.length || 1) * 10,
        parentId: block.id,
        triggeredById: addedRadicalIds[addedRadicalIds.length - 1] || null,
        triggeredByIds: addedRadicalIds,
        data: { character: chosen.kanji }
      };

      newBlocks.push(newKanjiBlock);
      return newBlocks;
    });

    return result;
  },

  // Add a specific combination (radical(s) + kanji) under a parent block, automatically adding all missing radicals
  addSpecificCombination(parentBlockId, kanjiChar, radicalListArray, radicalDataMap, kanjiDataMap) {
    let result = { success: true, message: '' };

    gridStore.update(currentBlocks => {
      const parent = currentBlocks.find(b => b.id === parentBlockId);
      if (!parent) {
        result = { success: false, message: 'Parent block not found.' };
        return currentBlocks;
      }

      // Check if this kanji already exists in this tree to avoid duplicates
      const rootId = getRootBlockId(currentBlocks, parent.id);
      const treeIds = getTreeBlockIds(currentBlocks, rootId);
      const exists = currentBlocks.some(b => b.type === 'kanji' && treeIds.has(b.id) && b.character === kanjiChar);
      if (exists) {
        result = { success: false, message: 'This Kanji is already on the grid.' };
        return currentBlocks;
      }

      // Get current radicals of the parent block
      const baseRadicals = getBlockConstituentRadicals(currentBlocks, parent, kanjiDataMap);

      // Get target radicals of the kanji
      const targetRadicals = kanjiDataMap[kanjiChar]?.radicals || [];

      // Find missing radicals
      const missingRadicals = targetRadicals.filter(r => !baseRadicals.includes(r));
      
      let newBlocks = [...currentBlocks];
      let addedRadicalIds = [];
      let addedAt = Date.now();

      if (missingRadicals.length > 0) {
        // Add each missing radical block
        for (let i = 0; i < missingRadicals.length; i++) {
          const radChar = missingRadicals[i];
          const radicalItem = radicalListArray.find(r => r.character === radChar) || {
            character: radChar,
            meaning: radicalDataMap[radChar]?.meaning || 'Radical',
            onyomi: radicalDataMap[radChar]?.onyomi || [],
            kunyomi: radicalDataMap[radChar]?.kunyomi || [],
            stroke_count: 1
          };

          const mainCoords = findEmptyCoords(newBlocks, parent.x, parent.y);
          const mainBlockId = Math.random().toString(36).substring(2, 9);
          
          const newMainBlock = {
            id: mainBlockId,
            type: 'radical',
            character: radChar,
            x: mainCoords.x,
            y: mainCoords.y,
            addedAt: addedAt + i * 10,
            parentId: parent.id,
            triggeredById: null,
            data: radicalItem
          };

          newBlocks.push(newMainBlock);
          addedRadicalIds.push(mainBlockId);
        }
      }

      // Add the kanji block
      const kanjiCoords = findEmptyCoords(newBlocks, parent.x, parent.y);
      const kanjiBlockId = Math.random().toString(36).substring(2, 9);

      const newKanjiBlock = {
        id: kanjiBlockId,
        type: 'kanji',
        character: kanjiChar,
        x: kanjiCoords.x,
        y: kanjiCoords.y,
        addedAt: addedAt + (missingRadicals.length || 1) * 10,
        parentId: parent.id,
        triggeredById: addedRadicalIds[addedRadicalIds.length - 1] || null,
        triggeredByIds: addedRadicalIds,
        data: { character: kanjiChar }
      };

      newBlocks.push(newKanjiBlock);
      return newBlocks;
    });

    return result;
  },

  // Move a block to new grid coordinates
  moveBlock(id, newX, newY) {
    gridStore.update(currentBlocks => {
      const isOccupied = currentBlocks.some(b => b.id !== id && b.x === newX && b.y === newY);
      if (isOccupied) {
        return currentBlocks; // Prevent overlap
      }
      return currentBlocks.map(b => {
        if (b.id === id) {
          return { ...b, x: newX, y: newY };
        }
        return b;
      });
    });
  },

  // Remove a block and any dependent kanji blocks spawned by it
  removeBlock(id) {
    gridStore.update(currentBlocks => {
      // Filter out the deleted block, and any kanji blocks that were triggered by it or listed in triggeredByIds
      return currentBlocks.filter(b => {
        if (b.id === id) return false;
        if (b.triggeredById === id) return false;
        if (b.triggeredByIds && b.triggeredByIds.includes(id)) return false;
        return true;
      });
    });
  },

  // Clear the entire sandbox
  clearGrid() {
    gridStore.set([]);
  }
};
