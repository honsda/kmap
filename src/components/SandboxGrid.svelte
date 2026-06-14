<script>
  import { onMount } from 'svelte';
  import { gridStore, radicalData, radicalList, gridActions, globalJlptFilter } from '../stores/gridStore.js';
  import RadicalBlock from './RadicalBlock.svelte';
  import RadicalSelectorModal from './RadicalSelectorModal.svelte';
  import DetailedInfoModal from './DetailedInfoModal.svelte';
  import CombinationModal from './CombinationModal.svelte';

  let { radicalDataMap = {}, radicalListArray = [], kanjiDataMap = {} } = $props();

  // Initialize Svelte stores with the fetched props
  radicalData.set(radicalDataMap);
  radicalList.set(radicalListArray);

  // Viewport & Zoom/Pan state
  let viewportEl = $state(null);
  let panX = $state(-800);
  let panY = $state(-800);
  let zoom = $state(1.0);
  let panning = $state(false);
  let panStart = $state({ x: 0, y: 0 });

  // Dragging state for blocks
  let draggingId = $state(null);
  let dragOffset = $state({ x: 0, y: 0 });
  let dragPos = $state({ x: 0, y: 0 });

  // Node hover highlighting
  let hoveredBlockId = $state(null);

  // Modal states
  let isSelectorOpen = $state(false);
  let isDetailsOpen = $state(false);
  let selectedDetailsData = $state(null);
  let isCombinationOpen = $state(false);
  let selectedCombinationPrimary = $state(null);
  let isHudVisible = $state(true);

  onMount(() => {
    // Initial centering of the 4000x4000 canvas inside the viewport
    if (viewportEl) {
      panX = (viewportEl.clientWidth - 4000) / 2;
      panY = (viewportEl.clientHeight - 4000) / 2;
    }

    // Passive wheel handler to prevent page scrolls during zoom
    const handleWheelNative = (e) => {
      e.preventDefault();
      const zoomFactor = 0.05;
      const newZoom = zoom + (e.deltaY < 0 ? zoomFactor : -zoomFactor);
      zoom = Math.max(0.5, Math.min(2.0, newZoom));
    };

    viewportEl.addEventListener('wheel', handleWheelNative, { passive: false });
    return () => {
      viewportEl.removeEventListener('wheel', handleWheelNative);
    };
  });

  // Canvas Panning Handlers
  function handlePanStart(event) {
    // Avoid panning if clicking a block or button
    if (event.target.closest('.radical-block-container') || event.target.closest('button')) return;
    
    panning = true;
    panStart = {
      x: event.clientX - panX,
      y: event.clientY - panY
    };
    window.addEventListener('pointermove', handlePanMove);
    window.addEventListener('pointerup', handlePanUp);
  }

  function handlePanMove(event) {
    if (!panning) return;
    panX = event.clientX - panStart.x;
    panY = event.clientY - panStart.y;
  }

  function handlePanUp() {
    panning = false;
    window.removeEventListener('pointermove', handlePanMove);
    window.removeEventListener('pointerup', handlePanUp);
  }

  // Block Dragging Handlers
  function startDrag(id, event) {
    const block = $gridStore.find(b => b.id === id);
    if (!block) return;

    draggingId = id;
    
    // Position of block in canvas coords
    const blockLeft = block.x * 120 + 10;
    const blockTop = block.y * 120 + 10;
    
    const canvasRect = document.getElementById('sandbox-canvas').getBoundingClientRect();
    const pointerXOnCanvas = (event.clientX - canvasRect.left) / zoom;
    const pointerYOnCanvas = (event.clientY - canvasRect.top) / zoom;
    
    dragOffset = {
      x: pointerXOnCanvas - blockLeft,
      y: pointerYOnCanvas - blockTop
    };
    
    dragPos = {
      x: blockLeft,
      y: blockTop
    };

    window.addEventListener('pointermove', handleDragMove);
    window.addEventListener('pointerup', handleDragUp);
  }

  // Drag Motion
  function handleDragMove(event) {
    if (!draggingId) return;
    const canvasRect = document.getElementById('sandbox-canvas').getBoundingClientRect();
    const pointerXOnCanvas = (event.clientX - canvasRect.left) / zoom;
    const pointerYOnCanvas = (event.clientY - canvasRect.top) / zoom;
    
    dragPos = {
      x: pointerXOnCanvas - dragOffset.x,
      y: pointerYOnCanvas - dragOffset.y
    };
  }

  // Drag Release (Snap)
  function handleDragUp() {
    if (!draggingId) return;

    const targetX = Math.round((dragPos.x - 10) / 120);
    const targetY = Math.round((dragPos.y - 10) / 120);
    
    const clampedX = Math.max(0, Math.min(32, targetX));
    const clampedY = Math.max(0, Math.min(32, targetY));
    
    gridActions.moveBlock(draggingId, clampedX, clampedY);
    draggingId = null;

    window.removeEventListener('pointermove', handleDragMove);
    window.removeEventListener('pointerup', handleDragUp);
  }

  // Zoom Controls
  function zoomIn() {
    zoom = Math.min(2.0, zoom + 0.1);
  }
  function zoomOut() {
    zoom = Math.max(0.5, zoom - 0.1);
  }
  function resetView() {
    zoom = 1.0;
    if (viewportEl) {
      panX = (viewportEl.clientWidth - 4000) / 2;
      panY = (viewportEl.clientHeight - 4000) / 2;
    }
  }

  // Branch Sorting
  let sortedRadicals = $derived.by(() => {
    return $gridStore
      .filter(b => b.type === 'radical')
      .sort((a, b) => a.addedAt - b.addedAt);
  });

  let firstRadical = $derived(sortedRadicals[0] || null);

  // Helper to compute node centers for lines
  function getCellCenter(block) {
    if (draggingId === block.id) {
      return {
        x: dragPos.x + 50,
        y: dragPos.y + 50
      };
    }
    return {
      x: block.x * 120 + 60,
      y: block.y * 120 + 60
    };
  }

  // Shorten connection lines so they start/end exactly at the box boundaries with a margin
  function getShortenedLine(p1, p2, padding = 18) {
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len === 0) return { x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y };
    
    const boxHalfSize = 50; // The box is 100x100, so half size is 50
    // Distance from center to the square boundary along this direction
    const distToBoundary = (boxHalfSize * len) / Math.max(Math.abs(dx), Math.abs(dy));
    
    // Total offset from the center for the start and end of the line
    const offsetStart = distToBoundary + padding;
    const offsetEnd = distToBoundary + padding + 6; // Add extra margin for the arrowhead

    return {
      x1: p1.x + (dx / len) * offsetStart,
      y1: p1.y + (dy / len) * offsetStart,
      x2: p2.x - (dx / len) * offsetEnd,
      y2: p2.y - (dy / len) * offsetEnd
    };
  }

  let notificationText = $state('');
  let notificationTimeout;

  function showNotification(msg) {
    notificationText = msg;
    clearTimeout(notificationTimeout);
    notificationTimeout = setTimeout(() => {
      notificationText = '';
    }, 4000);
  }

  // Add random initiating radical
  function addRandomRadical() {
    if (radicalListArray.length === 0) {
      showNotification('No radicals available.');
      return;
    }
    // Filter out radicals that are already initiating on the board
    const existingRootChars = new Set(
      $gridStore.filter(b => b.type === 'radical' && !b.parentId).map(b => b.character)
    );
    let available = radicalListArray.filter(r => !existingRootChars.has(r.character));
    
    // Filter by JLPT if active
    if ($globalJlptFilter !== 'all') {
      const level = parseInt($globalJlptFilter);
      available = available.filter(r => {
        const details = radicalDataMap[r.character] || {};
        const kanjiList = details.common_kanji || [];
        return kanjiList.some(k => !kanjiDataMap[k]?.jlpt || kanjiDataMap[k]?.jlpt >= level);
      });
    }

    const pool = available.length > 0 ? available : [];
    if (pool.length === 0) {
      showNotification($globalJlptFilter === 'all' 
        ? 'No compatible radicals available.' 
        : `No N${$globalJlptFilter} compatible radicals available.`);
      return;
    }
    const randomRadical = pool[Math.floor(Math.random() * pool.length)];
    gridActions.addBlock('radical', randomRadical.character, randomRadical, radicalDataMap);
  }

  // Add specific radical from modal selection
  function handleSelectRadical(radical) {
    gridActions.addBlock('radical', radical.character, radical, radicalDataMap);
    isSelectorOpen = false;
  }

  // Modals Actions
  function openDetails(data) {
    selectedDetailsData = data;
    isDetailsOpen = true;
  }

  function openCombination(data) {
    selectedCombinationPrimary = data;
    isCombinationOpen = true;
  }
</script>

<div 
  bind:this={viewportEl}
  onpointerdown={handlePanStart}
  class="fixed inset-0 w-screen h-screen bg-[#141414] overflow-hidden cursor-grab active:cursor-grabbing select-none rounded-none"
  role="presentation"
>
  {#if notificationText}
    <div class="absolute top-6 left-1/2 -translate-x-1/2 z-50 bg-red-600 text-white border border-red-700 px-6 py-3 shadow-2xl font-bold font-sans text-xs tracking-wider uppercase animate-in slide-in-from-top-4 duration-200">
      {notificationText}
    </div>
  {/if}
  <!-- HUD: Top Left Control Board -->
  {#if isHudVisible}
    <div class="absolute top-6 left-6 z-30 bg-white border border-zinc-300 rounded-none p-4 shadow-2xl w-72 pointer-events-auto animate-in fade-in slide-in-from-top-2 duration-150 text-black">
      <div class="space-y-2">
        <div class="flex items-center justify-between border-b border-zinc-200 pb-2">
          <div class="flex items-center gap-2">
            <span class="h-2 w-2 rounded-none bg-red-600 animate-pulse"></span>
            <h1 class="text-sm font-bold text-black tracking-wider uppercase font-sans">Radical Node Graph</h1>
          </div>
          <button 
            onclick={() => isHudVisible = false}
            class="h-6 w-6 rounded-none border border-zinc-300 bg-white text-zinc-500 hover:text-white hover:bg-red-650 hover:border-red-650 transition-colors flex items-center justify-center cursor-pointer text-[10px]"
            title="Hide Info Panel"
          >
            ✕
          </button>
        </div>
        <p class="text-[10px] text-zinc-600 leading-relaxed font-medium">
          Drag nodes to reorganize. Hover elements to highlight their web branches. Click "+" to build connections.
        </p>
      </div>
    </div>
  {:else}
    <!-- Small Toggle Button to show the HUD -->
    <button 
      onclick={() => isHudVisible = true}
      class="absolute top-6 left-6 z-30 h-10 w-10 bg-white border border-zinc-300 rounded-none text-black hover:bg-zinc-100 flex items-center justify-center shadow-2xl active:scale-95 transition-all pointer-events-auto cursor-pointer"
      title="Show Info Panel"
    >
      <span class="font-serif italic font-bold text-lg">i</span>
    </button>
  {/if}

  <!-- HUD: Top Right Zoom Controllers -->
  <div class="absolute top-6 right-6 z-30 flex items-center gap-2 bg-white border border-zinc-300 rounded-none p-1.5 shadow-2xl pointer-events-auto text-black">
    <button onclick={zoomOut} class="h-8 w-8 rounded-none bg-zinc-100 hover:bg-zinc-200 text-zinc-800 font-bold flex items-center justify-center text-sm active:scale-95 transition-all cursor-pointer">-</button>
    <span class="text-[11px] font-mono text-zinc-700 min-w-[40px] text-center font-bold">{Math.round(zoom * 100)}%</span>
    <button onclick={zoomIn} class="h-8 w-8 rounded-none bg-zinc-100 hover:bg-zinc-200 text-zinc-800 font-bold flex items-center justify-center text-sm active:scale-95 transition-all cursor-pointer">+</button>
    <div class="h-5 w-px bg-zinc-200 mx-1"></div>
    <button onclick={resetView} class="text-[10px] font-bold text-zinc-650 hover:text-red-650 px-2.5 py-1.5 hover:bg-zinc-100 rounded-none transition-all uppercase cursor-pointer">Reset</button>
  </div>

  <!-- HUD: Bottom Right Graph Details -->
  <div class="absolute bottom-6 right-6 z-30 bg-white border border-zinc-300 rounded-none p-4 shadow-2xl max-w-xs pointer-events-auto text-black">
    <span class="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block mb-2 pb-1 border-b border-zinc-200">Sandbox Stats</span>
    <div class="space-y-1.5 text-xs">
      <div class="flex justify-between">
        <span class="text-zinc-600 font-medium">Root Node:</span>
        <span class="font-mono text-red-600 font-bold">{firstRadical ? firstRadical.character : 'None'}</span>
      </div>
      <div class="flex justify-between">
        <span class="text-zinc-600 font-medium">Total Nodes:</span>
        <span class="font-mono text-zinc-900 font-bold">{$gridStore.length}</span>
      </div>
      <div class="flex justify-between">
        <span class="text-zinc-600 font-medium">Spanned Kanji:</span>
        <span class="font-mono text-zinc-900 font-bold">{$gridStore.filter(b => b.type === 'kanji').length}</span>
      </div>
    </div>
  </div>

  <!-- Zoom/Pan Canvas Sandbox -->
  <div 
    id="sandbox-canvas"
    class="absolute top-0 left-0 w-[4000px] h-[4000px] grid-canvas select-none"
    style="transform: translate({panX}px, {panY}px) scale({zoom}); cursor: {panning ? 'grabbing' : 'grab'};"
  >
    <!-- Permanent Branching Web Strings -->
    {#if firstRadical && $gridStore.length > 1}
      <svg class="absolute pointer-events-none top-0 left-0 w-[4000px] h-[4000px] z-0">
        <defs>
          <linearGradient id="webGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#a1a1aa" stop-opacity="0.85" />
            <stop offset="100%" stop-color="#71717a" stop-opacity="0.6" />
          </linearGradient>
          <linearGradient id="webGradActive" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#ef4444" stop-opacity="1.0" />
            <stop offset="100%" stop-color="#b91c1c" stop-opacity="0.8" />
          </linearGradient>
          <filter id="webGlow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="3.5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>

          <!-- SVG Arrowhead Markers -->
          <marker 
            id="arrow" 
            viewBox="0 0 10 10" 
            refX="4" 
            refY="5" 
            markerWidth="7" 
            markerHeight="7" 
            orient="auto"
          >
            <path d="M 0 2 L 8 5 L 0 8 z" fill="#a1a1aa" />
          </marker>
          
          <marker 
            id="arrowActive" 
            viewBox="0 0 10 10" 
            refX="4" 
            refY="5" 
            markerWidth="7" 
            markerHeight="7" 
            orient="auto"
          >
            <path d="M 0 2 L 8 5 L 0 8 z" fill="#ef4444" />
          </marker>

          <marker 
            id="arrowTrigger" 
            viewBox="0 0 10 10" 
            refX="4" 
            refY="5" 
            markerWidth="7" 
            markerHeight="7" 
            orient="auto"
          >
            <path d="M 0 2 L 8 5 L 0 8 z" fill="#ef4444" />
          </marker>
        </defs>
        
        {#each $gridStore as cell}
          {#if cell.parentId}
            {@const parentBlock = $gridStore.find(b => b.id === cell.parentId)}
            {#if parentBlock}
              <!-- Line from Parent to this cell (Formed Kanji) -->
              {@const parentCenter = getCellCenter(parentBlock)}
              {@const cellCenter = getCellCenter(cell)}
              {@const isHovered = hoveredBlockId === cell.id || 
                                  hoveredBlockId === parentBlock.id}
              {@const coords = getShortenedLine(parentCenter, cellCenter, 8)}
              
              <line
                x1={coords.x1}
                y1={coords.y1}
                x2={coords.x2}
                y2={coords.y2}
                stroke={isHovered ? "url(#webGradActive)" : "url(#webGrad)"}
                stroke-width={isHovered ? "4" : "2.4"}
                stroke-dasharray={isHovered ? "7 4" : ""}
                class={isHovered ? "animate-dash" : ""}
                marker-end={isHovered ? "url(#arrowActive)" : "url(#arrow)"}
              />
            {/if}
          {/if}
        {/each}
      </svg>
    {/if}

    <!-- Placed Blocks Grid -->
    {#each $gridStore as cell (cell.id)}
      {@const isDragging = draggingId === cell.id}
      <div 
        class="absolute"
        style="
          left: {isDragging ? dragPos.x : (cell.x * 120 + 10)}px; 
          top: {isDragging ? dragPos.y : (cell.y * 120 + 10)}px; 
          width: 100px; 
          height: 100px; 
          z-index: {isDragging ? 50 : (hoveredBlockId === cell.id ? 45 : 20)}; 
          transition: {isDragging ? 'none' : 'left 0.15s cubic-bezier(0.4, 0, 0.2, 1), top 0.15s cubic-bezier(0.4, 0, 0.2, 1)'};
        "
      >
        <RadicalBlock
          {cell}
          radicals={radicalListArray}
          {radicalDataMap}
          {kanjiDataMap}
          onOpenDetails={openDetails}
          onOpenCombination={openCombination}
          onShowNotification={showNotification}
          isFirst={firstRadical && cell.id === firstRadical.id}
          onHoverFirst={() => {}} 
          onStartDrag={startDrag}
          onHoverBlock={(id) => hoveredBlockId = id}
          onLeaveBlock={() => hoveredBlockId = null}
        />
      </div>
    {/each}
  </div>

  <!-- Action Buttons (Bottom Left Fixed inside viewport) -->
  <div class="absolute bottom-6 left-6 z-30 flex flex-col gap-2 pointer-events-auto">
    <!-- JLPT Filter -->
    <div class="flex items-center gap-1 bg-white border border-zinc-300 p-1.5 shadow-2xl">
      <span class="text-[9px] text-zinc-500 uppercase tracking-wider font-semibold mx-1">JLPT:</span>
      {#each ['all', '5', '4', '3', '2', '1'] as level}
        <button
          onclick={() => $globalJlptFilter = level}
          class="px-2 py-1 text-[10px] font-bold border transition-all cursor-pointer { $globalJlptFilter === level ? 'bg-red-600 text-white border-red-600' : 'bg-white text-zinc-600 border-zinc-200 hover:border-zinc-400' }"
        >
          {level === 'all' ? 'ALL' : `N${level}`}
        </button>
      {/each}
    </div>

    <div class="flex items-center gap-2">
      <!-- Add Radical Button -->
    <button
      onclick={() => isSelectorOpen = true}
      class="flex h-14 w-14 items-center justify-center rounded-none bg-red-600 hover:bg-red-500 text-white shadow-2xl transition-all duration-300 hover:scale-110 active:scale-95 border border-red-600 hover:border-red-500 cursor-pointer"
      title="Add Radical"
    >
      <svg class="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
        <path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
      </svg>
    </button>

    <!-- Add Random Radical Button -->
    <button
      onclick={addRandomRadical}
      class="flex h-14 w-14 items-center justify-center rounded-none bg-red-600 hover:bg-red-500 text-white border border-red-600 hover:border-red-500 shadow-2xl transition-all duration-300 hover:scale-110 active:scale-95 cursor-pointer font-sans font-bold text-xl select-none"
      title="Add Random Radical"
    >
      部
    </button>

    <!-- Clear Sandbox Button -->
    <button
      onclick={() => gridActions.clearGrid()}
      class="flex h-14 w-14 items-center justify-center rounded-none bg-red-600 hover:bg-red-500 text-white border border-red-600 hover:border-red-500 shadow-2xl transition-all duration-300 hover:scale-110 active:scale-95 cursor-pointer font-sans font-bold text-xl select-none"
      title="Clear Sandbox"
    >
      消
    </button>
    </div>
  </div>
</div>

<!-- Modals -->
<RadicalSelectorModal
  isOpen={isSelectorOpen}
  radicals={radicalListArray}
  onClose={() => isSelectorOpen = false}
  onSelect={handleSelectRadical}
/>

<DetailedInfoModal
  isOpen={isDetailsOpen}
  data={selectedDetailsData}
  {kanjiDataMap}
  onClose={() => isDetailsOpen = false}
/>

<CombinationModal
  isOpen={isCombinationOpen}
  primaryRadical={selectedCombinationPrimary}
  radicals={radicalListArray}
  {radicalDataMap}
  {kanjiDataMap}
  onClose={() => isCombinationOpen = false}
/>

<style>
  .grid-canvas {
    background-size: 120px 120px;
    background-image: linear-gradient(to right, rgba(255, 255, 255, 0.15) 1px, transparent 1px),
                      linear-gradient(to bottom, rgba(255, 255, 255, 0.15) 1px, transparent 1px);
  }
  
  .grid-canvas::before {
    content: '';
    position: absolute;
    inset: 0;
    background-size: 120px 120px;
    background-image: radial-gradient(rgba(255, 255, 255, 0.22) 1.5px, transparent 1.5px);
    pointer-events: none;
  }
  
  @keyframes dash {
    to {
      stroke-dashoffset: -40;
    }
  }
  
  :global(.animate-dash) {
    animation: dash 2.5s linear infinite;
  }
</style>
