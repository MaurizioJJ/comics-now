import { state } from '../globals.js';
import { closeContextMenu } from './menu-builder.js';

async function runGeminiFix(payload) {
  const response = await fetch(`${state.API_BASE_URL || window.API_BASE_URL || ''}/api/v1/tag-comics-now/gemini-fix`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) window.alert(result.message || 'Could not start Gemini fix.');
  else window.alert(`Gemini fix started for ${result.count} comic(s).`);
}

function addGeminiSelectionItem(menu, comic) {
  const selected = state.geminiFixSelection || (state.geminiFixSelection = new Map());
  const add = document.createElement('div');
  add.className = 'comic-context-menu-item';
  add.textContent = selected.has(comic.id) ? 'Remove from Gemini fix selection' : 'Add to Gemini fix selection';
  add.addEventListener('click', event => {
    event.preventDefault(); event.stopPropagation(); closeContextMenu();
    if (selected.has(comic.id)) selected.delete(comic.id); else selected.set(comic.id, comic);
  });
  menu.appendChild(add);
  if (selected.size) {
    const run = document.createElement('div');
    run.className = 'comic-context-menu-item'; run.textContent = `Run Gemini fix on selected (${selected.size})`;
    run.addEventListener('click', async event => {
      event.preventDefault(); event.stopPropagation(); closeContextMenu();
      await runGeminiFix({ comicIds: [...selected.keys()] }); selected.clear();
    });
    menu.appendChild(run);
  }
}

function addGeminiFolderItem(menu, comics, label) {
  if (!comics.length) return;
  const item = document.createElement('div');
  item.className = 'comic-context-menu-item'; item.textContent = `Run Gemini fix on ${label}`;
  item.addEventListener('click', async event => {
    event.preventDefault(); event.stopPropagation(); closeContextMenu();
    await runGeminiFix({ comicIds: comics.map(comic => comic.id) });
  });
  menu.appendChild(item);
}

export { addGeminiSelectionItem, addGeminiFolderItem };
