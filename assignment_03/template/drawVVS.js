// ============================================================
// drawVVS.js
// D3.js visualization for Stuttgart VVS S-Bahn delay analysis
// Research Question: Do stations amplify or absorb delays?
//
// Nodes  = VVS S-Bahn stations at real geographic positions
// Color  = Red (amplifier) / Grey (neutral) / Green (absorber)
// Size   = Total train volume (sum_trains)
// Edges  = Connections between stations (width = traffic volume)
// ============================================================

// ── Constants ───────────────────────────────────────────────

// Only these lines are S-Bahn (regional/other lines filtered out)
const SBAHN_LINES = ['1', '2', '3', '4', '5', '6', '60'];

// Official VVS S-Bahn line colors — matched to the VVS network map
const LINE_COLORS = {
    '1':  '#2D9541',   // S1  → green
    '2':  '#D7282F',   // S2  → red
    '3':  '#F5A623',   // S3  → amber/yellow-orange
    '4':  '#1F70B8',   // S4  → blue
    '5':  '#6EC6E6',   // S5  → light blue
    '6':  '#7C5B28',   // S6  → dark brown/olive
    '60': '#E07B25'    // S60 → darker orange (distinct from S3)
};

// Node fill colors based on delay_change_avg
const NODE_COLORS = {
  amplifier: '#C25B4E', // clay red — orange-red mix
  absorber:  '#3D8B82', // deep teal — clearly distinct
  neutral:   '#9A9790'  // ash — warm mid-grey
};

const FADED_NODE  = '#D3D1C7';  // faded node color when line filtered
const FADED_EDGE  = '#E8E6DF';  // faded edge color when line filtered
const ACTIVE_EDGE = '#C0BDB5';  // edge color in ALL mode

// Threshold: ±0.05 min considered neutral (not significant)
const DELAY_THRESHOLD = 0.05;

// Phantom nodes created by make_graph_vvs.py that are not real stations
const PHANTOM_NODES = new Set(['Start', 'Station outside VVS']);


// ── Main draw function ───────────────────────────────────────
// Called from index.html with the parsed JSON graph data
function drawVVS(graphData) {

    // ── Dimensions ──────────────────────────────────────────
    const container   = document.querySelector('main');
    const totalWidth  = container.clientWidth;
    const totalHeight = container.clientHeight;

    // Padding inside SVG so nodes don't clip at edges
    const PAD = { top: 55, right: 30, bottom: 35, left: 30 };

    // ── State ───────────────────────────────────────────────
    let selectedLine = 'ALL';   // currently active line filter
    let selectedNode = null;    // currently clicked node data

    // ── Filter Data ─────────────────────────────────────────

    // Remove phantom nodes (they are graph artifacts, not real stations)
    // and filter out invalid/outlier coordinates that collapse the map.
    const nodes = graphData.nodes
        .filter(d => !PHANTOM_NODES.has(d.station))
        .filter(d => Number.isFinite(d.lat) && Number.isFinite(d.long))
        .filter(d => d.lat > 10 && d.lat < 60 && d.long > 2 && d.long < 20);

    // Build a fast lookup: station name → node object
    const nodeMap = new Map(nodes.map(d => [d.station, d]));

    // Keep only links where:
    //   (a) both endpoints are real stations with valid coordinates, AND
    //   (b) at least one line on the link is an S-Bahn line
    const links = graphData.links.filter(d =>
        nodeMap.has(d.source) &&
        nodeMap.has(d.destination) &&
        d.lines.some(l => SBAHN_LINES.includes(l))
    );


    // ── Geographic Projection ────────────────────────────────
    // Map lat/long directly to SVG pixel coordinates.
    // SVG y-axis is inverted: higher latitude → smaller y (top of screen).
    // We add 5% padding to the geographic extents so edge nodes aren't clipped.

    const latExtent  = d3.extent(nodes, d => d.lat);
    const longExtent = d3.extent(nodes, d => d.long);

    const latPad  = (latExtent[1]  - latExtent[0])  * 0.06;
    const longPad = (longExtent[1] - longExtent[0]) * 0.06;

    // Longitude → x (west=left, east=right)
    const xScale = d3.scaleLinear()
        .domain([longExtent[0] - longPad, longExtent[1] + longPad])
        .range([PAD.left, totalWidth - PAD.right]);

    // Latitude → y (north=top, south=bottom) — INVERTED range
    const yScale = d3.scaleLinear()
        .domain([latExtent[0] - latPad, latExtent[1] + latPad])
        .range([totalHeight - PAD.bottom, PAD.top]);

    // Precompute pixel (x, y) for each node so we can reuse them
    nodes.forEach(d => {
        d.px = xScale(d.long);
        d.py = yScale(d.lat);
    });


    // ── Scales ──────────────────────────────────────────────

    // Node radius: sqrt scale so that AREA (not radius) is proportional to train count
    const radiusScale = d3.scaleSqrt()
        .domain(d3.extent(nodes, d => d.sum_trains))
        .range([4, 18]);

    // Edge stroke width: linear scale based on connection train volume
    const strokeScale = d3.scaleLinear()
        .domain(d3.extent(links, d => d.sum_trains))
        .range([1, 5]);

    // ── Label helpers ─────────────────────────────────────
    const LABEL_BASE_SIZE = 11;
    const LABEL_BASE_OFFSET = 8;
    const LABEL_MIN_SCALE = 0.85;
    const LABEL_MAX_SCALE = 1.5;

    function labelAnchor(d) {
        return d.px >= totalWidth / 2 ? 'start' : 'end';
    }

    function labelOffset(d, scale) {
        const dx = d.px - totalWidth / 2;
        const dy = d.py - totalHeight / 2;
        const angle = Math.atan2(dy, dx);
        const r = (radiusScale(d.sum_trains) + LABEL_BASE_OFFSET) * scale;
        return { dx: Math.cos(angle) * r, dy: Math.sin(angle) * r };
    }

    function updateLabelsForZoom(k) {
        const grow = Math.max(LABEL_MIN_SCALE, Math.min(LABEL_MAX_SCALE, Math.pow(k, 0.25)));
        const scale = grow / k;
        nodeElems.select('text.node-label')
            .attr('font-size', `${LABEL_BASE_SIZE * scale}px`)
            .attr('dx', d => labelOffset(d, scale).dx)
            .attr('dy', d => labelOffset(d, scale).dy);
    }


    // ── Helper: Classify a delay value ──────────────────────
    // Returns 'amplifier', 'absorber', or 'neutral'
    function classifyDelay(val) {
        if (val === null || val === undefined) return 'neutral';
        if (val >  DELAY_THRESHOLD) return 'amplifier';
        if (val < -DELAY_THRESHOLD) return 'absorber';
        return 'neutral';
    }

    // ── Helper: Get the delay value used for display/color ──
    // Uses per-line delay when a specific line is selected and data exists,
    // otherwise falls back to overall delay_change_avg.
    function getDisplayDelay(d, line) {
        if (line && line !== 'ALL' && d.delay_per_line && d.delay_per_line[line]) {
            return d.delay_per_line[line].delay_change_avg;
        }
        return d.delay_change_avg;
    }

    // ── Helper: Get node fill color ──────────────────────────
    function getNodeColor(d, line) {
        const val = getDisplayDelay(d, line);
        return NODE_COLORS[classifyDelay(val)];
    }

    // ── Helper: Does this node serve the selected line? ──────
    function nodeServesLine(d, line) {
        return line === 'ALL' || (d.lines && d.lines.includes(line));
    }

    // ── Helper: Does this link belong to the selected line? ──
    function linkBelongsToLine(d, line) {
        return line === 'ALL' || (d.lines && d.lines.includes(line));
    }

    // ── Helper: Format delay value with sign ─────────────────
    function fmtDelay(val) {
        if (val === null || val === undefined) return '—';
        return (val >= 0 ? '+' : '') + val.toFixed(2) + ' min';
    }


    // ── Build SVG ────────────────────────────────────────────
    const svg = d3.select('main')
        .append('svg')
        .attr('width',  totalWidth)
        .attr('height', totalHeight)
        .attr('id', 'map-svg')
        .style('position', 'absolute')
        .style('top', 0)
        .style('left', 0);

    // Light background for the map
    svg.append('rect')
        .attr('class', 'map-bg')
        .attr('width',  totalWidth)
        .attr('height', totalHeight)
        .attr('fill', '#F7F6F1');

    // Zoom/pan group — all map content lives inside this <g>
    const g = svg.append('g').attr('class', 'zoom-group');

    // ── Zoom behavior ────────────────────────────────────────
    // Allows mouse-wheel zoom and drag-to-pan
    const zoom = d3.zoom()
        .scaleExtent([0.4, 10])
        .on('zoom', (event) => {
            g.attr('transform', event.transform);
            updateLabelsForZoom(event.transform.k);
        });

    svg.call(zoom);

    // Double-click on background resets zoom to fit
    svg.on('dblclick.zoom', null); // disable d3 default dblclick zoom
    svg.on('dblclick', () => {
        svg.transition().duration(500).call(zoom.transform, d3.zoomIdentity);
    });


    // ── Draw Edges ───────────────────────────────────────────
    // Edges are drawn first so they appear behind nodes
    const edgeGroup = g.append('g').attr('class', 'edges');

    const edgeElems = edgeGroup.selectAll('line.edge')
        .data(links)
        .join('line')
        .attr('class', 'edge')
        // Use precomputed pixel coordinates from both endpoints
        .attr('x1', d => nodeMap.get(d.source)?.px      ?? 0)
        .attr('y1', d => nodeMap.get(d.source)?.py      ?? 0)
        .attr('x2', d => nodeMap.get(d.destination)?.px ?? 0)
        .attr('y2', d => nodeMap.get(d.destination)?.py ?? 0)
        .attr('stroke',       ACTIVE_EDGE)
        .attr('stroke-width', d => strokeScale(d.sum_trains))
        .attr('stroke-linecap', 'round')
        .attr('opacity', 0.9);


    // ── Draw Nodes ───────────────────────────────────────────
    // Each node is a <g> containing a circle and a text label.
    const nodeGroup = g.append('g').attr('class', 'nodes');

    const nodeElems = nodeGroup.selectAll('g.node')
        .data(nodes)
        .join('g')
        .attr('class', 'node')
        .attr('transform', d => `translate(${d.px},${d.py})`)
        .style('cursor', 'pointer')
        // Click → open side panel with station details
        .on('click', (event, d) => {
            event.stopPropagation(); // prevent SVG background click from closing panel
            showSidePanel(d);
        })
        // Hover → show tooltip
        .on('mouseover', (event, d) => showTooltip(event, d))
        .on('mousemove', (event)    => moveTooltip(event))
        .on('mouseout',  ()         => hideTooltip());

    // Station circle
    nodeElems.append('circle')
        .attr('class', 'node-circle')
        .attr('r',            d => radiusScale(d.sum_trains))
        .attr('fill',         d => getNodeColor(d, 'ALL'))
        .attr('stroke',       '#fff')
        .attr('stroke-width', 1.5);

    // Station name label — positioned above the circle
    // Hidden by default; zoom-linked visibility is handled via CSS class toggling
    nodeElems.append('text')
        .attr('class', 'node-label')
        .attr('text-anchor', d => labelAnchor(d))
        .attr('dx', d => labelOffset(d, 1).dx)
        .attr('dy', d => labelOffset(d, 1).dy)
        .attr('font-size', `${LABEL_BASE_SIZE}px`)
        .attr('font-weight', '600')
        .attr('font-family', "'DM Mono', monospace")
        .attr('fill', '#3A3830')
        .attr('paint-order', 'stroke')
        .attr('stroke', '#F7F6F1')
        .attr('stroke-width', 2)
        .attr('stroke-linejoin', 'round')
        .attr('pointer-events', 'none')  // labels don't interfere with mouse events
        .text(d => d.station);

    updateLabelsForZoom(1);


    // ── Update Visualization ─────────────────────────────────
    // Called whenever the user clicks a line filter button.
    // - Nodes on the selected line → full color (by per-line delay)
    // - Nodes not on the selected line → faded grey
    // - Edges on the selected line → colored by line color, full opacity
    // - Edges not on the selected line → faded, thin
    function updateVisualization(line) {

        // ---- Update edges ----
        edgeElems
            .transition().duration(380)
            .attr('stroke', d => {
                if (!linkBelongsToLine(d, line)) return FADED_EDGE;
                // Single line selected: use that line's color
                if (line !== 'ALL') return LINE_COLORS[line] ?? ACTIVE_EDGE;
                // ALL mode: neutral grey
                return ACTIVE_EDGE;
            })
            .attr('stroke-width', d => {
                // Faded edges become thinner to reduce visual clutter
                if (!linkBelongsToLine(d, line)) return 1;
                return strokeScale(d.sum_trains);
            })
            .attr('opacity', d => linkBelongsToLine(d, line) ? 0.95 : 0.25);

        // ---- Update nodes ----
        nodeElems.select('circle.node-circle')
            .transition().duration(380)
            .attr('fill', d => {
                if (!nodeServesLine(d, line)) return FADED_NODE;
                // Recolor node using per-line delay data or overall value
                return getNodeColor(d, line);
            })
            .attr('opacity', d => nodeServesLine(d, line) ? 1 : 0.35)
            .attr('r', d => {
                // Shrink faded nodes slightly to de-emphasise them
                const base = radiusScale(d.sum_trains);
                return nodeServesLine(d, line) ? base : base * 0.65;
            });

        // Fade labels of non-matching nodes
        nodeElems.select('text.node-label')
            .transition().duration(380)
            .attr('opacity', d => nodeServesLine(d, line) ? 1 : 0.15);

        // If side panel is open, refresh it with per-line data
        if (selectedNode) showSidePanel(selectedNode);
    }


    // ── Line Filter Buttons ──────────────────────────────────
    // Positioned at the top-center of the map area.
    // Buttons: ALL, S1, S2, S3, S4, S5, S6, S60
    const btnBar = d3.select('main')
        .append('div')
        .attr('id', 'line-buttons')
        .style('position', 'absolute')
        .style('top',  '10px')
        .style('left', '50%')
        .style('transform', 'translateX(-50%)')
        .style('display', 'flex')
        .style('gap', '6px')
        .style('z-index', 10)
        .style('pointer-events', 'all');

    const lineButtonData = ['ALL', ...SBAHN_LINES];

    btnBar.selectAll('button.line-btn')
        .data(lineButtonData)
        .join('button')
        .attr('class', 'line-btn')
        .attr('id', d => `btn-${d}`)
        .text(d => d === 'ALL' ? 'ALL' : `S${d}`)
        .style('background-color', d => d === 'ALL' ? '#3A3830' : LINE_COLORS[d])
        .style('color',       '#fff')
        .style('border',      'none')
        .style('border-radius', '5px')
        .style('padding',    '5px 13px')
        .style('font-size',  '12px')
        .style('font-weight', '700')
        .style('font-family', "'DM Mono', monospace")
        .style('cursor', 'pointer')
        .style('letter-spacing', '0.03em')
        .style('opacity', d => d === 'ALL' ? 1 : 0.72)
        .style('outline', d => d === 'ALL' ? '2px solid rgba(0,0,0,0.4)' : 'none')
        .style('outline-offset', '2px')
        .style('transition', 'opacity 0.2s, outline 0.2s')
        .on('click', function(event, d) {
            // Update selected line state
            selectedLine = d;

            // Visually highlight the active button
            btnBar.selectAll('button.line-btn')
                .style('opacity',  btn => btn === d ? 1 : 0.65)
                .style('outline',  btn => btn === d ? '2px solid rgba(0,0,0,0.45)' : 'none');

            updateVisualization(d);
        });

    // Run initial render in ALL mode
    updateVisualization('ALL');


    // ── Tooltip ──────────────────────────────────────────────
    // Appears on node hover with a quick summary.
    const tooltip = d3.select('main')
        .append('div')
        .attr('id', 'tooltip')
        .style('position', 'fixed')   // fixed so it doesn't scroll with page
        .style('pointer-events', 'none')
        .style('opacity', 0)
        .style('z-index', 30);

    function showTooltip(event, d) {
        const line = selectedLine;
        const val  = getDisplayDelay(d, line);
        const cls  = classifyDelay(val);
        const icon = cls === 'amplifier' ? '▲' : cls === 'absorber' ? '▼' : '●';
        const col  = NODE_COLORS[cls];
        // Which S-Bahn lines stop here?
        const sbLines = (d.lines || []).filter(l => SBAHN_LINES.includes(l));

        tooltip
            .style('opacity', 1)
            .html(`
                <div class="tt-name">${d.station}</div>
                <div class="tt-type" style="color:${col};">
                    ${icon} ${cls.charAt(0).toUpperCase() + cls.slice(1)}
                </div>
                <div class="tt-row">Delay change: <b>${fmtDelay(val)}</b>${line !== 'ALL' ? ` (S${line})` : ''}</div>
                <div class="tt-row">Trains/week: <b>${d.sum_trains.toLocaleString()}</b></div>
                <div class="tt-row">Lines: <b>${sbLines.map(l => `S${l}`).join(', ') || '—'}</b></div>
            `);
        moveTooltip(event);
    }

    function moveTooltip(event) {
        // Keep tooltip within viewport bounds
        const x = event.clientX + 16;
        const y = event.clientY - 10;
        tooltip
            .style('left', x + 'px')
            .style('top',  y + 'px');
    }

    function hideTooltip() {
        tooltip.style('opacity', 0);
    }


    // ── Side Panel ───────────────────────────────────────────
    // Slides in from the right when a node is clicked.
    // Shows per-station delay breakdown including per-line stats.
    const sidePanel = d3.select('main')
        .append('div')
        .attr('id', 'side-panel')
        .style('position', 'absolute')
        .style('top',    '0')
        .style('right', '-330px')   // start off-screen to the right
        .style('width',  '305px')
        .style('height', '100%')
        .style('background', '#fff')
        .style('border-left', '1px solid #E2E0D9')
        .style('padding',  '20px 18px')
        .style('box-sizing', 'border-box')
        .style('overflow-y', 'auto')
        .style('z-index', 20)
        .style('transition', 'right 0.28s cubic-bezier(0.4,0,0.2,1)')
        .style('box-shadow', '-6px 0 20px rgba(0,0,0,0.08)');

    // ✕ close button inside panel
    sidePanel.append('button')
        .attr('id', 'close-panel')
        .html('&#10005;')
        .style('position', 'absolute')
        .style('top', '14px')
        .style('right', '14px')
        .style('background', 'none')
        .style('border',  '1px solid #ddd')
        .style('border-radius', '50%')
        .style('width', '26px')
        .style('height', '26px')
        .style('font-size', '13px')
        .style('cursor', 'pointer')
        .style('color', '#888')
        .style('display', 'flex')
        .style('align-items', 'center')
        .style('justify-content', 'center')
        .style('line-height', '1')
        .on('click', closeSidePanel);

    // Container for dynamic panel content
    const panelContent = sidePanel.append('div').attr('id', 'panel-content');

    // Build and show the side panel for a given node
    function showSidePanel(d) {
        selectedNode = d;
        const line = selectedLine;

        // Determine current display value:
        // If a specific line is selected AND this node serves it, show per-line value.
        const lineData = (line !== 'ALL' && d.delay_per_line && d.delay_per_line[line])
            ? d.delay_per_line[line]
            : null;

        const displayVal = getDisplayDelay(d, line);
        const cls        = classifyDelay(displayVal);
        const clsColor   = NODE_COLORS[cls];
        const clsLabel   = cls.charAt(0).toUpperCase() + cls.slice(1);

        // S-Bahn lines serving this station
        const sbLines = (d.lines || []).filter(l => SBAHN_LINES.includes(l));

        // Build per-line breakdown rows
        const lineRows = sbLines.map(l => {
            const ld  = d.delay_per_line?.[l];
            if (!ld) return '';
            const lv  = ld.delay_change_avg;
            const lc  = NODE_COLORS[classifyDelay(lv)];
            // Highlight the currently selected line
            const isActive = (l === line);
            return `
                <tr style="background:${isActive ? '#F4F3EE' : 'transparent'};">
                    <td style="padding:4px 6px;">
                        <span class="line-badge" style="background:${LINE_COLORS[l]};">S${l}</span>
                    </td>
                    <td style="padding:4px 6px;text-align:right;color:${lc};font-weight:700;">
                        ${fmtDelay(lv)}
                    </td>
                    <td style="padding:4px 6px;text-align:right;color:#666;">
                        ${ld.arrival_delay_avg.toFixed(2)}
                    </td>
                    <td style="padding:4px 6px;text-align:right;color:#666;">
                        ${ld.departure_delay_avg.toFixed(2)}
                    </td>
                    <td style="padding:4px 6px;text-align:right;color:#888;font-size:10px;">
                        ${ld.sum_trains.toLocaleString()}
                    </td>
                </tr>`;
        }).join('');

        // Build a simple visual delay bar for arrival vs departure comparison
        // Scale: max bar = 8 min displayed as 100%
        const MAX_BAR = 8;
        function barWidth(val) { return Math.min(100, (Math.abs(val) / MAX_BAR) * 100).toFixed(1); }

        const arrVal  = lineData ? lineData.arrival_delay_avg   : d.arrival_delay_avg;
        const depVal  = lineData ? lineData.departure_delay_avg : d.departure_delay_avg;

        panelContent.html(`
            <h3 class="panel-station">${d.station}</h3>

            <!-- Classification badge -->
            <div class="panel-badge" style="background:${clsColor}15;border:1.5px solid ${clsColor};color:${clsColor};">
                ${clsLabel}
                <span class="panel-badge-val">${fmtDelay(displayVal)}</span>
            </div>

            ${line !== 'ALL' ? `<p class="panel-context">Showing data for <strong style="color:${LINE_COLORS[line]};">S${line}</strong></p>` : ''}

            <!-- Arrival vs Departure bars -->
            <div class="panel-section-title">Avg Delay (min)</div>
            <div class="panel-bars">
                <div class="bar-row">
                    <div class="bar-label-l">Arrival</div>
                    <div class="bar-track">
                        <div class="bar-fill" style="width:${barWidth(arrVal)}%;background:#5B8EC4;"></div>
                    </div>
                    <div class="bar-val">${arrVal.toFixed(2)}</div>
                </div>
                <div class="bar-row">
                    <div class="bar-label-l">Departure</div>
                    <div class="bar-track">
                        <div class="bar-fill" style="width:${barWidth(depVal)}%;background:${clsColor};"></div>
                    </div>
                    <div class="bar-val">${depVal.toFixed(2)}</div>
                </div>
            </div>

            <!-- Stats grid -->
            <div class="panel-grid">
                <div class="panel-stat">
                    <div class="stat-label">Trains/week</div>
                    <div class="stat-val">${d.sum_trains.toLocaleString()}</div>
                </div>
                <div class="panel-stat">
                    <div class="stat-label">Category</div>
                    <div class="stat-val">${d.category}</div>
                </div>
            </div>

            <!-- Lines serving station -->
            <div class="panel-section-title">Served by</div>
            <div class="panel-lines">
                ${sbLines.map(l =>
                    `<span class="line-badge" style="background:${LINE_COLORS[l]};">S${l}</span>`
                ).join('')}
            </div>

            <!-- Per-line breakdown table -->
            ${sbLines.length > 0 ? `
            <div class="panel-section-title" style="margin-top:14px;">Per Line Breakdown</div>
            <table class="panel-table">
                <thead>
                    <tr>
                        <th>Line</th>
                        <th>Δ delay</th>
                        <th>Arr</th>
                        <th>Dep</th>
                        <th>Trains</th>
                    </tr>
                </thead>
                <tbody>${lineRows}</tbody>
            </table>
            ` : ''}
        `);

        // Slide panel in
        sidePanel.style('right', '0px');
    }

    function closeSidePanel() {
        sidePanel.style('right', '-330px');
        selectedNode = null;
    }

    // Clicking the SVG background (not a node) closes the panel
    svg.on('click', () => {
        if (selectedNode) closeSidePanel();
    });


    // ── Legend ───────────────────────────────────────────────
    // Fixed bottom-left legend explaining colors and size encoding.
    const legend = d3.select('main')
        .append('div')
        .attr('id', 'legend')
        .style('position', 'absolute')
        .style('top', '18px')
        .style('left',   '16px')
        .style('z-index', 10);
legend.html(`
  <div class="legend-title">Delay Change</div>
  <div class="legend-row">
    <span class="legend-dot" style="background:#C25B4E;"></span>
    Amplifier (worsens delay)
  </div>
  <div class="legend-row">
    <span class="legend-dot" style="background:#9A9790;"></span>
    Neutral (±0.05 min)
  </div>
  <div class="legend-row">
    <span class="legend-dot" style="background:#3D8B82;"></span>
    Absorber (recovers delay)
  </div>
  <hr class="legend-divider">
  <div class="legend-hint">⬤ size = train volume</div>
  <div class="legend-hint">— width = connection volume</div>
`);

} // end drawVVS()