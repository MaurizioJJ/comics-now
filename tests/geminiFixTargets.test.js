/** @jest-environment node */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { resolveGeminiFixTargets, MAX_GEMINI_FIX_TARGETS } = require('../server/services/gemini-fix-targets');

describe('Gemini fix target resolution', () => {
  let root;
  beforeEach(() => { root = fs.mkdtempSync(path.join(os.tmpdir(), 'comics-gemini-')); });
  afterEach(() => fs.rmSync(root, { recursive: true, force: true }));

  test('resolves existing supported comic IDs under a configured root', () => {
    const comic = path.join(root, 'one.cbz'); fs.writeFileSync(comic, 'fixture');
    expect(resolveGeminiFixTargets({ comicIds: ['id-1'], rows: [{ id: 'id-1', path: comic }], roots: [root] })).toEqual([fs.realpathSync(comic)]);
  });

  test('recursively resolves supported files from a folder', () => {
    const nested = path.join(root, 'series'); fs.mkdirSync(nested);
    const comic = path.join(nested, 'one.cbr'); fs.writeFileSync(comic, 'fixture');
    fs.writeFileSync(path.join(nested, 'ignore.txt'), 'fixture');
    expect(resolveGeminiFixTargets({ folderPath: nested, rows: [], roots: [root] })).toEqual([fs.realpathSync(comic)]);
  });

  test('rejects traversal, missing comics, empty targets, and oversized selections', () => {
    expect(() => resolveGeminiFixTargets({ folderPath: path.join(root, '..'), rows: [], roots: [root] })).toThrow(/outside configured/);
    expect(() => resolveGeminiFixTargets({ comicIds: ['missing'], rows: [], roots: [root] })).toThrow(/not found/);
    expect(() => resolveGeminiFixTargets({ comicIds: [], rows: [], roots: [root] })).toThrow(/at least one/);
    expect(() => resolveGeminiFixTargets({ comicIds: Array(MAX_GEMINI_FIX_TARGETS + 1).fill('id'), rows: [], roots: [root] })).toThrow(/at most/);
  });
});
