<script>
  import { gridStore, gridActions, getTreeBlockIds, getRootBlockId } from '../stores/gridStore.js';

  let {
    isOpen = false,
    primaryRadical = null,
    radicals = [],
    radicalDataMap = {},
    kanjiDataMap = {},
    onClose = () => {}
  } = $props();

  let selectedSecondChar = $state('');
  let searchDropdownQuery = $state('');
  let isDropdownOpen = $state(false);
  let jlptFilter = $state('all'); // 'all', '5', '4', '3', '2', '1'

  // Reset state when modal opens or primary radical changes
  $effect(() => {
    if (isOpen && primaryRadical) {
      selectedSecondChar = '';
      searchDropdownQuery = '';
      isDropdownOpen = false;
      jlptFilter = 'all';
    }
  });

  let primaryRads = $derived(
    primaryRadical
      ? (primaryRadical.type === 'radical'
          ? [primaryRadical.character]
          : (kanjiDataMap[primaryRadical.character]?.radicals || []))
      : []
  );

  let evolutionCandidates = $derived.by(() => {
    if (!primaryRadical || primaryRads.length === 0) return [];
    
    // Find existing kanjis in this tree to avoid duplicates
    const rootId = getRootBlockId($gridStore, primaryRadical.id);
    const treeIds = getTreeBlockIds($gridStore, rootId);
    const existingKanjis = new Set(
      $gridStore
        .filter(b => b.type === 'kanji' && treeIds.has(b.id))
        .map(b => b.character)
    );

    let candidates = [];
    for (const [kanjiChar, kInfo] of Object.entries(kanjiDataMap)) {
      if (existingKanjis.has(kanjiChar)) continue;
      if (!kInfo.radicals || kInfo.radicals.length === 0) continue;

      const hasAll = primaryRads.every(r => kInfo.radicals.includes(r));
      if (hasAll) {
        const missing = kInfo.radicals.filter(r => !primaryRads.includes(r));
        if (missing.length > 0) {
          candidates.push({
            kanji: kanjiChar,
            diffCount: missing.length
          });
        }
      }
    }

    // Return ALL valid candidates, not just minimum diff
    return candidates.map(c => c.kanji);
  });

  // Filter radicals for selector dropdown
  let filteredSelectorRadicals = $derived(
    radicals.filter(r => {
      if (primaryRads.includes(r.character)) return false;

      // Check if this radical is part of any candidate
      const isValid = evolutionCandidates.some(kanji => {
        const kInfo = kanjiDataMap[kanji];
        return kInfo && kInfo.radicals && kInfo.radicals.includes(r.character);
      });
      if (!isValid) return false;

      const q = searchDropdownQuery.toLowerCase().trim();
      if (!q) return true;
      return (
        r.character.includes(q) ||
        r.meaning.toLowerCase().includes(q) ||
        (r.reading && r.reading.toLowerCase().includes(q))
      );
    })
  );

  let secondRadical = $derived(
    radicals.find(r => r.character === selectedSecondChar)
  );

  let intersectingKanji = $derived.by(() => {
    if (!primaryRadical) return [];

    let base = evolutionCandidates;

    // Filter by selected secondary radical
    if (selectedSecondChar) {
      base = base.filter(kanji => {
        const kInfo = kanjiDataMap[kanji];
        return kInfo && kInfo.radicals && kInfo.radicals.includes(selectedSecondChar);
      });
    }

    // Filter by JLPT level
    if (jlptFilter !== 'all') {
      const level = parseInt(jlptFilter);
      base = base.filter(kanji => {
        const kInfo = kanjiDataMap[kanji];
        return kInfo && (!kInfo.jlpt || kInfo.jlpt >= level);
      });
    }

    // Sort by stroke count
    return [...base].sort((a, b) => {
      const strokeA = kanjiDataMap[a]?.strokeCount ?? 99;
      const strokeB = kanjiDataMap[b]?.strokeCount ?? 99;
      return strokeA - strokeB;
    });
  });

  function selectSecondRadical(char) {
    selectedSecondChar = char;
    isDropdownOpen = false;
    searchDropdownQuery = '';
  }

  function addKanjiBlock(kanji) {
    const res = gridActions.addSpecificCombination(
      primaryRadical.id,
      kanji,
      radicals,
      radicalDataMap,
      kanjiDataMap
    );
    if (res.success) {
      onClose();
    }
  }

  function handleKeydown(e) {
    if (isOpen && e.key === 'Escape') {
      onClose();
    }
  }
</script>

<svelte:window onkeydown={handleKeydown} />

{#if isOpen && primaryRadical}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
  <div 
    class="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 animate-in fade-in duration-200"
    role="dialog"
    aria-modal="true"
    onclick={onClose}
  >
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div 
      class="bg-white border-2 border-red-650 rounded-none w-full max-w-xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 text-black"
      onclick={(e) => e.stopPropagation()}
    >
      <!-- Header -->
      <div class="p-6 border-b border-zinc-200 flex items-center justify-between">
        <div>
          <h2 class="text-xl font-bold text-black tracking-tight font-sans">EVOLUTION COMBINATION SANDBOX</h2>
          <p class="text-xs text-zinc-550 mt-1 font-medium">Combine components to evolve into a more complex Kanji.</p>
        </div>
        <button 
          onclick={onClose}
          class="h-8 w-8 rounded-none flex items-center justify-center text-zinc-500 hover:text-white hover:bg-red-650 transition-colors cursor-pointer"
        >
          ✕
        </button>
      </div>

      <!-- Content -->
      <div class="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-thin scrollbar-thumb-zinc-200">
        <!-- Component selector -->
        <div class="flex flex-col sm:flex-row items-center justify-center gap-4 py-4 bg-zinc-50 border border-zinc-200 rounded-none">
          <!-- Primary Component (Base) -->
          <div class="flex flex-col items-center">
            <span class="text-[10px] text-zinc-550 uppercase tracking-wider font-semibold mb-1">Base</span>
            <div class="text-4xl font-bold text-red-650 bg-white w-16 h-16 rounded-none flex items-center justify-center border border-zinc-200 shadow-inner">
              {primaryRadical.character}
            </div>
            <span class="text-xs text-zinc-700 mt-1 truncate max-w-[120px] font-medium">{primaryRadical.meaning}</span>
          </div>

          <!-- Plus Sign -->
          <div class="text-2xl font-bold text-zinc-400">+</div>

          <!-- Secondary Radical -->
          <div class="flex flex-col items-center relative">
            <span class="text-[10px] text-zinc-550 uppercase tracking-wider font-semibold mb-1">New Radical</span>
            
            <button 
              onclick={() => isDropdownOpen = !isDropdownOpen}
              class="text-4xl font-bold w-16 h-16 rounded-none flex items-center justify-center border transition-all shadow-inner cursor-pointer {selectedSecondChar ? 'text-red-650 border-zinc-200 bg-white hover:border-zinc-300' : 'text-zinc-400 border-zinc-200 border-dashed bg-white/50 hover:text-zinc-650 hover:border-zinc-300'}"
            >
              {selectedSecondChar || '?'}
            </button>

            {#if secondRadical}
              <span class="text-xs text-zinc-700 mt-1 truncate max-w-[120px] font-medium">{secondRadical.meaning}</span>
              <button 
                onclick={() => selectedSecondChar = ''}
                class="absolute -bottom-6 text-[10px] text-red-650 hover:text-red-500 transition-colors uppercase font-bold cursor-pointer"
              >
                Clear
              </button>
            {/if}

            <!-- Dropdown Menu -->
            {#if isDropdownOpen}
              <div class="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-56 rounded-none border border-zinc-200 bg-white p-2 shadow-2xl z-40 flex flex-col max-h-60 overflow-hidden">
                <input
                  type="text"
                  bind:value={searchDropdownQuery}
                  placeholder="Filter radicals..."
                  class="w-full rounded-none border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-xs text-black placeholder-zinc-400 outline-none mb-2 focus:border-red-650"
                />
                <div class="flex-1 overflow-y-auto space-y-0.5 scrollbar-thin">
                  {#each filteredSelectorRadicals as radical}
                    <button
                      onclick={() => selectSecondRadical(radical.character)}
                      class="w-full text-left px-2.5 py-1.5 rounded-none text-xs text-zinc-700 hover:bg-red-650 hover:text-white flex items-center justify-between transition-colors cursor-pointer"
                    >
                      <span class="font-bold text-sm">{radical.character}</span>
                      <span class="text-[10px] text-zinc-550 truncate ml-2 max-w-[120px]">{radical.meaning}</span>
                    </button>
                  {/each}
                </div>
              </div>
            {/if}
          </div>
        </div>

        <!-- Kanji Grid -->
        <div class="space-y-3">
          <div class="flex items-center justify-between">
            <h3 class="text-sm font-bold text-black uppercase tracking-wider">
              {#if selectedSecondChar}
                Combined Kanji ({intersectingKanji.length})
              {:else}
                All Evolutions ({intersectingKanji.length})
              {/if}
            </h3>
            <span class="text-[10px] text-zinc-550 font-medium">Click a kanji to add to grid</span>
          </div>

          <!-- JLPT Filter -->
          <div class="flex items-center gap-1.5">
            <span class="text-[9px] text-zinc-500 uppercase tracking-wider font-semibold mr-1">JLPT:</span>
            {#each ['all', '5', '4', '3', '2', '1'] as level}
              <button
                onclick={() => jlptFilter = level}
                class="px-2 py-0.5 text-[10px] font-bold border transition-all cursor-pointer
                  {jlptFilter === level
                    ? 'bg-red-650 text-white border-red-650'
                    : 'bg-white text-zinc-600 border-zinc-200 hover:border-zinc-400'}"
              >
                {level === 'all' ? 'ALL' : `N${level}`}
              </button>
            {/each}
          </div>

          {#if intersectingKanji.length === 0}
            <div class="text-center py-12 text-zinc-500 text-sm bg-zinc-50 rounded-none border border-zinc-200 border-dashed">
              {#if selectedSecondChar}
                No kanji contain both '{primaryRadical.character}' and '{selectedSecondChar}'.
              {:else if jlptFilter !== 'all'}
                No N{jlptFilter} kanji found for this radical.
              {:else}
                No kanji contain this radical.
              {/if}
            </div>
          {:else}
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {#each intersectingKanji as kanji}
                {@const kDetails = kanjiDataMap[kanji]}
                <button
                  onclick={() => addKanjiBlock(kanji)}
                  class="text-left p-2.5 rounded-none border border-zinc-200 bg-white hover:border-red-650 hover:bg-zinc-50 transition-all flex items-center gap-2.5 cursor-pointer group"
                  title="Add '{kanji}' to grid"
                >
                  <div class="text-2xl font-bold text-black bg-zinc-50 border border-zinc-200 w-10 h-10 flex items-center justify-center group-hover:border-red-650 group-hover:text-red-650 transition-colors">
                    {kanji}
                  </div>
                  <div class="flex-1 min-w-0 space-y-0.5">
                    <div class="flex items-center justify-between">
                      <span class="text-[11px] font-bold text-black truncate">
                        {kDetails?.meanings || 'Kanji Block'}
                      </span>
                      <div class="flex items-center gap-1.5 shrink-0 ml-1">
                        {#if kDetails?.jlpt}
                          <span class="text-[8px] font-mono bg-red-100 text-red-700 px-1 font-bold uppercase">N{kDetails.jlpt}</span>
                        {/if}
                        {#if kDetails?.strokeCount}
                          <span class="text-[8px] font-mono text-zinc-400">{kDetails.strokeCount}s</span>
                        {/if}
                      </div>
                    </div>
                    {#if kDetails}
                      <div class="text-[8px] text-zinc-500 truncate font-mono">
                        {#if kDetails.onyomi?.length}
                          <span class="text-red-650 font-semibold">ON:</span> {kDetails.onyomi.slice(0, 1).join(', ')}
                        {/if}
                        {#if kDetails.kunyomi?.length}
                          <span class="text-zinc-600 font-semibold ml-1.5">KUN:</span> {kDetails.kunyomi.slice(0, 1).join(', ')}
                        {/if}
                      </div>
                    {/if}
                  </div>
                </button>
              {/each}
            </div>
          {/if}
        </div>
      </div>
    </div>
  </div>
{/if}
