/** @jest-environment jsdom */
describe('comic metadata dialog', () => {
  let openComicMetadata;

  beforeAll(async () => {
    ({ openComicMetadata } = await import('../public/js/context-menu/actions-comic.js'));
  });

  beforeEach(() => {
    document.body.replaceChildren();
    window.API_BASE_URL = '';
    global.TextEncoder = require('util').TextEncoder;
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ Title: 'Recovered from ComicInfo.xml', Writer: 'Ada Writer', LanguageISO: 'fre' })
    });
  });

  test('loads full ComicInfo metadata for a library card before rendering', async () => {
    await openComicMetadata({
      id: 'comic-1', path: 'lib_0/Series/issue.cbz', name: 'issue.cbz',
      metadata: { Title: '', Writer: '', Number: '' }
    });

    expect(fetch).toHaveBeenCalledWith('/api/v1/comics/info?path=bGliXzAvU2VyaWVzL2lzc3VlLmNieg%3D%3D');
    expect(document.querySelector('.comic-metadata-title').textContent).toBe('Recovered from ComicInfo.xml');
    expect(document.querySelector('.comic-metadata-empty')).toBeNull();
  });

  test('shows an explicit load error instead of claiming metadata is absent when the request fails', async () => {
    fetch.mockResolvedValueOnce({ ok: false, status: 503 });
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    await openComicMetadata({ id: 'comic-1', path: 'lib_0/Series/issue.cbz', name: 'issue.cbz', metadata: {} });
    expect(document.querySelector('.comic-metadata-load-error').textContent)
      .toContain('Could not load full ComicInfo metadata');
    expect(document.querySelector('.comic-metadata-empty')).toBeNull();
  });
});
