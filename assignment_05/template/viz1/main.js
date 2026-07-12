/*
 * Viz 1 — Disrupted Games
 *
 * The HTML file owns the page shell and the CSS file owns its presentation.
 * This module owns data loading, interaction/state updates, and D3 rendering.
 */

import {
  state,
  getThemeColor,
  onStateChange,
  setActiveYear,
  setSelectedContinent,
  toggleSelectedCountry,
  clearSelectedCountries,
  setEventCategory,
  startPlay,
  stopPlay,
  OLYMPIC_YEARS,
} from '../main.js';

const ALL_CONTINENTS = ['Europe', 'Americas', 'Asia', 'Africa', 'Oceania'];
const CATEGORY_LIST = ['All', 'Wars/Cancellations', 'Boycotts', 'Political Events', 'Security Events'];

const CONTINENT_COLOR = {
  Europe: getThemeColor('--plot-blue'),
  Americas: getThemeColor('--plot-red'),
  Asia: getThemeColor('--plot-yellow'),
  Africa: getThemeColor('--plot-green'),
  Oceania: getThemeColor('--plot-purple'),
};

const CATEGORY_COLOR = {
  'Wars/Cancellations': getThemeColor('--accent-red-paper'),
  Boycotts: getThemeColor('--accent-gold-paper'),
  'Political Events': getThemeColor('--accent-violet-paper'),
  'Security Events': getThemeColor('--accent-blue-paper'),
  'Geographical Calamity': getThemeColor('--accent-green-paper'),
};

const CATEGORY_PLOT_COLOR = {
  'Wars/Cancellations': getThemeColor('--accent-red-panel'),
  Boycotts: getThemeColor('--accent-gold-panel'),
  'Political Events': getThemeColor('--accent-violet-panel'),
  'Security Events': getThemeColor('--accent-blue-panel'),
  'Geographical Calamity': getThemeColor('--accent-green-panel'),
};

const YEARS = OLYMPIC_YEARS;
const YEAR_MIN = YEARS[0];
const YEAR_MAX = YEARS[YEARS.length - 1];

function countryColorScale(continent, count) {
  const base = d3.hsl(CONTINENT_COLOR[continent]);
  return d3.range(count).map((index) => {
    const color = d3.hsl(base.h, base.s, Math.min(0.75, base.l + index * 0.12));
    return color.formatHex();
  });
}

export async function loadViz1() {
  const dataUrl = (file) => new URL(`../public/data/${file}`, import.meta.url);
  const [continentData, countryData, countryLookup, disruptions] = await Promise.all([
    fetch(dataUrl('viz1_continent_athletes.json')).then((response) => response.json()),
    fetch(dataUrl('viz1_country_athletes.json')).then((response) => response.json()),
    fetch(dataUrl('viz1_country_lookup.json')).then((response) => response.json()),
    fetch(dataUrl('olympic_disruptions.json')).then((response) => response.json()),
  ]);

  const root = d3.select('#viz1-root');
  if (root.empty()) return;

  const chartWrap = root.select('.chart-wrap');
  const chartSvg = chartWrap.select('.viz-svg');
  const tooltip = root.select('.viz-tooltip');
  const shell = root.select('.viz1-shell');
  const panelWrap = root.select('.viz1-panelwrap');
  const panel = panelWrap.select('.viz1-sidepanel');
  const filterDock = root.select('.viz1-controls-dock');

  const controls = {
    play: root.select('#viz1-play'),
    year: root.select('#active-year-display'),
    slider: root.select('#viz1-year-slider'),
    sliderHandle: root.select('.rs-handle'),
    categoryPills: filterDock.selectAll('.pill'),
    legend: panel.select('.viz1-legend'),
    continent: root.select('#viz1-continent'),
    picker: filterDock.select('.country-picker'),
    pickerToggle: filterDock.select('.country-picker-toggle'),
    pickerClear: filterDock.select('.country-picker-clear'),
    checklist: filterDock.select('.country-checklist'),
    chips: filterDock.select('.chip-row'),
    capMessage: filterDock.select('.cap-msg'),
    storyCard: panel.select('.story-card'),
    collapse: panelWrap.select('.viz1-collapse-btn'),
  };

  const chartRoot = chartSvg.select('.chart-root');
  const gridG = chartRoot.select('.grid-g');
  const barsG = chartRoot.select('.bars-g');
  const lineG = chartRoot.select('.line-g');
  const dotG = chartRoot.select('.dot-g');
  const evtG = chartRoot.select('.evt-g');
  const evtDotG = chartRoot.select('.evt-dot-g');
  const xAxisG = chartRoot.select('.axis-x');
  const yAxisG = chartRoot.select('.axis-y');
  const xLabel = chartSvg.select('.x-label');
  const yLabel = chartSvg.select('.y-label');

  const margin = { top: 30, right: 30, bottom: 50, left: 60 };
  const chartHeight = 480;
  const sliderMargin = 20;
  const sliderX = d3.scaleLinear().domain([YEAR_MIN, YEAR_MAX]).range([sliderMargin, 600 - sliderMargin]);
  const stackedData = pivotContinentData(continentData);
  let panelCollapsed = false;
  let selectedStoryEvents = null;

  function pivotContinentData(data) {
    const byYear = new Map();
    data.forEach((record) => {
      if (!byYear.has(record.Year)) byYear.set(record.Year, { Year: record.Year });
      byYear.get(record.Year)[record.Continent] = record.athletes;
    });
    return YEARS.map((year) => byYear.get(year) || { Year: year });
  }

  function countryMeta(noc) {
    for (const continent of ALL_CONTINENTS) {
      const match = (countryLookup[continent] || []).find((country) => country.NOC === noc);
      if (match) return { ...match, Continent: continent };
    }
    return { NOC: noc, Country: noc, Continent: state.selectedContinent };
  }

  function eventsForYear(year) {
    return disruptions.filter((event) => event.Year === year);
  }

  function filteredDisruptions() {
    return state.eventCategory === 'All'
      ? disruptions
      : disruptions.filter((event) => event.Category === state.eventCategory);
  }

  function visibleContinents() {
    return state.selectedContinent ? [state.selectedContinent] : ALL_CONTINENTS;
  }

  function nearestOlympicYear(pixel) {
    const year = sliderX.invert(pixel);
    return YEARS.reduce((closest, candidate) => (
      Math.abs(candidate - year) < Math.abs(closest - year) ? candidate : closest
    ));
  }

  function updateSlider() {
    controls.year.text(state.activeYear);
    controls.slider.attr('aria-valuenow', state.activeYear);
    controls.sliderHandle.attr('cx', sliderX(state.activeYear));
  }

  function updatePlaybackControl() {
    controls.play
      .html(state.isPlaying ? '❚❚' : '▶')
      .attr('aria-label', state.isPlaying ? 'Pause year sequence' : 'Play year sequence')
      .attr('aria-pressed', state.isPlaying ? 'true' : 'false');
  }

  function updateCategoryPills() {
    controls.categoryPills
      .classed('active', function () { return d3.select(this).datum() === state.eventCategory || this.dataset.category === state.eventCategory; })
      .attr('aria-pressed', function () { return String(this.dataset.category === state.eventCategory); });
  }

  function updatePickerSummary() {
    const names = state.selectedCountries.map((noc) => countryMeta(noc).Country);
    let label = 'Choose countries';
    if (names.length === 1) label = names[0];
    if (names.length === 2) label = `${names[0]} and ${names[1]}`;
    if (names.length > 2) label = `${names.slice(0, 2).join(', ')} +${names.length - 2}`;
    controls.pickerToggle.text(label).attr('aria-expanded', controls.picker.classed('open') ? 'true' : 'false');
    controls.picker.classed('has-selection', state.selectedCountries.length > 0);
  }

  function setPickerOpen(isOpen) {
    controls.picker.classed('open', isOpen);
    controls.pickerToggle.attr('aria-expanded', String(isOpen));
  }

  function renderChips() {
    const chips = controls.chips.selectAll('.chip').data(state.selectedCountries, (noc) => noc);
    chips.exit().remove();

    const entered = chips.enter().append('div').attr('class', 'chip');
    entered.append('span').attr('class', 'chip-label');
    entered.append('button')
      .attr('class', 'chip-x')
      .attr('type', 'button')
      .attr('aria-label', (noc) => `Remove ${countryMeta(noc).Country}`)
      .text('×')
      .on('click', (_, noc) => toggleSelectedCountry(noc));

    controls.chips.selectAll('.chip')
      .select('.chip-label')
      .text((noc) => countryMeta(noc).Country);
    controls.capMessage.property('hidden', state.selectedCountries.length < 5);
    updatePickerSummary();
  }

  function renderCountryChecklist() {
    controls.checklist.selectAll('*').remove();
    const continents = state.selectedContinent ? [state.selectedContinent] : ALL_CONTINENTS;

    continents.forEach((continent) => {
      const group = controls.checklist.append('div').attr('class', 'country-group');
      group.append('div').attr('class', 'group-label').text(continent);
      const items = group.append('div').attr('class', 'country-items');

      (countryLookup[continent] || []).forEach((country) => {
        const label = items.append('label').attr('class', 'country-item').attr('title', country.NOC);
        label.append('input')
          .attr('type', 'checkbox')
          .attr('class', 'country-checkbox')
          .attr('value', country.NOC)
          .property('checked', state.selectedCountries.includes(country.NOC))
          .property('disabled', state.selectedCountries.length >= 5 && !state.selectedCountries.includes(country.NOC))
          .on('change', () => toggleSelectedCountry(country.NOC));
        label.append('span').attr('class', 'country-label').text(country.Country);
      });
    });
  }

  function drawLegend() {
    controls.legend.selectAll('*').remove();
    const items = state.mode === 'country'
      ? state.selectedCountries.map((noc, index) => ({
        label: countryMeta(noc).Country,
        color: countryColorScale(countryMeta(noc).Continent, 1)[0],
      }))
      : visibleContinents().map((continent) => ({ label: continent, color: CONTINENT_COLOR[continent] }));

    const rows = controls.legend.selectAll('.legend-row').data(items).enter()
      .append('div').attr('class', 'legend-row');
    rows.append('span').attr('class', 'legend-swatch').style('background', (item) => item.color);
    rows.append('span').text((item) => item.label);
  }

  function renderStoryCard(events) {
    selectedStoryEvents = events;
    controls.storyCard.classed('placeholder', false).selectAll('*').remove();
    events.forEach((event) => {
      const entry = controls.storyCard.append('div').attr('class', 'story-entry');
      entry.append('div')
        .attr('class', 'story-badge')
        .style('background', CATEGORY_COLOR[event.Category] || getThemeColor('--accent-neutral-panel'))
        .text(event.Category);
      entry.append('div').attr('class', 'story-title').text(`${event.Year} — ${event.Label}`);
      entry.append('div').attr('class', 'story-meta').text(`${event.Host_City}, ${event.Host_Country}`);
      entry.append('p').attr('class', 'story-text').text(event.Story || event.Reason);
    });
    controls.storyCard.append('button')
      .attr('class', 'story-close')
      .attr('type', 'button')
      .text('Close')
      .on('click', clearStoryCard);
  }

  function clearStoryCard() {
    selectedStoryEvents = null;
    controls.storyCard.classed('placeholder', true).selectAll('*').remove();
    controls.storyCard.append('p')
      .attr('class', 'story-placeholder-text')
      .text('Click an event marker on the chart to see its story.');
  }

  function showTooltip(event, html) {
    tooltip
      .html(html)
      .style('left', `${event.clientX + 14}px`)
      .style('top', `${event.clientY - 10}px`)
      .property('hidden', false);
  }

  function hideTooltip() {
    tooltip.property('hidden', true);
  }

  function renderChart() {
    const width = Math.max(chartWrap.node().getBoundingClientRect().width, 300);
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = chartHeight - margin.top - margin.bottom;
    const x = d3.scaleBand().domain(YEARS).range([0, innerWidth]).padding(0.25);

    chartSvg.attr('viewBox', `0 0 ${width} ${chartHeight}`).attr('preserveAspectRatio', 'xMidYMid meet');
    chartRoot.attr('transform', `translate(${margin.left},${margin.top})`);
    xAxisG.attr('transform', `translate(0,${innerHeight})`);
    xLabel.attr('x', margin.left + innerWidth / 2).attr('y', chartHeight - 8);
    yLabel.attr('transform', `translate(16,${margin.top + innerHeight / 2}) rotate(-90)`);

    drawLegend();
    renderEvents(x, innerWidth, innerHeight);

    const continents = visibleContinents();
    const maxY = state.mode === 'country'
      ? d3.max(countryData.filter((record) => state.selectedCountries.includes(record.NOC)), (record) => record.athletes) || 100
      : d3.max(stackedData, (record) => continents.reduce((sum, continent) => sum + (record[continent] || 0), 0)) || 100;
    const y = d3.scaleLinear().domain([0, maxY]).nice().range([innerHeight, 0]);

    gridG.selectAll('*').remove();
    gridG.selectAll('.grid-h').data(y.ticks(6)).join('line')
      .attr('class', 'grid-h')
      .attr('x1', 0).attr('x2', innerWidth)
      .attr('y1', (value) => y(value)).attr('y2', (value) => y(value));

    xAxisG.call(d3.axisBottom(x).tickValues(YEARS.filter((_, index) => index % 2 === 0)));
    yAxisG.call(d3.axisLeft(y).ticks(6));
    xAxisG.select('.domain').attr('stroke', getThemeColor('--panel-line'));
    yAxisG.select('.domain').attr('stroke', getThemeColor('--panel-line'));
    xAxisG.selectAll('.tick line').attr('stroke', getThemeColor('--panel-line'));
    yAxisG.selectAll('.tick line').attr('stroke', getThemeColor('--panel-line'));

    lineG.selectAll('*').remove();
    dotG.selectAll('*').remove();
    barsG.selectAll('*').remove();

    if (state.mode === 'country' && state.selectedCountries.length > 0) {
      renderCountryLines(y, innerWidth);
    } else {
      renderContinentBars(x, y, continents);
    }
  }

  function renderEvents(x, innerWidth, innerHeight) {
    const events = filteredDisruptions();
    evtG.selectAll('*').remove();
    evtDotG.selectAll('*').remove();

    d3.groups(events, (event) => event.Year).forEach(([year, rows]) => {
      if (year < YEAR_MIN || year > YEAR_MAX) return;
      const isBand = rows.some((event) => event.Display_Style === 'shaded_band');
      const color = CATEGORY_PLOT_COLOR[rows[0].Category] || getThemeColor('--panel-text');
      const scale = d3.scaleLinear().domain([YEAR_MIN, YEAR_MAX]).range([0, innerWidth]);
      const xPosition = x(year) === undefined ? scale(year) : x(year) + x.bandwidth() / 2;

      if (isBand) {
        evtG.append('rect')
          .attr('class', 'evt-band')
          .attr('x', xPosition - 6).attr('y', 0)
          .attr('width', 12).attr('height', innerHeight)
          .attr('fill', color).attr('opacity', 0.14);
      }
      evtG.append('line')
        .attr('class', 'evt-line')
        .attr('x1', xPosition).attr('x2', xPosition)
        .attr('y1', 0).attr('y2', innerHeight)
        .attr('stroke', color)
        .attr('stroke-width', isBand ? 2 : 1.5)
        .attr('stroke-dasharray', isBand ? null : '5,4')
        .attr('opacity', rows[0].Impact_Level === 'Context' ? 0.4 : 0.85);

      evtDotG.append('circle')
        .attr('class', 'evt-dot')
        .attr('cx', xPosition).attr('cy', -8)
        .attr('r', rows[0].Impact_Level === 'Context' ? 4 : 6)
        .attr('fill', color)
        .attr('stroke', getThemeColor('--panel-text')).attr('stroke-width', 1)
        .style('cursor', 'pointer')
        .attr('tabindex', 0)
        .attr('role', 'button')
        .attr('aria-label', `${year}: ${rows.map((event) => event.Label).join(', ')}`)
        .on('click', () => renderStoryCard(rows))
        .on('keydown', (event) => {
          if (event.key === 'Enter' || event.key === ' ') renderStoryCard(rows);
        })
        .on('mousemove', (event) => showTooltip(event, `<div class="tt-year">${year}</div>${rows.map((row) => `<div class="tt-row">${row.Label}</div>`).join('')}`))
        .on('mouseleave', hideTooltip);
    });
  }

  function renderCountryLines(y, innerWidth) {
    const xLine = d3.scalePoint().domain(YEARS).range([0, innerWidth]);
    const series = state.selectedCountries.map((noc, index) => ({
      noc,
      color: countryColorScale(countryMeta(noc).Continent, 1)[0],
      values: YEARS.map((year) => {
        const record = countryData.find((item) => item.NOC === noc && item.Year === year);
        return { Year: year, athletes: record ? record.athletes : 0 };
      }),
    }));
    const line = d3.line().x((record) => xLine(record.Year)).y((record) => y(record.athletes)).curve(d3.curveMonotoneX);

    series.forEach((seriesItem) => {
      lineG.append('path')
        .attr('class', 'country-line')
        .attr('fill', 'none')
        .attr('stroke', seriesItem.color)
        .attr('stroke-width', 2.4)
        .attr('d', line(seriesItem.values));

      dotG.selectAll(`.dot-${seriesItem.noc}`).data(seriesItem.values).join('circle')
        .attr('class', `dot-${seriesItem.noc}`)
        .attr('cx', (record) => xLine(record.Year)).attr('cy', (record) => y(record.athletes))
        .attr('r', (record) => record.athletes === 0 ? 3 : 4)
        .attr('fill', (record) => record.athletes === 0 ? getThemeColor('--panel-text') : seriesItem.color)
        .attr('stroke', seriesItem.color).attr('stroke-width', (record) => record.athletes === 0 ? 2 : 0)
        .style('cursor', 'pointer')
        .on('mousemove', (event, record) => {
          const status = record.athletes === 0 ? 'Did not participate' : 'Participated';
          const eventNames = eventsForYear(record.Year).map((item) => item.Label).join(', ') || 'None';
          showTooltip(event, `<div class="tt-year">${seriesItem.noc} · ${record.Year}</div>
            <div class="tt-row">Athletes: ${record.athletes}</div>
            <div class="tt-row">${status}</div>
            <div class="tt-row">Events: ${eventNames}</div>`);
        })
        .on('mouseleave', hideTooltip);
    });
  }

  function renderContinentBars(x, y, continents) {
    const stacked = d3.stack().keys(continents).value((record, key) => record[key] || 0)(stackedData);
    barsG.selectAll('.series').data(stacked).join('g')
      .attr('class', 'series')
      .attr('fill', (series) => CONTINENT_COLOR[series.key])
      .each(function (seriesData) {
        d3.select(this).selectAll('rect').data(seriesData).join('rect')
          .attr('x', (record) => x(record.data.Year))
          .attr('y', (record) => y(record[1]))
          .attr('width', x.bandwidth())
          .attr('height', (record) => Math.max(0, y(record[0]) - y(record[1])))
          .attr('opacity', (record) => record.data.Year === state.activeYear ? 1 : 0.85)
          .style('cursor', 'pointer')
          .on('mousemove', (event, record) => {
            const continent = d3.select(event.currentTarget.parentNode).datum().key;
            const value = record[1] - record[0];
            const total = continents.reduce((sum, item) => sum + (record.data[item] || 0), 0);
            const share = total > 0 ? ((value / total) * 100).toFixed(1) : '0.0';
            const eventNames = eventsForYear(record.data.Year).map((item) => item.Label).join(', ') || 'None';
            showTooltip(event, `<div class="tt-year">${record.data.Year} · ${continent}</div>
              <div class="tt-row">Athletes: ${value}</div>
              <div class="tt-row">Share: ${share}%</div>
              <div class="tt-row">Events: ${eventNames}</div>`);
          })
          .on('mouseleave', hideTooltip);
      });
  }

  function renderUI() {
    updateSlider();
    updatePlaybackControl();
    updateCategoryPills();
    renderChips();
    renderCountryChecklist();
    renderChart();
  }

  controls.sliderHandle.call(d3.drag().on('drag', (event) => {
    const [pixel] = d3.pointer(event, controls.slider.node());
    setActiveYear(nearestOlympicYear(pixel));
  }));

  controls.slider
    .on('click', (event) => setActiveYear(nearestOlympicYear(d3.pointer(event, controls.slider.node())[0])))
    .on('keydown', (event) => {
      const direction = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0;
      if (!direction) return;
      event.preventDefault();
      const index = YEARS.indexOf(state.activeYear);
      setActiveYear(YEARS[Math.max(0, Math.min(YEARS.length - 1, index + direction))]);
    });

  controls.play.on('click', () => {
    if (state.isPlaying) {
      stopPlay();
      renderUI();
      return;
    }
    startPlay((year) => {
      if (year === YEARS[YEARS.length - 1]) renderUI();
    });
    renderUI();
  });

  controls.categoryPills.on('click', function () {
    setEventCategory(this.dataset.category);
  });

  controls.continent.on('change', function () {
    setSelectedContinent(this.value || null);
  });

  controls.pickerToggle.on('click', () => {
    const isOpen = !controls.picker.classed('open');
    setPickerOpen(isOpen);
  });

  controls.pickerClear.on('click', clearSelectedCountries);

  document.addEventListener('pointerdown', (event) => {
    if (!controls.picker.node().contains(event.target)) setPickerOpen(false);
  });

  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape' || !controls.picker.classed('open')) return;
    setPickerOpen(false);
    controls.pickerToggle.node().focus();
  });

  controls.collapse.on('click', function () {
    panelCollapsed = !panelCollapsed;
    panelWrap.classed('collapsed', panelCollapsed);
    shell.classed('legend-collapsed', panelCollapsed);
    d3.select(this)
      .html(panelCollapsed ? '‹' : '›')
      .attr('title', panelCollapsed ? 'Expand legend' : 'Collapse legend')
      .attr('aria-label', panelCollapsed ? 'Expand legend' : 'Collapse legend')
      .attr('aria-expanded', String(!panelCollapsed));
    requestAnimationFrame(renderChart);
  });

  onStateChange(renderUI);
  window.addEventListener('resize', renderChart);
  renderUI();
}
