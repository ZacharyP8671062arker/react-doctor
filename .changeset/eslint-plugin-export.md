---
"react-doctor": minor
---

feat(react-doctor): ship rules as an ESLint plugin (`react-doctor/eslint-plugin`)

The same React Doctor rule set that powers the CLI scan and the
`react-doctor/oxlint-plugin` export is now available as a first-class
ESLint plugin. Drop it into your `eslint.config.js` flat config and
diagnostics surface inline through whichever IDE / agent / pre-commit
hook already speaks ESLint — no separate `react-doctor` invocation
needed.

```js
// eslint.config.js
import reactDoctor from "react-doctor/eslint-plugin";

export default [
  reactDoctor.configs.recommended,
  reactDoctor.configs.next, // composable framework presets
  reactDoctor.configs["react-native"],
  reactDoctor.configs["tanstack-start"],
  reactDoctor.configs["tanstack-query"],
  // reactDoctor.configs.all, // every rule at react-doctor's default severity
];
```

The exported `recommended`, `next`, `react-native`, `tanstack-start`,
`tanstack-query`, and `all` configs reuse the exact severity maps the
react-doctor CLI emits to oxlint, so behavior stays in lock-step
between engines. You can also cherry-pick individual rules under the
`react-doctor/*` namespace.

The visitor signatures inside each rule are already ESLint-compatible
(`create(context) => visitors`); the new export wraps each rule with
the ESLint-required `meta` (`type`, `docs.url`, `schema`) and exposes
the plugin shape ESLint v9 flat configs expect. Closes
[#143](https://github.com/millionco/react-doctor/issues/143).
