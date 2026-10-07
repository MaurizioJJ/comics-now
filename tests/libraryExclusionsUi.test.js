/** @jest-environment jsdom */
const fs = require('fs');
const vm = require('vm');

test('settings render safe exclusion inputs and save relative paths', async () => {
  document.body.innerHTML = '<div id="library-folders-list"></div>';
  const state = { API_BASE_URL: '', fetchLibraryFromServer: jest.fn() };
  const fetch = jest.fn()
    .mockResolvedValueOnce({ ok: true, json: async () => ({ libraries: [{ path: '/comics/<script>', excludedFolders: ['Hidden'], excludedFolderNameContains: ['Old'] }] }) })
    .mockResolvedValueOnce({ ok: true, json: async () => ({ excludedFolders: ['Archive', 'Hidden'], excludedFolderNameContains: ['Old', 'Private'] }) });
  const sandbox = { state, window, document, fetch, console, escapeHtml: value => String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;') };
  const source = fs.readFileSync(require.resolve('../public/js/settings.js'), 'utf8')
    .replace(/import\s+[\s\S]*?from\s+['"][^'"]+['"];?/g, '')
    .replace(/export\s*\{[\s\S]*?\};?/g, '');
  Object.assign(sandbox, { settingsForm: null, scanButton: null, fullScanButton: null });
  vm.runInNewContext(source, sandbox);
  await state.refreshLibraryFolders();
  expect(document.querySelector('script')).toBeNull();
  const input = document.querySelector('.excluded-folders-input');
  expect(input).not.toBeNull();
  expect(input.value).toBe('Hidden');
  input.value = 'Archive\n Hidden\n';
  const nameContainsInput = document.querySelector('.excluded-folder-name-contains-input');
  expect(nameContainsInput.value).toBe('Old');
  nameContainsInput.value = 'Old\nPrivate\n';
  document.querySelector('.save-exclusions-btn').click();
  await new Promise(resolve => setTimeout(resolve, 0));
  expect(JSON.parse(fetch.mock.calls[1][1].body)).toEqual({ path: '/comics/<script>', excludedFolders: ['Archive', 'Hidden'], excludedFolderNameContains: ['Old', 'Private'] });
  expect(state.fetchLibraryFromServer).toHaveBeenCalled();
  expect(document.querySelector('.exclusions-status').textContent).toContain('Saved');
  fetch.mockResolvedValueOnce({ ok: false, json: async () => ({ message: 'Cannot exclude the library root' }) });
  input.value = '.';
  document.querySelector('.save-exclusions-btn').click();
  await new Promise(resolve => setTimeout(resolve, 0));
  expect(document.querySelector('.exclusions-status').textContent).toBe('Cannot exclude the library root');
  expect(document.querySelector('.save-exclusions-btn').disabled).toBe(false);
  expect(input.value).toBe('.');
  expect(state.fetchLibraryFromServer).toHaveBeenCalledTimes(1);
});
