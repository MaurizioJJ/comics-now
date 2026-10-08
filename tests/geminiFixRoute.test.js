/** @jest-environment node */
const fs = require('fs');
const os = require('os');
const path = require('path');
const attachRoutes = require('../server/routes/admin/comictagger');

describe('POST /api/v1/tag-comics-now/gemini-fix', () => {
  let root; let handler; let runComicTagger;
  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'comics-gemini-route-'));
    const comicPath = path.join(root, 'issue.cbz'); fs.writeFileSync(comicPath, 'fixture');
    const router = { get: jest.fn(), post: jest.fn((route, ...args) => { if (route.endsWith('/gemini-fix')) handler = args.at(-1); }) };
    runComicTagger = jest.fn();
    const rows = [
      { id: 'comic-1', path: comicPath },
      { key: 'geminiApiKey', value: '"test-key"' },
      { key: 'geminiCoverMatchEnabled', value: 'true' },
      { key: 'geminiTermsAccepted', value: 'true' }
    ];
    attachRoutes(router, {
      runComicTagger, dbAll: jest.fn(async sql => sql.includes('SELECT id, path') ? rows.filter(row => row.id) : rows.filter(row => row.key)),
      getComicsDirectories: () => [root], isTaggerRunning: () => false, config: {}
    });
    handler.comicPath = comicPath;
  });
  afterEach(() => fs.rmSync(root, { recursive: true, force: true }));

  function response() {
    return { statusCode: 200, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
  }

  test('starts a forced Gemini run with only the requested resolved comic', async () => {
    const res = response();
    await handler({ body: { comicIds: ['comic-1'] } }, res);
    expect(res.statusCode).toBe(202);
    expect(res.body).toEqual({ ok: true, count: 1 });
    expect(runComicTagger).toHaveBeenCalledWith({ mode: 'force', paths: [fs.realpathSync(handler.comicPath)], geminiRequired: true });
  });

  test('requires explicit Gemini setup before scheduling work', async () => {
    const res = response();
    const deps = {
      runComicTagger, dbAll: jest.fn(async () => []), getComicsDirectories: () => [root],
      isTaggerRunning: () => false, config: { geminiApiKey: 'test-key', geminiTermsAccepted: false }
    };
    const router = { get: jest.fn(), post: jest.fn((route, ...args) => { if (route.endsWith('/gemini-fix')) handler = args.at(-1); }) };
    attachRoutes(router, deps);
    await handler({ body: { comicIds: ['comic-1'] } }, res);
    expect(res.statusCode).toBe(412);
    expect(runComicTagger).not.toHaveBeenCalled();
  });
});
