# Changelog

## 1.2.6-personal.15

- Add searchable multiselect dropdowns for per-field library search filters. Multiple values within a field use OR matching; separate fields use AND matching.

## 1.2.6-personal.14

- Display a single canonical `Publisher` field in the right-click ComicInfo details, preferring the capitalized key and capitalizing lowercase-only publisher values.

## 1.2.6-personal.13

- Recover specific publishers from embedded ComicInfo when Folder Mode stored the generic `comics` label, and queue existing placeholder records for resumable re-indexing.
- Hide the ComicInfo `Pages` detail list from the app metadata dialog.
- Update locked runtime dependencies to patched `proxy-addr` and `sharp` releases.
