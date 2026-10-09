/** @jest-environment jsdom */
describe('metadata search results views', () => {
  let showSearchView;
  let getSearchFieldFilters;
  let state;
  let resolveSearch;

  beforeAll(async () => {
    document.body.innerHTML = `
      <div id="root-folder-list"></div><div id="folder-list-view"></div>
      <div id="publisher-list"></div><div id="series-list"></div><div id="comic-list"></div>
      <div id="smart-list-view"></div>
      <section id="search-results-view" class="hidden"><h2 id="search-results-title"></h2><div id="search-results-container"></div></section>
      <details id="search-field-settings"><div id="search-field-options"></div></details>
      <select id="library-search-field"><option value="all">All fields</option></select>
      <input id="library-search-query"><details id="search-per-field"><div id="search-per-field-inputs"></div></details>`;
    ({ showSearchView, getSearchFieldFilters } = await import('../public/js/library/search.js'));
    ({ state } = await import('../public/js/globals.js'));
  });

  beforeEach(() => {
    for (const id of ['root-folder-list', 'folder-list-view', 'publisher-list', 'series-list', 'comic-list', 'smart-list-view']) {
      document.getElementById(id).classList.remove('hidden');
    }
    document.getElementById('search-results-view').classList.add('hidden');
    document.getElementById('search-results-container').replaceChildren();
    state.router = null;
    state.currentView = '';
    state.lastSearchQuery = '';
    state.lastSearchField = 'all';
    state.lastSearchFilters = {};
    state.lastSearchResults = null;
    state.searchViewMode = 'folders';
    window.searchViewMode = 'folders';
    window.showFolderView = jest.fn();
  });

  test('hides the ordinary folder list while showing explicit search loading feedback', async () => {
    global.fetch = jest.fn(() => new Promise(resolve => { resolveSearch = resolve; }));
    const pending = showSearchView('French', 'language');

    expect(document.getElementById('folder-list-view').classList.contains('hidden')).toBe(true);
    expect(document.getElementById('smart-list-view').classList.contains('hidden')).toBe(true);
    expect(document.querySelector('#search-results-view [role="status"]')).not.toBeNull();
    expect(document.querySelector('#search-results-view [role="status"]').textContent).toContain('Searching');

    resolveSearch({ json: async () => [] });
    await pending;
  });

  test('groups matches by their containing folder and opens that folder', async () => {
    const matches = [
      { id: 'one', path: 'lib_0/Publisher/Series A/one.cbz', publisher: 'Publisher', series: 'Series A' },
      { id: 'two', path: 'lib_0/Publisher/Series A/two.cbz', publisher: 'Publisher', series: 'Series A' },
      { id: 'three', path: 'lib_0/Publisher/Series B/three.cbz', publisher: 'Publisher', series: 'Series B' }
    ];
    global.fetch = jest.fn().mockResolvedValue({ json: async () => matches });

    await showSearchView('French', 'language');

    const cards = [...document.querySelectorAll('[data-search-folder-path]')];
    expect(cards.map(card => card.dataset.searchFolderPath)).toEqual([
      'lib_0/Publisher/Series A', 'lib_0/Publisher/Series B'
    ]);
    const cardText = cards.map(card => card.textContent).join(' ');
    expect(cardText).toContain('Series A');
    expect(cardText).toContain('2 matching comics');
    expect(cardText).toContain('Series B');
    expect(cardText).toContain('1 matching comic');
    cards[0].click();
    expect(window.showFolderView).toHaveBeenCalledWith('lib_0/Publisher/Series A');
  });

  test('collects checked values into per-field multiselect filters', () => {
    document.getElementById('search-per-field-inputs').innerHTML = `
      <input type="checkbox" checked data-search-field-value="publisher" value="Bonelli Editore">
      <input type="checkbox" checked data-search-field-value="publisher" value="Marvel">
      <input type="checkbox" checked data-search-field-value="language" value="Italian">`;
    expect(getSearchFieldFilters()).toEqual({
      publisher: ['Bonelli Editore', 'Marvel'], language: ['Italian']
    });
  });
});
