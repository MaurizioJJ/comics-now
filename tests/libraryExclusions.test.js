const fs = require('fs');
const path = require('path');
const config = require('../server/config');
const { CONFIG_FILE } = require('../server/constants');
const { dbRun, dbGet, checkComicAccess } = require('../server/db');
const { scanLibrary } = require('../server/services/library-scan');
const { buildLibrary } = require('../server/services/library');
const attachSettings = require('../server/routes/admin/settings');
const attachLibrary = require('../server/routes/user/library');

describe('Library folder exclusions', () => {
  const root = path.join(process.env.DATA_DIR, 'exclusion-library');
  const excludedComic = path.join(root, 'Hidden', 'Nested', 'comic.cbz');
  let originalLibraries;
  let originalInbox;
  let originalGlobalExclusions;

  beforeEach(() => {
    originalLibraries = config.getLibraries();
    originalGlobalExclusions = config.getConfig().excludedFolders;
    originalInbox = config.getComicsLocation();
    config.getConfig().libraries = [{ path: root, hierarchyMode: 'folder' }];
    config.setComicsLocation(root, true);
  });

  afterEach(async () => {
    jest.restoreAllMocks();
    config.getConfig().libraries = originalLibraries;
    config.getConfig().excludedFolders = originalGlobalExclusions;
    config.setComicsLocation(originalInbox, true);
    await dbRun('DELETE FROM comics WHERE id = ?', ['excluded-test']);
    await dbRun('DELETE FROM user_comic_status WHERE comicId = ?', ['excluded-test']);
    await dbRun('DELETE FROM scan_dirs WHERE dir LIKE ?', [`${root}%`]);
    fs.rmSync(root, { recursive: true, force: true });
  });

  test('normalizes and persists exact relative folder rules with subtree boundaries', () => {
    config.setLibraryExcludedFolders(root, [' Hidden/Nested/ ', 'Hidden/Nested', 'Hidden\\Other']);
    expect(config.getLibraries()[0].excludedFolders).toEqual(['Hidden/Nested', 'Hidden/Other']);
    expect(JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8')).libraries[0].excludedFolders)
      .toEqual(['Hidden/Nested', 'Hidden/Other']);
    expect(config.isPathExcluded(excludedComic)).toBe(true);
    expect(config.isPathExcluded(path.join(root, 'Hidden', 'Nested'))).toBe(true);
    expect(config.isPathExcluded(path.join(root, 'Hidden', 'Nested-extra', 'comic.cbz'))).toBe(false);
    expect(config.isPathExcluded(path.join(root + '-other', 'Hidden', 'Nested', 'comic.cbz'))).toBe(false);
    expect(config.isPathExcluded(path.join(root, 'Hidden', 'comic.cbz'))).toBe(false);
    config.setLibraryExcludedFolders(root, []);
    expect(config.isPathExcluded(excludedComic)).toBe(false);
  });

  test('matches optional folder-name text at any depth without matching filenames or other libraries', () => {
    config.setLibraryExclusions(root, { excludedFolderNameContains: [' old ', 'PRIVATE', 'old'] });
    expect(config.getLibraries()[0].excludedFolderNameContains).toEqual(['old', 'PRIVATE']);
    expect(config.isPathExcluded(path.join(root, 'Series Old Edition', 'comic.cbz'))).toBe(true);
    expect(config.isPathExcluded(path.join(root, 'private scans', 'nested', 'comic.cbz'))).toBe(true);
    expect(config.isPathExcluded(path.join(root, 'Visible', 'My Old Comic.cbz'))).toBe(false);
    expect(config.isPathExcluded(path.join(root + '-other', 'Old', 'comic.cbz'))).toBe(false);
    config.setLibraryExclusions(root, { excludedFolderNameContains: [] });
    expect(config.isPathExcluded(path.join(root, 'Series Old Edition', 'comic.cbz'))).toBe(false);
  });

  test('keeps legacy global path exclusions working alongside per-library rules', () => {
    const globalFolder = path.join(root, 'LegacyHidden');
    expect(config.addExcludedFolder(globalFolder)).toBe(true);
    expect(config.getExcludedFolders()).toContain(globalFolder);
    expect(config.isPathExcluded(path.join(globalFolder, 'comic.cbz'))).toBe(true);
    expect(config.removeExcludedFolder(globalFolder)).toBe(true);
    expect(config.isPathExcluded(path.join(globalFolder, 'comic.cbz'))).toBe(false);
  });

  test.each([null, 'Hidden', [''], ['.'], ['..'], ['../Hidden'], ['/outside'], ['C:\\outside'], ['Hidden/../../outside'], [12], ['bad\0name'], Array(101).fill('Hidden')])(
    'rejects invalid exclusion lists without changing the library: %j', rules => {
      expect(() => config.setLibraryExcludedFolders(root, rules)).toThrow();
      expect(config.getLibraries()[0].excludedFolders).toBeUndefined();
    }
  );

  test('rejects unknown libraries and rolls back the in-memory setting on persistence failure', () => {
    expect(() => config.setLibraryExcludedFolders(root + '-unknown', ['Hidden'])).toThrow();
    const write = jest.spyOn(fs, 'writeFileSync').mockImplementation(() => { throw new Error('disk full'); });
    expect(() => config.setLibraryExcludedFolders(root, ['Hidden'])).toThrow('Failed to save library exclusions');
    expect(config.getLibraries()[0].excludedFolders).toBeUndefined();
    write.mockRestore();
  });

  test.each([null, 'Old', [''], ['.'], ['..'], ['../Old'], ['Old/Private'], ['bad\0text'], [12], Array(101).fill('Old')])(
    'rejects invalid folder-name text rules without changing the library: %j', rules => {
      expect(() => config.setLibraryExclusions(root, { excludedFolderNameContains: rules })).toThrow();
      expect(config.getLibraries()[0].excludedFolderNameContains).toBeUndefined();
    }
  );

  test('the admin endpoint validates input and registers the administrator guard', async () => {
    const routes = new Map();
    const requireAdmin = jest.fn();
    attachSettings({ get: jest.fn(), delete: jest.fn(), post: (url, ...handlers) => routes.set(url, handlers) }, {
      requireAdmin, formatErrorMessage: error => error.message
    });
    const handlers = routes.get('/api/v1/admin/library-exclusions');
    expect(handlers).toBeDefined();
    expect(handlers[0]).toBe(requireAdmin);
    const response = { json: jest.fn(), status: jest.fn().mockReturnThis() };
    await handlers[1]({ body: { path: root, excludedFolders: ['Hidden'] } }, response);
    expect(response.json).toHaveBeenCalledWith({ ok: true, excludedFolders: ['Hidden'], excludedFolderNameContains: [] });
    await handlers[1]({ body: { path: root, excludedFolders: ['../outside'] } }, response);
    expect(response.status).toHaveBeenCalledWith(400);
    expect(config.isPathExcluded(excludedComic)).toBe(true);
    const write = jest.spyOn(fs, 'writeFileSync').mockImplementation(() => { throw new Error('disk full'); });
    await handlers[1]({ body: { path: root, excludedFolders: [] } }, response);
    expect(response.status).toHaveBeenCalledWith(500);
    expect(config.isPathExcluded(excludedComic)).toBe(true);
    write.mockRestore();
  });

  test('excluded subtrees are not scanned, existing metadata and progress survive, and clearing restores visibility', async () => {
    fs.mkdirSync(path.dirname(excludedComic), { recursive: true });
    fs.copyFileSync(path.join(__dirname, 'fixtures/sample.cbz'), excludedComic);
    await dbRun('INSERT INTO comics (id, path, name, publisher, series, thumbnailPath) VALUES (?, ?, ?, ?, ?, ?)',
      ['excluded-test', excludedComic, 'comic.cbz', 'Example', 'Series', 'retained.jpg']);
    await dbRun('INSERT INTO user_comic_status (userId, comicId, lastReadPage, totalPages) VALUES (?, ?, ?, ?)',
      ['default-user', 'excluded-test', 3, 10]);
    expect(Object.keys(await buildLibrary())).toHaveLength(1);
    config.setLibraryExcludedFolders(root, ['Hidden']);
    const readdir = jest.spyOn(fs.promises, 'readdir');
    await scanLibrary(true);
    expect(readdir.mock.calls.some(([directory]) => directory === path.join(root, 'Hidden'))).toBe(false);
    expect(await dbGet('SELECT thumbnailPath FROM comics WHERE id = ?', ['excluded-test'])).toEqual({ thumbnailPath: 'retained.jpg' });
    expect(await dbGet('SELECT lastReadPage FROM user_comic_status WHERE comicId = ?', ['excluded-test'])).toEqual({ lastReadPage: 3 });
    expect(fs.existsSync(excludedComic)).toBe(true);
    expect(await buildLibrary()).toEqual({});
    expect(await checkComicAccess('default-user', 'admin', excludedComic, 'Example', 'Series', [root])).toBe(false);
    fs.unlinkSync(excludedComic);
    await scanLibrary(true);
    expect(await dbGet('SELECT id FROM comics WHERE id = ?', ['excluded-test'])).toEqual({ id: 'excluded-test' });
    config.setLibraryExcludedFolders(root, []);
    expect(Object.keys(await buildLibrary())).toHaveLength(1);
  });

  test('persisted exclusions are validated when libraries are loaded', () => {
    expect(config.sanitizeDirectories([{ path: root, excludedFolders: ['Hidden\\Nested'] }])[0].excludedFolders).toEqual(['Hidden/Nested']);
    expect(() => config.sanitizeDirectories([{ path: root, excludedFolders: ['../outside'] }])).toThrow();
  });

  test('folder navigation hides excluded children and denies direct navigation even for admins', async () => {
    fs.mkdirSync(path.join(root, 'Hidden'), { recursive: true });
    fs.mkdirSync(path.join(root, 'Visible'), { recursive: true });
    config.setLibraryExcludedFolders(root, ['Hidden']);
    let handler;
    attachLibrary({ get: (url, ...handlers) => { if (url.startsWith('/api/v1/folders/')) handler = handlers.at(-1); } }, {
      log: jest.fn(), dbAll: jest.fn(async () => []), getComicsDirectories: () => [root],
      getLibraryIdFromPath: config.getLibraryIdFromPath, resolvePath: value => value,
      requireAuth: jest.fn(), formatErrorMessage: error => error.message
    });
    const response = { json: jest.fn(), status: jest.fn().mockReturnThis() };
    await handler({ params: { path: Buffer.from(root).toString('base64') }, user: { userId: 'admin', role: 'admin' } }, response);
    expect(response.json.mock.calls[0][0].folders.map(folder => folder.name)).toEqual(['Visible']);
    await handler({ params: { path: Buffer.from(path.join(root, 'Hidden')).toString('base64') }, user: { userId: 'admin', role: 'admin' } }, response);
    expect(response.status).toHaveBeenCalledWith(403);
  });
});
