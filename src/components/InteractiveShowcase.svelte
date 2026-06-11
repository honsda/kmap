<script>
  // Svelte 5 Rune State
  let count = $state(0);
  let userName = $state('');
  let selectedFeatures = $state(new Set(['Speed', 'Style']));

  const features = ['Speed', 'Style', 'Simplicity', 'Power', 'Type Safety'];

  // Derived state
  let counterLevel = $derived(
    count < 0 ? 'Subzero' :
    count === 0 ? 'Zero' :
    count <= 5 ? 'Low' :
    count <= 15 ? 'Medium' :
    count <= 25 ? 'High' : 'Legendary'
  );

  let counterColor = $derived(
    count < 0 ? 'text-blue-400 border-blue-500/20 bg-blue-500/5' :
    count === 0 ? 'text-slate-400 border-slate-500/20 bg-slate-500/5' :
    count <= 5 ? 'text-emerald-400 border-emerald-500/20 bg-emerald-500/5' :
    count <= 15 ? 'text-amber-400 border-amber-500/20 bg-amber-500/5' :
    count <= 25 ? 'text-rose-400 border-rose-500/20 bg-rose-500/5' :
    'text-purple-400 border-purple-500/20 bg-purple-500/5 dynamic-glow'
  );

  function toggleFeature(feature) {
    if (selectedFeatures.has(feature)) {
      selectedFeatures.delete(feature);
    } else {
      selectedFeatures.add(feature);
    }
    // Reassigning is required in Svelte 5 for Sets to trigger reactivity
    selectedFeatures = new Set(selectedFeatures);
  }
</script>

<div class="relative group overflow-hidden rounded-3xl border border-slate-800/80 bg-slate-900/40 p-8 shadow-2xl backdrop-blur-xl transition-all duration-300 hover:border-slate-700/80 hover:shadow-indigo-500/10">
  <!-- Decorative background gradients -->
  <div class="absolute -right-20 -top-20 h-60 w-60 rounded-full bg-indigo-500/10 blur-3xl transition-all duration-500 group-hover:bg-indigo-500/15"></div>
  <div class="absolute -bottom-20 -left-20 h-60 w-60 rounded-full bg-purple-500/10 blur-3xl transition-all duration-500 group-hover:bg-purple-500/15"></div>

  <!-- Header -->
  <div class="relative mb-6 flex items-center justify-between">
    <div>
      <span class="text-xs font-semibold tracking-wider text-indigo-400 uppercase">Svelte 5 Runes</span>
      <h3 class="mt-1 text-2xl font-bold tracking-tight text-white">Interactive Sandbox</h3>
    </div>
    <div class="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-800/80 text-orange-400 shadow-inner">
      <svg class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
        <path stroke-linecap="round" stroke-linejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
      </svg>
    </div>
  </div>

  <!-- Divider -->
  <div class="my-6 h-px bg-gradient-to-r from-transparent via-slate-800 to-transparent"></div>

  <!-- Section: Counter -->
  <div class="space-y-4">
    <div class="flex items-center justify-between">
      <span class="text-sm font-medium text-slate-300">Runes Counter:</span>
      <span class="rounded-full border px-3 py-0.5 text-xs font-medium transition-all duration-300 {counterColor}">
        {counterLevel}
      </span>
    </div>

    <div class="flex items-center gap-4">
      <button 
        onclick={() => count--}
        class="flex h-12 w-12 items-center justify-center rounded-xl border border-slate-800 bg-slate-950 text-xl font-bold text-slate-300 shadow-lg transition-all duration-200 hover:border-slate-700 hover:bg-slate-900 active:scale-95"
      >
        −
      </button>

      <div class="flex-1 flex items-center justify-center h-12 rounded-xl bg-slate-950/80 border border-slate-900 shadow-inner font-mono text-xl font-bold text-white">
        {count}
      </div>

      <button 
        onclick={() => count++}
        class="flex h-12 w-12 items-center justify-center rounded-xl border border-slate-800 bg-slate-950 text-xl font-bold text-slate-300 shadow-lg transition-all duration-200 hover:border-slate-700 hover:bg-slate-900 active:scale-95"
      >
        +
      </button>
    </div>
  </div>

  <!-- Section: Features Toggle -->
  <div class="mt-8 space-y-3">
    <span class="text-sm font-medium text-slate-300">Toggle Tags:</span>
    <div class="flex flex-wrap gap-2">
      {#each features as feature}
        {@const isActive = selectedFeatures.has(feature)}
        <button
          onclick={() => toggleFeature(feature)}
          class="rounded-lg border px-3 py-1.5 text-xs font-medium transition-all duration-200 active:scale-95 {isActive ? 'border-indigo-500/30 bg-indigo-500/10 text-indigo-300 shadow-md shadow-indigo-500/5' : 'border-slate-800 bg-slate-950 text-slate-400 hover:border-slate-700 hover:text-slate-300'}"
        >
          {feature}
        </button>
      {/each}
    </div>
  </div>

  <!-- Section: Live Input -->
  <div class="mt-8 space-y-3">
    <label for="sandbox-input" class="block text-sm font-medium text-slate-300">Live Preview Input:</label>
    <div class="relative">
      <input
        id="sandbox-input"
        type="text"
        bind:value={userName}
        placeholder="Type something..."
        class="w-full rounded-xl border border-slate-800 bg-slate-950/80 px-4 py-3 text-sm text-white placeholder-slate-500 shadow-inner outline-none transition-all duration-200 focus:border-indigo-500/50 focus:ring-2 focus:ring-indigo-500/10"
      />
    </div>
    <div class="h-6 overflow-hidden">
      {#if userName}
        <p class="text-xs text-indigo-400 font-mono italic">
          Echoing: <span class="text-slate-300">{userName}</span>
        </p>
      {:else}
        <p class="text-xs text-slate-500 italic">Waiting for input...</p>
      {/if}
    </div>
  </div>
</div>

<style>
  @keyframes pulse-glow {
    0%, 100% {
      box-shadow: 0 0 12px rgba(168, 85, 247, 0.2);
    }
    50% {
      box-shadow: 0 0 20px rgba(168, 85, 247, 0.4);
    }
  }
  :global(.dynamic-glow) {
    animation: pulse-glow 2s infinite;
  }
</style>
