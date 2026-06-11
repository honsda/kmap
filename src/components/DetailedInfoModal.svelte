<script>
  import { gridActions, radicalList, radicalData } from '../stores/gridStore.js';

  let {
    isOpen = false,
    data = null,
    kanjiDataMap = {},
    onClose = () => {}
  } = $props();

  function addKanjiBlock(kanji) {
    const kInfo = kanjiDataMap[kanji];
    if (kInfo && kInfo.radicals && data?.type === 'radical') {
      const addedRadicalChar = kInfo.radicals.find(r => r !== data.character);
      if (addedRadicalChar) {
        const res = gridActions.addSpecificCombination(
          data.id,
          addedRadicalChar,
          kanji,
          $radicalList,
          $radicalData
        );
        if (res.success) {
          onClose();
        }
        return;
      }
    }
    gridActions.addBlock('kanji', kanji, { character: kanji }, {}, data?.id);
    onClose();
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

  let sentences = $state([]);
  let loadingSentences = $state(false);

  $effect(() => {
    if (isOpen && data && data.character) {
      fetchSentences(data.character);
    } else {
      sentences = [];
    }
  });

  async function fetchSentences(char) {
    sentences = [];
    loadingSentences = true;
    try {
      const targetUrl = `https://tatoeba.org/en/api_v0/search?from=jpn&to=eng&query=${encodeURIComponent(char)}`;
      const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(targetUrl)}`;
      const res = await fetch(proxyUrl);
      if (!res.ok) throw new Error('Network error');
      const result = await res.json();
      const json = JSON.parse(result.contents);
      
      if (json.results && json.results.length > 0) {
        sentences = json.results.slice(0, 2).map(item => {
          const jpnText = item.text;
          const engText = item.translations && item.translations.length > 0 
            ? item.translations[0].map(t => t.text).join(' | ') 
            : 'No translation available';
          return { japanese: jpnText, english: engText };
        });
      } else {
        sentences = [];
      }
    } catch (err) {
      console.error('Failed to fetch example sentences:', err);
      sentences = [];
    } finally {
      loadingSentences = false;
    }
  }
</script>

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
          <h2 class="text-xl font-bold text-black tracking-tight">{data.meaning.toUpperCase()}</h2>
          <p class="text-[11px] text-zinc-550 mt-1 font-medium">Radical Details & Constituent Kanji</p>
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
          <span class="text-zinc-800 font-mono text-sm block mt-1 font-bold">
            {data.onyomi && data.onyomi.length > 0 ? data.onyomi.join(', ') : '—'}
          </span>
        </div>
        <div>
          <span class="text-zinc-500 font-semibold text-[9px] uppercase tracking-wider block">Kunyomi</span>
          <span class="text-zinc-800 font-mono text-sm block mt-1 font-bold">
            {data.kunyomi && data.kunyomi.length > 0 ? data.kunyomi.join(', ') : '—'}
          </span>
        </div>
      </div>

      <!-- Example Sentences Section -->
      <div class="space-y-3 pb-1 border-b border-zinc-200">
        <h3 class="text-xs font-bold text-black uppercase tracking-wider">Example Sentences</h3>
        
        {#if loadingSentences}
          <div class="flex items-center gap-2 py-4 text-[11px] text-zinc-500 font-medium">
            <span class="h-3 w-3 rounded-full border border-zinc-350 border-t-red-650 animate-spin"></span>
            Loading examples from Tatoeba...
          </div>
        {:else if sentences.length === 0}
          <div class="text-[11px] text-zinc-550 italic py-2">
            No example sentences available for this character.
          </div>
        {:else}
          <div class="space-y-2.5">
            {#each sentences as sentence}
              <div class="bg-zinc-50 border border-zinc-200 p-3 rounded-none space-y-1">
                <!-- Japanese text -->
                <p class="text-xs font-bold text-black tracking-normal leading-relaxed select-all">
                  {sentence.japanese}
                </p>
                <!-- English translation -->
                <p class="text-[10px] text-zinc-655 font-medium leading-normal select-all">
                  {sentence.english}
                </p>
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
