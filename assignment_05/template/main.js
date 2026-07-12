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

export function getThemeColor(token) {
  return getComputedStyle(document.documentElement).getPropertyValue(token).trim();
}

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
  state.mode = 'continent';
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

  let idx = OLYMPIC_YEARS.indexOf(state.activeYear);
  if (idx === -1) idx = 0;
  if (idx === OLYMPIC_YEARS.length - 1) {
    state.activeYear = OLYMPIC_YEARS[0];
    idx = 0;
  }

  state.isPlaying = true;
  notify();

  playTimer = setInterval(() => {
    idx += 1;
    setActiveYear(OLYMPIC_YEARS[idx]);
    if (onTick) onTick(OLYMPIC_YEARS[idx]);
    if (idx >= OLYMPIC_YEARS.length - 1) stopPlay();
  }, 900);
}

export function stopPlay() {
  const wasPlaying = state.isPlaying || playTimer;
  state.isPlaying = false;
  if (playTimer) {
    clearInterval(playTimer);
    playTimer = null;
  }
  if (wasPlaying) notify();
}

function initPremiumChrome() {
  const preloader = document.querySelector('.preloader');
  if (preloader) {
    window.setTimeout(() => preloader.classList.add('is-done'), 700);
  }

  const revealItems = document.querySelectorAll('[data-reveal]');
  if ('IntersectionObserver' in window) {
    const revealObserver = new IntersectionObserver((entries, observer) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      });
    }, { threshold: 0.12 });
    revealItems.forEach((item) => revealObserver.observe(item));
  } else {
    revealItems.forEach((item) => item.classList.add('is-visible'));
  }

  const header = document.querySelector('#app-header');
  let lastScroll = window.scrollY;
  if (header) {
    window.addEventListener('scroll', () => {
      const currentScroll = window.scrollY;
      if (currentScroll > 120 && currentScroll > lastScroll + 4) header.classList.add('header-hidden');
      if (currentScroll < lastScroll - 4 || currentScroll < 40) header.classList.remove('header-hidden');
      lastScroll = currentScroll;
    }, { passive: true });
  }

  const cursor = document.querySelector('.cursor-orb');
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  if (cursor && finePointer) {
    let cursorX = -100;
    let cursorY = -100;
    let targetX = cursorX;
    let targetY = cursorY;
    const moveCursor = (event) => {
      targetX = event.clientX;
      targetY = event.clientY;
      cursor.classList.add('is-visible');
    };
    const tick = () => {
      cursorX += (targetX - cursorX) * 0.16;
      cursorY += (targetY - cursorY) * 0.16;
      cursor.style.left = `${cursorX}px`;
      cursor.style.top = `${cursorY}px`;
      window.requestAnimationFrame(tick);
    };
    window.addEventListener('pointermove', moveCursor, { passive: true });
    document.querySelectorAll('a, button, select, input').forEach((element) => {
      element.addEventListener('mouseenter', () => cursor.classList.add('is-hovering'));
      element.addEventListener('mouseleave', () => cursor.classList.remove('is-hovering'));
    });
    tick();
  }

  if (finePointer) {
    document.querySelectorAll('.magnetic').forEach((element) => {
      element.addEventListener('pointermove', (event) => {
        const bounds = element.getBoundingClientRect();
        const x = (event.clientX - (bounds.left + bounds.width / 2)) * 0.16;
        const y = (event.clientY - (bounds.top + bounds.height / 2)) * 0.16;
        element.style.transform = `translate3d(${x}px, ${y}px, 0)`;
      });
      element.addEventListener('pointerleave', () => {
        element.style.transform = '';
      });
    });
  }
}

function bindResetRange() {
  const resetBtn = document.getElementById('reset-range');
  if (resetBtn) {
    resetBtn.addEventListener('click', () => setYearRange([1896, 2016]));
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    initPremiumChrome();
    bindResetRange();
  });
} else {
  initPremiumChrome();
  bindResetRange();
}
