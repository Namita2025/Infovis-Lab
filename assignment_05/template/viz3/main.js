/* ============================================================
   VIZ 3 — Country–Sport Dominance Network
   Force-Directed Bipartite Graph · D3 v7
   File: viz3.js
   ============================================================ */

export async function loadViz3() {
  const dataUrl = file => new URL(`../public/data/${file}`, import.meta.url);

  // ── 1. DATA ──────────────────────────────────────────────
  const raw = await (await fetch(dataUrl('viz3_network.json'))).json();

  // Olympic ring colors per PDF
  const COLOR = {
    Europe:   '#0081C8',  // Olympic Blue
    Americas: '#EE334E',  // Olympic Red
    Asia:     '#FCB131',  // Olympic Yellow/Gold
    Africa:   '#00A651',  // Olympic Green
    Oceania:  '#6F4E9C',  // Olympic Purple
    sport:    '#3A8FB7',  // Pool Blue
  };

  const SPORT_EMOJI = {
    Athletics:    '🏃', Swimming:     '🏊', Gymnastics:   '🤸',
    Cycling:      '🚴', Wrestling:    '🤼', Boxing:       '🥊',
    Shooting:     '🎯', Rowing:       '🚣', Weightlifting:'🏋️',
    Fencing:      '🤺', Football:     '⚽', Basketball:   '🏀',
    Volleyball:   '🏐', Judo:         '🥋', Diving:       '🤿',
    Canoe:        '🛶', Archery:      '🏹', Hockey:       '🏑',
    Tennis:       '🎾', Equestrian:   '🏇', Skiing:       '⛷️',
    'Ice Hockey': '🏒', Skating:      '⛸️', Biathlon:     '🎿',
  };

  // Simplified era options for cleaner view
  const ERAS = [
    { val: '1896-1936', label: 'Pre-War (1896–1936)' },
    { val: '1948-1968', label: 'Cold War Rise (1948–1968)' },
    { val: '1972-1991', label: 'Cold War Peak (1972–1991)' },
    { val: 'all',       label: 'All Eras Combined' },
  ];

  const eras = ERAS.map(e => e.val);

  // ── 2. CONTAINER SETUP ───────────────────────────────────
  const section = d3.select('#viz3-root');
  section.selectAll('*:not(h2)').remove();

  section.append('p').attr('class','viz-story-banner')
    .html('🕸️ <strong>Monopoly vs diversity.</strong> Hub nations (USA, USSR) dominate across sports. Single-sport nations (Jamaica → Sprinting, Kenya → Distance) reveal resource-focused paths to glory.');

  const controls = section.append('div').attr('class','viz-controls');

  // Era selector — styled as vertical pill buttons, shown horizontally
  const eraWrap = controls.append('div').attr('class','control-group era-group');
  eraWrap.append('span').attr('class','control-label').text('Era');
  const eraBtns = eraWrap.append('div').attr('class','btn-group era-btn-group');
  ERAS.forEach((e,i) => {
    eraBtns.append('button')
      .attr('class','toggle-btn era-btn'+(i===2?' active':''))
      .attr('data-val', e.val)
      .text(e.label);
  });

  // Search
  const searchWrap = controls.append('div').attr('class','control-group');
  searchWrap.append('span').attr('class','control-label').text('Search');
  const searchInput = searchWrap.append('input')
    .attr('type','text').attr('placeholder','Country or sport…')
    .attr('class','search-input');

  // Edge weight
  const edgeWrap = controls.append('div').attr('class','control-group');
  edgeWrap.append('span').attr('class','control-label').text('Edge Weight');
  const edgeBtns = edgeWrap.append('div').attr('class','btn-group');
  ['Medal Count','Gold Only','Years Active'].forEach((v,i) => {
    edgeBtns.append('button')
      .attr('class','toggle-btn'+(i===0?' active':''))
      .attr('data-val',v).text(v);
  });

  // Min threshold slider (default to 10 for cleaner view)
  const threshWrap = controls.append('div').attr('class','control-group');
  threshWrap.append('span').attr('class','control-label').text('Min Medals Threshold');
  const threshRow = threshWrap.append('div').attr('class','decade-row');
  const threshLabel = threshRow.append('span').attr('class','decade-display').text('8');
  const threshSlider = threshRow.append('input')
    .attr('type','range').attr('min',5).attr('max',20).attr('value',8)
    .attr('class','decade-slider');
  threshWrap.append('span').attr('class','control-hint')
    .text('Higher threshold = cleaner network · Recommended: 8+');

  // Node toggles
  const nodeWrap = controls.append('div').attr('class','control-group');
  nodeWrap.append('span').attr('class','control-label').text('Nodes');
  const nodeBtns = nodeWrap.append('div').attr('class','btn-group');
  ['Countries ON','Sports ON','Labels ON'].forEach((v,i) => {
    nodeBtns.append('button')
      .attr('class','toggle-btn active')
      .attr('data-val',v).text(v);
  });

  // Layout
  const layoutWrap = controls.append('div').attr('class','control-group');
  layoutWrap.append('span').attr('class','control-label').text('Layout');
  const layoutBtns = layoutWrap.append('div').attr('class','btn-group');
  ['Force','Radial','Arc'].forEach((v,i) => {
    layoutBtns.append('button')
      .attr('class','toggle-btn'+(i===0?' active':''))
      .attr('data-val',v).text(v);
  });

  // ── 3. SVG ───────────────────────────────────────────────
  const chartWrap = section.append('div').attr('class','chart-wrap network-wrap');

  const W = Math.min(window.innerWidth - 80, 960);
  const H = 620;

  const svg = chartWrap.append('svg')
    .attr('width', W).attr('height', H)
    .attr('class','viz-svg network-svg');

  // Defs: arrowhead, glows
  const defs = svg.append('defs');
  defs.append('marker').attr('id','arrow')
    .attr('viewBox','0 0 10 10').attr('refX',18).attr('refY',5)
    .attr('markerWidth',6).attr('markerHeight',6).attr('orient','auto')
    .append('path').attr('d','M 0 0 L 10 5 L 0 10 z').attr('fill','#ccc');

  // Glow filters per continent + sport
  Object.entries(COLOR).forEach(([key,col]) => {
    const f = defs.append('filter').attr('id',`glow-${key}`);
    f.append('feGaussianBlur').attr('stdDeviation','4').attr('result','blur');
    const merge = f.append('feMerge');
    merge.append('feMergeNode').attr('in','blur');
    merge.append('feMergeNode').attr('in','SourceGraphic');
  });

  // Layer order matters for z-index
  const linkG  = svg.append('g').attr('class','link-g');
  const nodeG  = svg.append('g').attr('class','node-g');
  const labelG = svg.append('g').attr('class','label-g');
  const annotG = svg.append('g').attr('class','annot-g');

  // Info panel (right side, inside SVG as foreignObject)
  const fObj = svg.append('foreignObject')
    .attr('x', W - 210).attr('y', 10)
    .attr('width', 200).attr('height', H - 20);
  const infoPanel = fObj.append('xhtml:div').attr('class','network-info-panel');
  infoPanel.append('div').attr('class','nip-title').text('Click a node to inspect');
  infoPanel.append('div').attr('class','nip-body').text('');

  // KPI bar
  const kpiBar = section.insert('div','div.chart-wrap').attr('class','kpi-bar');
  ['Sports','Countries','Clusters','Top Hub'].forEach(k => {
    const card = kpiBar.append('div').attr('class','kpi-card');
    card.append('div').attr('class','kpi-label').text(k);
    card.append('div').attr('class','kpi-value').attr('data-key',k).text('—');
  });

  // ── 4. STATE ─────────────────────────────────────────────
  let state = {
    era:         '1896-1936',
    edgeWeight:  'Medal Count',
    threshold:   8,
    layout:      'Force',
    search:      '',
    showCountry: true,
    showSport:   true,
    showLabels:  true,
    hovered:     null,
    pinned:      null,
  };

  let simulation;

  // ── 5. RENDER ────────────────────────────────────────────
  function render() {
    // Filter rows by era and threshold
    let rows = raw;
    if (state.era !== 'all') {
      const [lo,hi] = state.era.split('-').map(Number);
      rows = rows.filter(d => {
        const y = d.YearStart ?? d.Year;
        return y >= lo && y <= hi;
      });
    }

    // Aggregate medals per NOC-Sport pair
    const aggMap = new Map();
    rows.forEach(d => {
      const key = `${d.NOC}||${d.Sport}`;
      if (!aggMap.has(key)) {
        aggMap.set(key, {
          NOC: d.NOC, Sport: d.Sport, Continent: d.Continent,
          medals: 0, gold: 0, years: new Set(), Era: d.Era
        });
      }
      const r = aggMap.get(key);
      r.medals += d.medals ?? 1;
      r.gold   += d.gold   ?? 0;
      if (d.Year) r.years.add(d.Year);
    });
    let pairs = [...aggMap.values()];

    // Apply threshold
    pairs = pairs.filter(d => {
      const w = state.edgeWeight === 'Gold Only' ? d.gold
              : state.edgeWeight === 'Years Active' ? d.years.size
              : d.medals;
      return w >= state.threshold;
    });

    // Build nodes and links
    const countrySet = new Map();
    const sportSet   = new Map();
    pairs.forEach(p => {
      if (!countrySet.has(p.NOC))
        countrySet.set(p.NOC, { id: p.NOC, type:'country', continent: p.Continent, medals:0, connections:0 });
      if (!sportSet.has(p.Sport))
        sportSet.set(p.Sport, { id: p.Sport, type:'sport', medals:0, connections:0 });
      countrySet.get(p.NOC).medals += p.medals;
      countrySet.get(p.NOC).connections++;
      sportSet.get(p.Sport).medals += p.medals;
      sportSet.get(p.Sport).connections++;
    });

    const countryNodes = state.showCountry ? [...countrySet.values()] : [];
    const sportNodes   = state.showSport   ? [...sportSet.values()]   : [];
    const nodes = [...countryNodes, ...sportNodes];

    const links = pairs
      .filter(p => state.showCountry && state.showSport)
      .map(p => ({
        source: p.NOC, target: p.Sport,
        value: state.edgeWeight === 'Gold Only'    ? p.gold
             : state.edgeWeight === 'Years Active' ? p.years.size
             : p.medals,
        continent: p.Continent,
        medals: p.medals,
        gold: p.gold,
      }));

    // Radius scale
    const rScale = d3.scaleSqrt()
      .domain([0, d3.max(nodes, d => d.medals) || 1])
      .range([5, 28]);
    const lScale = d3.scaleLinear()
      .domain([0, d3.max(links, d => d.value) || 1])
      .range([0.5, 6]);

    // Search highlight
    const searchQ = state.search.toLowerCase().trim();

    // Identify isolated nodes (single sport connection)
    const isolated = new Set(countryNodes.filter(n => n.connections === 1).map(n => n.id));

    // Hub nations (top 5 by connections)
    const hubs = [...countryNodes].sort((a,b) => b.connections - a.connections).slice(0,5);
    const hubSet = new Set(hubs.map(h => h.id));

    // ── KPI BAR ────────────────────────────────────────────
    const topHub = hubs[0];
    document.querySelector('.kpi-card [data-key="Sports"]').textContent    = sportNodes.length;
    document.querySelector('.kpi-card [data-key="Countries"]').textContent = countryNodes.length;
    document.querySelector('.kpi-card [data-key="Clusters"]').textContent  = isolated.size;
    document.querySelector('.kpi-card [data-key="Top Hub"]').textContent   = topHub ? topHub.id : '—';

    // ── SIMULATION ─────────────────────────────────────────
    if (simulation) simulation.stop();

    // Layout-based forces
    const cx = (W - 210) / 2;  // center x (leave room for info panel)
    const cy = H / 2;

    simulation = d3.forceSimulation(nodes)
      .force('charge', d3.forceManyBody().strength(d =>
        d.type === 'sport' ? -180 : -100
      ))
      .force('collision', d3.forceCollide(d =>
        rScale(d.medals) + 5
      ));

    if (state.layout === 'Force') {
      simulation
        .force('link', d3.forceLink(links).id(d => d.id)
          .distance(d => 60 + lScale(d.value) * 5)
          .strength(0.4))
        .force('center', d3.forceCenter(cx, cy))
        .force('x', d3.forceX(cx).strength(0.04))
        .force('y', d3.forceY(cy).strength(0.04));

    } else if (state.layout === 'Radial') {
      // Sport nodes in center ring, countries on outer ring
      const sportList = [...sportSet.keys()];
      const countryList = [...countrySet.keys()];
      nodes.forEach(n => {
        if (n.type === 'sport') {
          const i = sportList.indexOf(n.id);
          const a = (i / sportList.length) * 2 * Math.PI;
          n.fx = cx + 140 * Math.cos(a);
          n.fy = cy + 140 * Math.sin(a);
        } else {
          n.fx = null; n.fy = null;
        }
      });
      simulation
        .force('link', d3.forceLink(links).id(d => d.id).distance(120))
        .force('radial', d3.forceRadial(270, cx, cy).strength(d =>
          d.type === 'country' ? 0.5 : 0
        ))
        .force('center', null);

    } else if (state.layout === 'Arc') {
      // Countries on left arc, sports on right arc
      const countryList = [...countrySet.keys()];
      const sportList   = [...sportSet.keys()];
      nodes.forEach(n => {
        if (n.type === 'country') {
          const i = countryList.indexOf(n.id);
          n.fx = 90;
          n.fy = 50 + (i / Math.max(countryList.length-1,1)) * (H - 100);
        } else {
          const i = sportList.indexOf(n.id);
          n.fx = W - 290;
          n.fy = 50 + (i / Math.max(sportList.length-1,1)) * (H - 100);
        }
      });
      simulation.force('link', d3.forceLink(links).id(d=>d.id).distance(60))
        .force('center', null).force('charge', null).force('collision', null);
    }

    // ── LINKS ──────────────────────────────────────────────
    const linkSel = linkG.selectAll('.net-link').data(links, d => d.source.id||d.source+'_'+d.target.id||d.target);
    linkSel.join(
      enter => enter.append('line').attr('class','net-link')
        .attr('stroke', d => COLOR[d.continent] ?? '#ccc')
        .attr('stroke-width', d => lScale(d.value))
        .attr('stroke-opacity', 0.35),
      update => update
        .attr('stroke', d => COLOR[d.continent] ?? '#ccc')
        .attr('stroke-width', d => lScale(d.value)),
      exit => exit.remove()
    );

    // ── NODES ──────────────────────────────────────────────
    const nodeSel = nodeG.selectAll('.net-node').data(nodes, d => d.id);
    nodeSel.join(
      enter => {
        const g = enter.append('g').attr('class', 'net-node').style('cursor','pointer');

        // Outer glow ring for hubs
        g.filter(d => d.type === 'country' && hubSet.has(d.id))
          .append('circle').attr('class','hub-glow')
          .attr('r', d => rScale(d.medals) + 8)
          .attr('fill', d => COLOR[d.continent])
          .attr('opacity', 0.15)
          .attr('filter', d => `url(#glow-${d.continent})`);

        // Main circle
        g.append('circle').attr('class','node-circle')
          .attr('r', d => rScale(d.medals))
          .attr('fill', d => d.type === 'sport' ? COLOR.sport : COLOR[d.continent])
          .attr('stroke', '#fff').attr('stroke-width', 1.8)
          .attr('opacity', 0.9);

        // Sport emoji inside sport node
        g.filter(d => d.type === 'sport').append('text')
          .attr('class','sport-emoji')
          .attr('text-anchor','middle').attr('dominant-baseline','central')
          .attr('font-size', 11).attr('pointer-events','none')
          .text(d => SPORT_EMOJI[d.id] ?? '🏅');

        // Drag + click
        g.call(drag(simulation))
          .on('click', function(event, d) {
            event.stopPropagation();
            state.pinned = state.pinned === d.id ? null : d.id;
            updateHighlight();
            updateInfoPanel(d, links);
          })
          .on('mouseover', function(event, d) {
            state.hovered = d.id;
            updateHighlight();
          })
          .on('mouseout', function() {
            if (!state.pinned) { state.hovered = null; updateHighlight(); }
          });

        return g;
      },
      update => update,
      exit => exit.remove()
    );

    // ── LABELS ─────────────────────────────────────────────
    const labelSel = labelG.selectAll('.net-label').data(
      state.showLabels ? nodes : [], d => d.id
    );
    labelSel.join(
      enter => enter.append('text').attr('class','net-label')
        .attr('font-size', d => d.type === 'sport' ? 9 : 10)
        .attr('font-weight', d => hubSet.has(d.id) ? 800 : 500)
        .attr('fill', d => d.type === 'sport' ? '#6b6760' : COLOR[d.continent])
        .attr('text-anchor','middle')
        .attr('pointer-events','none'),
      update => update,
      exit => exit.remove()
    )
    .text(d => d.type === 'sport' ? d.id : d.id)
    .attr('opacity', d => {
      if (!searchQ) return 1;
      return d.id.toLowerCase().includes(searchQ) ? 1 : 0.15;
    });

    // ── ANNOTATION CALLOUTS (static, on notable clusters) ──
    annotG.selectAll('*').remove();
    if (state.layout === 'Force') {
      // Will be placed after simulation settles (in tick handler)
    }

    // ── TICK ───────────────────────────────────────────────
    simulation.on('tick', () => {
      linkG.selectAll('.net-link')
        .attr('x1', d => d.source.x).attr('y1', d => d.source.y)
        .attr('x2', d => d.target.x).attr('y2', d => d.target.y);

      nodeG.selectAll('.net-node')
        .attr('transform', d => `translate(${
          Math.max(rScale(d.medals), Math.min(W-210-rScale(d.medals), d.x))
        },${
          Math.max(rScale(d.medals), Math.min(H-rScale(d.medals), d.y))
        })`);

      labelG.selectAll('.net-label')
        .attr('x', d => Math.max(rScale(d.medals), Math.min(W-210-rScale(d.medals), d.x)))
        .attr('y', d => Math.max(rScale(d.medals), Math.min(H-rScale(d.medals), d.y)) + rScale(d.medals) + 11);
    });

    simulation.on('end', () => drawAnnotations(nodes, links, rScale));

    // ── RIBBON SYNC — Update medal counts ─────────────────────────
    // viz3 doesn't have gold/silver/bronze breakdown
    // Actual detailed counts come from viz2 via shared state

    // ── Click outside to depin ──
    svg.on('click', () => {
      state.pinned = null; state.hovered = null;
      updateHighlight();
      infoPanel.select('.nip-title').text('Click a node to inspect');
      infoPanel.select('.nip-body').text('');
    });

    function updateHighlight() {
      const focus = state.pinned ?? state.hovered;
      if (!focus) {
        nodeG.selectAll('.net-node').attr('opacity',1);
        linkG.selectAll('.net-link').attr('stroke-opacity',0.35);
        labelG.selectAll('.net-label').attr('opacity',1);
        return;
      }
      const connected = new Set([focus]);
      links.forEach(l => {
        const src = typeof l.source === 'object' ? l.source.id : l.source;
        const tgt = typeof l.target === 'object' ? l.target.id : l.target;
        if (src === focus) connected.add(tgt);
        if (tgt === focus) connected.add(src);
      });
      nodeG.selectAll('.net-node').attr('opacity', d => connected.has(d.id) ? 1 : 0.1);
      linkG.selectAll('.net-link').attr('stroke-opacity', d => {
        const src = typeof d.source === 'object' ? d.source.id : d.source;
        const tgt = typeof d.target === 'object' ? d.target.id : d.target;
        return (src===focus||tgt===focus) ? 0.75 : 0.05;
      });
      labelG.selectAll('.net-label').attr('opacity', d => connected.has(d.id) ? 1 : 0.08);
    }

    function updateInfoPanel(d, links) {
      const conLinks = links.filter(l => {
        const src = typeof l.source === 'object' ? l.source.id : l.source;
        const tgt = typeof l.target === 'object' ? l.target.id : l.target;
        return src === d.id || tgt === d.id;
      });

      const isHub      = hubSet.has(d.id);
      const isIsolated = isolated.has(d.id);
      const sportNames = conLinks.map(l => {
        const src = typeof l.source === 'object' ? l.source.id : l.source;
        const tgt = typeof l.target === 'object' ? l.target.id : l.target;
        return src === d.id ? tgt : src;
      }).filter((s,i,a) => a.indexOf(s)===i);

      infoPanel.select('.nip-title')
        .text(d.type === 'sport' ? `🏅 ${d.id}` : `${d.id} ${isHub?'🌟':isIsolated?'🎯':''}`);

      infoPanel.select('.nip-body').html(`
        <div class="nip-row"><span>Type</span><strong>${d.type==='sport'?'Sport':'Country'}</strong></div>
        ${d.continent ? `<div class="nip-row"><span>Region</span><strong style="color:${COLOR[d.continent]}">${d.continent}</strong></div>` : ''}
        <div class="nip-row"><span>Total medals</span><strong>${d.medals}</strong></div>
        <div class="nip-row"><span>Connections</span><strong>${d.connections}</strong></div>
        ${isHub      ? '<div class="nip-tag hub">🌟 Hub Nation</div>' : ''}
        ${isIsolated ? '<div class="nip-tag isolated">🎯 Single-sport specialist</div>' : ''}
        <div class="nip-sports-title">${d.type==='country'?'Sports dominated:':'Top countries:'}</div>
        ${sportNames.slice(0,8).map(s => {
          const lk = conLinks.find(l => {
            const src = typeof l.source==='object'?l.source.id:l.source;
            const tgt = typeof l.target==='object'?l.target.id:l.target;
            return src===s||tgt===s;
          });
          const emoji = SPORT_EMOJI[s] ?? '🏅';
          return `<div class="nip-sport-row">${emoji} <span>${s}</span> <strong>${lk?.value??''}</strong></div>`;
        }).join('')}
      `);
    }
  }

  // ── 6. ANNOTATION CALLOUTS ───────────────────────────────
  function drawAnnotations(nodes, links, rScale) {
    annotG.selectAll('*').remove();
    if (state.layout !== 'Force') return;

    // Find Jamaica and Kenya if present
    ['USA','USSR','Jamaica','Kenya'].forEach(noc => {
      const n = nodes.find(d => d.id === noc || d.id.includes(noc));
      if (!n || !n.x) return;
      const labels = {
        USA:    { text:'🇺🇸 USA — hub nation', sub:'Dominates 8+ sports', color:'#006BA6' },
        USSR:   { text:'🇷🇺 USSR/Russia',       sub:'Cold War rival',       color:'#C8102E' },
        Jamaica:{ text:'🇯🇲 Jamaica',            sub:'One lane, one legacy', color:'#007A4D' },
        Kenya:  { text:'🇰🇪 Kenya',              sub:'Built on altitude',    color:'#007A4D' },
      };
      const lb = labels[noc] || labels[Object.keys(labels).find(k => noc.includes(k))];
      if (!lb) return;

      const nx = Math.max(30, Math.min(W-240, n.x));
      const ny = Math.max(20, Math.min(H-40, n.y));
      const offX = ny > H/2 ? -110 : 20;
      const offY = ny > H/2 ?  -50 : 20;
      const bx = nx + offX, by = ny + offY;

      annotG.append('line')
        .attr('x1', nx).attr('y1', ny)
        .attr('x2', bx+60).attr('y2', by+12)
        .attr('stroke', lb.color).attr('stroke-width', 1)
        .attr('stroke-dasharray','4,3').attr('opacity',0.6);

      const g = annotG.append('g');
      g.append('rect')
        .attr('x', bx).attr('y', by)
        .attr('width', 120).attr('height', 34)
        .attr('rx', 6).attr('fill','#fff')
        .attr('stroke', '#e2ddd6').attr('stroke-width',1)
        .attr('filter','drop-shadow(0 2px 4px rgba(0,0,0,.08))');
      g.append('text').attr('x', bx+8).attr('y', by+13)
        .attr('font-size',10).attr('font-weight',700)
        .attr('fill', lb.color).text(lb.text);
      g.append('text').attr('x', bx+8).attr('y', by+26)
        .attr('font-size',9).attr('fill','#6b6760').text(lb.sub);
    });
  }

  // ── 7. DRAG HELPER ───────────────────────────────────────
  function drag(sim) {
    return d3.drag()
      .on('start', (e, d) => {
        if (!e.active) sim.alphaTarget(0.3).restart();
        d.fx = d.x; d.fy = d.y;
      })
      .on('drag', (e, d) => { d.fx = e.x; d.fy = e.y; })
      .on('end',  (e, d) => {
        if (!e.active) sim.alphaTarget(0);
        d.fx = null; d.fy = null;
      });
  }

  // ── 8. LEGEND ────────────────────────────────────────────
  const legendDiv = section.append('div').attr('class','viz-legend');

  // Country node swatches
  const ALL_CONTINENTS = ['Europe','Americas','Asia','Africa','Oceania'];
  ALL_CONTINENTS.forEach(c => {
    const item = legendDiv.append('div').attr('class','legend-item');
    item.append('span').attr('class','legend-circle').style('background',COLOR[c]);
    item.append('span').attr('class','legend-text').text(c);
  });

  // Sport node
  const sportItem = legendDiv.append('div').attr('class','legend-item');
  sportItem.append('span').attr('class','legend-circle').style('background',COLOR.sport);
  sportItem.append('span').attr('class','legend-text').text('Sport node');

  // Size legend
  legendDiv.append('div').attr('class','legend-item')
    .html(`<span style="width:8px;height:8px;border-radius:50%;background:rgba(0,0,0,.15);border:1px solid #aaa;display:inline-block;margin-right:5px;"></span>
           <span class="legend-text">Node size = medals</span>`);

  legendDiv.append('div').attr('class','legend-item')
    .html(`<span style="width:20px;height:2px;background:#ccc;display:inline-block;margin-right:5px;"></span>
           <span class="legend-text">Edge thickness = medals</span>`);

  legendDiv.append('span').attr('class','legend-note')
    .text('Drag nodes · Click to inspect · 🌟 Hub · 🎯 Single-sport specialist');

  // ── 9. WIRE CONTROLS ─────────────────────────────────────
  // Era buttons
  d3.selectAll('#viz3 .era-btn').on('click', function() {
    d3.selectAll('#viz3 .era-btn').classed('active',false);
    d3.select(this).classed('active',true);
    state.era = this.dataset.val;
    state.pinned = null; state.hovered = null;
    render();
  });

  // Search
  searchInput.on('input', function() {
    state.search = this.value;
    labelG.selectAll('.net-label').attr('opacity', d => {
      if (!state.search) return 1;
      return d.id.toLowerCase().includes(state.search.toLowerCase()) ? 1 : 0.12;
    });
    nodeG.selectAll('.net-node').attr('opacity', d => {
      if (!state.search) return 1;
      return d.id.toLowerCase().includes(state.search.toLowerCase()) ? 1 : 0.2;
    });
  });

  // Edge weight
  d3.selectAll('#viz3 .btn-group:nth-of-type(2) .toggle-btn').on('click', function() {
    d3.selectAll('#viz3 .btn-group:nth-of-type(2) .toggle-btn').classed('active',false);
    d3.select(this).classed('active',true);
    state.edgeWeight = this.dataset.val;
    render();
  });

  // Threshold
  threshSlider.on('input', function() {
    state.threshold = +this.value;
    threshLabel.text(this.value);
    render();
  });

  // Node toggles
  const nodeToggleMap = ['showCountry','showSport','showLabels'];
  d3.selectAll('#viz3 .btn-group:nth-of-type(3) .toggle-btn').each(function(d,i) {
    d3.select(this).on('click', function() {
      const key = nodeToggleMap[i];
      state[key] = !state[key];
      d3.select(this).classed('active', state[key]);
      render();
    });
  });

  // Layout
  d3.selectAll('#viz3 .btn-group:nth-of-type(4) .toggle-btn').on('click', function() {
    d3.selectAll('#viz3 .btn-group:nth-of-type(4) .toggle-btn').classed('active',false);
    d3.select(this).classed('active',true);
    state.layout = this.dataset.val;
    // Clear fixed positions from previous radial/arc layouts
    if (state.layout === 'Force') {
      nodeG.selectAll('.net-node').each(function(d) { d.fx = null; d.fy = null; });
    }
    render();
  });

  render();
}
