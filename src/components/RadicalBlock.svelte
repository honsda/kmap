<script>
  import { gridStore, gridActions, getAvailableEvolutions, globalJlptFilter } from '../stores/gridStore.js';
  import Tooltip from './Tooltip.svelte';
  import FloatingMenu from './FloatingMenu.svelte';

  let {
    cell = null,
    radicals = [],
    radicalDataMap = {},
    kanjiDataMap = {},
    onOpenDetails = () => {},
    onOpenCombination = () => {},
    onShowNotification = () => {},
    isFirst = false,
    onHoverFirst = () => {},
    onStartDrag = () => {},
    onHoverBlock = () => {},
    onLeaveBlock = () => {}
  } = $props();

  let isHovered = $state(false);
  let hoveredBadgeChar = $state(null);
  let hoverTimeout;

  function handleMouseEnter() {
    clearTimeout(hoverTimeout);
    isHovered = true;
    onHoverBlock(cell.id);
    if (isFirst) {
      onHoverFirst(true);
    }
  }

  function handleMouseLeave() {
    onLeaveBlock();
    isHovered = false;
    hoveredBadgeChar = null;
    if (isFirst) {
      onHoverFirst(false);
    }
  }

  function handlePointerDown(e) {
    if (e.target.closest('button')) return;
    if (e.target.closest('.radical-badge')) return;
    e.preventDefault();
    onStartDrag(cell.id, e);
  }

  function removeCell(e) {
    e.stopPropagation();
    gridActions.removeBlock(cell.id);
  }

  // Get full radical data if type is radical
  let blockData = $derived.by(() => {
    if (cell.type !== 'radical') return null;
    const details = radicalDataMap[cell.character] || {};
    const item = radicals.find(r => r.character === cell.character) || {};
    const kanjiInfo = kanjiDataMap[cell.character] || {};
    return {
      id: cell.id,
      type: 'radical',
      character: cell.character,
      meaning: details.meaning || item.meaning || 'Unknown',
      onyomi: details.onyomi || item.onyomi || [],
      kunyomi: details.kunyomi || item.kunyomi || [],
      stroke_count: item.stroke_count || 1,
      common_kanji: details.common_kanji || [],
      jlpt: kanjiInfo.jlpt || null
    };
  });

  // Kanji block data (full readings from kanjiDataMap)
  let kanjiData = $derived.by(() => {
    if (cell.type !== 'kanji') return null;
    const details = kanjiDataMap[cell.character];
    if (details) {
      return {
        id: cell.id,
        type: 'kanji',
        character: cell.character,
        meaning: details.meanings || 'Unknown',
        onyomi: details.onyomi || [],
        kunyomi: details.kunyomi || [],
        stroke_count: details.strokeCount || 1,
        jlpt: details.jlpt || null
      };
    }
    return {
      id: cell.id,
      type: 'kanji',
      character: cell.character,
      meaning: 'Kanji block',
      onyomi: [],
      kunyomi: [],
      stroke_count: 0,
      jlpt: null
    };
  });

  // Compute added radicals: difference between this block's radicals and parent's radicals
  let addedRadicals = $derived.by(() => {
    if (!cell.parentId) return [];
    const parent = $gridStore.find(b => b.id === cell.parentId);
    if (!parent) return [];

    const parentRads = parent.type === 'radical'
      ? [parent.character]
      : (kanjiDataMap[parent.character]?.radicals || []);

    const myRads = cell.type === 'radical'
      ? [cell.character]
      : (kanjiDataMap[cell.character]?.radicals || []);

    const parentCounts = {};
    for (const r of parentRads) {
      parentCounts[r] = (parentCounts[r] || 0) + 1;
    }

    const added = [];
    for (const r of myRads) {
      if (parentCounts[r] > 0) {
        parentCounts[r]--;
      } else {
        added.push(r);
      }
    }
    return added;
  });

  // Build full data object for a radical character (for opening details)
  function getRadicalData(radChar) {
    const details = radicalDataMap[radChar] || {};
    const item = radicals.find(r => r.character === radChar) || {};
    const kanjiInfo = kanjiDataMap[radChar] || {};
    return {
      id: cell.id,
      type: 'radical',
      character: radChar,
      meaning: details.meaning || item.meaning || 'Unknown',
      onyomi: details.onyomi || item.onyomi || [],
      kunyomi: details.kunyomi || item.kunyomi || [],
      stroke_count: item.stroke_count || 1,
      common_kanji: details.common_kanji || [],
      jlpt: kanjiInfo.jlpt || null
    };
  }

  function handleBadgeClick(e, radChar) {
    e.stopPropagation();
    onOpenDetails(getRadicalData(radChar));
  }

  // Derived state to check if block can evolve further
  let canEvolve = $derived.by(() => {
    return getAvailableEvolutions($gridStore, cell, radicalDataMap, kanjiDataMap).length > 0;
  });

  // Action callbacks
  function triggerDetails() {
    if (cell.type === 'radical') {
      onOpenDetails(blockData);
    } else if (cell.type === 'kanji') {
      onOpenDetails(kanjiData);
    }
  }

  function triggerCombination() {
    if (cell.type === 'radical') {
      onOpenCombination(blockData);
    } else if (cell.type === 'kanji') {
      onOpenCombination(kanjiData);
    }
  }

  function addRandomRadical() {
    const res = gridActions.evolveBlock(cell.id, radicals, radicalDataMap, kanjiDataMap);
    if (!res.success) {
      onShowNotification(res.message);
    }
  }

  function addRandomKanji() {
    let list = blockData?.common_kanji || [];

    // Filter by JLPT if active
    if ($globalJlptFilter !== 'all') {
      const level = parseInt($globalJlptFilter);
      list = list.filter(k => kanjiDataMap[k]?.jlpt >= level);
    }

    if (list.length > 0) {
      const randomKanji = list[Math.floor(Math.random() * list.length)];
      const res = gridActions.addSpecificCombination(cell.id, randomKanji, radicals, radicalDataMap, kanjiDataMap);
      if (!res.success) {
        onShowNotification(res.message);
      }
    } else {
      onShowNotification($globalJlptFilter === 'all' 
        ? "No common kanji associated with this radical." 
        : `No N${$globalJlptFilter} kanji associated with this radical.`);
    }
  }
</script>

<div 
  class="relative w-full h-full select-none group radical-block-container cursor-grab active:cursor-grabbing"
  onmouseenter={handleMouseEnter}
  onmouseleave={handleMouseLeave}
  onpointerdown={handlePointerDown}
  role="presentation"
>
  {#if cell.type === 'empty'}
    <!-- Empty cell placeholder -->
    <div class="w-full h-full rounded-none border border-dashed border-zinc-800 bg-[#18181b]/30 transition-all duration-300 flex items-center justify-center text-zinc-750">
      <svg class="w-5 h-5 opacity-20" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
        <path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
      </svg>
    </div>
  {:else}
    <!-- Filled block -->
    {#if isHovered}
      <div 
        class="absolute -left-[210px] -right-[30px] -top-[30px] -bottom-[30px] z-0 bg-transparent pointer-events-auto cursor-default"
      ></div>
    {/if}

    <div
      onclick={triggerDetails}
      onkeydown={(e) => (e.key === 'Enter' || e.key === ' ') && triggerDetails()}
      tabindex="0"
      role="button"
      class="w-full h-full rounded-none border text-left p-4 flex flex-col justify-between transition-all duration-150 relative z-10
      {cell.type === 'radical' 
        ? (isFirst 
            ? 'border-red-600 bg-white text-black ring-1 ring-red-650/40 hover:border-red-500'
            : 'border-zinc-800 bg-black text-white hover:border-red-650')
        : 'border-zinc-300 bg-white text-black hover:border-black hover:bg-white'}"
    >
      <!-- Delete button -->
      <button
        onclick={removeCell}
        class="absolute top-2 right-2 flex h-5 w-5 items-center justify-center bg-red-600 hover:bg-red-500 text-white opacity-0 group-hover:opacity-100 transition-opacity rounded-none z-20 cursor-pointer text-[10px] font-bold border border-red-600 hover:border-red-500 shadow-md select-none"
        title="Remove"
      >
        除
      </button>

      <!-- Large Character -->
      <div class="text-4xl font-bold font-sans tracking-tight mt-1">
        {cell.character}
      </div>

      <!-- Vertical Kunyomi -->
      {#if cell.type === 'radical' && blockData?.kunyomi?.length > 0}
        <div class="absolute right-1.5 top-2 bottom-6 text-[9px] font-mono opacity-40 overflow-hidden flex justify-start pt-1 tracking-widest pointer-events-none" style="writing-mode: vertical-rl; text-orientation: upright;">
          {blockData.kunyomi[0]}
        </div>
      {:else if cell.type === 'kanji' && kanjiData?.kunyomi?.length > 0}
        <div class="absolute right-1.5 top-2 bottom-6 text-[9px] font-mono opacity-40 overflow-hidden flex justify-start pt-1 tracking-widest pointer-events-none" style="writing-mode: vertical-rl; text-orientation: upright;">
          {kanjiData.kunyomi[0]}
        </div>
      {/if}

      <!-- Footer Badge -->
      <div class="flex items-center justify-between w-full mt-1">
        <span class="text-[9px] uppercase tracking-wider font-semibold opacity-60">
          {cell.type}
        </span>
        {#if cell.type === 'radical' && blockData}
          <span class="text-[9px] font-mono opacity-50 truncate max-w-[50px]">
            {blockData.meaning}
          </span>
        {/if}
      </div>
    </div>

    <!-- Added Radicals Indicator Badges (bottom-left corner of child blocks) -->
    {#if addedRadicals.length > 0}
      <div class="absolute -bottom-3 left-0.5 flex gap-0.5 z-30">
        {#each addedRadicals as radChar}
          <button
            class="radical-badge relative flex items-center justify-center w-6 h-6 text-[11px] font-bold border cursor-pointer transition-all duration-100 select-none bg-zinc-900 text-red-400 border-zinc-600 hover:bg-zinc-800 hover:border-red-500 hover:text-red-300"
            title="{radicalDataMap[radChar]?.meaning || 'Radical'}: {radChar}"
            onclick={(e) => handleBadgeClick(e, radChar)}
            onmouseenter={() => hoveredBadgeChar = radChar}
            onmouseleave={() => hoveredBadgeChar = null}
          >
            {radChar}
          </button>
        {/each}
        <!-- Badge tooltip (positioned above the badge row) -->
        {#if hoveredBadgeChar}
          <div class="absolute bottom-full left-0 mb-1 z-50 px-2 py-1 bg-zinc-900 border border-zinc-600 text-[10px] text-zinc-200 whitespace-nowrap pointer-events-none">
            <span class="text-red-400 font-bold">{hoveredBadgeChar}</span>
            <span class="text-zinc-400 ml-1">{radicalDataMap[hoveredBadgeChar]?.meaning || 'Radical'}</span>
          </div>
        {/if}
      </div>
    {/if}

    <!-- Tooltip -->
    {#if cell.type === 'radical'}
      <Tooltip data={blockData} visible={isHovered} />
    {:else}
      <Tooltip data={kanjiData} visible={isHovered} />
    {/if}

    <!-- Floating action box -->
    {#if cell.type === 'radical' || cell.type === 'kanji'}
      <FloatingMenu 
        visible={isHovered} 
        {canEvolve}
        isKanji={cell.type === 'kanji'}
        onAddSpecific={triggerCombination}
        onAddRandomRadical={addRandomRadical}
        onAddRandomKanji={addRandomKanji}
      />
    {/if}
  {/if}
</div>
