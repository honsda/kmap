# kmap — Kanji Radical Map

An interactive visual sandbox for exploring how Japanese Kanji are built from radicals. Start with a basic radical, evolve it into Kanji, and watch an evolution tree grow on an infinite canvas.

**Live → [honsda.github.io/kmap](https://honsda.github.io/kmap)**

---

## What is this?

Japanese Kanji are made up of smaller building blocks called **radicals**. For example, the kanji **明** (bright) is composed of **日** (sun) and **月** (moon).

kmap lets you explore these relationships visually:

1. **Start with a radical** — drop one onto the canvas.
2. **Evolve it** — the app finds Kanji that contain your radical and places them as connected nodes.
3. **Keep branching** — each new Kanji can evolve further, forming a tree of increasingly complex characters.

The result is a node graph that shows how simple strokes combine into the thousands of characters used in written Japanese.

## How to use

### Canvas controls

| Action | Input |
|---|---|
| Pan the canvas | Click and drag on empty space |
| Zoom in / out | Scroll wheel |
| Move a block | Click and drag it |
| Delete a block | Hover over it, click the **除** button |

### Bottom-left toolbar

| Button | What it does |
|---|---|
| **JLPT filter** | Vertical level selector (N5–N1). Selecting a level limits all random generation to Kanji at that level or easier. Kanji without an official JLPT rating are always included. |
| **＋** (red) | Opens a modal to manually pick a radical from the full list. |
| **部** | Adds a random radical to the canvas as a new root node. |
| **字** | Picks a random Kanji that uses a radical already on the canvas and adds it as a connected node. |
| **⟳** | Clears the entire canvas. |

### Block interactions

Hover over any block to reveal a floating action menu:

- **ℹ** — Open the **detail sidebar** with readings, meanings, JLPT level, constituent radicals, related Kanji (synonyms), and example words.
- **＋** — Open the **combination modal** showing every Kanji that can be formed from this radical/kanji, filterable by JLPT level.
- **⇡** — **Evolve** this block into a more complex Kanji that contains its radicals (random pick).
- **字** — Add a random Kanji that uses this block's radical.

### Detail sidebar

Click any block to open the right-hand sidebar, which shows:

- **Onyomi / Kunyomi** readings with Romaji transliteration
- **JLPT level** badge
- **Constituent radicals** — every radical that makes up the selected Kanji
- **Related Kanji (Synonyms)** — other Kanji with similar English meanings, clickable to add them as standalone blocks
- **Word examples** — common vocabulary using the Kanji, with Japanese example sentences and English translations
- **Common Kanji** — all Kanji that share this radical, clickable to branch from the current node

### Radical indicator badges

When a Kanji block is connected to a parent, small badges appear at the bottom showing **only the new radicals** that were added compared to the parent. This makes it easy to see what changed at each evolution step.

### Evolution arrows

Arrows connect parent blocks to their children. Straight (horizontal/vertical) arrows sit tightly between adjacent boxes, while diagonal arrows have slightly more margin for readability.

## Tech stack

| Layer | Technology |
|---|---|
| Framework | [Astro](https://astro.build) (static site generation) |
| UI | [Svelte 5](https://svelte.dev) (runes, reactive state) |
| Styling | [Tailwind CSS v4](https://tailwindcss.com) |
| Readings | [wanakana](https://github.com/WaniKani/WanaKana) (kana ↔ romaji) |
| Synonyms | [Datamuse API](https://www.datamuse.com/api/) |
| Word examples | [kanjiapi.dev](https://kanjiapi.dev) |

## Data sources

The build script (`scripts/build-radical-data.cjs`) fetches and merges data from:

- **KANJIDIC2** — readings, meanings, stroke counts, JLPT levels for 13,000+ characters
- **KanjiVG** — radical decomposition mappings (which radicals make up which Kanji)
- **Kanji Alive** — radical names and meanings
- **kanji-data** — supplemental JLPT level data
- **Unicode EquivalentUnifiedIdeograph** — normalizes Kangxi radical codepoints to standard CJK

All data is processed at build time into static JSON files. No database required.

## Development

Requires **Node.js ≥ 22.12.0**.

```bash
# Install dependencies
npm install

# Start dev server (builds data + starts Astro)
npm run dev

# Production build
npm run build

# Preview production build
npm run preview
```

### Project structure

```
src/
├── components/
│   ├── SandboxGrid.svelte      # Main canvas with pan/zoom and arrow rendering
│   ├── RadicalBlock.svelte     # Individual node (radical or kanji block)
│   ├── FloatingMenu.svelte     # Hover action buttons on each block
│   ├── Tooltip.svelte          # Hover tooltip with quick info
│   ├── DetailedInfoModal.svelte # Right sidebar with full kanji details
│   ├── CombinationModal.svelte # Modal listing all possible kanji combinations
│   └── RadicalSelectorModal.svelte # Modal for manually picking a radical
├── stores/
│   └── gridStore.js            # Central state: grid blocks, evolution logic, JLPT filter
├── layouts/
│   └── Layout.astro            # HTML shell with metadata
└── pages/
    └── index.astro             # Entry point, loads data and renders SandboxGrid
scripts/
└── build-radical-data.cjs      # Fetches and merges kanji dictionaries into static JSON
public/data/
├── radical_data.json           # Radical → meanings, readings, common kanji
├── radical_list.json           # Ordered list of all radicals
└── kanji_data.json             # Kanji → readings, meanings, JLPT, radicals
```

## Deployment

Pushes to `main` automatically deploy to GitHub Pages via the workflow in `.github/workflows/deploy.yml`.

## License

MIT
