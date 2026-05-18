# Changelog

## 1.6.5 - 2026-05-19

This release focuses on the public-facing VNFest experience, the Moe Contest workflow, and GitHub upload hygiene.

### Added

- Added a default login-first entry flow with a redesigned login page.
- Added forgot-password support to the local account flow.
- Added a shared wallpaper system for login and secondary pages, with local wallpapers discovered from `/image/background`.
- Added main-page wallpaper styling for both map mode and list mode.
- Added a public Moe Contest portal under `moe/`.
- Added a Moe Contest manager page for contest owners and administrators.
- Added Moe Contest APIs for contests, stages, candidates, matches, and votes.
- Added standard Moe Contest stages, including nomination, qualifier, bracket, and a separate final stage.
- Added 1v1 bracket advancement, final-stage advancement, stage settlement, and public bracket rendering.
- Added contest deletion support with dependent vote/stage/candidate cleanup.
- Added Bangumi subject and character proxy helpers for nomination workflows.
- Added contract tests for Moe Contest backend, manager UI, and public UI.

### Changed

- Main page now loads the map first, then applies wallpaper effects after the map has actually rendered.
- List mode now shares the same wallpaper and glass-panel visual language as map mode.
- Stage defaults are editable instead of being locked to fixed presets.
- Moe Contest schedule/result pages were redesigned around smaller adaptive modules and connected tournament structure.
- Login copy now uses “回到你的同好会。” and removes the coordinate-themed language.
- Local wallpaper fallback now uses the tracked site image asset, while `/image/background` stays available as a local drop folder.
- `.gitignore` was reorganized to exclude local config, runtime data, user uploads, cache, logs, build output, and private wallpaper files.
- Runtime JSON data such as events, publications, manuscripts, and registrations was removed from Git tracking while remaining on disk locally.

### Fixed

- Fixed wallpaper loading order regressions caused by treating an empty `#mapSvg` as a rendered map.
- Fixed main-page wallpaper script caching by adding explicit versioned script URLs.
- Fixed secondary/detail wallpaper changes that were no longer part of the desired scope by rolling them back.
- Improved privacy handling in auth-related flows and expanded backend privacy contract checks.

### Verification

- `npm run check`
- `node --check js/page-background.js`

## 1.6.4

Baseline release before the Moe Contest, login wallpaper, and upload-hygiene work. It included map/list navigation, club detail management, Wiki generation, activity/publication workflows, and backend privacy contract coverage.
