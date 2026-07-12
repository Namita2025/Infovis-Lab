/* ============================================================
OLYMPICLENS — Main Orchestrator
Holds the single shared state object used by all visualizations.
============================================================ */

export const state = {
  yearRange: [1896, 2016],       // shared global year slider range
  activeYear: 1896,              // current "play head" year
  isPlaying: false,
  eventCategory: 'All',          // 'All' | 'Wars/Cancellations' | 'Boycotts' | 'Political Events' | 'Security Events'
  mode: 'continent',             // 'continent' | 'country'
  selectedContinent: null,       // single continent for country-detail dropdown
  selectedCountries: [],         // up to 5 NOC codes
  listeners: []
};

export function onStateChange(fn) {
  state.listeners.push(fn);
}

function notify() {
  state.listeners.forEach(fn => fn(state));
}

export function setYearRange(range) {
  state.yearRange = range;
  const disp = document.getElementById('year-range-display');
  if (disp) disp.textContent = `${range[0]} – ${range[1]}`;
  notify();
}

export function setActiveYear(year) {
  state.activeYear = year;
  const disp = document.getElementById('active-year-display');
  if (disp) disp.textContent = year;
  notify();
}

export function setEventCategory(cat) {
  state.eventCategory = cat;
  notify();
}

export function setMode(mode) {
  state.mode = mode;
  notify();
}

export function setSelectedContinent(continent) {
  state.selectedContinent = continent;
  state.selectedCountries = [];
  notify();
}

export function toggleSelectedCountry(nocCode) {
  const idx = state.selectedCountries.indexOf(nocCode);
  if (idx >= 0) {
    state.selectedCountries.splice(idx, 1);
  } else {
    if (state.selectedCountries.length >= 5) return false; // hard cap
    state.selectedCountries.push(nocCode);
  }
  state.mode = state.selectedCountries.length > 0 ? 'country' : 'continent';
  notify();
  return true;
}

export function clearSelectedCountries() {
  state.selectedCountries = [];
  state.mode = 'continent';
  notify();
}

/* ── OLYMPIC EDITION YEARS (Summer, 1896–2016, excluding cancellations) ── */
export const OLYMPIC_YEARS = [
  1896,1900,1904,1908,1912,1920,1924,1928,1932,1936,
  1948,1952,1956,1960,1964,1968,1972,1976,1980,1984,
  1988,1992,1996,2000,2004,2008,2012,2016
];

let playTimer = null;

export function startPlay(onTick) {
  if (playTimer) return;
  state.isPlaying = true;
  let idx = OLYMPIC_YEARS.indexOf(state.activeYear);
  if (idx === -1) idx = 0;
  playTimer = setInterval(() => {
    idx = (idx + 1) % OLYMPIC_YEARS.length;
    setActiveYear(OLYMPIC_YEARS[idx]);
    if (onTick) onTick(OLYMPIC_YEARS[idx]);
    if (idx === OLYMPIC_YEARS.length - 1) stopPlay();
  }, 900);
}

export function stopPlay() {
  state.isPlaying = false;
  if (playTimer) {
    clearInterval(playTimer);
    playTimer = null;
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const resetBtn = document.getElementById('reset-range');
  if (resetBtn) {
    resetBtn.addEventListener('click', () => setYearRange([1896, 2016]));
  }
});
