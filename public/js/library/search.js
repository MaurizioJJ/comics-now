import {
  state,
  escapeHtml,
  safeDirName,
  getRelativePath,
  createLoadingMessage,
  createEmptyMessage,
  searchResultsView,
  searchResultsTitle,
  searchResultsContainer,
  rootFolderListDiv,
  publisherListDiv,
  seriesListDiv,
  comicListDiv
} from '../globals.js';
import { comicIdMap } from './data.js';

const SEARCH_FIELDS_STORAGE_KEY = 'comicsNow.visibleSearchFields';
const DEFAULT_VISIBLE_SEARCH_FIELDS = ['title', 'series', 'publisher', 'language', 'year', 'writer', 'penciller', 'tags', 'characters'];
const BUILTIN_SEARCH_FIELDS = [
  { value: 'all', label: 'All fields' },
  { value: 'title', label: 'Title' },
  { value: 'series', label: 'Series' },
  { value: 'publisher', label: 'Publisher' },
  { value: 'language', label: 'Language' },
  { value: 'year', label: 'Publication year' },
  { value: 'writer', label: 'Text author' },
  { value: 'penciller', label: 'Drawing artist' },
  { value: 'tags', label: 'Tags' },
  { value: 'characters', label: 'Characters' }
];
let searchFieldCatalog = null;

function labelForMetadataField(key) {
  const known = BUILTIN_SEARCH_FIELDS.find(field => field.value === key);
  return known?.label || key.replace(/^metadata:/, '').replace(/([a-z])([A-Z])/g, '$1 $2');
}

function localValuesForField(comic, field) {
  const metadata = comic.metadata || {};
  if (field === 'title') return [comic.name, metadata.Title, metadata.title];
  if (field === 'series') return [comic.series, metadata.Series, metadata.series];
  if (field === 'publisher') return [comic.publisher, metadata.Publisher, metadata.publisher];
  const aliases = {
    year: ['year', 'startyear', 'publicationdate'], writer: ['writer', 'authors', 'author'],
    penciller: ['penciller', 'pencil', 'artist'], tags: ['tags'], characters: ['characters'],
    language: ['languageiso', 'language']
  }[field];
  const keys = field.startsWith('metadata:') ? [field.slice('metadata:'.length).toLocaleLowerCase()] : (aliases || [field]);
  return Object.entries(metadata).filter(([key]) => keys.includes(key.toLocaleLowerCase())).map(([, value]) => value);
}

function localQueryMatches(value, field, query) {
  let needles = [String(query || '').toLocaleLowerCase()];
  if (field === 'language' && ['french', 'français', 'francais'].includes(needles[0])) needles = [...needles, 'fre', 'fra'];
  const text = Array.isArray(value) ? value.join(' ') : String(value ?? '');
  return needles.some(needle => text.toLocaleLowerCase().includes(needle));
}

function localSearchFieldCatalog() {
  const fields = new Map(BUILTIN_SEARCH_FIELDS.map(field => [field.value, field]));
  for (const comic of comicIdMap.values()) {
    for (const key of Object.keys(comic.metadata || {})) {
      const value = `metadata:${key}`;
      if (!fields.has(value.toLocaleLowerCase())) fields.set(value.toLocaleLowerCase(), { value, label: labelForMetadataField(value) });
    }
  }
  return [...fields.values()];
}

function visibleSearchFields() {
  try {
    const stored = JSON.parse(localStorage.getItem(SEARCH_FIELDS_STORAGE_KEY) || 'null');
    if (Array.isArray(stored)) {
      const visible = new Set(stored.filter(value => typeof value === 'string'));
      const migrationKey = 'comicsNow.searchFieldsLanguageDefaulted';
      if (!localStorage.getItem(migrationKey)) {
        visible.add('language');
        localStorage.setItem(SEARCH_FIELDS_STORAGE_KEY, JSON.stringify([...visible]));
        localStorage.setItem(migrationKey, 'true');
      }
      return visible;
    }
  } catch {}
  return new Set(DEFAULT_VISIBLE_SEARCH_FIELDS);
}

function updateSearchFieldOptions(select, visible) {
  const selected = select.value;
  const fields = searchFieldCatalog || BUILTIN_SEARCH_FIELDS;
  select.replaceChildren();
  for (const field of fields) {
    if (field.value !== 'all' && !visible.has(field.value)) continue;
    const option = document.createElement('option');
    option.value = field.value;
    option.textContent = field.label;
    select.appendChild(option);
  }
  if ([...select.options].some(option => option.value === selected)) select.value = selected;
  else select.value = 'all';
}

async function loadSearchFieldCatalog() {
  if (searchFieldCatalog) return searchFieldCatalog;
  try {
    const response = await fetch(`${state.API_BASE_URL || window.API_BASE_URL || ''}/api/v1/search/fields`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const fields = await response.json();
    if (!Array.isArray(fields)) throw new Error('Invalid field list');
    searchFieldCatalog = fields.filter(field => typeof field?.value === 'string' && typeof field?.label === 'string');
  } catch (error) {
    console.warn('[search] Could not load ComicInfo field list; using local metadata:', error);
    searchFieldCatalog = localSearchFieldCatalog();
  }
  return searchFieldCatalog;
}

function initializeSearchFieldSettings() {
  const details = document.getElementById('search-field-settings');
  const options = document.getElementById('search-field-options');
  const select = document.getElementById('library-search-field');
  const queryInput = document.getElementById('library-search-query');
  const perFieldDetails = document.getElementById('search-per-field');
  const perFieldInputs = document.getElementById('search-per-field-inputs');
  if (!details || !options || !select || details.dataset.initialized === 'true') return;
  details.dataset.initialized = 'true';
  const visible = visibleSearchFields();
  updateSearchFieldOptions(select, visible);

  let perFieldTimer;
  const renderPerFieldInputs = fields => {
    if (!perFieldInputs) return;
    const previousInputs = getSearchFieldFilters();
    const previous = Object.keys(previousInputs).length ? previousInputs : (state.lastSearchFilters || {});
    perFieldInputs.replaceChildren();
    for (const field of fields.filter(item => item.value !== 'all' && visible.has(item.value))) {
      const label = document.createElement('label');
      label.className = 'search-per-field-control';
      const caption = document.createElement('span');
      caption.textContent = field.label;
      const input = document.createElement('input');
      input.type = 'search';
      input.dataset.searchField = field.value;
      input.value = previous[field.value] || '';
      input.placeholder = `Search ${field.label.toLocaleLowerCase()}…`;
      input.autocomplete = 'off';
      input.addEventListener('input', () => {
        clearTimeout(perFieldTimer);
        perFieldTimer = setTimeout(() => {
          const filters = getSearchFieldFilters();
          const query = queryInput?.value.trim() || '';
          if (query || Object.keys(filters).length) showSearchView(query, select.value, false, filters);
          else if (state.currentView === 'search') showSearchView('', 'all', false, {});
        }, 300);
      });
      label.append(caption, input);
      perFieldInputs.appendChild(label);
    }
    if (!perFieldInputs.children.length) perFieldInputs.textContent = 'Select fields under Configure searchable fields to add search boxes here.';
  };

  perFieldDetails?.addEventListener('toggle', async () => {
    if (!perFieldDetails.open) return;
    renderPerFieldInputs(await loadSearchFieldCatalog());
  });

  details.addEventListener('toggle', async () => {
    if (!details.open) return;
    options.textContent = 'Loading fields…';
    const fields = await loadSearchFieldCatalog();
    options.replaceChildren();
    for (const field of fields.filter(item => item.value !== 'all')) {
      const label = document.createElement('label');
      label.className = 'search-field-option';
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.value = field.value;
      checkbox.checked = visible.has(field.value);
      checkbox.addEventListener('change', () => {
        if (checkbox.checked) visible.add(field.value);
        else visible.delete(field.value);
        localStorage.setItem(SEARCH_FIELDS_STORAGE_KEY, JSON.stringify([...visible]));
        const previousField = select.value;
        updateSearchFieldOptions(select, visible);
        if (searchFieldCatalog) renderPerFieldInputs(searchFieldCatalog);
        if (state.currentView === 'search') {
          showSearchView(queryInput?.value.trim() || '', select.value, false, getSearchFieldFilters());
        }
        if (previousField !== select.value && queryInput?.value.trim() && state.currentView === 'search') {
          showSearchView(queryInput.value.trim(), select.value);
        }
      });
      const text = document.createElement('span');
      text.textContent = field.label;
      label.append(checkbox, text);
      options.appendChild(label);
    }
    updateSearchFieldOptions(select, visible);
  });

  select.addEventListener('change', () => {
    const query = queryInput?.value.trim();
    if (query && state.currentView === 'search') showSearchView(query, select.value);
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeSearchFieldSettings, { once: true });
} else {
  initializeSearchFieldSettings();
}

export async function rerenderSearchResults() {
  const lastSearchQuery = state.lastSearchQuery || window.lastSearchQuery;
  const lastSearchField = state.lastSearchField || window.lastSearchField;
  if (lastSearchQuery) {
    await showSearchView(lastSearchQuery, lastSearchField, true, state.lastSearchFilters || {});
  }
}

export function getSearchFieldFilters() {
  const inputs = document.querySelectorAll('#search-per-field-inputs [data-search-field]');
  return Object.fromEntries([...inputs]
    .map(input => [input.dataset.searchField, input.value.trim()])
    .filter(([, value]) => value));
}

export async function showSearchView(query, field, useCache = false, filters = {}) {
  const _isNavigatingFromRouter = state._isNavigatingFromRouter || window._isNavigatingFromRouter;
  const router = state.router || window.router;
  const hasGlobalQuery = Boolean(String(query || '').trim());
  const hasFieldFilters = filters && Object.values(filters).some(value => String(value || '').trim());
  if (!hasGlobalQuery && !hasFieldFilters) {
    state.lastSearchQuery = '';
    state.lastSearchField = 'all';
    state.lastSearchFilters = {};
    window.lastSearchQuery = '';
    window.lastSearchField = 'all';
    const showRoot = state.showRootFolderList || window.showRootFolderList;
    if (typeof showRoot === 'function') showRoot({ force: true });
    return;
  }
  if (!_isNavigatingFromRouter && router && (query || Object.keys(filters || {}).length)) {
    const params = new URLSearchParams();
    if (query) params.set('q', query);
    params.set('field', field || 'all');
    if (Object.keys(filters).length) params.set('filters', JSON.stringify(filters));
    const searchUrl = `/search?${params.toString()}`;
    if (getRelativePath() + window.location.search !== searchUrl) {
      router.navigate(searchUrl, true);
    }
  }

  if (query === undefined && state.lastSearchQuery !== undefined) {
    query = state.lastSearchQuery;
    field = state.lastSearchField;
    filters = state.lastSearchFilters || {};
    useCache = true;
  }
  
  const normalizedFilters = filters && typeof filters === 'object' ? filters : {};
  const isSameSearch = (query === state.lastSearchQuery && field === state.lastSearchField && JSON.stringify(normalizedFilters) === JSON.stringify(state.lastSearchFilters || {}));
  state.lastSearchQuery = query || '';
  window.lastSearchQuery = state.lastSearchQuery;
  state.lastSearchField = field || 'all';
  window.lastSearchField = state.lastSearchField;
  state.lastSearchFilters = normalizedFilters;
  const globalQueryInput = document.getElementById('library-search-query');
  const globalFieldSelect = document.getElementById('library-search-field');
  if (globalQueryInput && globalQueryInput.value !== (query || '')) globalQueryInput.value = query || '';
  if (globalFieldSelect && [...globalFieldSelect.options].some(option => option.value === state.lastSearchField)) globalFieldSelect.value = state.lastSearchField;

  state.currentView = 'search';
  window.currentView = 'search';
  
  if (rootFolderListDiv) rootFolderListDiv.classList.add('hidden');
  if (publisherListDiv) publisherListDiv.classList.add('hidden');
  if (seriesListDiv) seriesListDiv.classList.add('hidden');
  if (comicListDiv) comicListDiv.classList.add('hidden');
  
  if (searchResultsView) {
    searchResultsView.classList.remove('hidden');
  }

  if (searchResultsTitle) {
    searchResultsTitle.textContent = state.lastSearchQuery ? `Search Results for "${state.lastSearchQuery}"` : 'Search Results';
  }

  const renderResults = (comics) => {
    const mode = state.searchViewMode || window.searchViewMode || 'list';
    if (mode === 'folders') {
      renderSearchResultsAsFolders(comics);
    } else {
      const renderComicCards = state.renderComicCards || window.renderComicCards;
      if (typeof renderComicCards === 'function') {
        renderComicCards(comics, 'search');
      }
    }
  };

  if (useCache && isSameSearch && state.lastSearchResults) {
    renderResults(state.lastSearchResults);
    return;
  }

  if (searchResultsContainer) {
    searchResultsContainer.innerHTML = createLoadingMessage('Searching...');
  }

  if (!navigator.onLine) {
    const comics = searchLibraryLocally(state.lastSearchQuery, state.lastSearchField, normalizedFilters);
    state.lastSearchResults = comics;
    window.lastSearchResults = comics;
    if (comics.length === 0) {
      if (searchResultsContainer) {
        searchResultsContainer.innerHTML = createEmptyMessage('No results found.');
      }
      return;
    }
    renderResults(comics);
    return;
  }

  try {
    const baseUrl = state.API_BASE_URL || window.API_BASE_URL || '';
    const params = new URLSearchParams({ query: state.lastSearchQuery, field: state.lastSearchField, filters: JSON.stringify(normalizedFilters) });
    const response = await fetch(`${baseUrl}/api/v1/search?${params.toString()}`);
    const comics = await response.json();
    state.lastSearchResults = comics;
    window.lastSearchResults = comics;
    
    if (comics.length === 0) {
      if (searchResultsContainer) {
        searchResultsContainer.innerHTML = createEmptyMessage('No results found.');
      }
      return;
    }

    renderResults(comics);
  } catch (error) {
    console.error('[search] Error:', error);
    if (searchResultsContainer) {
      searchResultsContainer.innerHTML = '<div class="text-red-400">Search failed.</div>';
    }
  }
}

export function renderSearchResultsAsFolders(comics) {
  if (!searchResultsContainer) return;
  searchResultsContainer.innerHTML = '';
  
  // Group comics by Publisher
  const publishers = {};
  comics.forEach(comic => {
    const pub = comic.publisher || 'Unknown';
    if (!publishers[pub]) publishers[pub] = [];
    publishers[pub].push(comic);
  });

  const sortedPublishers = Object.keys(publishers).sort();
  
  sortedPublishers.forEach(pubName => {
    const pubComics = publishers[pubName];
    const card = document.createElement('div');
    card.className = 'publisher-card bg-gray-800 rounded-lg shadow-lg cursor-pointer p-4 border border-gray-700/50 hover:border-purple-500/50 transition-all duration-300 group';
    
    // Group by series within publisher to get counts
    const series = {};
    pubComics.forEach(c => {
      const s = c.series || 'Unknown';
      if (!series[s]) series[s] = [];
      series[s].push(c);
    });
    
    const seriesCount = Object.keys(series).length;
    const comicCount = pubComics.length;

    card.innerHTML = `
      <div class="relative h-48 w-full bg-gray-700 rounded-lg overflow-hidden flex items-center justify-center p-4">
         <div class="text-4xl font-bold text-gray-500 opacity-20 select-none">${pubName.charAt(0).toUpperCase()}</div>
         <div class="absolute inset-0 flex items-center justify-center">
            <span class="text-gray-400 font-bold">${pubName}</span>
         </div>
      </div>
      <h3 class="text-lg font-semibold mt-4 text-center text-white truncate w-full px-2">${escapeHtml(pubName)}</h3>
      <p class="mt-1 text-xs text-gray-400 text-center">${seriesCount} ${seriesCount === 1 ? 'Series' : 'Series'} (${comicCount} ${comicCount === 1 ? 'comic' : 'comics'})</p>
    `;
    
    card.addEventListener('click', () => {
      // For simplicity, just show the comics of this publisher in a flat list for now
      const renderComicCards = state.renderComicCards || window.renderComicCards;
      if (typeof renderComicCards === 'function') {
        renderComicCards(pubComics, 'search');
      }
      if (searchResultsTitle) {
        searchResultsTitle.textContent = `Search Results: ${pubName}`;
      }
      // Add back button to return to publisher list
      const backBtn = document.createElement('button');
      backBtn.className = 'pill-button bg-gray-700 hover:bg-gray-600 text-white transition-colors mb-4 ml-4';
      backBtn.textContent = '← Back to Publishers';
      backBtn.addEventListener('click', () => {
          showSearchView(state.lastSearchQuery, state.lastSearchField, true);
      });
      searchResultsContainer.prepend(backBtn);
    });
    
    searchResultsContainer.appendChild(card);
  });
}

export function searchLibraryLocally(query, field, filters = {}) {
  const q = String(query || '').toLocaleLowerCase();
  const results = [];
  
  const activeComicIdMap = comicIdMap || state.comicIdMap || window.comicIdMap;
  if (!activeComicIdMap) return [];

  for (const comic of activeComicIdMap.values()) {
    const meta = comic.metadata || {};
    const globalValues = field === 'all' ? [comic.name, comic.series, comic.publisher, ...Object.values(meta)] : localValuesForField(comic, field);
    const globalMatch = !q || globalValues.some(value => localQueryMatches(value, field, q));
    const fieldMatches = Object.entries(filters).every(([filterField, filterQuery]) => {
      return localValuesForField(comic, filterField).some(value => localQueryMatches(value, filterField, filterQuery));
    });
    if (globalMatch && fieldMatches) {
      results.push(comic);
    }
  }
  return results;
}

const LibrarySearch = {
  rerenderSearchResults,
  showSearchView,
  renderSearchResultsAsFolders,
  searchLibraryLocally,
  getSearchFieldFilters
};

state.LibrarySearch = LibrarySearch;
Object.assign(state, LibrarySearch);

if (typeof window !== 'undefined') {
  window.LibrarySearch = LibrarySearch;
  Object.assign(window, LibrarySearch);
}
