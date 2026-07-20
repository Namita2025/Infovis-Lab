# OlympicLens

This project is a browser-based interactive visualization of Olympic history. It presents three linked stories about disruption, medal efficiency, and the expansion of the Olympic programme.

## Run the visualization

The web app is a static site, so you do not need a build step.

1. Open a terminal in the project root.
2. Start a simple local web server:

   ```bash
   python -m http.server 8000
   ```

3. Open the following URL in your browser:

   ```text
   http://localhost:8000/template/
   ```

This is the recommended way to run the site because the charts load JSON data from the local project files.

> If you prefer, you can also open the page directly in a browser, but serving it locally is more reliable.

## Project structure

- [template/index.html](template/index.html) — main landing page and entry point for the full experience
- [template/main.js](template/main.js) — shared state and shared UI logic used across the visualizations
- [template/style.css](template/style.css) — shared styling for the site
- [template/visualization-system.css](template/visualization-system.css) — shared layout and component styling for the charts

### Visualization 1: Participation and disruption
- [template/viz1/index.html](template/viz1/index.html)
- [template/viz1/main.js](template/viz1/main.js)
- [template/viz1/style.css](template/viz1/style.css)
- Purpose: explores participation over time and highlights disruptions such as wars, boycotts, and political events

### Visualization 2: Medal efficiency
- [template/viz2/index.html](template/viz2/index.html)
- [template/viz2/main.js](template/viz2/main.js)
- [template/viz2/style.css](template/viz2/style.css)
- Purpose: shows how countries converted participation into medals across Olympic editions

### Visualization 3: Programme expansion
- [template/viz3/index.html](template/viz3/index.html)
- [template/viz3/main.js](template/viz3/main.js)
- [template/viz3/style.css](template/viz3/style.css)
- Purpose: visualizes how the Olympic sports programme expanded over time

### Data files
- [template/public/data](template/public/data) — JSON files used by the visualizations
- [template/public/data/countries.geo.json](template/public/data/countries.geo.json) — geographic shapes for the map view
- [template/public/data/viz1_continent_athletes.json](template/public/data/viz1_continent_athletes.json) — participation data for visualization 1
- [template/public/data/viz2_efficiency_yearly.json](template/public/data/viz2_efficiency_yearly.json) — medal-efficiency data for visualization 2
- [template/public/data/viz3_sport_tree.json](template/public/data/viz3_sport_tree.json) — programme hierarchy data for visualization 3

## Python files and notebooks

The Python folder contains supporting files for data processing and experimentation.

- [python/](python/) — notebooks and CSV data used during preprocessing
- [python/server.py](python/server.py) — a simple Flask example; it is not required to view the visualization
- [template/scripts/preprocess_viz2.py](template/scripts/preprocess_viz2.py) — optional preprocessing helper for visualization 2 data

### Optional Python setup

If you want to work with the notebooks or Python scripts, use Python 3.8+ and install the required packages:

```bash
pip install pandas flask jupyter
```

You can then launch Jupyter from the project root:

```bash
jupyter notebook
```

## Running order

No specific order is required for the web app itself.

- To view the visualization: start the local server and open the page in your browser.
- To work with the Python notebooks: open them after installing the packages above.
- If you change the underlying data, refresh the browser after updating the relevant JSON files in [template/public/data](template/public/data).
