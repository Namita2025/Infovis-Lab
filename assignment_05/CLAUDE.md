# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is **Assignment 5** for the Infovis Lab course. The project is an interactive D3.js visualization dashboard called **OlympicLens — Disrupted Games**, exploring Olympic participation through global events (1896–2016).

The project consists of three coordinated visualizations:
1. **Viz 1** — Disrupted Games: Stacked bar chart (continent overview) ↔ multi-line chart (country detail) with event markers
2. **Viz 2** — Medal Efficiency Choropleth: World map showing medals ÷ athletes sent, colored by continent
3. **Viz 3** — Country–Sport Dominance Network: Force-directed bipartite graph (countries ↔ sports)

## Architecture

```
assignment_05/
├── template/                    # Main visualization (D3.js + ES modules)
│   ├── index.html              # Entry point, loads viz1 by default
│   ├── main.js                 # Shared state management (ES module)
│   ├── viz1.js                 # Viz 1: Disrupted Games (stacked bar + lines)
│   ├── viz2.js                 # Viz 2: Medal Efficiency Choropleth
│   ├── viz3.js                 # Viz 3: Country-Sport Network (force-directed)
│   ├── style.css               # Design system (CSS custom properties)
│   ├── d3.v7.min.js           # D3 v7 (local copy)
│   └── public/data/            # Static JSON datasets
│       ├── viz1_continent_athletes.json
│       ├── viz1_country_athletes.json
│       ├── viz1_country_lookup.json
│       ├── viz2_efficiency_yearly.json
│       ├── viz3_network.json
│       ├── olympic_disruptions.json
│       └── countries.geo.json
├── python/                     # Flask server (legacy, not used by main viz)
│   └── server.py               # Serves iris dataset on :8080
└── README.md                   # Assignment overview
```

## Key Architectural Patterns

### Shared State (main.js)
Single source of truth for cross-viz coordination:
```js
export const state = {
  yearRange: [1896, 2016],
  activeYear: 1896,
  isPlaying: false,
  eventCategory: 'All',
  mode: 'continent' | 'country',
  selectedContinent: null,
  selectedCountries: [],  // max 5
  listeners: []
};
```
- **Observer pattern**: `onStateChange(fn)` / `notify()` — all visualizations subscribe
- **Olympic years only**: 26 Summer Games (1896–2016, excluding 1916/1940/1944)

### Design System (style.css)
- **CSS Custom Properties** for colors, spacing, typography, shadows
- **Olympic ring colors** mapped to continents (Europe/Blue, Americas/Red, Asia/Yellow, Africa/Green, Oceania/Purple)
- **Fluid typography** via `clamp()` — no media queries for text scaling
- **Inter font** with system-ui fallbacks

### Module Loading (index.html)
```html
<script type="module" src="main.js"></script>
<script type="module">
  import { loadViz1 } from './viz1.js';
  loadViz1();
  // Viz2/Viz3 loaders commented out — uncomment when ready
</script>
```

## Development Commands

### Running the Visualization
The main visualization runs as static files — **no Python server needed** for the D3 visualizations (they fetch JSON from `template/public/data/`).

**Recommended: VS Code Live Server**
1. Open `template/` folder in VS Code
2. Click "Go Live" (bottom right) → opens `http://localhost:5500`
3. Viz 1 loads automatically; uncomment imports in `index.html` for Viz 2/3

**Alternative: Python HTTP server**
```bash
cd template
python -m http.server 8000
# Open http://localhost:8000
```

### Python Server (Legacy/Unused)
```bash
cd python
python -m venv venv
source venv/bin/activate
pip install flask pandas
python server.py  # Runs on :8080, serves iris dataset — NOT used by main viz
```

## Data Pipeline

Data files in `template/public/data/` are **pre-generated** (from assignment_04 Python notebooks). The visualization loads them directly via `fetch()`.

| File | Used By | Description |
|------|---------|-------------|
| `viz1_continent_athletes.json` | Viz 1 | Athletes per continent per Olympic year |
| `viz1_country_athletes.json` | Viz 1 | Athletes per country per Olympic year |
| `viz1_country_lookup.json` | Viz 1 | Continent → country lookup (NOC, name, total athletes) |
| `olympic_disruptions.json` | Viz 1 | Global events (wars, boycotts, etc.) with year, category, display style |
| `viz2_efficiency_yearly.json` | Viz 2 | Yearly medal counts + athletes per NOC |
| `countries.geo.json` | Viz 2 | GeoJSON world map (ISO-3 codes) |
| `viz3_network.json` | Viz 3 | Country-Sport medal edges with year, continent, era |

**Regenerating data**: See `python/Namita_data_preprocessing_FINAL.ipynb` (Jupyter notebook in `python/`).

## Key Implementation Details

### Viz 1 — Dual Mode Chart
- **Continent mode** (default): Stacked bar chart, all 5 continents
- **Country mode**: Multi-line chart, up to 5 selected countries from chosen continent
- **Event markers**: Vertical lines (point events) + shaded bands (multi-year events) + clickable dots for story cards
- **Shared year slider** + play button (global, synced via `main.js` state)

### Viz 2 — Choropleth Map
- **Efficiency** = medals ÷ athletes sent
- **Per-continent color ramps**: 90th percentile normalization within each continent
- **Historical NOCs** mapped to modern ISO-3 (e.g., URS→RUS, GDR/FRG→DEU)
- **Hatching** for low-confidence (<5 athletes)
- **Year slider** (All-time or single edition) + medal type filter (All/Gold/Silver/Bronze)

### Viz 3 — Force-Directed Bipartite Network
- **Nodes**: Countries (continent-colored) + Sports (blue)
- **Edges**: Medal count / Gold only / Years active (user-selectable)
- **Three layouts**: Force / Radial (sports center, countries orbit) / Arc (bipartite sides)
- **Threshold slider** (min medals) + search highlight + KPI bar (Sports, Countries, Clusters, Top Hub)
- **Hub detection** (top 5 by connections) + isolated single-sport specialists

## Adding/Modifying Visualizations

1. Create `vizN.js` exporting `async function loadVizN()`
2. Import `state`, `onStateChange`, `OLYMPIC_YEARS` from `main.js` for cross-viz sync
3. Add `<div id="vizN-root"></div>` to `index.html` + import/load in module script
4. Follow existing patterns: `ResizeObserver` for responsive SVG, `d3.geoPath` for maps, `d3.forceSimulation` for networks

## Common Tasks

### Modify Color Scheme
Edit CSS custom properties in `style.css:7-23` (continent colors, event colors, medal colors).

### Add Olympic Year
Update `OLYMPIC_YEARS` array in `main.js:75-79` and ensure data files include the year.

### Add Event Category
1. Add to `CATEGORY_LIST` in `viz1.js:31`
2. Add color to `CATEGORY_COLOR` in `viz1.js:33-39`
3. Ensure `olympic_disruptions.json` includes the category

### Adjust Force Layout (Viz 3)
Modify forces in `viz3.js:274-329` — `charge`, `collision`, `link`, `center`, `radial`, `x/y`.

## Notes for Future Development

- **Viz 2/3 loaders are commented out** in `index.html` — uncomment to enable
- **No build step** — pure ES modules + static files
- **D3 v7** loaded locally (`d3.v7.min.js`), not via CDN
- **Responsive**: `ResizeObserver` on chart containers, `viewBox` on SVGs
- **Accessibility**: `prefers-reduced-motion` respected, semantic HTML, keyboard-focusable controls