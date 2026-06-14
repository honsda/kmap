<script>
  let {
    visible = false,
    canEvolve = true,
    isKanji = false,
    onAddSpecific = () => {},
    onAddRandomRadical = () => {},
    onAddRandomKanji = () => {}
  } = $props();
</script>

{#if visible}
  <div class="absolute left-full top-1/2 -translate-y-1/2 ml-3.5 z-50 flex flex-col gap-1.5 animate-in fade-in slide-in-from-left-2 duration-150">
    <!-- Button 1: Search / Select Kanji -->
    <button 
      onclick={onAddSpecific}
      disabled={!canEvolve}
      class="h-8 w-8 flex items-center justify-center bg-red-600 hover:bg-red-500 text-white border border-red-600 hover:border-red-500 shadow-xl rounded-none active:scale-95 transition-all duration-150 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
      title={canEvolve ? "Search and Add Specific Kanji" : "This Kanji has reached its final form"}
      aria-label="Search and Add Specific Kanji"
    >
      <span class="font-sans font-bold text-xs select-none">選</span>
    </button>

    <!-- Button 2: Add Random Radical -->
    <button 
      onclick={onAddRandomRadical}
      disabled={!canEvolve}
      class="h-8 w-8 flex items-center justify-center bg-red-600 hover:bg-red-500 text-white border border-red-600 hover:border-red-500 shadow-xl rounded-none active:scale-95 transition-all duration-150 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
      title={canEvolve ? "Add Random Radical" : "This Kanji has reached its final form"}
      aria-label="Add Random Radical"
    >
      <span class="font-sans font-bold text-xs select-none">部</span>
    </button>

    <!-- Button 3: Add Random Kanji -->
    {#if !isKanji}
      <button 
        onclick={onAddRandomKanji}
        class="h-8 w-8 flex items-center justify-center bg-red-600 hover:bg-red-500 text-white border border-red-600 hover:border-red-500 shadow-xl rounded-none active:scale-95 transition-all duration-150 cursor-pointer"
        title="Add Random Kanji containing this radical"
        aria-label="Add Random Kanji containing this radical"
      >
        <span class="font-sans font-bold text-xs select-none">字</span>
      </button>
    {/if}
  </div>
{/if}
