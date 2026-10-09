const CREDIT_FIELDS = [
  { role: 'Text author', keys: ['Writer', 'Authors', 'Author'], photoKeys: ['WriterImage', 'WriterPhoto', 'AuthorImage', 'AuthorPhoto'] },
  { role: 'Drawing artist', keys: ['Penciller', 'Pencil', 'Artist'], photoKeys: ['PencillerImage', 'PencillerPhoto', 'ArtistImage', 'ArtistPhoto'] },
  { role: 'Inker', keys: ['Inker'], photoKeys: ['InkerImage', 'InkerPhoto'] },
  { role: 'Colorist', keys: ['Colorist'], photoKeys: ['ColoristImage', 'ColoristPhoto'] },
  { role: 'Letterer', keys: ['Letterer'], photoKeys: ['LettererImage', 'LettererPhoto'] },
  { role: 'Cover artist', keys: ['CoverArtist'], photoKeys: ['CoverArtistImage', 'CoverArtistPhoto'] },
  { role: 'Editor', keys: ['Editor'], photoKeys: ['EditorImage', 'EditorPhoto'] }
];

const FACT_FIELDS = [
  { label: 'Issue', keys: ['Number'] },
  { label: 'Volume', keys: ['Volume'] },
  { label: 'Publication year', keys: ['Year', 'StartYear'] },
  { label: 'Month', keys: ['Month'] },
  { label: 'Day', keys: ['Day'] },
  { label: 'Pages', keys: ['PageCount'] },
  { label: 'Language', keys: ['LanguageISO', 'Language'] },
  { label: 'Format', keys: ['Format'] },
  { label: 'Age rating', keys: ['AgeRating'] }
];

const SECTION_FIELDS = [
  { label: 'Tags', keys: ['Tags'] },
  { label: 'Genre', keys: ['Genre'] },
  { label: 'Characters', keys: ['Characters'] },
  { label: 'Teams', keys: ['Teams'] },
  { label: 'Locations', keys: ['Locations'] },
  { label: 'Story arcs', keys: ['StoryArc'] },
  { label: 'Series group', keys: ['SeriesGroup'] }
];

function displayValue(value) {
  if (Array.isArray(value)) return value.map(displayValue).filter(Boolean).join(', ');
  if (value && typeof value === 'object') return Object.values(value).map(displayValue).filter(Boolean).join(', ');
  return value == null ? '' : String(value).trim();
}

function fullMetadataValue(value) {
  if (Array.isArray(value) && value.every(item => item == null || typeof item !== 'object')) return displayValue(value);
  if (value && typeof value === 'object') return JSON.stringify(value, null, 2);
  return displayValue(value);
}

function issueFromComicName(comic, metadata) {
  const candidates = [comic.name, metadata.Title, comic.title];
  for (const candidate of candidates) {
    if (typeof candidate !== 'string') continue;
    const match = candidate.match(/(?:^|[^a-z0-9])T0*(\d+)(?=$|[^a-z0-9])/i);
    if (match) return match[1];
  }
  return '';
}

function valueFor(metadata, keys) {
  const keySet = new Set(keys.map(key => key.toLocaleLowerCase()));
  const entry = Object.entries(metadata).find(([key, value]) => keySet.has(key.toLocaleLowerCase()) && displayValue(value));
  return entry ? { key: entry[0], raw: entry[1], value: displayValue(entry[1]) } : null;
}

function presentLanguage(value) {
  const normalized = value.toLocaleLowerCase();
  if (['fre', 'fra', 'fr'].includes(normalized)) return 'French';
  if (normalized === 'eng') return 'English';
  if (normalized === 'spa') return 'Spanish';
  if (normalized === 'ita') return 'Italian';
  if (normalized === 'deu' || normalized === 'ger') return 'German';
  return value;
}

export function createComicMetadataViewModel(comic = {}) {
  const metadata = comic.metadata && typeof comic.metadata === 'object' && !Array.isArray(comic.metadata)
    ? comic.metadata
    : {};
  const publisherKey = displayValue(metadata.Publisher) ? 'Publisher'
    : displayValue(metadata.publisher) ? 'publisher' : null;
  const publisherValue = [metadata.Publisher, metadata.publisher].find(value => displayValue(value));
  const credits = CREDIT_FIELDS.flatMap(field => {
    const credit = valueFor(metadata, field.keys);
    if (!credit) return [];
    const photo = valueFor(metadata, field.photoKeys);
    return [{ role: field.role, value: credit.value, photo: photo?.value || '', key: credit.key }];
  });
  const facts = FACT_FIELDS.flatMap(field => {
    const item = valueFor(metadata, field.keys);
    if (field.label === 'Issue') {
      const filenameIssue = issueFromComicName(comic, metadata);
      if (filenameIssue) return [{ label: 'Issue', value: filenameIssue, key: 'filename' }];
    }
    if (!item) return [];
    const value = field.label === 'Language' ? presentLanguage(item.value) : item.value;
    return [{ label: field.label, value, key: item.key }];
  });
  const sections = SECTION_FIELDS.flatMap(section => {
    const item = valueFor(metadata, section.keys);
    return item ? [{ label: section.label, values: item.value.split(', ').filter(Boolean), key: item.key }] : [];
  });
  const summary = valueFor(metadata, ['Summary', 'Description'])?.value || '';

  return {
    title: valueFor(metadata, ['Title'])?.value || comic.name || 'Untitled comic',
    series: valueFor(metadata, ['Series'])?.value || comic.series || '',
    publisher: displayValue(publisherValue) || comic.publisher || '',
    summary,
    credits,
    facts,
    sections,
    allMetadata: Object.entries(metadata)
      .filter(([key]) => key.toLocaleLowerCase() !== 'pages')
      .filter(([key]) => !/^xmlns(?::|$)/i.test(key))
      .filter(([key]) => key.toLocaleLowerCase() !== 'publisher' || key === publisherKey)
      .filter(([, value]) => displayValue(value))
      .map(([key, value]) => ({
        key: key.toLocaleLowerCase() === 'publisher' ? 'Publisher' : key,
        value: key.toLocaleLowerCase() === 'number' && issueFromComicName(comic, metadata)
          ? issueFromComicName(comic, metadata)
          : fullMetadataValue(value)
      }))
  };
}
