describe('comic metadata presentation model', () => {
  let createComicMetadataViewModel;

  beforeAll(async () => {
    ({ createComicMetadataViewModel } = await import('../public/js/context-menu/metadata-view-model.mjs'));
  });

  test('organizes identity, credits, publication facts and full metadata', () => {
    const model = createComicMetadataViewModel({
      name: 'Example 01.cbz', series: 'Example Series', publisher: 'Example Press',
      metadata: {
        Title: 'The First Story', Writer: 'Ada Writer', Penciller: 'Rae Artist',
        WriterImage: '/authors/ada.jpg', Year: '2024', Volume: '2', Number: '1',
        LanguageISO: 'fre', Summary: 'A story worth reading.', Characters: ['Mina', 'Sol'],
        CustomCredit: 'Guest editor'
      }
    });

    expect(model).toMatchObject({ title: 'The First Story', series: 'Example Series', publisher: 'Example Press', summary: 'A story worth reading.' });
    expect(model.credits).toEqual(expect.arrayContaining([
      expect.objectContaining({ role: 'Text author', value: 'Ada Writer', photo: '/authors/ada.jpg' }),
      expect.objectContaining({ role: 'Drawing artist', value: 'Rae Artist' })
    ]));
    expect(model.facts).toEqual(expect.arrayContaining([
      expect.objectContaining({ label: 'Publication year', value: '2024' }),
      expect.objectContaining({ label: 'Language', value: 'French' })
    ]));
    expect(model.sections.find(section => section.label === 'Characters').values).toEqual(['Mina', 'Sol']);
    expect(model.allMetadata).toEqual(expect.arrayContaining([expect.objectContaining({ key: 'CustomCredit', value: 'Guest editor' })]));
  });

  test('falls back to the comic filename and handles missing metadata', () => {
    expect(createComicMetadataViewModel({ name: 'Untitled.cbz', metadata: null })).toMatchObject({
      title: 'Untitled.cbz', credits: [], facts: [], sections: [], allMetadata: []
    });
  });

  test('uses the T-number in the filename as the issue when ComicInfo Number is wrong', () => {
    const model = createComicMetadataViewModel({
      name: '1940 - Et Si La France Avait Continué La Guerre - T01 - Le Grand Déménagement.cbz',
      metadata: {
        Title: '1940 - Et Si La France Avait Continué La Guerre - T01 - Le Grand Déménagement',
        Number: '1940',
        Genre: 'Alternate history',
        Pages: { Page: [{ Image: '0001.jpg', Type: 'FrontCover' }] },
        'xmlns:xsi': 'http://www.w3.org/2001/XMLSchema-instance'
      }
    });

    expect(model.facts.find(fact => fact.label === 'Issue').value).toBe('1');
    expect(model.allMetadata.find(item => item.key === 'Number').value).toBe('1');
    expect(model.allMetadata.find(item => item.key === 'Pages').value).toContain('FrontCover');
    expect(model.allMetadata.some(item => item.key.startsWith('xmlns'))).toBe(false);
  });
});
