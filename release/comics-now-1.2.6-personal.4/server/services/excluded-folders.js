const path = require('path');

function normalizeExcludedFolders(folders) {
  if (!Array.isArray(folders)) return [];
  const normalized = [];
  const seen = new Set();
  for (const folder of folders) {
    if (typeof folder !== 'string' || !folder.trim()) continue;
    const value = path.normalize(folder.trim());
    const root = path.parse(value).root;
    const clean = value === root ? root : value.replace(/[\\/]+$/, '');
    if (path.isAbsolute(clean) && !seen.has(clean)) {
      seen.add(clean);
      normalized.push(clean);
    }
  }
  return normalized;
}

function isPathExcluded(candidate, folders) {
  if (typeof candidate !== 'string' || !path.isAbsolute(candidate)) return false;
  const normalizedCandidate = path.resolve(candidate);
  const configMatcher = require('../config').isPathExcluded;
  if (typeof configMatcher === 'function' && configMatcher(normalizedCandidate)) return true;
  return normalizeExcludedFolders(folders).some(folder => {
    const relative = path.relative(folder, normalizedCandidate);
    return relative === '' || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative));
  });
}

module.exports = { normalizeExcludedFolders, isPathExcluded };
