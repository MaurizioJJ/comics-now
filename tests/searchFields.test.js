const attachLibraryRoutes = require('../server/routes/user/library');
const metadataService = require('../server/services/metadata');

function createRouteHarness(comics, overrides = {}) {
  const routes = new Map();
  const router = { get: (path, ...handlers) => routes.set(path, handlers.at(-1)) };
  attachLibraryRoutes(router, {
    log: jest.fn(), dbGet: async () => ({ role: 'admin' }),
    dbAll: async sql => sql.includes('FROM comics') ? comics : [],
    buildLibrary: async () => ({}), getComicsDirectories: () => ['/comics'],
    getLibraryIdFromPath: () => 'comics', resolvePath: value => value,
    generateVirtualMetadata: jest.fn(), checkComicAccess: async () => true,
    getReadingPrefMaps: async () => ({}), resolveReadingModes: () => ({ mangaMode: false, continuousMode: false }),
    validateSearchQuery: query => ({ valid: true, sanitized: query }), requireAuth: jest.fn(),
    ...overrides
  });
  return routes;
}

function response() {
  return { statusCode: 200, status(code) { this.statusCode = code; return this; }, json(value) { this.body = value; return this; } };
}

const comics = [
  { id: 1, name: 'Issue A', path: '/comics/a.cbz', metadata: JSON.stringify({ Writer: 'Text Author', Penciller: 'Draw Artist', Year: '1987', Tags: 'Mystery', LanguageISO: 'fr' }), series: 'Series A', publisher: 'Publisher A' },
  { id: 2, name: 'Issue B', path: '/comics/b.cbz', metadata: JSON.stringify({ Writer: 'Other Writer', Penciller: 'Text Author', Year: '1998', Tags: 'Comedy', LanguageISO: 'eng', CustomCredit: 'Special Artist' }), series: 'Series B', publisher: 'Publisher B' }
];

describe('metadata field search', () => {
  test.each([
    ['writer', 'Text Author', [1]], ['penciller', 'Text Author', [2]],
    ['year', '1987', [1]], ['tags', 'Mystery', [1]],
    ['metadata:CustomCredit', 'Special Artist', [2]]
  ])('filters only the selected %s value', async (field, query, expectedIds) => {
    const result = response();
    await createRouteHarness(comics).get('/api/v1/search')({ query: { query, field }, user: { userId: 'u1' } }, result);
    expect(result.body.map(comic => comic.id)).toEqual(expectedIds);
  });

  test('combines field filters without a global term and accepts French language names', async () => {
    const result = response();
    await createRouteHarness(comics).get('/api/v1/search')({
      query: { query: '', filters: JSON.stringify({ language: 'French', publisher: 'Publisher A' }) },
      user: { userId: 'u1' }
    }, result);
    expect(result.body.map(comic => comic.id)).toEqual([1]);
  });

  test('filters a single language field with an empty global search using French', async () => {
    const result = response();
    await createRouteHarness(comics).get('/api/v1/search')({
      query: { query: '', filters: JSON.stringify({ language: 'French' }) },
      user: { userId: 'u1' }
    }, result);
    expect(result.body.map(comic => comic.id)).toEqual([1]);
  });

  test('reads the archive ComicInfo language when folder-mode index metadata omits it', async () => {
    const comic = { ...comics[0], id: 3, path: '/comics/archive-only-language.cbz', metadata: '{}' };
    const archiveReader = jest.spyOn(metadataService, 'getComicInfoFromArchive').mockResolvedValue({ LanguageISO: 'fr' });
    const result = response();
    await createRouteHarness([comic]).get('/api/v1/search')({
      query: { query: '', filters: JSON.stringify({ language: 'French' }) },
      user: { userId: 'u1' }
    }, result);
    expect(archiveReader).toHaveBeenCalledWith(comic.path);
    expect(result.body.map(item => item.id)).toEqual([3]);
    archiveReader.mockRestore();
  });

  test('global search scoped to Language also reads archive-only language values', async () => {
    const comic = { ...comics[0], id: 4, path: '/comics/global-archive-language.cbz', metadata: '{}' };
    const archiveReader = jest.spyOn(metadataService, 'getComicInfoFromArchive').mockResolvedValue({ LanguageISO: 'fr' });
    const result = response();
    await createRouteHarness([comic]).get('/api/v1/search')({
      query: { query: 'French', field: 'language' }, user: { userId: 'u1' }
    }, result);
    expect(archiveReader).toHaveBeenCalledWith(comic.path);
    expect(result.body.map(item => item.id)).toEqual([4]);
    archiveReader.mockRestore();
  });

  test('does not read archive metadata for comics outside the user access list', async () => {
    const comic = { ...comics[0], id: 5, path: '/comics/private-language.cbz', metadata: '{}' };
    const archiveReader = jest.spyOn(metadataService, 'getComicInfoFromArchive').mockResolvedValue({ LanguageISO: 'fr' });
    const result = response();
    await createRouteHarness([comic], {
      dbGet: async () => ({ role: 'user' }),
      checkComicAccess: async () => false
    }).get('/api/v1/search')({
      query: { query: '', filters: JSON.stringify({ language: 'French' }) },
      user: { userId: 'u1' }
    }, result);
    expect(archiveReader).not.toHaveBeenCalled();
    expect(result.body).toEqual([]);
    archiveReader.mockRestore();
  });

  test('catalog includes built-in, language and discovered metadata fields', async () => {
    const result = response();
    await createRouteHarness(comics).get('/api/v1/search/fields')({ user: { userId: 'u1' } }, result);
    expect(result.body.map(field => field.value)).toEqual(expect.arrayContaining([
      'all', 'language', 'year', 'writer', 'penciller', 'tags', 'metadata:CustomCredit'
    ]));
  });
});
