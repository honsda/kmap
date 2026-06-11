<script>
  let { data = null, visible = false } = $props();
</script>

{#if visible && data}
  <div class="absolute right-full top-1/2 -translate-y-1/2 mr-3 z-50 w-52 rounded-none bg-white border border-red-650 p-3 shadow-2xl text-xs pointer-events-none transition-all duration-200 animate-in fade-in slide-in-from-right-2">
    <div class="space-y-1">
      <div class="flex items-center justify-between border-b border-zinc-200 pb-1">
        <span class="font-bold text-black text-sm">{data.character}</span>
        <div class="flex items-center gap-1.5">
          {#if data.jlpt}
            <span class="text-[9px] font-mono bg-red-100 text-red-700 px-1 font-bold uppercase">N{data.jlpt}</span>
          {/if}
          <span class="text-[10px] text-black font-mono">Stroke: {data.stroke_count || 1}</span>
        </div>
      </div>
      
      <div>
        <span class="text-zinc-500 font-semibold block text-[9px] uppercase tracking-wider">Onyomi</span>
        <span class="text-zinc-800 font-mono text-[11px] block truncate">
          {data.onyomi && data.onyomi.length > 0 ? data.onyomi.join(', ') : '—'}
        </span>
      </div>

      <div>
        <span class="text-zinc-500 font-semibold block text-[9px] uppercase tracking-wider">Kunyomi</span>
        <span class="text-zinc-800 font-mono text-[11px] block truncate">
          {data.kunyomi && data.kunyomi.length > 0 ? data.kunyomi.join(', ') : '—'}
        </span>
      </div>

      <div>
        <span class="text-zinc-500 font-semibold block text-[9px] uppercase tracking-wider">Meaning</span>
        <span class="text-black font-semibold text-[11px] block line-clamp-2">
          {data.meaning}
        </span>
      </div>
    </div>
    <!-- Arrow pointing to the right (white background) -->
    <div class="absolute left-full top-1/2 -translate-y-1/2 w-2 h-2 bg-white border-t border-r border-red-650 rotate-45 -ml-1 rounded-none"></div>
  </div>
{/if}
