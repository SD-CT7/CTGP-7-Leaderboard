import { state } from '../state.js';
import { REGION_DATA, SELECTABLE_REGIONS, COUNTRY_TO_REGION } from '../data/regions.js';
import { FLAG_BASE_URL } from '../config.js';

export function countryMatchesFilter(countryCode) {
  if (state.countryFilter.type === 'all') return true;
  if (!countryCode || countryCode === '-') return false;
  const code = countryCode.toLowerCase();
  if (state.countryFilter.type === 'country') {
    if (state.countryFilter.value === 'uk' && code === 'scotland') return true;
    return code === state.countryFilter.value;
  }
  if (state.countryFilter.type === 'region') return COUNTRY_TO_REGION[code] === state.countryFilter.value;
  return true;
}

export function openCountryFilterMenu() {
  document.getElementById('country-filter-overlay').classList.add('visible');
  showRegionList();
}

function closeCountryFilterMenu() {
  document.getElementById('country-filter-overlay').classList.remove('visible');
}

function showRegionList() {
  document.getElementById('cf-title').innerText = 'Filter by Region';
  document.getElementById('cf-back-btn').classList.remove('visible');
  const list = document.getElementById('cf-list');
  list.innerHTML = '';

  const allItem = document.createElement('div');
  allItem.className = 'cf-item all-item' + (state.countryFilter.type === 'all' ? ' selected' : '');
  allItem.innerText = 'All Regions';
  allItem.onclick = () => applyCountryFilter('all', null);
  list.appendChild(allItem);

  SELECTABLE_REGIONS.forEach(region => {
    const isSelected = state.countryFilter.type === 'region' && state.countryFilter.value === region;
    const item = document.createElement('div');
    item.className = 'cf-item' + (isSelected ? ' selected' : '');
    item.innerText = region;
    item.onclick = () => showCountryList(region);
    list.appendChild(item);
  });
}

function showCountryList(region) {
  document.getElementById('cf-title').innerText = region;
  document.getElementById('cf-back-btn').classList.add('visible');
  const list = document.getElementById('cf-list');
  list.innerHTML = '';

  const allItem = document.createElement('div');
  allItem.className = 'cf-item all-item' + (state.countryFilter.type === 'region' && state.countryFilter.value === region ? ' selected' : '');
  allItem.innerText = `All of ${region}`;
  allItem.onclick = () => applyCountryFilter('region', region);
  list.appendChild(allItem);

  REGION_DATA[region].forEach(c => {
    const isSelected = state.countryFilter.type === 'country' && state.countryFilter.value === c.code;
    const flagSrc = c.code === 'scotland' ? 'Scotland.webp' : `${FLAG_BASE_URL}${c.code}.svg`;
    const item = document.createElement('div');
    item.className = 'cf-item' + (isSelected ? ' selected' : '');
    item.innerHTML = `<img src="${flagSrc}" onerror="this.style.visibility='hidden'">${c.name}`;
    item.onclick = () => applyCountryFilter('country', c.code);
    list.appendChild(item);
  });
}

export function applyCountryFilter(type, value) {
  state.countryFilter = { type, value };
  closeCountryFilterMenu();
  updateCountryFilterButtonState();
  if (window.onFilterChange) window.onFilterChange();
}

function updateCountryFilterButtonState() {
  const active = state.countryFilter.type !== 'all';
  document.querySelectorAll('.earth-btn').forEach(btn => btn.classList.toggle('filter-active', active));
}

export function initFilterEvents() {
  const cfOverlay = document.getElementById('country-filter-overlay');
  cfOverlay.addEventListener('click', () => document.getElementById('country-filter-overlay').classList.remove('visible'));
  cfOverlay.querySelector('.country-filter-box').addEventListener('click', (e) => e.stopPropagation());
  document.getElementById('cf-back-btn').addEventListener('click', showRegionList);
  cfOverlay.querySelector('.cf-close-btn').addEventListener('click', () => document.getElementById('country-filter-overlay').classList.remove('visible'));
}
