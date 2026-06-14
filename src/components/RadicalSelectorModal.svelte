<script>
  let {
    isOpen = false,
    radicals = [],
    onClose = () => {},
    onSelect = (radical) => {}
  } = $props();

  let searchQuery = $state('');

  let filteredRadicals = $derived(
    radicals.filter(r => {
      const q = searchQuery.toLowerCase().trim();
      if (!q) return true;
      return (
        r.character.includes(q) ||
        (r.original_character && r.original_character.includes(q)) ||
        r.meaning.toLowerCase().includes(q) ||
        (r.reading && r.reading.toLowerCase().includes(q))
      );
    })
  );

  function handleKeydown(e) {
    if (isOpen && e.key === 'Escape') {
      onClose();
    }
  }
</script>

<svelte:window onkeydown={handleKeydown} />

{#if isOpen}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
  <div 
    class="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 animate-in fade-in duration-200"
    role="dialog"
    aria-modal="true"
    onclick={onClose}
  >
    <!-- Modal Content -->
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div 
      class="bg-white border-2 border-red-650 rounded-none w-full max-w-2xl max-h-[80vh] flex flex-col shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 text-black"
      onclick={(e) => e.stopPropagation()}
    >
      <!-- Header -->
      <div class="p-6 border-b border-zinc-200 flex items-center justify-between">
        <div>
          <h2 class="text-xl font-bold text-black tracking-tight font-sans">SELECT JAPANESE RADICAL</h2>
          <p class="text-[11px] text-zinc-500 mt-1">Choose a radical component to add to the sandbox grid.</p>
        </div>
        <button 
          onclick={onClose}
          class="h-8 w-8 rounded-none flex items-center justify-center text-zinc-500 hover:text-white hover:bg-red-650 transition-colors cursor-pointer"
        >
          ✕
        </button>
      </div>

      <!-- Search Box -->
      <div class="p-4 bg-zinc-50 border-b border-zinc-200">
        <div class="relative">
          <input 
            type="text"
            bind:value={searchQuery}
            placeholder="Search by radical, meaning, or reading..."
            class="w-full rounded-none border border-zinc-300 bg-white px-4 py-3 pl-10 text-sm text-black placeholder-zinc-400 outline-none focus:border-red-650 transition-all"
          />
          <div class="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400">
            <svg class="w-4.5 h-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          {#if searchQuery}
            <button 
              onclick={() => searchQuery = ''}
              class="absolute right-3.5 top-1/2 -translate-y-1/2 text-red-650 hover:text-red-500 text-xs font-semibold cursor-pointer"
            >
              CLEAR
            </button>
          {/if}
        </div>
      </div>

      <!-- Radicals Grid Container -->
      <div class="flex-1 overflow-y-auto p-6 scrollbar-thin scrollbar-thumb-zinc-200">
        {#if filteredRadicals.length === 0}
          <div class="text-center py-12 text-zinc-500 text-sm">
            No radicals found matching your search.
          </div>
        {:else}
          <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {#each filteredRadicals as radical}
              <button
                onclick={() => onSelect(radical)}
                class="group relative rounded-none border border-zinc-200 bg-white p-4 text-left transition-all hover:border-red-650 hover:bg-zinc-50 active:scale-98 flex flex-col items-center justify-center text-center gap-2 cursor-pointer"
              >
                <div class="text-3xl font-bold text-black transition-transform group-hover:scale-110 duration-200">
                  {radical.character}
                </div>
                <div class="w-full">
                  <div class="text-[10px] text-zinc-500 truncate font-mono">
                    {radical.reading || '—'}
                  </div>
                  <div class="text-xs text-red-650 truncate mt-0.5 font-medium">
                    {radical.meaning}
                  </div>
                </div>
                <!-- Stroke count badge -->
                <span class="absolute top-2 right-2 text-[9px] font-mono text-zinc-500 bg-zinc-50 px-1.5 py-0.5 rounded-none border border-zinc-200">
                  {radical.stroke_count} strokes
                </span>
              </button>
            {/each}
          </div>
        {/if}
      </div>
    </div>
  </div>
{/if}
