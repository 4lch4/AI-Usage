# Changelog

## [0.3.0](https://github.com/4lch4/AI-Usage/compare/v0.2.2...v0.3.0) (2026-10-17)


### Features

* **android:** 1x1 home-screen widget with OpenCode Go usage ([42aff86](https://github.com/4lch4/AI-Usage/commit/42aff86cfa3ecd7cbff2ae6285d2d0b155d11b5d))
* **android:** 1x1 home-screen widget with OpenCode Go usage ([b51a9cb](https://github.com/4lch4/AI-Usage/commit/b51a9cb487326b55715b4f64bc8336642116753c))
* **android:** Expo app with the OpenCode Go usage screen ([66e3156](https://github.com/4lch4/AI-Usage/commit/66e315675d2f714ff09c9089800c804ce81e7923))
* **android:** Expo app with the OpenCode Go usage screen ([89ff35f](https://github.com/4lch4/AI-Usage/commit/89ff35fb42db56c49619cc6968cb2989553d3434))


### Bug Fixes

* **android:** build a release APK in CI so the app bundles its JavaScript ([2b40196](https://github.com/4lch4/AI-Usage/commit/2b40196c3c28830a7514e3cebb8b3e086a8e8928))
* **android:** keep WorkManager's Room database through R8 ([8ab17ab](https://github.com/4lch4/AI-Usage/commit/8ab17ab9046c93bcf4b0c18299fb648fe0b6c914))

## [0.2.2](https://github.com/4lch4/AI-Usage/compare/v0.2.1...v0.2.2) (2026-10-15)


### Bug Fixes

* run reg.exe for autostart so Start with Windows actually saves ([76c4e4c](https://github.com/4lch4/AI-Usage/commit/76c4e4cba56998aee1b8f2ab3b2d83e27658de9b))
* run reg.exe for autostart so Start with Windows actually saves ([ce6e49b](https://github.com/4lch4/AI-Usage/commit/ce6e49bfa1abc578f12b4ac80532b009a17c82a8))

## [0.2.1](https://github.com/4lch4/AI-Usage/compare/v0.2.0...v0.2.1) (2026-10-15)


### Bug Fixes

* **release:** ship the installer payload with Setup so it can install ([3c3eeb7](https://github.com/4lch4/AI-Usage/commit/3c3eeb7a7d542c79c601ad7f6e38871a1684a01b))
* **release:** ship the installer payload with Setup so it can install ([2b50b52](https://github.com/4lch4/AI-Usage/commit/2b50b52fb8270f8c040116ab988bf821fb548b62))

## [0.2.0](https://github.com/4lch4/AI-Usage/compare/v0.1.0...v0.2.0) (2026-10-15)


### Features

* add autostart, offered only in a packaged build ([5e1ddbd](https://github.com/4lch4/AI-Usage/commit/5e1ddbd800cdefe8b8102c6b7fcd2bc53830f548))
* add Electrobun tray app for Claude and OpenCode Go usage ([1f41cbb](https://github.com/4lch4/AI-Usage/commit/1f41cbb959dec88ac81ff0912e38919ac405390e))
* add Electrobun tray app for Claude and OpenCode Go usage ([1860785](https://github.com/4lch4/AI-Usage/commit/186078560072ee170473b26283963e7f7cb28d81))
* add PowerShell usage probe for Claude and OpenCode Go/Zen ([f31f196](https://github.com/4lch4/AI-Usage/commit/f31f19616220c9ce8f14d3d3ed3fd24e01f665ea))
* add Settings and a near-limit Alert to the tray app ([3b5be10](https://github.com/4lch4/AI-Usage/commit/3b5be109e076d8135a831d2e3efbe1950f105547))
* add Settings and near-limit Alert logic to core ([90ac2eb](https://github.com/4lch4/AI-Usage/commit/90ac2eb06db188cb13028b0cb5ef4639245d5e43))


### Bug Fixes

* a hand-edited setting is added to its dropdown instead of showing the wrong value ([36a3987](https://github.com/4lch4/AI-Usage/commit/36a3987e39aee12c0077d7529e32ddc04bf24771))
* autostart the installed launcher, ship only the installer ([249056b](https://github.com/4lch4/AI-Usage/commit/249056b9c3985ccb15e227b1a4e50e6c17bc6ed0))
* changed identifier to `com.4lch4.ai-usage` ([2170e5e](https://github.com/4lch4/AI-Usage/commit/2170e5ec1b5539d2aacd0d2dd81a1906f8320294))
* keep the tray alive when a refresh throws, correct Windows tray docs ([bf47640](https://github.com/4lch4/AI-Usage/commit/bf476406ca76bbcee7c2fea9b4a12457977440f3))
* load settings before the tray exists, ignore Hutch artifacts ([f4d137a](https://github.com/4lch4/AI-Usage/commit/f4d137a4863143029d7637a724b582fea695fc8a))
* point OpenCode Go users to an API key instead of Console login ([d3c4d26](https://github.com/4lch4/AI-Usage/commit/d3c4d264678b1741003acaf1c35ba4b4703600cd))
* **release:** version the Windows build and publish releases as drafts ([41e2cb6](https://github.com/4lch4/AI-Usage/commit/41e2cb65738af2c57645584a70a03db9b8ebcab8))
* repair a stale autostart entry instead of keeping it, keep autostart out of Settings patches ([f1468cc](https://github.com/4lch4/AI-Usage/commit/f1468ccbfcbc4a934b4f2728613891b7c6cdbc83))
* repair a stale autostart entry, keep autostart out of Settings patches ([a6bc7cf](https://github.com/4lch4/AI-Usage/commit/a6bc7cfe10d0fc861a64c492fcb7eafd209a80f1))
* Settings changes reached the shell but were dropped, and the Panel clipped ([7de9312](https://github.com/4lch4/AI-Usage/commit/7de9312d1c9d56a4c06261a14b31ca9a70f340f2))
* write the tray icon as an ICO and anchor the panel to the work area ([fc3fba7](https://github.com/4lch4/AI-Usage/commit/fc3fba7370f5b7222123ccf8cc37c0ae710083ba))
