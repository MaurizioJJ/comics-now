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
      <button id="reset-library-filters" type="button">Reset all filters</button><span id="search-results-count" role="status"></span>
      <button class="filter-btn" data-filter="all">All</button><button class="filter-btn active" data-filter="read">Read</button>
      <input id="library-search-query"><details id="search-per-field"><div id="search-per-field-inputs"></div></details>`;
    localStorage.setItem('comicsNow.visibleSearchFields', JSON.stringify(['language', 'metadata:Locations']));
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
    window.showRootFolderList = jest.fn();
    state.showRootFolderList = null;
    state.activeFilter = 'all';
    state.activeSmartFilter = null;
    document.getElementById('search-results-count').textContent = '';
    document.getElementById('search-per-field-inputs').replaceChildren();
  });

  test('hides the ordinary folder list while showing explicit search loading feedback', async () => {
    global.fetch = jest.fn(() => new Promise(resolve => { resolveSearch = resolve; }));
    const pending = showSearchView('French', 'language');

    expect(document.getElementById('folder-list-view').classList.contains('hidden')).toBe(true);
    expect(document.getElementById('smart-list-view').classList.contains('hidden')).toBe(true);
    expect(document.querySelector('#search-results-view [role="status"]')).not.toBeNull();
    expect(document.querySelector('#search-results-view [role="status"]').textContent).toContain('Searching');

    resolveSearch({ ok: true, json: async () => [] });
    await pending;
  });

  test('groups matches by their containing folder and opens that folder', async () => {
    const matches = [
      { id: 'one', path: 'lib_0/Publisher/Series A/one.cbz', publisher: 'Publisher', series: 'Series A' },
      { id: 'two', path: 'lib_0/Publisher/Series A/two.cbz', publisher: 'Publisher', series: 'Series A' },
      { id: 'three', path: 'lib_0/Publisher/Series B/three.cbz', publisher: 'Publisher', series: 'Series B' }
    ];
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => matches });

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
  test.each([0, 1, 3])('reports %i matching comics, rather than folder cards', async count => {
    const matches = Array.from({ length: count }, (_, id) => ({ id, path: `lib_0/Series/${id}.cbz` }));
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => matches });
    await showSearchView('', 'all', false, { language: ['French'] });
    expect(document.getElementById('search-results-count').textContent).toBe(`${count} matching ${count === 1 ? 'comic' : 'comics'}`);
  });

  test('reset button clears all filters and search state, and restores the library', async () => {
    state.activeFilter = window.activeFilter = 'read';
    state.activeSmartFilter = window.activeSmartFilter = 'manga';
    state.activeAlphaFilter = window.activeAlphaFilter = 'B';
    document.getElementById('library-search-query').value = 'Batman';
    state.lastSearchFilters = { publisher: ['DC'] };
    state.lastSearchResults = [{ id: 'old' }];
    document.getElementById('search-per-field-inputs').innerHTML = '<input type="checkbox" checked data-search-field-value="publisher" value="DC">';
    document.getElementById('reset-library-filters').click();
    expect(getSearchFieldFilters()).toEqual({});
    expect(document.getElementById('library-search-query').value).toBe('');
    expect(document.getElementById('library-search-field').value).toBe('all');
    expect(state.lastSearchFilters).toEqual({});
    expect(state.lastSearchResults).toBeNull();
    expect(state.activeFilter).toBe('all');
    expect(window.activeFilter).toBe('all');
    expect(state.activeSmartFilter).toBeNull();
    expect(window.activeSmartFilter).toBeNull();
    expect(state.activeAlphaFilter).toBe('All');
    expect(document.querySelector('.filter-btn[data-filter="all"]').classList.contains('active')).toBe(true);
    expect(document.querySelector('.filter-btn[data-filter="read"]').classList.contains('active')).toBe(false);
    expect(window.showRootFolderList).toHaveBeenCalledWith({ force: true });
  });

  test('reset invalidates pending search responses', async () => {
    global.fetch = jest.fn(() => new Promise(resolve => { resolveSearch = resolve; }));
    const pending = showSearchView('old', 'all');
    document.getElementById('reset-library-filters').click();
    resolveSearch({ ok: true, json: async () => [{ id: 'old', path: 'lib_0/old.cbz' }] });
    await pending;
    expect(state.lastSearchResults).toBeNull();
    expect(document.getElementById('search-results-count').textContent).toBe('');
  });

  test('failed search clears the previous count and shows the failure', async () => {
    document.getElementById('search-results-count').textContent = '3 matching comics';
    global.fetch = jest.fn().mockRejectedValue(new Error('offline'));
    const log = jest.spyOn(console, 'error').mockImplementation(() => {});
    await showSearchView('French', 'language');
    expect(document.getElementById('search-results-count').textContent).toBe('');
    expect(document.getElementById('search-results-container').textContent).toContain('Search failed');
    expect(log).toHaveBeenCalledWith('[search] Error:', expect.any(Error));
    log.mockRestore();
  });

  test.each([
    { ok: false, status: 403, json: async () => [] },
    { ok: true, json: async () => ({ message: 'invalid' }) }
  ])('shows a visible failure for rejected or malformed responses', async response => {
    global.fetch = jest.fn().mockResolvedValue(response);
    const log = jest.spyOn(console, 'error').mockImplementation(() => {});
    await showSearchView('French', 'language');
    expect(document.getElementById('search-results-count').textContent).toBe('');
    expect(document.getElementById('search-results-container').textContent).toContain('Search failed');
    expect(log).toHaveBeenCalled();
    log.mockRestore();
  });

  test('updates the count when reusing cached metadata-only results', async () => {
    const matches = [{ id: 'cached', path: 'lib_0/Series/cached.cbz' }];
    state.lastSearchQuery = '';
    state.lastSearchField = 'all';
    state.lastSearchFilters = { language: ['fr'] };
    state.lastSearchResults = matches;
    global.fetch = jest.fn();
    await showSearchView('', 'all', true, state.lastSearchFilters);
    expect(document.getElementById('search-results-count').textContent).toBe('1 matching comic');
    expect(global.fetch).not.toHaveBeenCalled();
  });

  test('dropdowns use full indexed server values and reset their selection summaries', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => [
      { value: 'all', label: 'All fields', options: [] },
      { value: 'language', label: 'Language', options: ['fr'] },
      { value: 'metadata:Locations', label: 'Locations', options: ['Paris'] }
    ] });
    const panel = document.getElementById('search-per-field');
    panel.open = true;
    panel.dispatchEvent(new Event('toggle'));
    await new Promise(resolve => setTimeout(resolve, 0));
    const language = document.querySelector('[data-search-field-control="language"]');
    language.open = true;
    language.dispatchEvent(new Event('toggle'));
    const choice = language.querySelector('[value="fr"]');
    expect(choice).not.toBeNull();
    choice.click();
    expect(language.querySelector('summary').textContent).toBe('Language (1 selected)');
    const locations = document.querySelector('[data-search-field-control="metadata:Locations"]');
    locations.open = true;
    locations.dispatchEvent(new Event('toggle'));
    expect(locations.querySelector('[value="Paris"]')).not.toBeNull();
    document.getElementById('reset-library-filters').click();
    expect(getSearchFieldFilters()).toEqual({});
    expect(document.querySelector('[data-search-field-control="language"] summary').textContent).toBe('Language');
    await new Promise(resolve => setTimeout(resolve, 350));
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

});
