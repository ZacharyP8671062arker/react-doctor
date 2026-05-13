---
"react-doctor": minor
---

v2 rewrite: SDK-first surface (`react-doctor` exports the SDK; the legacy
`diagnose()` shape lives at `react-doctor/api`). Adds a new
`react-doctor/score` subpath. Drops the `react-doctor/browser-poc` export.
Drops the `eslint-plugin-react-hooks` /
`eslint-plugin-react-you-might-not-need-an-effect` peer dependencies
(`eslint-plugin-react-hooks` is now a regular dependency; the
"you-might-not-need-an-effect" rules are skipped unless the plugin is
installed in the consumer project). Other runtime deps trimmed: `knip`,
`bippy`, `ora`, `@oxc-parser/wasm` dropped; `oxc-parser`, `oxc-resolver`
added.
