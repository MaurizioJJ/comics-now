const { dbAll, dbRun } = require('../db');
const { saveSetting } = require('../settings');
const { getComicInfoFromArchive } = require('./metadata');
const { log } = require('../logger');
const { isPathExcluded } = require('../config');

const ACTIVE_WINDOW_MS = 60 * 60 * 1000;
const PAUSE_WINDOW_MS = 60 * 60 * 1000;
const BATCH_SIZE = 10;
const CONCURRENCY = 2;
const STATE_KEY = 'comicInfoMetadataIndex';

let timer = null;
let running = false;
let state = {
  status: 'idle',
  processed: 0,
  enriched: 0,
  noNewFields: 0,
  withoutComicInfo: 0,
  errors: 0,
  trancheStartedAt: null,
  nextRunAt: null,
  lastError: null
};

async function persistState() {
  await saveSetting(STATE_KEY, state);
}

async function loadState() {
  const row = await require('../db').dbGet('SELECT value FROM settings WHERE key = ?', [STATE_KEY]);
  if (!row?.value) return;
  try {
    const saved = JSON.parse(row.value);
    // Earlier .9 builds counted all comics with no added fields under this
    // broad label. Preserve the count as noNewFields; new records distinguish
    // archives with no readable ComicInfo from already-indexed fields.
    if (saved.noNewFields === undefined && saved.withoutMetadata !== undefined) {
      saved.noNewFields = saved.withoutMetadata;
    }
    delete saved.withoutMetadata;
    state = { ...state, ...saved };
  } catch (error) {
    log('ERROR', 'META_INDEX', `Could not parse saved index state: ${error.message}`);
  }
}

async function processComic(comic, deadline) {
  if (Date.now() >= deadline) return false;
  try {
    if (isPathExcluded(comic.path)) {
      await dbRun('UPDATE comics SET metadataIndexedAt = ? WHERE id = ?', [Date.now(), comic.id]);
      state.processed++;
      return true;
    }

    const embedded = await getComicInfoFromArchive(comic.path);
    const existing = (() => {
      try { return JSON.parse(comic.metadata || '{}'); } catch { return {}; }
    })();
    const additions = Object.fromEntries(Object.entries(embedded || {}).filter(([, value]) =>
      value !== null && value !== undefined && String(value).trim() !== ''
    ));
    const merged = { ...additions };
    for (const [key, value] of Object.entries(existing)) {
      if (value !== null && value !== undefined && String(value).trim() !== '') merged[key] = value;
    }
    const addedKeys = Object.keys(additions).filter(key =>
      existing[key] === null || existing[key] === undefined || String(existing[key]).trim() === ''
    );

    await dbRun('UPDATE comics SET metadata = ?, metadataIndexedAt = ? WHERE id = ?', [
      JSON.stringify(merged), Date.now(), comic.id
    ]);
    state.processed++;
    if (addedKeys.length) state.enriched++;
    else if (Object.keys(additions).length) state.noNewFields++;
    else state.withoutComicInfo++;
    return true;
  } catch (error) {
    state.errors++;
    state.lastError = `${comic.name}: ${error.message}`;
    log('ERROR', 'META_INDEX', `Failed to index ComicInfo for ${comic.name}: ${error.message}`);
    // Do not retry a permanently unreadable archive on every tranche. A changed
    // comic is reset to unindexed by the regular scanner's INSERT OR REPLACE.
    await dbRun('UPDATE comics SET metadataIndexedAt = ? WHERE id = ?', [Date.now(), comic.id]);
    state.processed++;
    return true;
  }
}

async function takeBatch(deadline) {
  const rows = await dbAll(
    `SELECT id, path, name, metadata FROM comics
     WHERE libraryMode = 'folder' AND metadataIndexedAt IS NULL
     ORDER BY id LIMIT ?`,
    [BATCH_SIZE]
  );
  if (!rows.length) return 0;

  let next = 0;
  const workers = Array.from({ length: Math.min(CONCURRENCY, rows.length) }, async () => {
    while (next < rows.length && Date.now() < deadline) {
      const comic = rows[next++];
      await processComic(comic, deadline);
    }
  });
  await Promise.all(workers);
  await persistState();
  return rows.length;
}

function scheduleAt(timestamp) {
  if (timer) clearTimeout(timer);
  const delay = Math.max(0, timestamp - Date.now());
  timer = setTimeout(() => runWindow().catch(error => {
    log('ERROR', 'META_INDEX', `Indexer scheduler failed: ${error.message}`);
    state.status = 'error';
    state.lastError = error.message;
    state.nextRunAt = Date.now() + PAUSE_WINDOW_MS;
    persistState().finally(() => scheduleAt(state.nextRunAt));
  }), delay);
  timer.unref?.();
}

async function runWindow() {
  if (running) return;
  running = true;
  try {
    if (!state.trancheStartedAt || Date.now() - state.trancheStartedAt >= ACTIVE_WINDOW_MS) {
      state.trancheStartedAt = Date.now();
    }
    const deadline = state.trancheStartedAt + ACTIVE_WINDOW_MS;
    state.status = 'indexing';
    state.nextRunAt = null;
    state.lastError = null;
    await persistState();
    log('INFO', 'META_INDEX', `Starting ComicInfo indexing tranche; active window ends at ${new Date(deadline).toISOString()}`);

    while (Date.now() < deadline) {
      const count = await takeBatch(deadline);
      if (!count) {
        state.status = 'complete';
        state.trancheStartedAt = null;
        state.nextRunAt = Date.now() + PAUSE_WINDOW_MS;
        await persistState();
        log('INFO', 'META_INDEX', `ComicInfo indexing complete. Processed ${state.processed}; enriched ${state.enriched}; no new fields ${state.noNewFields}; no ComicInfo ${state.withoutComicInfo}; errors ${state.errors}.`);
        scheduleAt(state.nextRunAt);
        return;
      }
    }

    state.status = 'paused';
    state.trancheStartedAt = null;
    state.nextRunAt = Date.now() + PAUSE_WINDOW_MS;
    await persistState();
    log('INFO', 'META_INDEX', `ComicInfo tranche paused after ${state.processed} comics; next tranche at ${new Date(state.nextRunAt).toISOString()}.`);
    scheduleAt(state.nextRunAt);
  } finally {
    running = false;
  }
}

async function startOrResume() {
  await loadState();
  if (state.nextRunAt && state.nextRunAt > Date.now()) {
    scheduleAt(state.nextRunAt);
    return;
  }
  scheduleAt(Date.now());
}

async function getStatus() {
  return { ...state, activeWindowMs: ACTIVE_WINDOW_MS, pauseWindowMs: PAUSE_WINDOW_MS };
}

module.exports = { startOrResume, getStatus };
