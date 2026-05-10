// HACK: rules that fire on patterns tests legitimately need. Tests
// hardcode arrays (so `no-array-index-as-key` fires on every fixture
// row), build oversize fixture components (so `no-giant-component`
// fires), assert behavior with `forwardRef` / `defaultProps` /
// `flushSync` (so the deprecation + escape-hatch rules fire), and
// often skip best-practice idioms (no-barrel-import, no-moment,
// memo-related rules) because the test bundle isn't shipped.
//
// We auto-silence these in any file matched by `isTestFilePath`. Rules
// that catch correctness bugs (`rules-of-hooks`, `no-direct-state-mutation`,
// `effect-needs-cleanup`, the `react-hooks-js/*` compiler rules, …)
// are deliberately NOT in this set — a test that violates them is
// a buggy test, not an intentional fixture.
//
// User can opt out via `disableNoiseRulesInTestFiles: false` in
// `react-doctor.config.json`. User can also force a rule back on for
// a specific file via `ignore.overrides` (which runs after this
// filter) — but that's an inversion they have to ask for explicitly.
export const RULES_DISABLED_IN_TEST_FILES: ReadonlySet<string> = new Set([
  // Architecture — tests intentionally compose "anti-pattern" fixtures
  "react-doctor/no-giant-component",
  "react-doctor/no-render-in-render",
  "react-doctor/no-render-prop-children",
  "react-doctor/no-many-boolean-props",
  "react-doctor/no-nested-component-definition",
  "react-doctor/no-generic-handler-names",
  "react-doctor/no-polymorphic-children",
  // Deprecation warnings — tests assert on the deprecated APIs
  "react-doctor/no-react19-deprecated-apis",
  "react-doctor/no-default-props",
  "react-doctor/no-react-dom-deprecated-apis",
  "react-doctor/no-legacy-class-lifecycles",
  "react-doctor/no-legacy-context-api",
  // Concurrent-mode escape hatches — tests legitimately exercise these
  "react-doctor/no-flush-sync",
  "react-doctor/no-document-start-view-transition",
  // Correctness adjacent to fixtures — false-positive on test data
  "react-doctor/no-array-index-as-key",
  "react-doctor/no-uncontrolled-input",
  "react-doctor/no-prevent-default",
  // Bundle size — test bundles aren't shipped
  "react-doctor/no-barrel-import",
  "react-doctor/no-full-lodash-import",
  "react-doctor/no-moment",
  "react-doctor/prefer-dynamic-import",
  "react-doctor/no-dynamic-import-path",
  "react-doctor/use-lazy-motion",
  "react-doctor/no-undeferred-third-party",
  // Memoization perf — tests don't render at app frequency
  "react-doctor/no-usememo-simple-expression",
  "react-doctor/no-inline-prop-on-memo-component",
  "react-doctor/rerender-memo-with-default-value",
  "react-doctor/rerender-memo-before-early-return",
  "react-doctor/rerender-lazy-state-init",
  "react-doctor/rerender-functional-setstate",
  "react-doctor/rerender-state-only-in-handlers",
  "react-doctor/rerender-defer-reads-hook",
  "react-doctor/rerender-derived-state-from-hook",
  "react-doctor/rerender-transitions-scroll",
  "react-doctor/rendering-hoist-jsx",
  "react-doctor/rendering-usetransition-loading",
  // JS micro-perf — test code isn't on the hot path
  "react-doctor/js-flatmap-filter",
  "react-doctor/js-combine-iterations",
  "react-doctor/js-tosorted-immutable",
  "react-doctor/js-hoist-regexp",
  "react-doctor/js-hoist-intl",
  "react-doctor/js-cache-property-access",
  "react-doctor/js-length-check-first",
  "react-doctor/js-min-max-loop",
  "react-doctor/js-set-map-lookups",
  "react-doctor/js-batch-dom-css",
  "react-doctor/js-index-maps",
  "react-doctor/js-cache-storage",
  "react-doctor/js-early-exit",
  "react-doctor/async-defer-await",
  "react-doctor/async-await-in-loop",
  "react-doctor/async-parallel",
  // State/effect rules whose target patterns are common in tests
  "react-doctor/no-fetch-in-effect",
  "react-doctor/no-derived-state-effect",
  "react-doctor/no-derived-useState",
  "react-doctor/no-mirror-prop-effect",
  "react-doctor/prefer-useReducer",
  "react-doctor/prefer-use-sync-external-store",
  // Design rules — irrelevant for test fixtures
  "react-doctor/design-no-bold-heading",
  "react-doctor/design-no-redundant-padding-axes",
  "react-doctor/design-no-redundant-size-axes",
  "react-doctor/design-no-space-on-flex-children",
  "react-doctor/design-no-em-dash-in-jsx-text",
  "react-doctor/design-no-three-period-ellipsis",
  "react-doctor/design-no-default-tailwind-palette",
  "react-doctor/design-no-vague-button-label",
  "react-doctor/no-inline-bounce-easing",
  "react-doctor/no-z-index-9999",
  "react-doctor/no-inline-exhaustive-style",
  "react-doctor/no-side-tab-border",
  "react-doctor/no-pure-black-background",
  "react-doctor/no-gradient-text",
  "react-doctor/no-dark-mode-glow",
  "react-doctor/no-tiny-text",
  "react-doctor/no-wide-letter-spacing",
  "react-doctor/no-gray-on-colored-background",
  "react-doctor/no-justified-text",
  // Accessibility nits — the relevant ones are app-level concerns,
  // not test-fixture concerns. Real correctness a11y (`alt-text`,
  // `role-has-required-aria-props`) stays on.
  "jsx-a11y/click-events-have-key-events",
  "jsx-a11y/no-static-element-interactions",
  "jsx-a11y/no-autofocus",
  "jsx-a11y/tabindex-no-positive",
  "jsx-a11y/anchor-is-valid",
  "jsx-a11y/label-has-associated-control",
  // Dead code — tests intentionally export/import in unusual shapes
  "knip/files",
  "knip/exports",
  "knip/types",
  "knip/duplicates",
]);
