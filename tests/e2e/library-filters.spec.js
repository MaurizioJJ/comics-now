const { test, expect } = require('@playwright/test');

test('indexed language options, matching count, and reset work in the library', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('comicsNow.visibleSearchFields', JSON.stringify(['language', 'metadata:Locations']));
  });
  await page.route('**/api/v1/search/fields', route => route.fulfill({ json: [
    { value: 'all', label: 'All fields', options: [] },
    { value: 'language', label: 'Language', options: ['fr'] },
    { value: 'metadata:Locations', label: 'Locations', options: ['Paris'] }
  ] }));
  await page.route('**/api/v1/search?**', route => route.fulfill({ json: [
    { id: 'one', name: 'One', path: 'lib_0/Series/one.cbz' },
    { id: 'two', name: 'Two', path: 'lib_0/Series/two.cbz' }
  ] }));
  await page.goto('/');
  await expect(page.locator('#reset-library-filters')).toBeVisible();
  await page.locator('#search-per-field > summary').click();
  await page.locator('[data-search-field-control="language"] > summary').click();
  await page.locator('[data-search-field-value="language"][value="fr"]').check();
  await expect(page.locator('#search-results-count')).toHaveText('2 matching comics');
  await page.locator('#reset-library-filters').click();
  await expect(page.locator('#search-results-count')).toHaveText('');
  await expect(page.locator('#library-search-query')).toHaveValue('');
  await expect(page.locator('[data-search-field-control="language"] > summary')).toHaveText('Language');
  await expect(page.locator('#search-results-view')).toBeHidden();
  await expect(page.locator('.filter-btn[data-filter="all"]')).toHaveClass(/active/);
});
