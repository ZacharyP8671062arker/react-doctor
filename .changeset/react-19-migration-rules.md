---
"react-doctor": minor
---

feat(react-doctor): add 4 new React 18→19 migration rules

Distilled from the awesome-copilot React 18/19 skill collection
(`react18-lifecycle-patterns`, `react18-legacy-context`,
`react19-source-patterns`, `react19-test-patterns`), these rules
catch the deprecated APIs that warn in React 18.3.1 and are
**REMOVED in React 19** — the largest remaining gap in the
react-doctor rule surface.

**4 new rules:**

- `react-doctor/no-legacy-class-lifecycles` (`error`) — flags
  `componentWillMount`, `componentWillReceiveProps`, and
  `componentWillUpdate` on class components, including the
  `UNSAFE_*` prefixed forms (which only silence the React 18
  warning and are still removed in 19). Walks the class body
  directly so non-class functions with the same names don't
  false-positive.
- `react-doctor/no-legacy-context-api` (`error`) — flags the
  legacy provider/consumer pair: `childContextTypes`,
  `getChildContext`, and `contextTypes`. Catches both the
  in-class `static contextTypes = {…}` form AND the out-of-class
  `Foo.childContextTypes = {…}` assignment, since both styles
  appear in the wild and missing one leaves the migration
  half-done.
- `react-doctor/no-default-props` (`warn`) —
  `Foo.defaultProps = {…}` on identifiers that look like
  components. Removed for function components in React 19 —
  guides users to ES6 default parameters in destructured props.
- `react-doctor/no-react-dom-deprecated-apis` (`warn`) —
  companion to `no-react19-deprecated-apis` for the react-dom
  side: legacy root API (`render` / `hydrate` /
  `unmountComponentAtNode`), `findDOMNode`, and the
  renamed-and-moved `useFormState` (now `useActionState` from
  `react`). The whole `react-dom/test-utils` entry point is gone
  in React 19, so any import from it (named, default, or
  namespace) is flagged with steering toward `act` from `react`
  and `fireEvent` / `render` from `@testing-library/react`.
  Tracks both the named-import and namespace-binding
  (`ReactDOM.render(…)`) styles.

Each rule ships with positive-trigger and modern-counterpart
regression tests in
`tests/regressions/react-19-migration-rules.test.ts` (15 cases
across the four rules).
