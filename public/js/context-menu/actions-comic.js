import { state, encodePath } from '../globals.js';
import { positionContextMenu, attachCloseHandler, closeContextMenu } from './menu-builder.js';
import { createComicMetadataViewModel } from './metadata-view-model.mjs';
import {
  createDownloadItem,
  createReadStatusItem,
  createMangaToggleItem,
  createContinuousToggleItem,
  createGuidedDetectionItem,
  createReadingListItem,
  createMenuItem
} from './actions-shared.js';

const METADATA_ICON = '<svg fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M4 5.5A2.5 2.5 0 016.5 3H20v16H6.5A2.5 2.5 0 014 16.5v-11zM4 16.5A2.5 2.5 0 016.5 14H20M8 7h8M8 10h6"/></svg>';

function metadataElement(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text) element.textContent = text;
  return element;
}

function localAssetUrl(path) {
  if (!path || typeof path !== 'string') return '';
  try {
    const base = state.API_BASE_URL || window.API_BASE_URL || '';
    const url = new URL(`${base}/${path.replace(/^\/+/, '')}`, window.location.origin);
    return url.origin === window.location.origin ? url.href : '';
  } catch { return ''; }
}

function publisherLogoUrl(publisher) {
  for (const library of Object.values(state.library || {})) {
    const logo = library?.publishers?.[publisher]?.logoUrl;
    if (logo) return localAssetUrl(logo);
  }
  return '';
}

function makePortrait(name, imagePath) {
  const portrait = metadataElement('div', 'metadata-portrait');
  const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]).join('').toLocaleUpperCase() || '•';
  portrait.appendChild(metadataElement('span', 'metadata-portrait-fallback', initials));
  const photoUrl = localAssetUrl(imagePath);
  if (photoUrl) {
    const photo = document.createElement('img');
    photo.src = photoUrl;
    photo.alt = `${name} portrait`;
    photo.loading = 'lazy';
    photo.addEventListener('error', () => photo.remove(), { once: true });
    portrait.appendChild(photo);
  }
  return portrait;
}

function addMetadataSection(parent, title, values) {
  if (!values.length) return;
  const section = metadataElement('section', 'comic-metadata-section');
  section.appendChild(metadataElement('h3', 'comic-metadata-section-title', title));
  const chips = metadataElement('div', 'comic-metadata-chips');
  for (const value of values) chips.appendChild(metadataElement('span', 'comic-metadata-chip', value));
  section.appendChild(chips);
  parent.appendChild(section);
}

async function openComicMetadata(comic) {
  let metadataLoadError = false;
  const isLocal = comic.handle || comic.file || (comic.id && String(comic.id).startsWith('device-'));
  if (!isLocal && comic.path) {
    try {
      const base = state.API_BASE_URL || window.API_BASE_URL || '';
      const response = await fetch(`${base}/api/v1/comics/info?path=${encodeURIComponent(encodePath(comic.path))}`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const metadata = await response.json();
      if (metadata && typeof metadata === 'object' && !Array.isArray(metadata)) comic = { ...comic, metadata };
      else throw new Error('Invalid metadata response');
    } catch (error) {
      metadataLoadError = true;
      console.warn('[comic-metadata] Could not load full ComicInfo metadata:', error);
    }
  }
  const viewModel = createComicMetadataViewModel(comic);
  const overlay = metadataElement('div', 'comic-metadata-overlay');
  const dialog = metadataElement('section', 'comic-metadata-dialog');
  dialog.setAttribute('role', 'dialog');
  dialog.setAttribute('aria-modal', 'true');
  dialog.setAttribute('aria-labelledby', 'comic-metadata-title');
  const close = metadataElement('button', 'comic-metadata-close', '×');
  close.type = 'button';
  close.setAttribute('aria-label', 'Close metadata');
  const closeDialog = () => { document.removeEventListener('keydown', keyHandler); overlay.remove(); };
  const keyHandler = event => { if (event.key === 'Escape') closeDialog(); };
  close.addEventListener('click', closeDialog);
  overlay.addEventListener('click', event => { if (event.target === overlay) closeDialog(); });
  dialog.addEventListener('click', event => event.stopPropagation());
  document.addEventListener('keydown', keyHandler);

  const header = metadataElement('header', 'comic-metadata-header');
  const cover = metadataElement('div', 'comic-metadata-cover');
  const coverFallback = metadataElement('span', 'comic-metadata-cover-fallback', 'COMIC');
  cover.appendChild(coverFallback);
  const coverUrl = localAssetUrl(comic.thumbnailPath ? `thumbnails/${comic.thumbnailPath}` : '');
  if (coverUrl) {
    const coverImage = document.createElement('img');
    coverImage.src = coverUrl;
    coverImage.alt = `${viewModel.title} cover`;
    coverImage.loading = 'lazy';
    coverImage.className = 'comic-metadata-cover-image';
    coverImage.addEventListener('load', () => coverFallback.remove(), { once: true });
    cover.appendChild(coverImage);
  }

  const heading = metadataElement('div', 'comic-metadata-heading');
  const publisherMark = metadataElement('div', 'comic-metadata-publisher');
  const logoUrl = publisherLogoUrl(viewModel.publisher);
  if (logoUrl) {
    const logo = document.createElement('img');
    logo.src = logoUrl;
    logo.alt = `${viewModel.publisher} logo`;
    logo.loading = 'lazy';
    logo.addEventListener('error', () => { logo.remove(); publisherMark.textContent = viewModel.publisher; }, { once: true });
    publisherMark.appendChild(logo);
  } else if (viewModel.publisher) publisherMark.textContent = viewModel.publisher;
  heading.append(publisherMark, metadataElement('p', 'comic-metadata-eyebrow', viewModel.series || 'COMIC FILE'), metadataElement('h2', 'comic-metadata-title', viewModel.title));
  const issueFacts = viewModel.facts.filter(item => ['Publication year', 'Volume', 'Issue'].includes(item.label));
  const deck = [viewModel.publisher, ...issueFacts.map(item => `${item.label}: ${item.value}`)].filter(Boolean).join(' · ');
  if (deck) heading.appendChild(metadataElement('p', 'comic-metadata-deck', deck));
  header.append(cover, heading, close);
  dialog.appendChild(header);

  const body = metadataElement('div', 'comic-metadata-body');
  if (viewModel.facts.length) {
    const facts = metadataElement('section', 'comic-metadata-facts');
    for (const fact of viewModel.facts) {
      const item = metadataElement('div', 'comic-metadata-fact');
      item.append(metadataElement('span', 'comic-metadata-fact-label', fact.label), metadataElement('strong', 'comic-metadata-fact-value', fact.value));
      facts.appendChild(item);
    }
    body.appendChild(facts);
  }
  if (viewModel.credits.length) {
    const credits = metadataElement('section', 'comic-metadata-section');
    credits.appendChild(metadataElement('h3', 'comic-metadata-section-title', 'The creators'));
    const grid = metadataElement('div', 'comic-metadata-credits');
    for (const credit of viewModel.credits) {
      const card = metadataElement('article', 'comic-metadata-credit');
      card.append(makePortrait(credit.value, credit.photo));
      const copy = metadataElement('div', 'comic-metadata-credit-copy');
      copy.append(metadataElement('span', 'comic-metadata-credit-role', credit.role), metadataElement('strong', 'comic-metadata-credit-name', credit.value));
      card.appendChild(copy);
      grid.appendChild(card);
    }
    credits.appendChild(grid);
    body.appendChild(credits);
  }
  if (viewModel.summary) {
    const summary = metadataElement('section', 'comic-metadata-summary');
    summary.append(metadataElement('h3', 'comic-metadata-section-title', 'About this comic'), metadataElement('p', 'comic-metadata-summary-text', viewModel.summary));
    body.appendChild(summary);
  }
  for (const section of viewModel.sections) addMetadataSection(body, section.label, section.values);
  if (viewModel.allMetadata.length) {
    const details = document.createElement('details');
    details.className = 'comic-metadata-all';
    details.open = true;
    details.appendChild(metadataElement('summary', '', 'Full ComicInfo metadata'));
    const list = metadataElement('dl', 'comic-metadata-list');
    for (const item of viewModel.allMetadata) list.append(metadataElement('dt', '', item.key), metadataElement('dd', '', item.value));
    details.appendChild(list);
    body.appendChild(details);
  }
  if (metadataLoadError) {
    body.appendChild(metadataElement('p', 'comic-metadata-load-error', 'Could not load full ComicInfo metadata from the library. Showing any details already available.'));
  }
  if (!metadataLoadError && !viewModel.facts.length && !viewModel.credits.length && !viewModel.summary && !viewModel.sections.length) {
    body.appendChild(metadataElement('p', 'comic-metadata-empty', 'No ComicInfo metadata has been recorded for this comic yet.'));
  }
  dialog.append(body, metadataElement('footer', 'comic-metadata-footer', comic.name || ''));
  overlay.appendChild(dialog);
  document.body.appendChild(overlay);
  close.focus();
}

function createShowMetadataItem(comic) {
  return createMenuItem(`${METADATA_ICON}<span>Show metadata</span>`, () => openComicMetadata(comic), { className: 'text-amber-100' });
}

/**
 * Create and show context menu for comic cards
 */
function showComicContextMenu(event, comic) {
  event.preventDefault();
  event.stopPropagation();
  closeContextMenu();

  const menu = document.createElement('div');
  menu.className = 'comic-context-menu';

  const isLocal = comic.handle || comic.file || (comic.id && String(comic.id).startsWith('device-'));

  menu.appendChild(createShowMetadataItem(comic));

  // 1. Download (mobile only)
  if (!isLocal) {
    const downloadItem = createDownloadItem(comic);
    if (downloadItem) menu.appendChild(downloadItem);
  }

  // 2. Read/Unread
  if (!isLocal) {
    menu.appendChild(createReadStatusItem(comic));
  }

  // 3. Manga Mode
  menu.appendChild(createMangaToggleItem(comic));

  // 4. Continuous Mode
  const continuousItem = createContinuousToggleItem(comic);
  if (continuousItem) menu.appendChild(continuousItem);

  // 5. Guided Detection
  const guidedItem = createGuidedDetectionItem('comic', comic.id, comic.name || 'this comic', comic);
  if (guidedItem) menu.appendChild(guidedItem);

  // 6. Reading List
  menu.appendChild(createReadingListItem(comic));

  positionContextMenu(menu, event);
  attachCloseHandler(menu);
}

// Expose function for cross-phase compatibility
export { showComicContextMenu };
export { openComicMetadata };
state.showComicContextMenu = showComicContextMenu;
if (typeof window !== 'undefined') {
  window.showComicContextMenu = showComicContextMenu;
}
