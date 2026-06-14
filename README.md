# Kanji Radical Sandbox (kmap)

An interactive, visual sandbox for exploring Japanese Kanji through their constituent radicals. 

This project allows users to start with basic radicals, combine them to form more complex Kanji, and trace the evolution of characters in a visual grid format.

## Features

- **Interactive Node Graph**: Place radicals and Kanji on a grid and move them around.
- **Kanji Evolution**: Combine radicals to discover which Kanji they form, showing all valid evolution candidates.
- **Detailed Information**: View detailed data about any Kanji or radical, including:
  - Meanings and readings (Onyomi, Kunyomi)
  - Stroke counts
  - JLPT levels
  - Common word examples with Japanese sentences and English translations
- **Filtering**: Find kanji by their JLPT level.

## Development

The project is built using:
- **Astro**: Static site generator
- **Svelte 5**: Interactive UI components and reactivity
- **Tailwind CSS**: Styling

### Setup

```bash
# Install dependencies
npm install

# Start the development server
npm run dev
```

### Data Generation

The project fetches and parses extensive Kanji dictionaries during the build process to generate a static dataset.

```bash
# Build data and project
npm run build
```

This runs the script `scripts/build-radical-data.cjs`, which uses sources like KANJIDIC2 and KanjiVG to produce `radical_data.json` and `radical_list.json` in the `public/data/` directory.

## Deployment

The project is configured to automatically deploy to GitHub Pages on every push to the `main` branch via GitHub Actions.

## License

MIT
