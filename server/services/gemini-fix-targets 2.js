const fs = require('fs');
const path = require('path');

const MAX_GEMINI_FIX_TARGETS = 500;

function isInside(root, target) {
  const relative = path.relative(root, target);
  return relative !== '' && relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative);
}

function resolveGeminiFixTargets({ comicIds, folderPath, rows, roots }) {
  const allowedRoots = (roots || []).filter(Boolean).map(root => fs.realpathSync(path.resolve(root)));
  if (!allowedRoots.length) throw new Error('No library roots are configured.');
  let selected;
  if (Array.isArray(comicIds)) {
    if (!comicIds.length) throw new Error('Select at least one comic.');
    if (comicIds.length > MAX_GEMINI_FIX_TARGETS) throw new Error(`A Gemini fix can include at most ${MAX_GEMINI_FIX_TARGETS} comics.`);
    if (comicIds.some(id => typeof id !== 'string' || !id.trim())) throw new Error('Comic IDs must be non-empty strings.');
    if (new Set(comicIds).size !== comicIds.length) throw new Error('Duplicate comic IDs are not allowed.');
    const byId = new Map((rows || []).map(row => [row.id, row]));
    selected = comicIds.map(id => {
      const row = byId.get(id);
      if (!row?.path) throw new Error(`Comic ${id} was not found.`);
      return row.path;
    });
  } else if (typeof folderPath === 'string' && folderPath.trim()) {
    const folder = fs.realpathSync(path.resolve(folderPath));
    if (!allowedRoots.some(root => folder === root || isInside(root, folder))) throw new Error('Folder is outside configured library roots.');
    if (!fs.existsSync(folder) || !fs.statSync(folder).isDirectory()) throw new Error('Folder does not exist.');
    selected = [];
    const visit = directory => {
      for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
        const target = path.join(directory, entry.name);
        if (entry.isDirectory()) visit(target);
        else if (entry.isFile() && ['.cbz', '.cbr'].includes(path.extname(entry.name).toLowerCase())) selected.push(target);
        if (selected.length > MAX_GEMINI_FIX_TARGETS) throw new Error(`A Gemini fix can include at most ${MAX_GEMINI_FIX_TARGETS} comics.`);
      }
    };
    visit(folder);
  } else {
    throw new Error('Provide comic IDs or a folder path.');
  }

  const targets = selected.map(value => fs.realpathSync(path.resolve(value)));
  for (const target of targets) {
    if (!allowedRoots.some(root => isInside(root, target))) throw new Error('A selected comic is outside configured library roots.');
    if (!['.cbz', '.cbr'].includes(path.extname(target).toLowerCase()) || !fs.existsSync(target) || !fs.statSync(target).isFile()) {
      throw new Error('A selected comic is missing or is not a supported comic file.');
    }
  }
  if (!targets.length) throw new Error('No supported comics were found in this folder.');
  if (new Set(targets).size !== targets.length) throw new Error('Duplicate comic files are not allowed.');
  return targets;
}

module.exports = { MAX_GEMINI_FIX_TARGETS, resolveGeminiFixTargets };
