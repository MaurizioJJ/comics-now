const fs = require('fs');
const path = require('path');
const vm = require('vm');

function loadSmartLists(fetchLists) {
  const elements = new Map();
  const state = { currentView: 'folder', ReadingLists: { fetchReadingLists: fetchLists } };
  const context = vm.createContext({
    window: {},
    state,
    latestAddedCountSpan: null,
    downloadedCountSpan: null,
    applyDisplayInfoToComic: comic => comic,
    console: { warn: jest.fn() },
    document: { getElementById: jest.fn(identifier => elements.get(identifier) || null) },
    Date,
    setTimeout,
    clearTimeout
  });
  const source = fs.readFileSync(path.join(__dirname, '../public/js/library/smartlists.js'), 'utf8')
    .replace(/import\s+[\s\S]*?from\s+['"][^'"]+['"];?/g, '')
    .replace(/export\s+(?=(?:async\s+)?function|const|let)/g, '');
  new vm.Script(source).runInContext(context);
  return { api: state.LibrarySmartLists, state, context, elements };
}

test('an empty successful response does not recursively fetch again', async () => {
  let harness;
  const fetchLists = jest.fn(async () => {
    if (fetchLists.mock.calls.length >= 5) harness.elements.clear();
    harness.api.setCachedReadingLists([]);
    return [];
  });
  harness = loadSmartLists(fetchLists);
  harness.elements.set('dynamic-reading-list-filter-count', {});
  harness.elements.set('dynamic-reading-list-filter-btn', { classList: { add: jest.fn() } });
  await harness.api.fetchAndCacheReadingLists();
  await new Promise(resolve => setImmediate(resolve));
  expect(fetchLists).toHaveBeenCalledTimes(1);
  harness.api.getReadingListsForPublisher('Example');
  await new Promise(resolve => setImmediate(resolve));
  expect(fetchLists).toHaveBeenCalledTimes(1);
});

test('overlapping calls share a request and later explicit refresh still works', async () => {
  let resolveFetch;
  const fetchLists = jest.fn(() => new Promise(resolve => { resolveFetch = resolve; }));
  const { api } = loadSmartLists(fetchLists);
  const first = api.fetchAndCacheReadingLists();
  const second = api.fetchAndCacheReadingLists();
  await Promise.resolve();
  expect(fetchLists).toHaveBeenCalledTimes(1);
  resolveFetch([{ name: 'Example', publishers: ['Example'] }]);
  await Promise.all([first, second]);
  expect(fetchLists).toHaveBeenCalledTimes(1);
  expect(api.getReadingListsForPublisher('Example')).toHaveLength(1);
  const refresh = api.fetchAndCacheReadingLists();
  await Promise.resolve();
  resolveFetch([]);
  await refresh;
  expect(fetchLists).toHaveBeenCalledTimes(2);
  expect(api.getCachedReadingLists()).toHaveLength(0);
});

test('setting a loaded empty cache does not fetch', async () => {
  const fetchLists = jest.fn(async () => []);
  const { api } = loadSmartLists(fetchLists);
  api.setCachedReadingLists([]);
  expect(api.getReadingListsForPublisher('Example')).toHaveLength(0);
  await Promise.resolve();
  expect(fetchLists).not.toHaveBeenCalled();
});

test('a failed request reports the error and permits an explicit retry', async () => {
  const failure = new Error('network unavailable');
  const fetchLists = jest.fn().mockRejectedValueOnce(failure).mockResolvedValueOnce([]);
  const { api, context } = loadSmartLists(fetchLists);
  await api.fetchAndCacheReadingLists();
  expect(context.console.warn).toHaveBeenCalledWith('[smartlists] Error caching reading lists:', failure);
  await api.fetchAndCacheReadingLists();
  expect(fetchLists).toHaveBeenCalledTimes(2);
});

test('initial publisher lookup loads once and updates an active smart filter', async () => {
  const fetchLists = jest.fn(async () => [{ name: 'Example: Collection' }]);
  const { api, state } = loadSmartLists(fetchLists);
  state.currentView = 'publishers';
  state.activeSmartFilter = 'reading-list';
  state.applyFilterAndRender = jest.fn();
  api.getReadingListsForPublisher('Example');
  api.getReadingListsForPublisher('Example');
  await api.fetchAndCacheReadingLists();
  expect(fetchLists).toHaveBeenCalledTimes(1);
  expect(state.applyFilterAndRender).toHaveBeenCalledTimes(1);
  expect(api.getReadingListsForPublisher('Example')).toHaveLength(1);
});

test('direct fetch fallback caches an empty response without looping', async () => {
  const { api, state, context, elements } = loadSmartLists(null);
  state.ReadingLists = null;
  context.fetch = jest.fn(async () => {
    if (context.fetch.mock.calls.length >= 5) elements.clear();
    return { json: async () => ({ ok: true, lists: [] }) };
  });
  elements.set('dynamic-reading-list-filter-count', {});
  elements.set('dynamic-reading-list-filter-btn', { classList: { add: jest.fn() } });
  await api.fetchAndCacheReadingLists();
  await new Promise(resolve => setImmediate(resolve));
  expect(context.fetch).toHaveBeenCalledTimes(1);
  api.updateReadingListFilterButtonCount();
  await Promise.resolve();
  expect(context.fetch).toHaveBeenCalledTimes(1);
});
