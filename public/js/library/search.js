import {
  state,
  getRelativePath,
  createEmptyMessage,
  searchResultsView,
  searchResultsTitle,
  searchResultsContainer,
  rootFolderListDiv,
  folderListViewDiv,
  publisherListDiv,
  seriesListDiv,
  comicListDiv,
  smartListView
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

function searchableValues(value) {
  if (Array.isArray(value)) return value.flatMap(searchableValues);
  if (value && typeof value === 'object') return Object.values(value).flatMap(searchableValues);
  return value == null ? [] : [String(value).trim()].filter(Boolean);
}

function localOptionsForField(field) {
  const values = new Set();
  for (const comic of comicIdMap.values()) {
    for (const value of localValuesForField(comic, field).flatMap(searchableValues)) values.add(value);
  }
  return [...values].sort((a, b) => a.localeCompare(b));
}

function localQueryMatches(value, field, query) {
  let needles = [String(query || '').toLocaleLowerCase()];
  if (field === 'language') {
    const aliases = {
      french: ['fr', 'fra', 'fre'], 'français': ['fr', 'fra', 'fre'], francais: ['fr', 'fra', 'fre'],
      fr: ['french', 'fra', 'fre'], fra: ['french', 'fr', 'fre'], fre: ['french', 'fr', 'fra'],
      english: ['en', 'eng'], en: ['english', 'eng'], eng: ['english', 'en'],
      spanish: ['es', 'spa'], español: ['es', 'spa'], es: ['spanish', 'spa'], spa: ['spanish', 'es'],
      italian: ['it', 'ita'], italiano: ['it', 'ita'], it: ['italian', 'ita'], ita: ['italian', 'it'],
      german: ['de', 'deu', 'ger'], deutsch: ['de', 'deu', 'ger'], de: ['german', 'deu', 'ger'],
      deu: ['german', 'de', 'ger'], ger: ['german', 'de', 'deu']
    };
    needles = [...needles, ...(aliases[needles[0]] || [])];
  }
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
  const fieldOptions = new Map();
  const renderPerFieldInputs = fields => {
    if (!perFieldInputs) return;
    const previousInputs = getSearchFieldFilters();
    const previous = Object.keys(previousInputs).length ? previousInputs : (state.lastSearchFilters || {});
    perFieldInputs.replaceChildren();
    for (const field of fields.filter(item => item.value !== 'all' && visible.has(item.value))) {
      const details = document.createElement('details');
      details.className = 'search-per-field-control';
      details.dataset.searchFieldControl = field.value;
      const summary = document.createElement('summary');
      const selectedValues = new Set(Array.isArray(previous[field.value]) ? previous[field.value] : (previous[field.value] ? [previous[field.value]] : []));
      const updateSummary = () => {
        summary.textContent = selectedValues.size ? `${field.label} (${selectedValues.size} selected)` : field.label;
      };
      updateSummary();
      const input = document.createElement('input');
      input.type = 'search';
      input.dataset.searchFieldSearch = field.value;
      input.placeholder = `Find ${field.label.toLocaleLowerCase()}…`;
      input.autocomplete = 'off';
      const choices = document.createElement('div');
      choices.className = 'search-per-field-options';
      const values = fieldOptions.get(field.value) || localOptionsForField(field.value);
      fieldOptions.set(field.value, values);
      const renderChoices = () => {
        const query = input.value.trim().toLocaleLowerCase();
        const matching = values.filter(value => value.toLocaleLowerCase().includes(query));
        const filtered = matching.slice(0, 100);
        for (const value of selectedValues) {
          if (!filtered.includes(value)) filtered.unshift(value);
        }
        choices.replaceChildren();
        for (const value of filtered) {
          const option = document.createElement('label');
          option.className = 'search-per-field-option';
          const checkbox = document.createElement('input');
          checkbox.type = 'checkbox';
          checkbox.value = value;
          checkbox.checked = selectedValues.has(value);
          checkbox.dataset.searchFieldValue = field.value;
          checkbox.addEventListener('change', () => {
            if (checkbox.checked) selectedValues.add(value);
            else selectedValues.delete(value);
            updateSummary();
            scheduleSearch();
          });
          const text = document.createElement('span');
          text.textContent = value;
          option.append(checkbox, text);
          choices.appendChild(option);
        }
        if (matching.length > 100) {
          const hint = document.createElement('span');
          hint.className = 'search-field-settings-hint';
          hint.textContent = 'Showing the first 100 matches. Type to narrow the list.';
          choices.appendChild(hint);
        } else if (!filtered.length) {
          choices.textContent = values.length ? 'No matching values.' : 'No indexed values found for this field.';
        }
      };
      const scheduleSearch = () => {
        clearTimeout(perFieldTimer);
        perFieldTimer = setTimeout(() => {
          const filters = getSearchFieldFilters();
          const query = queryInput?.value.trim() || '';
          if (query || Object.keys(filters).length) showSearchView(query, select.value, false, filters);
          else if (state.currentView === 'search') showSearchView('', 'all', false, {});
        }, 300);
      };
      input.addEventListener('input', renderChoices);
      details.addEventListener('toggle', () => { if (details.open) renderChoices(); });
      details.append(summary, input, choices);
      perFieldInputs.appendChild(details);
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
          showSearchView(queryInput.value.trim(), select.value, false, getSearchFieldFilters());
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
    const filters = getSearchFieldFilters();
    if ((query || Object.keys(filters).length) && state.currentView === 'search') showSearchView(query || '', select.value, false, filters);
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
  const filters = {};
  for (const input of document.querySelectorAll('#search-per-field-inputs [data-search-field-value]:checked')) {
    (filters[input.dataset.searchFieldValue] ||= []).push(input.value);
  }
  return filters;
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
  
  [rootFolderListDiv, folderListViewDiv, publisherListDiv, seriesListDiv, comicListDiv, smartListView]
    .filter(Boolean)
    .forEach(view => view.classList.add('hidden'));
  
  if (searchResultsView) {
    searchResultsView.classList.remove('hidden');
  }

  if (searchResultsTitle) {
    searchResultsTitle.textContent = state.lastSearchQuery ? `Search Results for "${state.lastSearchQuery}"` : 'Search Results';
  }

  const renderResults = (comics) => {
    if (searchResultsContainer) searchResultsContainer.setAttribute('aria-busy', 'false');
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
    searchResultsContainer.setAttribute('aria-busy', 'true');
    searchResultsContainer.innerHTML = `
      <div role="status" aria-live="polite" class="col-span-full flex items-center justify-center gap-3 py-12 text-gray-300">
        <span class="h-8 w-8 rounded-full border-4 border-gray-600 border-t-red-500 animate-spin" aria-hidden="true"></span>
        <span>Searching comics…</span>
      </div>`;
  }

  if (!navigator.onLine) {
    const comics = searchLibraryLocally(state.lastSearchQuery, state.lastSearchField, normalizedFilters);
    state.lastSearchResults = comics;
    window.lastSearchResults = comics;
    if (comics.length === 0) {
      if (searchResultsContainer) {
        searchResultsContainer.setAttribute('aria-busy', 'false');
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
        searchResultsContainer.setAttribute('aria-busy', 'false');
        searchResultsContainer.innerHTML = createEmptyMessage('No results found.');
      }
      return;
    }

    renderResults(comics);
  } catch (error) {
    console.error('[search] Error:', error);
    if (searchResultsContainer) {
      searchResultsContainer.setAttribute('aria-busy', 'false');
      searchResultsContainer.innerHTML = '<div class="text-red-400">Search failed.</div>';
    }
  }
}

export function renderSearchResultsAsFolders(comics) {
  if (!searchResultsContainer) return;
  searchResultsContainer.innerHTML = '';

  const groups = new Map();
  for (const comic of comics || []) {
    const comicPath = String(comic.path || '').replace(/\\/g, '/').replace(/\/+$/, '');
    const separator = comicPath.lastIndexOf('/');
    const folderPath = separator >= 0 ? comicPath.slice(0, separator) : '';
    if (!folderPath) continue;
    if (!groups.has(folderPath)) {
      const rootNames = state.LIBRARY_NAMES || window.LIBRARY_NAMES || {};
      const folderName = folderPath.split('/').pop();
      groups.set(folderPath, {
        path: folderPath,
        name: rootNames[folderPath] || folderName || 'Library',
        comics: []
      });
    }
    groups.get(folderPath).comics.push(comic);
  }

  const sortedFolders = [...groups.values()].sort((a, b) => a.name.localeCompare(b.name));
  if (!sortedFolders.length) {
    searchResultsContainer.innerHTML = createEmptyMessage('No matching comic folders found.');
    return;
  }

  for (const folder of sortedFolders) {
    const card = document.createElement('button');
    card.type = 'button';
    card.dataset.searchFolderPath = folder.path;
    card.className = 'search-folder-result-card bg-gray-800 rounded-lg shadow-lg cursor-pointer p-4 border border-gray-700/50 hover:border-purple-500/50 transition-all duration-300 group text-left';

    const icon = document.createElement('div');
    icon.className = 'h-40 w-full bg-gray-900 rounded-lg flex items-center justify-center text-red-400';
    icon.innerHTML = '<svg class="h-16 w-16" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M3 7.5A2.5 2.5 0 0 1 5.5 5H10l2 2h6.5A2.5 2.5 0 0 1 21 9.5v8a2.5 2.5 0 0 1-2.5 2.5h-13A2.5 2.5 0 0 1 3 17.5z"/></svg>';
    const title = document.createElement('h3');
    title.className = 'text-lg font-semibold mt-4 text-center text-white truncate w-full px-2';
    title.textContent = folder.name;
    const count = document.createElement('p');
    count.className = 'mt-1 text-xs text-gray-400 text-center';
    count.textContent = `${folder.comics.length} matching ${folder.comics.length === 1 ? 'comic' : 'comics'}`;
    card.append(icon, title, count);
    card.addEventListener('click', () => {
      const openFolder = state.showFolderView || window.showFolderView;
      if (typeof openFolder === 'function') openFolder(folder.path);
    });
    searchResultsContainer.appendChild(card);
  }
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
    const fieldMatches = Object.entries(filters).every(([filterField, filterQueries]) => {
      const values = Array.isArray(filterQueries) ? filterQueries : [filterQueries];
      return values.some(filterQuery => localValuesForField(comic, filterField).some(value => localQueryMatches(value, filterField, filterQuery)));
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
