<script>
  import { gridStore, gridActions, getAvailableEvolutions } from '../stores/gridStore.js';
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
    if (isFirst) {
      onHoverFirst(false);
    }
  }

  function handlePointerDown(e) {
    if (e.target.closest('button')) return;
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
    const list = blockData?.common_kanji || [];
    if (list.length > 0) {
      const randomKanji = list[Math.floor(Math.random() * list.length)];
      const res = gridActions.addSpecificCombination(cell.id, randomKanji, radicals, radicalDataMap, kanjiDataMap);
      if (!res.success) {
        onShowNotification(res.message);
      }
    } else {
      onShowNotification("No common kanji associated with this radical.");
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
        class="absolute -left-[240px] -right-[70px] -top-[70px] -bottom-[70px] z-0 bg-transparent pointer-events-auto cursor-default"
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

      <!-- First tag -->
      {#if isFirst}
        <span class="absolute top-2 left-2 text-[8px] font-bold uppercase tracking-wider text-red-500 bg-black px-1.5 py-0.5 rounded-none border border-red-650/40">
          Start
        </span>
      {/if}

      <!-- Large Character -->
      <div class="text-4xl font-bold font-sans tracking-tight mt-1">
        {cell.character}
      </div>

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
