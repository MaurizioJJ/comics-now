jest.mock('../../../server/services/metadata', () => ({
  getComicInfoFromArchive: jest.fn(),
  isTitleSameAsSeries: jest.fn(() => false)
}));

const attachMetadataRoutes = require('../../../server/routes/user/metadata');
const { getComicInfoFromArchive } = require('../../../server/services/metadata');

describe('GET /api/v1/comics/info', () => {
  let handler;
  let deps;

  beforeEach(() => {
    jest.clearAllMocks();
    const router = {
      get: jest.fn((routePath, ...handlers) => {
        if (routePath === '/api/v1/comics/info') handler = handlers[handlers.length - 1];
      }),
      post: jest.fn(),
      put: jest.fn(),
      delete: jest.fn()
    };
    deps = {
      dbGet: jest.fn()
        .mockResolvedValueOnce({ id: 'comic-1', publisher: 'comics', series: '1940' })
        .mockResolvedValueOnce({ metadata: JSON.stringify({ Number: '1940', Publisher: 'comics' }) }),
      log: jest.fn(),
      formatErrorMessage: jest.fn((error) => error.message),
      isPathSafe: jest.fn(() => true),
      resolvePath: jest.fn(value => value),
      checkComicAccess: jest.fn().mockResolvedValue(true),
      getComicsDirectories: jest.fn(() => ['/library']),
      createId: jest.fn(() => 'comic-1'),
      getComicVineApiKey: jest.fn(),
      cvFetchJson: jest.fn(),
      COMICVINE_API_URL: 'https://example.invalid',
      stripHtml: value => value,
      normalizeCvId: value => value
    };
    attachMetadataRoutes(router, deps);
    getComicInfoFromArchive.mockResolvedValue({
      Series: '1940', Genre: 'Alternate history', PageCount: '64',
      LanguageISO: 'fre', Pages: { Page: [{ Image: '0001.jpg' }] }
    });
  });

  test('combines embedded ComicInfo with indexed fields so the dialog receives all metadata', async () => {
    const response = { statusCode: 200, status: jest.fn(function (code) { this.statusCode = code; return this; }), json: jest.fn() };
    const comicPath = '/library/1940/T01.cbz';

    await handler({
      query: { path: Buffer.from(comicPath).toString('base64') },
      user: { userId: 'default-user', role: 'admin' }
    }, response);

    expect(getComicInfoFromArchive).toHaveBeenCalledWith(comicPath);
    expect(response.json).toHaveBeenCalledWith(expect.objectContaining({
      Number: '1940', Publisher: 'comics', Genre: 'Alternate history',
      PageCount: '64', LanguageISO: 'fre', Pages: { Page: [{ Image: '0001.jpg' }] }
    }));
  });
});
