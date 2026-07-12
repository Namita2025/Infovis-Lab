/* ============================================================
VIZ 1 — Disrupted Games: Olympic Participation Through Global Events
Stacked bar chart (continent overview) <-> multi-line chart (country detail)
D3 v7 · File: viz1.js
============================================================ */

import { state, onStateChange, setActiveYear, setSelectedContinent,
         toggleSelectedCountry, clearSelectedCountries,
         setEventCategory, startPlay, stopPlay, OLYMPIC_YEARS } from './main.js';

const ALL_CONTINENTS = ['Europe', 'Americas', 'Asia', 'Africa', 'Oceania'];

const CONTINENT_COLOR = {
  Europe:   '#0081C8',
  Americas: '#EE334E',
  Asia:     '#FCB131',
  Africa:   '#00A651',
  Oceania:  '#6F4E9C',
};

// Country lines reuse their continent's hue family via a lightness ramp,
// so a selected country is always visually anchored to its continent color.
function countryColorScale(continent, count) {
  const base = d3.hsl(CONTINENT_COLOR[continent]);
  return d3.range(count).map(i => {
    const c = d3.hsl(base.h, base.s, Math.min(0.75, base.l + i * 0.12));
    return c.formatHex();
  });
}

const CATEGORY_LIST = ['All', 'Wars/Cancellations', 'Boycotts', 'Political Events', 'Security Events'];

const CATEGORY_COLOR = {
  'Wars/Cancellations': '#b91c1c',
  'Boycotts':           '#c2410c',
  'Political Events':   '#7c3aed',
  'Security Events':    '#0369a1',
  'Geographical Calamity': '#0f766e',
};

export async function loadViz1() {
  const [continentData, countryData, countryLookup, disruptions] = await Promise.all([
    fetch('./public/data/viz1_continent_athletes.json').then(r => r.json()),
    fetch('./public/data/viz1_country_athletes.json').then(r => r.json()),
    fetch('./public/data/viz1_country_lookup.json').then(r => r.json()),
    fetch('./public/data/olympic_disruptions.json').then(r => r.json()),
  ]);

  const YEARS = OLYMPIC_YEARS;
  const YEAR_MIN = YEARS[0];
  const YEAR_MAX = YEARS[YEARS.length - 1];

  const root = d3.select('#viz1-root');
  root.selectAll('*').remove();

  // ── OUTER SHELL: chart column (left) + collapsible side panel (right) ──
  const shell = root.append('div').attr('class', 'viz1-shell');
  const chartCol = shell.append('div').attr('class', 'viz1-chartcol');
  const panelWrap = shell.append('div').attr('class', 'viz1-panelwrap');
  const panel = panelWrap.append('div').attr('class', 'viz1-sidepanel');
  const collapseBtn = panelWrap.append('button')
    .attr('class', 'viz1-collapse-btn')
    .attr('title', 'Collapse panel')
    .html('&#8250;');

  let panelCollapsed = false;
  collapseBtn.on('click', () => {
    panelCollapsed = !panelCollapsed;
    panelWrap.classed('collapsed', panelCollapsed);
    collapseBtn.html(panelCollapsed ? '&#8249;' : '&#8250;');
    requestAnimationFrame(renderChart);
  });

  // ── TOP: Play button + shared year slider (global, per spec) ──
  const controlsBar = chartCol.append('div').attr('class', 'viz1-controlsbar');
  const playBtn = controlsBar.append('button').attr('class', 'play-btn').html('&#9658;');
  const yearReadout = controlsBar.append('span').attr('class', 'year-readout').attr('id', 'active-year-display').text(YEAR_MIN);
  const sliderWrap = controlsBar.append('div').attr('class', 'year-slider-wrap');
  const sliderSvg = sliderWrap.append('svg').attr('class', 'range-slider-svg').attr('viewBox', '0 0 600 40');

  const sliderMargin = 20;
  const sliderX = d3.scaleLinear().domain([YEAR_MIN, YEAR_MAX]).range([sliderMargin, 600 - sliderMargin]);
  sliderSvg.append('line').attr('class', 'rs-track')
    .attr('x1', sliderMargin).attr('x2', 600 - sliderMargin).attr('y1', 20).attr('y2', 20);
  const sliderHandle = sliderSvg.append('circle').attr('class', 'rs-handle')
    .attr('r', 8).attr('cy', 20).attr('cx', sliderX(YEAR_MIN));

  function nearestOlympicYear(px) {
    const yr = sliderX.invert(px);
    return YEARS.reduce((a, b) => Math.abs(b - yr) < Math.abs(a - yr) ? b : a);
  }

  sliderHandle.call(d3.drag().on('drag', (event) => {
    const [mx] = d3.pointer(event, sliderSvg.node());
    const yr = nearestOlympicYear(mx);
    setActiveYear(yr);
  }));

  sliderSvg.on('click', (event) => {
    const [mx] = d3.pointer(event, sliderSvg.node());
    setActiveYear(nearestOlympicYear(mx));
  });

  playBtn.on('click', () => {
    if (state.isPlaying) {
      stopPlay();
      playBtn.html('&#9658;');
    } else {
      playBtn.html('&#10074;&#10074;');
      startPlay((yr) => { if (yr === YEARS[YEARS.length - 1]) playBtn.html('&#9658;'); });
    }
  });

  // ── EVENT CATEGORY FILTER — pill buttons ──
  const filterSection = panel.append('div').attr('class', 'panel-block');
  filterSection.append('div').attr('class', 'control-label').text('Event Category');
  const catPillGroup = filterSection.append('div').attr('class', 'pill-group');
  const catPills = catPillGroup.selectAll('.pill').data(CATEGORY_LIST).enter()
    .append('button')
    .attr('class', d => 'pill' + (d === 'All' ? ' active' : ''))
    .style('--pill-color', d => CATEGORY_COLOR[d] || '#1C1C1C')
    .text(d => d)
    .on('click', function (event, d) {
      catPills.classed('active', dd => dd === d);
      setEventCategory(d);
    });

  // ── LEGEND ──
  const legendSection = panel.append('div').attr('class', 'panel-block');
  legendSection.append('div').attr('class', 'control-label').text('Legend');
  const legendBody = legendSection.append('div').attr('class', 'viz1-legend');

  // ── CONTINENT -> COUNTRY CASCADING DROPDOWNS ──
  const selectorSection = panel.append('div').attr('class', 'panel-block');
  selectorSection.append('div').attr('class', 'control-label').text('Country Detail Mode');

  const continentSelect = selectorSection.append('select').attr('class', 'viz1-select');
  continentSelect.append('option').attr('value', '').text('Select a continent…');
  continentSelect.selectAll('option.cont').data(ALL_CONTINENTS).enter()
    .append('option').attr('class', 'cont').attr('value', d => d).text(d => d);

  const countrySelect = selectorSection.append('select').attr('class', 'viz1-select').property('disabled', true);
  countrySelect.append('option').attr('value', '').text('Select a country…');

  const chipRow = selectorSection.append('div').attr('class', 'chip-row');
  const capMsg = selectorSection.append('div').attr('class', 'cap-msg').style('display', 'none').text('Max 5 countries reached');

  function refreshChips() {
    const chips = chipRow.selectAll('.chip').data(state.selectedCountries, d => d);
    chips.exit().remove();
    const enter = chips.enter().append('div').attr('class', 'chip');
    enter.append('span').attr('class', 'chip-label');
    enter.append('button').attr('class', 'chip-x').text('×')
      .on('click', (event, d) => {
        toggleSelectedCountry(d);
        refreshChips();
        updateCountryOptions();
        renderChart();
      });
    chipRow.selectAll('.chip').select('.chip-label').text(d => d);
    capMsg.style('display', state.selectedCountries.length >= 5 ? 'block' : 'none');
  }

  function updateCountryOptions() {
    const cont = state.selectedContinent;
    countrySelect.selectAll('option.country').remove();
    if (!cont) { countrySelect.property('disabled', true); return; }
    countrySelect.property('disabled', false);
    const list = countryLookup[cont] || [];
    countrySelect.selectAll('option.country').data(list).enter()
      .append('option').attr('class', 'country')
      .attr('value', d => d.NOC)
      .property('disabled', d => state.selectedCountries.length >= 5 && !state.selectedCountries.includes(d.NOC))
      .text(d => `${d.Country} (${d.total_athletes})`);
    countrySelect.property('value', '');
  }

  continentSelect.on('change', function () {
    const val = this.value;
    setSelectedContinent(val || null);
    updateCountryOptions();
    refreshChips();
    renderChart();
  });

  countrySelect.on('change', function () {
    const val = this.value;
    if (!val) return;
    const ok = toggleSelectedCountry(val);
    if (!ok) { capMsg.style('display', 'block'); }
    updateCountryOptions();
    refreshChips();
    renderChart();
    this.value = '';
  });

  // ── EVENT STORY CARD — placeholder until a marker is clicked ──
  const storySection = panel.append('div').attr('class', 'panel-block story-block');
  storySection.append('div').attr('class', 'control-label').text('Event Details');
  const storyCard = storySection.append('div').attr('class', 'story-card placeholder');
  storyCard.append('p').attr('class', 'story-placeholder-text')
    .text('Click an event marker on the chart to see its story.');

  function renderStoryCard(eventsAtYear) {
    storyCard.classed('placeholder', false).selectAll('*').remove();
    eventsAtYear.forEach(e => {
      const block = storyCard.append('div').attr('class', 'story-entry');
      block.append('div').attr('class', 'story-badge')
        .style('background', CATEGORY_COLOR[e.Category] || '#1C1C1C')
        .text(e.Category);
      block.append('div').attr('class', 'story-title').text(`${e.Year} — ${e.Label}`);
      block.append('div').attr('class', 'story-meta').text(`${e.Host_City}, ${e.Host_Country}`);
      block.append('p').attr('class', 'story-text').text(e.Story || e.Reason);
    });
    storyCard.append('button').attr('class', 'story-close').text('Close')
      .on('click', () => {
        storyCard.classed('placeholder', true).selectAll('*').remove();
        storyCard.append('p').attr('class', 'story-placeholder-text')
          .text('Click an event marker on the chart to see its story.');
      });
  }

  // ── CHART AREA ──
  const chartWrap = chartCol.append('div').attr('class', 'chart-wrap');
  const tooltip = chartCol.append('div').attr('class', 'viz-tooltip').style('display', 'none');

  const margin = { top: 30, right: 30, bottom: 50, left: 60 };
  const H = 480;

  const svg = chartWrap.append('svg').attr('class', 'viz-svg');
  const gRoot = svg.append('g');
  const gridG = gRoot.append('g').attr('class', 'grid-g');
  const barsG = gRoot.append('g').attr('class', 'bars-g');
  const lineG = gRoot.append('g').attr('class', 'line-g');
  const dotG = gRoot.append('g').attr('class', 'dot-g');
  const evtG = gRoot.append('g').attr('class', 'evt-g');
  const evtDotG = gRoot.append('g').attr('class', 'evt-dot-g');
  const xAxisG = gRoot.append('g').attr('class', 'axis-x');
  const yAxisG = gRoot.append('g').attr('class', 'axis-y');
  const xLabel = svg.append('text').attr('class', 'axis-label').attr('text-anchor', 'middle').text('Olympic Year');
  const yLabel = svg.append('text').attr('class', 'axis-label').attr('text-anchor', 'middle').text('Unique Athletes');

  const stackGen = d3.stack().keys(ALL_CONTINENTS).value((d, key) => d[key] || 0);

  function pivotContinentData() {
    const byYear = new Map();
    continentData.forEach(d => {
      if (!byYear.has(d.Year)) byYear.set(d.Year, { Year: d.Year });
      byYear.get(d.Year)[d.Continent] = d.athletes;
    });
    return YEARS.map(y => byYear.get(y) || { Year: y });
  }
  const stackedData = pivotContinentData();

  function eventsForYear(year) {
    return disruptions.filter(d => d.Year === year);
  }

  function filteredDisruptions() {
    if (state.eventCategory === 'All') return disruptions;
    return disruptions.filter(d => d.Category === state.eventCategory);
  }

  function drawLegend() {
    legendBody.selectAll('*').remove();
    const items = state.mode === 'country'
      ? state.selectedCountries.map((noc, i) => {
          const cont = state.selectedContinent;
          const list = countryLookup[cont] || [];
          const meta = list.find(c => c.NOC === noc);
          const colors = countryColorScale(cont, state.selectedCountries.length);
          return { label: meta ? meta.Country : noc, color: colors[i] };
        })
      : ALL_CONTINENTS.map(c => ({ label: c, color: CONTINENT_COLOR[c] }));
    const rows = legendBody.selectAll('.legend-row').data(items).enter().append('div').attr('class', 'legend-row');
    rows.append('span').attr('class', 'legend-swatch').style('background', d => d.color);
    rows.append('span').text(d => d.label);
  }

  function renderChart() {
    const collapsed = panelCollapsed;
    const fullW = Math.max(chartWrap.node().getBoundingClientRect().width, 300);
    const W = fullW;
    const iW = W - margin.left - margin.right;
    const iH = H - margin.top - margin.bottom;

    svg.attr('viewBox', `0 0 ${W} ${H}`).attr('preserveAspectRatio', 'xMidYMid meet');
    gRoot.attr('transform', `translate(${margin.left},${margin.top})`);
    xAxisG.attr('transform', `translate(0,${iH})`);
    xLabel.attr('x', margin.left + iW / 2).attr('y', H - 8);
    yLabel.attr('transform', `translate(${16},${margin.top + iH / 2}) rotate(-90)`);

    const x = d3.scaleBand().domain(YEARS).range([0, iW]).padding(0.25);

    drawLegend();

    // ── EVENT MARKERS (bands/lines, filtered by category) ──
    const events = filteredDisruptions();
    evtG.selectAll('*').remove();
    evtDotG.selectAll('*').remove();

    const grouped = d3.groups(events, d => d.Year);
    grouped.forEach(([year, rows]) => {
      if (!YEARS.includes(year) && (year < YEAR_MIN || year > YEAR_MAX)) return;
      const isBand = rows.some(r => r.Display_Style === 'shaded_band');
      const color = CATEGORY_COLOR[rows[0].Category] || '#999';
      const xPos = x(year) !== undefined ? x(year) + x.bandwidth() / 2 : x0ForNonEditionYear(year, x, iW);

      if (isBand) {
        evtG.append('rect')
          .attr('class', 'evt-band')
          .attr('x', xPos - 6).attr('y', 0)
          .attr('width', 12).attr('height', iH)
          .attr('fill', color).attr('opacity', 0.14);
      }
      evtG.append('line')
        .attr('class', 'evt-line')
        .attr('x1', xPos).attr('x2', xPos)
        .attr('y1', 0).attr('y2', iH)
        .attr('stroke', color)
        .attr('stroke-width', isBand ? 2 : 1.5)
        .attr('stroke-dasharray', isBand ? null : '5,4')
        .attr('opacity', rows[0].Impact_Level === 'Context' ? 0.4 : 0.85);

      evtDotG.append('circle')
        .attr('class', 'evt-dot')
        .attr('cx', xPos).attr('cy', -8)
        .attr('r', rows[0].Impact_Level === 'Context' ? 4 : 6)
        .attr('fill', color)
        .attr('stroke', '#fff').attr('stroke-width', 1)
        .style('cursor', 'pointer')
        .on('click', () => renderStoryCard(rows))
        .on('mousemove', function (event) {
          tooltip.style('display', 'block')
            .style('left', (event.pageX + 14) + 'px')
            .style('top', (event.pageY - 10) + 'px')
            .html(`<div class="tt-year">${year}</div>` + rows.map(r => `<div class="tt-row">${r.Label}</div>`).join(''));
        })
        .on('mouseleave', () => tooltip.style('display', 'none'));
    });

    function x0ForNonEditionYear(year, xScale, innerW) {
      const scale = d3.scaleLinear().domain([YEAR_MIN, YEAR_MAX]).range([0, innerW]);
      return scale(year);
    }

    // ── GRID + AXES ──
    const maxY = state.mode === 'country'
      ? d3.max(countryData.filter(d => state.selectedCountries.includes(d.NOC)), d => d.athletes) || 100
      : d3.max(stackedData, d => ALL_CONTINENTS.reduce((s, c) => s + (d[c] || 0), 0)) || 100;
    const y = d3.scaleLinear().domain([0, maxY]).nice().range([iH, 0]);

    gridG.selectAll('*').remove();
    gridG.selectAll('.grid-h').data(y.ticks(6)).join('line')
      .attr('class', 'grid-h')
      .attr('x1', 0).attr('x2', iW)
      .attr('y1', d => y(d)).attr('y2', d => y(d))
      .attr('stroke', 'rgba(0,0,0,.07)');

    xAxisG.call(d3.axisBottom(x).tickValues(YEARS.filter((_, i) => i % 2 === 0)))
      .call(g => g.select('.domain').attr('stroke', '#ccc8c0'))
      .call(g => g.selectAll('.tick line').attr('stroke', '#ccc8c0'));
    yAxisG.call(d3.axisLeft(y).ticks(6))
      .call(g => g.select('.domain').attr('stroke', '#ccc8c0'))
      .call(g => g.selectAll('.tick line').attr('stroke', '#ccc8c0'));

    lineG.selectAll('*').remove();
    dotG.selectAll('*').remove();
    barsG.selectAll('*').remove();

    if (state.mode === 'country' && state.selectedCountries.length > 0) {
      // ── MULTI-LINE CHART: country detail mode ──
      const colors = countryColorScale(state.selectedContinent, state.selectedCountries.length);
      const xLine = d3.scalePoint().domain(YEARS).range([0, iW]);

      const series = state.selectedCountries.map((noc, i) => ({
        noc, color: colors[i],
        values: YEARS.map(yr => {
          const rec = countryData.find(d => d.NOC === noc && d.Year === yr);
          return { Year: yr, athletes: rec ? rec.athletes : 0 };
        })
      }));

      const lineGen = d3.line().x(d => xLine(d.Year)).y(d => y(d.athletes)).curve(d3.curveMonotoneX);

      series.forEach(s => {
        lineG.append('path').attr('class', 'country-line')
          .attr('fill', 'none').attr('stroke', s.color).attr('stroke-width', 2.4)
          .attr('d', lineGen(s.values));

        dotG.selectAll(`.dot-${s.noc}`).data(s.values).join('circle')
          .attr('class', `dot-${s.noc}`)
          .attr('cx', d => xLine(d.Year)).attr('cy', d => y(d.athletes))
          .attr('r', d => d.athletes === 0 ? 3 : 4)
          .attr('fill', d => d.athletes === 0 ? '#fff' : s.color)
          .attr('stroke', s.color).attr('stroke-width', d => d.athletes === 0 ? 2 : 0)
          .style('cursor', 'pointer')
          .on('mousemove', function (event, d) {
            const status = d.athletes === 0 ? 'Did not participate' : 'Participated';
            const evts = eventsForYear(d.Year).map(e => e.Label).join(', ') || 'None';
            tooltip.style('display', 'block')
              .style('left', (event.pageX + 14) + 'px')
              .style('top', (event.pageY - 10) + 'px')
              .html(`<div class="tt-year">${s.noc} · ${d.Year}</div>
                     <div class="tt-row">Athletes: ${d.athletes}</div>
                     <div class="tt-row">${status}</div>
                     <div class="tt-row">Events: ${evts}</div>`);
          })
          .on('mouseleave', () => tooltip.style('display', 'none'));
      });
    } else {
      // ── STACKED BAR CHART: continent overview (default) ──
      const stacked = stackGen(stackedData);
      barsG.selectAll('.series').data(stacked).join('g')
        .attr('class', 'series')
        .attr('fill', d => CONTINENT_COLOR[d.key])
        .each(function (seriesData) {
          d3.select(this).selectAll('rect').data(seriesData).join('rect')
            .attr('x', d => x(d.data.Year))
            .attr('y', d => y(d[1]))
            .attr('width', x.bandwidth())
            .attr('height', d => Math.max(0, y(d[0]) - y(d[1])))
            .attr('opacity', d => d.data.Year === state.activeYear ? 1 : 0.85)
            .style('cursor', 'pointer')
            .on('mousemove', function (event, d) {
              const continent = d3.select(this.parentNode).datum().key;
              const val = d[1] - d[0];
              const total = ALL_CONTINENTS.reduce((s, c) => s + (d.data[c] || 0), 0);
              const pct = total > 0 ? ((val / total) * 100).toFixed(1) : '0.0';
              const evts = eventsForYear(d.data.Year).map(e => e.Label).join(', ') || 'None';
              tooltip.style('display', 'block')
                .style('left', (event.pageX + 14) + 'px')
                .style('top', (event.pageY - 10) + 'px')
                .html(`<div class="tt-year">${d.data.Year} · ${continent}</div>
                       <div class="tt-row">Athletes: ${val}</div>
                       <div class="tt-row">Share: ${pct}%</div>
                       <div class="tt-row">Events: ${evts}</div>`);
            })
            .on('mouseleave', () => tooltip.style('display', 'none'));
        });
    }
  }

  onStateChange(() => renderChart());
  window.addEventListener('resize', () => renderChart());
  renderChart();
}
