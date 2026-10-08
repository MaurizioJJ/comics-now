jest.mock('../server/db', () => ({
  dbAll: jest.fn(),
  dbRun: jest.fn(),
  dbGet: jest.fn()
}));
jest.mock('../server/settings', () => ({ saveSetting: jest.fn().mockResolvedValue(undefined) }));
jest.mock('../server/services/metadata', () => ({
  getComicInfoFromArchive: jest.fn().mockResolvedValue({ Series: 'Dampyr', Publisher: 'Bonelli Editore' }),
  normalizePublisher: jest.fn(value => value.trim())
}));
jest.mock('../server/logger', () => ({ log: jest.fn() }));
jest.mock('../server/config', () => ({ isPathExcluded: jest.fn(() => false) }));

let db;
let saveSetting;
let indexer;
let metadata;
let logger;

describe('ComicInfo indexer publisher propagation', () => {
  beforeEach(() => {
    jest.resetModules();
    db = require('../server/db');
    ({ saveSetting } = require('../server/settings'));
    metadata = require('../server/services/metadata');
    logger = require('../server/logger');
    indexer = require('../server/services/comicinfo-indexer');
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-10-09T10:00:00Z'));
    db.dbAll.mockReset()
      .mockResolvedValueOnce([{
        id: 'dampyr-1', path: '/comics/Dampyr/001.cbz', name: '001.cbz',
        publisher: 'comics', metadata: JSON.stringify({ publisher: 'comics', Publisher: 'comics' })
      }])
      .mockResolvedValue([]);
    db.dbRun.mockReset().mockResolvedValue(undefined);
    db.dbGet.mockReset().mockResolvedValue(null);
    saveSetting.mockClear();
    logger.log.mockClear();
  });

  afterEach(() => jest.useRealTimers());

  test('replaces generic publisher placeholders with embedded ComicInfo publisher in metadata and publisher column', async () => {
    await indexer.startOrResume();
    await jest.advanceTimersByTimeAsync(0);

    const update = db.dbRun.mock.calls.find(([sql]) => sql.includes('UPDATE comics SET metadata ='));
    expect(update).toBeDefined();
    const [sql, params] = update;
    const savedMetadata = JSON.parse(params[0]);

    expect(savedMetadata.Publisher).toBe('Bonelli Editore');
    expect(savedMetadata.publisher).toBe('Bonelli Editore');
    expect(sql).toMatch(/publisher\s*=\s*CASE/i);
    expect(params).toContain('Bonelli Editore');
    await expect(indexer.getStatus()).resolves.toMatchObject({ enriched: 1, noNewFields: 0 });
  });

  test('queues existing generic publisher rows for a one-time re-index', async () => {
    db.dbRun.mockResolvedValueOnce({ changes: 18126 }).mockResolvedValue(undefined);
    await indexer.startOrResume();
    await jest.advanceTimersByTimeAsync(0);

    expect(db.dbRun.mock.calls[0][0]).toMatch(/SET metadataIndexedAt = NULL[\s\S]*json_extract\(metadata, '\$\.Publisher'\)/);
    expect(saveSetting).toHaveBeenCalledWith('comicInfoPublisherRepair_v1', 'complete');
  });

  test('preserves a meaningful existing publisher value', async () => {
    db.dbAll.mockReset()
      .mockResolvedValueOnce([{
        id: 'dampyr-1', path: '/comics/Dampyr/001.cbz', name: '001.cbz', publisher: 'Bonelli Editore',
        metadata: JSON.stringify({ Publisher: 'Bonelli Editore', publisher: 'Bonelli Editore' })
      }])
      .mockResolvedValue([]);
    await indexer.startOrResume();
    await jest.advanceTimersByTimeAsync(0);

    const update = db.dbRun.mock.calls.find(([sql]) => sql.includes('UPDATE comics SET metadata ='));
    expect(JSON.parse(update[1][0]).Publisher).toBe('Bonelli Editore');
    expect(update[1][1]).toBe('Bonelli Editore');
  });

  test('uses a meaningful lowercase metadata publisher when uppercase metadata is generic', async () => {
    metadata.getComicInfoFromArchive.mockResolvedValueOnce({ Series: 'Dampyr' });
    db.dbAll.mockReset()
      .mockResolvedValueOnce([{
        id: 'dampyr-2', path: '/comics/Dampyr/002.cbz', name: '002.cbz', publisher: 'comics',
        metadata: JSON.stringify({ Publisher: 'comics', publisher: 'Bonelli Editore' })
      }])
      .mockResolvedValue([]);
    await indexer.startOrResume();
    await jest.advanceTimersByTimeAsync(0);

    const update = db.dbRun.mock.calls.find(([sql]) => sql.includes('UPDATE comics SET metadata ='));
    const savedMetadata = JSON.parse(update[1][0]);
    expect(savedMetadata.Publisher).toBe('Bonelli Editore');
    expect(savedMetadata.publisher).toBe('Bonelli Editore');
    expect(update[1][1]).toBe('Bonelli Editore');
  });

  test('normalizes the publisher recovered from an affected live archive before storing it', async () => {
    metadata.getComicInfoFromArchive.mockResolvedValue({ Series: 'Martin Mystère', Publisher: 'Sergio Bonelli Editore' });
    db.dbAll.mockReset()
      .mockResolvedValueOnce([{
        id: 'martin-mystere-1', path: '/comics/Martin Mystère/001.cbz', name: '001.cbz', publisher: 'comics',
        metadata: JSON.stringify({ Publisher: 'comics' })
      }])
      .mockResolvedValue([]);
    await indexer.startOrResume();
    await jest.advanceTimersByTimeAsync(0);

    const update = db.dbRun.mock.calls.find(([sql]) => sql.includes('UPDATE comics SET metadata ='));
    expect(metadata.normalizePublisher).toHaveBeenCalledWith('Sergio Bonelli Editore');
    expect(JSON.parse(update[1][0]).Publisher).toBe('Sergio Bonelli Editore');
    expect(update[1][1]).toBe('Sergio Bonelli Editore');
  });

  test('records archive read failures and marks the row processed', async () => {
    metadata.getComicInfoFromArchive.mockRejectedValueOnce(new Error('archive read failed'));
    await indexer.startOrResume();
    await jest.advanceTimersByTimeAsync(0);

    await expect(indexer.getStatus()).resolves.toMatchObject({
      processed: 1,
      errors: 1,
      lastError: '001.cbz: archive read failed'
    });
    expect(db.dbRun).toHaveBeenCalledWith(
      'UPDATE comics SET metadataIndexedAt = ? WHERE id = ?',
      [Date.now(), 'dampyr-1']
    );
    expect(logger.log).toHaveBeenCalledWith(
      'ERROR', 'META_INDEX', 'Failed to index ComicInfo for 001.cbz: archive read failed'
    );
  });
});
