## [3.6.2](https://github.com/Aesthermortis/donghualife-seen-userscript/compare/v3.6.1...v3.6.2) (2025-09-27)

### Bug Fixes

- **content-decorator:** align computeId signature with its usage ([89e7882](https://github.com/Aesthermortis/donghualife-seen-userscript/commit/89e7882b91d779a615c88769c6443b1edde2e4f0))
- **core:** prevent losing episode refs on unmark ([6e73886](https://github.com/Aesthermortis/donghualife-seen-userscript/commit/6e73886cd736f40e551c9c2334b2fbe497e4be27))

## [3.6.1](https://github.com/Aesthermortis/donghualife-seen-userscript/compare/v3.6.0...v3.6.1) (2025-09-26)

### Bug Fixes

- **app-controller:** keep completed parents when tracking episodes ([d1760b2](https://github.com/Aesthermortis/donghualife-seen-userscript/commit/d1760b22bee74a42f163975522e89e7cdf0a395b))

## [3.6.0](https://github.com/Aesthermortis/donghualife-seen-userscript/compare/v3.5.0...v3.6.0) (2025-09-26)

### Features

- **bulk:** add parent-state updates for bulk actions ([182aebb](https://github.com/Aesthermortis/donghualife-seen-userscript/commit/182aebb84f6a8405fabd1d63c72f57f7709daefc))

## [3.5.0](https://github.com/Aesthermortis/donghualife-seen-userscript/compare/v3.4.1...v3.5.0) (2025-09-24)

### Features

- **dom-observer:** enhance DOM observation with node filtering and batching ([1c7b91a](https://github.com/Aesthermortis/donghualife-seen-userscript/commit/1c7b91aa78b108e611f99ed45b76a434bfe46c01))
- **store:** serialize cross-tab writes with Web Locks and commit ordering ([0bce2e3](https://github.com/Aesthermortis/donghualife-seen-userscript/commit/0bce2e3aee5d70199f26e25ed8bda48205c22763))
- **test:** migrate jest setup and test layout ([9ace678](https://github.com/Aesthermortis/donghualife-seen-userscript/commit/9ace678e8233fa6d68c4ee5a409187cd73e98095))
- **ui:** lock and restore body scroll when modal is open ([4b412ed](https://github.com/Aesthermortis/donghualife-seen-userscript/commit/4b412ed34ddd16ede823e285994412eecf3a91f3))

### Bug Fixes

- **ui:** restrict modal focus trap to tabbable elements ([a9bcc42](https://github.com/Aesthermortis/donghualife-seen-userscript/commit/a9bcc425d149ff128b9b5e1aedd8a8052341a280))

### Performance Improvements

- **core:** batch DOM decorations with single-pass idle scheduler ([e65000f](https://github.com/Aesthermortis/donghualife-seen-userscript/commit/e65000ff6d147860760407e2d5073e4721f3340d))

## [3.4.1](https://github.com/Aesthermortis/donghualife-seen-userscript/compare/v3.4.0...v3.4.1) (2025-09-22)

### Bug Fixes

- **build:** inject semantic-release version into Rollup to prevent 1.0.0 fallback ([de06204](https://github.com/Aesthermortis/donghualife-seen-userscript/commit/de06204d4152cc9945b7de4cc0418e5b40f77f21))

## [3.4.0](https://github.com/Aesthermortis/donghualife-seen-userscript/compare/v3.3.1...v3.4.0) (2025-09-22)

### Features

- **content-decorator:** implement bulk actions for visible episodes ([2684462](https://github.com/Aesthermortis/donghualife-seen-userscript/commit/2684462c4f68251b2c51780dc03d77f73d96246f))
- **database-manager:** add notifications for blocked DB and version changes ([bd504e2](https://github.com/Aesthermortis/donghualife-seen-userscript/commit/bd504e2303a79f80369937c0290f4a8e31ce636e))
- **guidelines:** add project development guidelines ([915d158](https://github.com/Aesthermortis/donghualife-seen-userscript/commit/915d158a42c25c4ffc6936f6d2b02ff60300c317))
- **observer:** add teardown and BFCache re-attach; scope applyAll to mutated subtrees ([64e61c7](https://github.com/Aesthermortis/donghualife-seen-userscript/commit/64e61c73d877759702a596d7ad9f44a2abf1bbe8))

### Bug Fixes

- **rollup.config.mjs:** ensure metadata banner uses resolved version ([5f89c20](https://github.com/Aesthermortis/donghualife-seen-userscript/commit/5f89c20e5402b5aca9fe97d4adb58cc97789f3b8))
