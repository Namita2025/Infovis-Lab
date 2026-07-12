// VIZ 2 — Medal Efficiency by Country (Choropleth), D3 v7, ES module

export async function loadViz2() {

  const [raw, world] = await Promise.all([
    fetch('./public/data/viz2_efficiency_yearly.json').then(r => r.json()),
    fetch('./public/data/countries.geo.json').then(r => r.json())
  ]);

  const YEARS = [...new Set(raw.map(d => d.Year))].sort((a, b) => a - b);
  const CANCELLED_YEARS = new Set([1916, 1940, 1944]);
  const SPARSE_THRESHOLD = 5;
  const MEDAL_TYPES = ['All', 'Gold', 'Silver', 'Bronze'];

  const CONTINENT_COLOR = {
    Europe: '#0081C8', Americas: '#EE334E', Asia: '#FCB131',
    Africa: '#00A651', Oceania: '#6F4E9C',
  };
  const COLOR_ZERO_MEDALS = '#b7b2a4';
  const COLOR_NO_DATA     = '#f2f0ea';
  const COLOR_NO_GAMES    = '#dedad0';

  // Historical/dissolved NOCs mapped to their modern successor's ISO-3,
  // purely for rendering on today's borders (see footnote in UI).
  const NOC_TO_ISO = {
    AFG:'AFG', ARG:'ARG', AUS:'AUS', AUT:'AUT', AZE:'AZE', BEL:'BEL', BEN:'BEN',
    BGR:'BGR', BRA:'BRA', CAN:'CAN', CHN:'CHN', CIV:'CIV', COL:'COL', CRO:'HRV',
    CUB:'CUB', CZE:'CZE', DNK:'DNK', ECU:'ECU', EGY:'EGY', ESP:'ESP', EST:'EST',
    ETH:'ETH', FIN:'FIN', FRA:'FRA', GBR:'GBR', GEO:'GEO', DEU:'DEU', GHA:'GHA',
    GRC:'GRC', IND:'IND', IRL:'IRL', ISR:'ISR', ITA:'ITA', JPN:'JPN', KAZ:'KAZ',
    KEN:'KEN', KOR:'KOR', LVA:'LVA', LTU:'LTU', LUX:'LUX', MAR:'MAR', MDA:'MDA',
    MEX:'MEX', MKD:'MKD', MLI:'MLI', NED:'NLD', NPL:'NPL', NOR:'NOR', NZL:'NZL',
    PAK:'PAK', PER:'PER', PHL:'PHL', POL:'POL', PRT:'PRT', PRK:'PRK', QAT:'QAT',
    ROU:'ROU', RUS:'RUS', SEN:'SEN', SGP:'SGP', SVN:'SVN', SWE:'SWE', THA:'THA',
    TTO:'TTO', TUN:'TUN', TUR:'TUR', UKR:'UKR', URY:'URY', USA:'USA', UZB:'UZB',
    VEN:'VEN', VNM:'VNM', ZAF:'ZAF',
    ALG:'DZA', AND:'AND', ANG:'AGO', ARU:'ABW', ASA:'ASM', BAH:'BHS', BAN:'BGD',
    BDI:'BDI', BER:'BMU', BIZ:'BRN', BLR:'BLR', BOT:'BWA', CAM:'KHM', CYP:'CYP',
    DJI:'DJI', ESA:'SLV', FIJ:'FJI', GEQ:'GNQ', GUA:'GTM', GUY:'GUY', HKG:'HKG',
    HUN:'HUN', INA:'IDN', IRI:'IRN', ISL:'ISL', ISV:'VIR', JAM:'JAM', KWT:'KWT',
    LBN:'LBN', LSO:'LSO', MGL:'MNG', MCO:'MCO', MOZ:'MOZ', NCA:'NCA', NGA:'NGA',
    PAN:'PAN', PRI:'PRI', SUI:'CHE', SUR:'SUR', SVK:'SVK', SYR:'SYR', TCD:'TCD',
    TZA:'TZA', ZMB:'ZMB', ZWE:'ZWE', DEN:'DNK', GRE:'GRC', RSA:'ZAF',
    URS:'RUS', GDR:'DEU', FRG:'DEU', TCH:'CZE', YUG:'SRB',
    BOH:'CZE', SCG:'SRB', EUN:'RUS', ANZ:'AUS',
  };

  // Aggregate by modern ISO-3, merging historical NOCs that share a
  // successor (e.g. URS + RUS + EUN all -> RUS) instead of overwriting.
  function aggregateByISO(rows) {
    const byISO = new Map();
    rows.forEach(d => {
      const iso = NOC_TO_ISO[d.NOC];
      if (!iso) return;
      let c = byISO.get(iso);
      if (!c) {
        c = { iso, Continent: d.Continent, athletes: 0, Gold: 0, Silver: 0, Bronze: 0, sports: new Map() };
        byISO.set(iso, c);
      }
      c.athletes += d.athletes || 0;
      c.Gold += d.Gold || 0;
      c.Silver += d.Silver || 0;
      c.Bronze += d.Bronze || 0;
      if (d.best_sport && d.best_sport !== 0) {
        c.sports.set(d.best_sport, (c.sports.get(d.best_sport) || 0) + 1);
      }
    });
    return [...byISO.values()].map(c => {
      const medals = c.Gold + c.Silver + c.Bronze;
      let best_sport = 0, best = -1;
      c.sports.forEach((n, s) => { if (n > best) { best = n; best_sport = s; } });
      return {
        iso: c.iso, Continent: c.Continent, athletes: c.athletes,
        medals, Gold: c.Gold, Silver: c.Silver, Bronze: c.Bronze,
        efficiency: c.athletes > 0 ? medals / c.athletes : 0,
        best_sport, sparse: c.athletes < SPARSE_THRESHOLD,
      };
    });
  }

  const cumulative = aggregateByISO(raw);

  // ── DOM ──────────────────────────────────────────────────
  const section = d3.select('#viz2');
  section.selectAll(':scope > *:not(h2)').remove();

  section.append('p').attr('class', 'viz-story-banner').html(
    '🏅 <strong>Small nations, outsized glory.</strong> Medal Efficiency = medals ÷ athletes sent. ' +
    'Colored by continent (as in Viz 1) — darker shade means higher efficiency within that continent.'
  );

  const controlsRow = section.append('div').attr('class', 'viz-controls viz2-controls-row');

  const medalWrap = controlsRow.append('div').attr('class', 'control-group viz2-medal-filter');
  medalWrap.append('span').attr('class', 'control-label').text('Medal type');
  const medalBtns = medalWrap.append('div').attr('class', 'btn-group');
  MEDAL_TYPES.forEach((m, i) => {
    medalBtns.append('button')
      .attr('class', 'toggle-btn' + (i === 0 ? ' active' : ''))
      .attr('data-val', m).text(m);
  });

  const mapWrap = section.append('div').attr('class', 'viz2-map-wrap').style('position', 'relative');
  const nogamesBanner = mapWrap.append('div').attr('class', 'viz2-nogames-banner').style('display', 'none');

  const svg = mapWrap.append('svg').attr('class', 'viz-svg');
  const defs = svg.append('defs');
  const oceanG = svg.append('g');
  const mapG = svg.append('g').attr('class', 'map-layer');
  const glyphG = svg.append('g').attr('class', 'glyph-layer');

  // Year slider lives below the map, matching Viz1's bottom time control.
  const sliderWrap = section.append('div').attr('class', 'control-group viz2-slider-wrap');
  sliderWrap.append('span').attr('class', 'control-label').text('Year');
  const sliderRow = sliderWrap.append('div').attr('class', 'decade-row');
  const yearLabel = sliderRow.append('span').attr('class', 'decade-display viz2-year-label').text('All-time (1896-2016)');
  const yearSlider = sliderRow.append('input')
    .attr('type', 'range').attr('class', 'decade-slider')
    .attr('min', -1).attr('max', YEARS.length - 1).attr('step', 1).attr('value', -1);
  const resetBtn = sliderRow.append('button').attr('class', 'toggle-btn viz2-reset-btn').text('Reset');

  defs.append('pattern')
    .attr('id', 'viz2-hatch').attr('width', 6).attr('height', 6)
    .attr('patternUnits', 'userSpaceOnUse').attr('patternTransform', 'rotate(45)')
    .append('rect').attr('width', 6).attr('height', 6).attr('fill', 'none');
  d3.select('#viz2-hatch').append('line')
    .attr('x1', 0).attr('y1', 0).attr('x2', 0).attr('y2', 6)
    .attr('stroke', 'rgba(255,255,255,0.85)').attr('stroke-width', 2.5);

  // Legend: one small white->continent-color chip per continent
  const legend = section.append('div').attr('class', 'viz2-legend');
  const continentLegend = legend.append('div').attr('class', 'viz2-continent-legend');
  Object.entries(CONTINENT_COLOR).forEach(([name, color]) => {
    const item = continentLegend.append('div').attr('class', 'continent-legend-item');
    item.append('div').attr('class', 'continent-legend-swatch')
      .style('background', `linear-gradient(to right, #ffffff, ${color})`);
    item.append('span').text(name);
  });
  legend.append('div').attr('class', 'legend-row')
    .html('<span class="legend-swatch hatch"></span><span>Hatched = fewer than 5 athletes (low-confidence)</span>');
  legend.append('div').attr('class', 'legend-row')
    .html(`<span class="legend-swatch zero" style="background:${COLOR_ZERO_MEDALS}"></span><span>Participated, won 0 medals</span>`);
  legend.append('div').attr('class', 'legend-row')
    .html(`<span class="legend-swatch nodata" style="background:${COLOR_NO_DATA}"></span><span>No team sent / did not exist that year</span>`);

  section.append('p').attr('class', 'viz2-footnote')
    .text('Medals for dissolved nations (USSR, East/West Germany, Czechoslovakia, Yugoslavia, etc.) are shown on their modern successor\'s borders for visualization purposes only.');

  let tooltip = d3.select('body').select('.viz-tooltip');
  if (tooltip.empty()) {
    tooltip = d3.select('body').append('div').attr('class', 'viz-tooltip').style('display', 'none');
  }

  // ── STATE ────────────────────────────────────────────────
  const state = { yearIndex: -1, medalType: 'All' };
  const selectedYear = () => (state.yearIndex >= 0 ? YEARS[state.yearIndex] : null);

  function currentRows() {
    const year = selectedYear();
    return year === null ? cumulative : aggregateByISO(raw.filter(d => d.Year === year));
  }

  function medalCount(d) {
    return state.medalType === 'All' ? d.medals : (d[state.medalType] || 0);
  }

  function buildLookup() {
    const lookup = new Map();
    currentRows().forEach(d => {
      const medals = medalCount(d);
      const efficiency = d.athletes > 0 ? medals / d.athletes : 0;
      lookup.set(d.iso, { ...d, medals, efficiency });
    });
    return lookup;
  }

  // ── PROJECTION (fitWidth, then trim height to actual content —
  //    avoids both side letterboxing and excess vertical whitespace) ──
  let width = 800, height = 420;
  const projection = d3.geoMercator();
  const path = d3.geoPath(projection);
  const worldFC = { type: 'FeatureCollection', features: world.features };

  function resize() {
    width = Math.max(320, mapWrap.node().clientWidth);
    projection.fitWidth(width, worldFC);
    const [[x0, y0], [x1, y1]] = path.bounds(worldFC);
    height = Math.ceil(y1 - y0);
    projection.translate([projection.translate()[0], projection.translate()[1] - y0]);

    svg.attr('viewBox', `0 0 ${width} ${height}`).attr('preserveAspectRatio', 'xMidYMid meet');
    oceanG.selectAll('rect').data([null]).join('rect')
      .attr('width', width).attr('height', height).attr('fill', '#f4f2ed');

    mapG.selectAll('.country-path').attr('d', path);
    render();
  }

  new ResizeObserver(resize).observe(mapWrap.node());

  mapG.selectAll('.country-path')
    .data(world.features)
    .join('path')
    .attr('class', 'country-path')
    .attr('stroke-width', 0.5)
    .on('mousemove', function (event, feature) {
      const nation = currentLookup.get(feature.id);
      if (!nation) { tooltip.style('display', 'none'); return; }
      const sportTxt = nation.best_sport === 0 || nation.best_sport == null ? 'No medals' : nation.best_sport;
      tooltip.style('display', 'block')
        .style('left', (event.pageX + 14) + 'px')
        .style('top', (event.pageY - 10) + 'px')
        .html(`
          <strong>${feature.properties.name}</strong><br>
          Athletes: ${nation.athletes}<br>
          Efficiency: ${nation.efficiency.toFixed(3)}<br>
          Best sport: ${sportTxt}<br>
          🥇 ${nation.Gold} · 🥈 ${nation.Silver} · 🥉 ${nation.Bronze}
          ${nation.sparse ? '<br><em>Low-confidence: fewer than 5 athletes</em>' : ''}
        `);
    })
    .on('mouseout', () => tooltip.style('display', 'none'));

  // ── RENDER ───────────────────────────────────────────────
  let currentLookup = new Map();

  function render() {
    currentLookup = buildLookup();
    const year = selectedYear();
    const isCancelled = year !== null && CANCELLED_YEARS.has(year);

    nogamesBanner.style('display', isCancelled ? 'flex' : 'none')
      .text(isCancelled ? `No Olympic Games were held in ${year}.` : '');

    // Per-continent 90th-percentile efficiency, so each continent's own
    // color ramp is scaled to its own data rather than one global range.
    const byContinent = d3.group([...currentLookup.values()].filter(n => n.efficiency > 0), n => n.Continent);
    const continentMax = new Map();
    byContinent.forEach((nations, cont) => {
      const vals = nations.map(n => n.efficiency).sort(d3.ascending);
      continentMax.set(cont, Math.max(0.02, d3.quantile(vals, 0.9) || 0.02));
    });

    function fillFor(nation) {
      if (!nation.athletes || nation.medals === 0) return COLOR_ZERO_MEDALS;
      const base = CONTINENT_COLOR[nation.Continent] || '#999999';
      const max = continentMax.get(nation.Continent) || 0.02;
      const t = Math.min(1, nation.efficiency / max);
      return d3.interpolateRgb('#ffffff', base)(0.2 + t * 0.8);
    }

    mapG.selectAll('.country-path')
      .attr('fill', d => {
        if (isCancelled) return COLOR_NO_GAMES;
        const nation = currentLookup.get(d.id);
        return nation ? fillFor(nation) : COLOR_NO_DATA;
      })
      .attr('stroke', d => (currentLookup.get(d.id) ? '#fff' : '#ddd8cc'));

    mapG.selectAll('.country-hatch').remove();
    if (!isCancelled) {
      mapG.selectAll('.country-hatch')
        .data(world.features.filter(d => {
          const n = currentLookup.get(d.id);
          return n && n.sparse && n.athletes > 0;
        }))
        .join('path')
        .attr('class', 'country-hatch')
        .attr('d', path)
        .attr('fill', 'url(#viz2-hatch)')
        .attr('stroke', 'none')
        .style('pointer-events', 'none');
    }

    glyphG.selectAll('.podium-glyph').remove();
    if (!isCancelled) {
      const withMedals = [...currentLookup.values()].filter(n => n.medals > 0);
      const maxMedals = d3.max(withMedals, n => n.medals) || 1;
      const rScale = d3.scaleSqrt().domain([0, maxMedals]).range([width * 0.003, width * 0.022]);

      withMedals.forEach(nation => {
        const feature = world.features.find(f => f.id === nation.iso);
        if (!feature) return;
        const centroid = path.centroid(feature);
        if (!centroid || isNaN(centroid[0])) return;
        glyphG.append('circle')
          .attr('class', 'podium-glyph')
          .attr('cx', centroid[0]).attr('cy', centroid[1])
          .attr('r', rScale(nation.medals))
          .attr('fill', '#D4A82B')
          .attr('fill-opacity', 0.9)
          .attr('stroke', '#7a5c14')
          .attr('stroke-width', 0.75);
      });
    }
  }

  // ── EVENTS ───────────────────────────────────────────────
  yearSlider.on('input', function () {
    state.yearIndex = +this.value;
    yearLabel.text(state.yearIndex === -1 ? 'All-time (1896-2016)' : String(selectedYear()));
    render();
  });

  resetBtn.on('click', () => {
    state.yearIndex = -1;
    yearSlider.property('value', -1);
    yearLabel.text('All-time (1896-2016)');
    render();
  });

  medalBtns.selectAll('.toggle-btn').on('click', function () {
    medalBtns.selectAll('.toggle-btn').classed('active', false);
    d3.select(this).classed('active', true);
    state.medalType = d3.select(this).attr('data-val');
    render();
  });

  resize();
}