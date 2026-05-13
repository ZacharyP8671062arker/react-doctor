# React Doctor v1↔v2 Parity Report

Generated: 2026-05-12T21:25:45.331Z. CLI flags: `--json --json-compact --no-dead-code --offline`.

v2 issues are filtered to v1's lint rule-ID surface (extracted from `packages/react-doctor/src/oxlint-config.ts`); knip dead-code rules are excluded on both sides.

| Fixture | v1 raw | v1 filt | v2 raw | v2 filt | Δ | v1 time | v2 time | Slowdown | Missing in v2 | Extra in v2 |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| RhysSullivan/executor | 76 | 66 | 26 | 66 | 0 | 4.4s | 2.8s | 0.62× | 2 | 0 |
| nodejs/nodejs.org | 80 | 74 | 45 | 74 | 0 | 6.5s | 5.9s | 0.92× | 6 | 5 |
| tldraw/tldraw | 67 | 34 | 0 | 34 | 0 | 23.0s | 4.8s | 0.21× | 21 | 1 |
| pingdotgg/t3code | 54 | 54 | 0 | 55 | +1 | 33.7s | 34.3s | 1.02× | 7 | 0 |
| better-auth/better-auth | 65 | 61 | 0 | 62 | +1 | 3.6s | 2.1s | 0.58× | 8 | 1 |
| excalidraw/excalidraw | 62 | 57 | 0 | 55 | -2 | 3.5s | 3.7s | 1.07× | 4 | 549 |
| mastra-ai/mastra | 52 | 41 | 0 | 39 | -2 | 6.7s | 19.6s | 2.92× | 64 | 5400 |
| payloadcms/payload | 31 | 15 | 0 | 16 | +1 | 65.4s | 28.9s | 0.44× | 64 | 20 |
| baptisteArno/typebot.io | 54 | 48 | 0 | 48 | 0 | 5.5s | 3.1s | 0.56× | 21 | 0 |
| makeplane/plane | 55 | 42 | 0 | 43 | +1 | 11.1s | 5.6s | 0.51× | 20 | 808 |
| medusajs/medusa | 50 | 43 | 0 | 44 | +1 | 12.3s | 9.9s | 0.81× | 34 | 29 |
| RocketChat/Rocket.Chat | 47 | 35 | 0 | 36 | +1 | 12.1s | 10.1s | 0.84× | 18 | 0 |
| twentyhq/twenty | 44 | 24 | 0 | 24 | 0 | 27.8s | 16.3s | 0.58× | 139 | 44 |
| unkeyed/unkey | 43 | 38 | 0 | 39 | +1 | 6.8s | 5.8s | 0.85× | 24 | 0 |
| shadcn-ui/ui | 44 | 45 | 0 | 45 | 0 | 9.2s | 10.9s | 1.19× | 148 | 1974 |
| triggerdotdev/trigger.dev | 42 | 30 | 0 | 30 | 0 | 6.2s | 5.0s | 0.80× | 25 | 9 |
| formbricks/formbricks | 38 | 35 | 0 | 35 | 0 | 8.3s | 7.1s | 0.85× | 12 | 639 |
| langfuse/langfuse | 34 | 32 | 0 | 33 | +1 | 5.8s | 7.9s | 1.36× | 75 | 2 |
| ToolJet/ToolJet | 28 | 30 | 0 | 30 | 0 | 24.4s | 19.5s | 0.80× | 27 | 0 |
| onlook-dev/onlook | 30 | 27 | 0 | 27 | 0 | 5.8s | 5.8s | 1.00× | 42 | 0 |
| calcom/cal.com | 27 | 18 | 0 | 18 | 0 | 16.8s | 8.0s | 0.48× | 50 | 153 |
| PostHog/posthog | 31 | 25 | 0 | 29 | +4 | 33.8s | 18.3s | 0.54× | 298 | 19 |
| appsmithorg/appsmith | 9 | 12 | 0 | 13 | +1 | 62.4s | 62.3s | 1.00× | 73 | 8 |
| getsentry/sentry | 24 | 24 | 0 | 25 | +1 | 12.7s | 17.1s | 1.34× | 89 | 0 |
| lobehub/lobe-chat | 25 | 27 | 0 | 27 | 0 | 30.6s | 17.2s | 0.56× | 79 | 5 |
| dubinc/dub | 23 | 24 | 0 | 24 | 0 | 9.7s | 9.7s | 0.99× | 27 | 0 |
| TanStack/query | 54 | 50 | 0 | 51 | +1 | 13.4s | 5.6s | 0.42× | 78 | 47 |
| pmndrs/react-three-fiber | 81 | 80 | 29 | 78 | -2 | 1.7s | 897ms | 0.53× | 0 | 8 |
| react-hook-form/react-hook-form | 75 | 75 | 4 | 76 | +1 | 1.5s | 1.4s | 0.90× | 2 | 0 |
| framer/motion | 50 | 49 | 0 | 49 | 0 | 29.9s | 23.5s | 0.79× | 0 | 2 |
| expo/expo | 55 | 14 | 0 | 15 | +1 | 34.2s | 47.9s | 1.40× | 29 | 486 |
| pierrecomputer/pierre/packages/trees | 78 | 78 | 21 | 78 | 0 | 7.4s | 6.0s | 0.81× | 0 | 0 |
| pierrecomputer/pierre/packages/diffs | 93 | 93 | 76 | 93 | 0 | 2.8s | 2.8s | 0.99× | 0 | 0 |
| frontend | 63 | 64 | 0 | 65 | +1 | 9.4s | 9.5s | 1.01× | 5 | 0 |
| cheffect | 92 | 92 | 70 | 93 | +1 | 623ms | 488ms | 0.78× | 2 | 0 |
| bunnings-lite | 85 | 87 | 60 | 87 | 0 | 575ms | 482ms | 0.84× | 0 | 0 |

**Score divergence from v1** (Δ = v2 filtered − v1 filtered, across 36 fixtures):

| Bucket | Count |
|---|---:|
| Δ = 0 (exact match) | 17 |
| \|Δ\| ≤ 1 | 32 |
| \|Δ\| ≤ 2 | 35 |
| \|Δ\| ≤ 5 | 36 |
| \|Δ\| > 5 | 0 |
| max \|Δ\| | 4 |
| mean \|Δ\| | 0.69 |

**Wall-clock slowdown** (v2 / v1, across 36 fixtures; both CLIs spawned in parallel so the ratio reflects relative cost under shared load, not absolute):

| Bucket | Count |
|---|---:|
| ≤ 1.0× (v2 ≤ v1) | 27 |
| ≤ 1.5× | 35 |
| ≤ 2.0× | 35 |
| ≤ 3.0× | 36 |
| > 3.0× | 0 |
| median | 0.84× |
| mean | 0.87× |
| max | 2.92× |

Top 5 slowest fixtures (by v2/v1 ratio):

- mastra-ai/mastra: 6.7s → 19.6s (2.92×)
- expo/expo: 34.2s → 47.9s (1.40×)
- langfuse/langfuse: 5.8s → 7.9s (1.36×)
- getsentry/sentry: 12.7s → 17.1s (1.34×)
- shadcn-ui/ui: 9.2s → 10.9s (1.19×)

## Per-fixture rule deltas

### RhysSullivan/executor

- v1 filtered score: **66** vs v2 filtered: **66**
- Unique rules in v1 only (drive v2's higher score):
  - `react-doctor/design-no-three-period-ellipsis`
- Missing in v2 by (file, line) tuple (sampled — same-rule-different-line entries here don't move the score):
  - `react-doctor/js-combine-iterations` × 1
  - `react-doctor/design-no-three-period-ellipsis` × 1

### nodejs/nodejs.org

- v1 filtered score: **74** vs v2 filtered: **74**
- Unique rules in v1 only (drive v2's higher score):
  - `react-doctor/nextjs-no-a-element`
- Unique rules in v2 only (drive v1's higher score):
  - `react-doctor/no-secrets-in-client-code`
- Missing in v2 by (file, line) tuple (sampled — same-rule-different-line entries here don't move the score):
  - `react-doctor/nextjs-no-a-element` × 3
  - `react-doctor/js-combine-iterations` × 3
- Extra in v2 by (file, line) tuple (sampled):
  - `react-doctor/async-await-in-loop` × 2
  - `react-doctor/no-secrets-in-client-code` × 1
  - `react-doctor/no-barrel-import` × 1
  - `react-doctor/js-combine-iterations` × 1

### tldraw/tldraw

- v1 filtered score: **34** vs v2 filtered: **34**
- Unique rules in v1 only (drive v2's higher score):
  - `react-doctor/design-no-three-period-ellipsis`
- Unique rules in v2 only (drive v1's higher score):
  - `react-doctor/no-secrets-in-client-code`
- Missing in v2 by (file, line) tuple (sampled — same-rule-different-line entries here don't move the score):
  - `react-doctor/js-combine-iterations` × 11
  - `react-doctor/design-no-three-period-ellipsis` × 6
  - `react-doctor/js-batch-dom-css` × 4
- Extra in v2 by (file, line) tuple (sampled):
  - `react-doctor/no-secrets-in-client-code` × 1

### pingdotgg/t3code

- v1 filtered score: **54** vs v2 filtered: **55**
- Unique rules in v1 only (drive v2's higher score):
  - `react-doctor/design-no-three-period-ellipsis`
- Missing in v2 by (file, line) tuple (sampled — same-rule-different-line entries here don't move the score):
  - `react-doctor/design-no-three-period-ellipsis` × 4
  - `react-doctor/js-combine-iterations` × 3

### better-auth/better-auth

- v1 filtered score: **61** vs v2 filtered: **62**
- Unique rules in v1 only (drive v2's higher score):
  - `react-doctor/design-no-three-period-ellipsis`
- Missing in v2 by (file, line) tuple (sampled — same-rule-different-line entries here don't move the score):
  - `react-doctor/design-no-three-period-ellipsis` × 5
  - `react-doctor/js-combine-iterations` × 3
- Extra in v2 by (file, line) tuple (sampled):
  - `react-doctor/js-combine-iterations` × 1

### excalidraw/excalidraw

- v1 filtered score: **57** vs v2 filtered: **55**
- Unique rules in v2 only (drive v1's higher score):
  - `react-doctor/js-min-max-loop`
  - `react-doctor/prefer-use-effect-event`
- Missing in v2 by (file, line) tuple (sampled — same-rule-different-line entries here don't move the score):
  - `react-doctor/js-combine-iterations` × 4
- Extra in v2 by (file, line) tuple (sampled):
  - `react-doctor/no-render-in-render` × 84
  - `effect/no-event-handler` × 77
  - `react-doctor/js-combine-iterations` × 63
  - `react-doctor/no-barrel-import` × 41
  - `react-doctor/js-batch-dom-css` × 23
  - `react-doctor/no-react19-deprecated-apis` × 18
  - `effect/no-derived-state` × 17
  - `react-doctor/js-set-map-lookups` × 17
  - `react-doctor/rendering-svg-precision` × 17
  - `jsx-a11y/no-static-element-interactions` × 15
  - `jsx-a11y/click-events-have-key-events` × 14
  - `react-doctor/no-array-index-as-key` × 14
  - `jsx-a11y/no-autofocus` × 11
  - `react-doctor/no-cascading-set-state` × 10
  - `react-doctor/no-giant-component` × 10
  - `effect/no-adjust-state-on-prop-change` × 7
  - `react-doctor/rerender-functional-setstate` × 7
  - `react-doctor/no-dynamic-import-path` × 6
  - `react-doctor/no-derived-useState` × 6
  - `react-doctor/async-await-in-loop` × 6

### mastra-ai/mastra

- v1 filtered score: **41** vs v2 filtered: **39**
- Unique rules in v1 only (drive v2's higher score):
  - `react-doctor/design-no-three-period-ellipsis`
- Unique rules in v2 only (drive v1's higher score):
  - `react-doctor/js-length-check-first`
  - `react-doctor/js-min-max-loop`
  - `react-doctor/no-secrets-in-client-code`
- Missing in v2 by (file, line) tuple (sampled — same-rule-different-line entries here don't move the score):
  - `react-doctor/design-no-three-period-ellipsis` × 57
  - `react-doctor/js-combine-iterations` × 7
- Extra in v2 by (file, line) tuple (sampled):
  - `react-doctor/async-await-in-loop` × 1036
  - `react-doctor/js-combine-iterations` × 503
  - `react-doctor/server-sequential-independent-await` × 488
  - `react-doctor/async-parallel` × 425
  - `react-doctor/design-no-redundant-size-axes` × 423
  - `react-doctor/no-barrel-import` × 412
  - `effect/no-event-handler` × 363
  - `react-doctor/js-set-map-lookups` × 223
  - `react-doctor/no-react19-deprecated-apis` × 148
  - `react-doctor/rendering-svg-precision` × 146
  - `react-doctor/js-flatmap-filter` × 99
  - `react-doctor/js-index-maps` × 95
  - `react-doctor/js-tosorted-immutable` × 82
  - `react-doctor/js-cache-property-access` × 79
  - `effect/no-derived-state` × 70
  - `react-doctor/rendering-hydration-mismatch-time` × 61
  - `react-doctor/no-array-index-as-key` × 58
  - `effect/no-adjust-state-on-prop-change` × 56
  - `react-doctor/no-effect-event-handler` × 43
  - `react-doctor/prefer-useReducer` × 33

### payloadcms/payload

- v1 filtered score: **15** vs v2 filtered: **16**
- Unique rules in v1 only (drive v2's higher score):
  - `react-doctor/design-no-three-period-ellipsis`
- Missing in v2 by (file, line) tuple (sampled — same-rule-different-line entries here don't move the score):
  - `react-doctor/no-tiny-text` × 31
  - `react-doctor/js-combine-iterations` × 14
  - `react-doctor/design-no-three-period-ellipsis` × 12
  - `react-doctor/nextjs-no-img-element` × 4
  - `react-doctor/no-outline-none` × 2
  - `react-doctor/nextjs-no-a-element` × 1
- Extra in v2 by (file, line) tuple (sampled):
  - `react-doctor/design-no-redundant-size-axes` × 17
  - `react-doctor/no-barrel-import` × 1
  - `react-doctor/js-set-map-lookups` × 1
  - `react-doctor/js-combine-iterations` × 1

### baptisteArno/typebot.io

- v1 filtered score: **48** vs v2 filtered: **48**
- Unique rules in v1 only (drive v2's higher score):
  - `react-doctor/design-no-three-period-ellipsis`
- Missing in v2 by (file, line) tuple (sampled — same-rule-different-line entries here don't move the score):
  - `react-doctor/design-no-three-period-ellipsis` × 17
  - `react-doctor/js-combine-iterations` × 4

### makeplane/plane

- v1 filtered score: **42** vs v2 filtered: **43**
- Unique rules in v1 only (drive v2's higher score):
  - `react-doctor/design-no-three-period-ellipsis`
- Missing in v2 by (file, line) tuple (sampled — same-rule-different-line entries here don't move the score):
  - `react-doctor/js-combine-iterations` × 12
  - `react-doctor/design-no-three-period-ellipsis` × 8
- Extra in v2 by (file, line) tuple (sampled):
  - `react-doctor/design-no-redundant-size-axes` × 808

### medusajs/medusa

- v1 filtered score: **43** vs v2 filtered: **44**
- Unique rules in v1 only (drive v2's higher score):
  - `react-doctor/design-no-three-period-ellipsis`
- Missing in v2 by (file, line) tuple (sampled — same-rule-different-line entries here don't move the score):
  - `react-doctor/js-combine-iterations` × 29
  - `react-doctor/design-no-three-period-ellipsis` × 5
- Extra in v2 by (file, line) tuple (sampled):
  - `react-doctor/js-combine-iterations` × 9
  - `react-doctor/server-sequential-independent-await` × 7
  - `react-doctor/js-flatmap-filter` × 5
  - `react-doctor/async-parallel` × 4
  - `react-doctor/async-await-in-loop` × 2
  - `react-doctor/no-barrel-import` × 2

### RocketChat/Rocket.Chat

- v1 filtered score: **35** vs v2 filtered: **36**
- Unique rules in v1 only (drive v2's higher score):
  - `react-doctor/design-no-three-period-ellipsis`
- Missing in v2 by (file, line) tuple (sampled — same-rule-different-line entries here don't move the score):
  - `react-doctor/js-combine-iterations` × 15
  - `react-doctor/design-no-three-period-ellipsis` × 3

### twentyhq/twenty

- v1 filtered score: **24** vs v2 filtered: **24**
- Unique rules in v1 only (drive v2's higher score):
  - `react-doctor/design-no-three-period-ellipsis`
- Missing in v2 by (file, line) tuple (sampled — same-rule-different-line entries here don't move the score):
  - `react-doctor/js-combine-iterations` × 130
  - `react-doctor/design-no-three-period-ellipsis` × 9
- Extra in v2 by (file, line) tuple (sampled):
  - `react-doctor/js-combine-iterations` × 16
  - `react-doctor/async-await-in-loop` × 8
  - `react-doctor/async-parallel` × 7
  - `react-doctor/server-sequential-independent-await` × 3
  - `react-doctor/no-dynamic-import-path` × 2
  - `react-doctor/js-tosorted-immutable` × 2
  - `react-doctor/no-full-lodash-import` × 1
  - `react-doctor/js-set-map-lookups` × 1
  - `react-doctor/async-defer-await` × 1
  - `react-doctor/js-index-maps` × 1
  - `react-doctor/js-cache-property-access` × 1
  - `react-doctor/no-secrets-in-client-code` × 1

### unkeyed/unkey

- v1 filtered score: **38** vs v2 filtered: **39**
- Unique rules in v1 only (drive v2's higher score):
  - `react-doctor/design-no-three-period-ellipsis`
- Missing in v2 by (file, line) tuple (sampled — same-rule-different-line entries here don't move the score):
  - `react-doctor/design-no-three-period-ellipsis` × 21
  - `react-doctor/js-combine-iterations` × 3

### shadcn-ui/ui

- v1 filtered score: **45** vs v2 filtered: **45**
- Unique rules in v1 only (drive v2's higher score):
  - `react-doctor/design-no-three-period-ellipsis`
- Unique rules in v2 only (drive v1's higher score):
  - `react-doctor/async-parallel`
  - `react-doctor/js-cache-property-access`
- Missing in v2 by (file, line) tuple (sampled — same-rule-different-line entries here don't move the score):
  - `react-doctor/design-no-three-period-ellipsis` × 146
  - `react-doctor/js-combine-iterations` × 2
- Extra in v2 by (file, line) tuple (sampled):
  - `jsx-a11y/anchor-is-valid` × 309
  - `react-doctor/design-no-redundant-size-axes` × 195
  - `react-doctor/prefer-dynamic-import` × 168
  - `react-doctor/no-array-index-as-key` × 123
  - `effect/no-event-handler` × 123
  - `react-doctor/no-react19-deprecated-apis` × 107
  - `react-doctor/js-combine-iterations` × 97
  - `react-doctor/rendering-hydration-mismatch-time` × 79
  - `react-doctor/design-no-vague-button-label` × 60
  - `react-doctor/async-await-in-loop` × 39
  - `react-doctor/rerender-memo-before-early-return` × 38
  - `react/no-danger` × 36
  - `react-doctor/js-set-map-lookups` × 35
  - `react-doctor/design-no-space-on-flex-children` × 35
  - `react-doctor/rerender-functional-setstate` × 34
  - `react-doctor/js-index-maps` × 32
  - `react-doctor/no-derived-useState` × 29
  - `react-doctor/design-no-bold-heading` × 26
  - `react-doctor/rendering-svg-precision` × 24
  - `effect/no-pass-data-to-parent` × 21

### triggerdotdev/trigger.dev

- v1 filtered score: **30** vs v2 filtered: **30**
- Unique rules in v1 only (drive v2's higher score):
  - `react-doctor/design-no-three-period-ellipsis`
- Missing in v2 by (file, line) tuple (sampled — same-rule-different-line entries here don't move the score):
  - `react-doctor/design-no-three-period-ellipsis` × 22
  - `react-doctor/js-combine-iterations` × 3
- Extra in v2 by (file, line) tuple (sampled):
  - `react-doctor/server-sequential-independent-await` × 6
  - `react-doctor/async-await-in-loop` × 1
  - `react-doctor/async-parallel` × 1
  - `react-doctor/js-combine-iterations` × 1

### formbricks/formbricks

- v1 filtered score: **35** vs v2 filtered: **35**
- Missing in v2 by (file, line) tuple (sampled — same-rule-different-line entries here don't move the score):
  - `react-doctor/js-combine-iterations` × 12
- Extra in v2 by (file, line) tuple (sampled):
  - `effect/no-event-handler` × 393
  - `react-doctor/async-await-in-loop` × 42
  - `effect/no-derived-state` × 18
  - `effect/no-pass-data-to-parent` × 18
  - `react-doctor/js-combine-iterations` × 16
  - `react-doctor/rerender-lazy-state-init` × 15
  - `react-doctor/no-generic-handler-names` × 13
  - `react-doctor/rendering-svg-precision` × 10
  - `react-doctor/no-effect-event-handler` × 7
  - `react-doctor/server-sequential-independent-await` × 6
  - `react-doctor/js-set-map-lookups` × 6
  - `react-doctor/design-no-space-on-flex-children` × 6
  - `react-doctor/design-no-redundant-size-axes` × 6
  - `react-doctor/rerender-state-only-in-handlers` × 6
  - `react-doctor/no-cascading-set-state` × 6
  - `react-doctor/design-no-default-tailwind-palette` × 5
  - `react-doctor/js-tosorted-immutable` × 4
  - `react-doctor/client-passive-event-listeners` × 4
  - `react-doctor/no-giant-component` × 4
  - `react-doctor/no-many-boolean-props` × 3

### langfuse/langfuse

- v1 filtered score: **32** vs v2 filtered: **33**
- Unique rules in v1 only (drive v2's higher score):
  - `react-doctor/design-no-three-period-ellipsis`
- Missing in v2 by (file, line) tuple (sampled — same-rule-different-line entries here don't move the score):
  - `react-doctor/design-no-three-period-ellipsis` × 64
  - `react-doctor/js-combine-iterations` × 11
- Extra in v2 by (file, line) tuple (sampled):
  - `react-doctor/js-flatmap-filter` × 2

### ToolJet/ToolJet

- v1 filtered score: **30** vs v2 filtered: **30**
- Unique rules in v1 only (drive v2's higher score):
  - `react-doctor/design-no-three-period-ellipsis`
- Missing in v2 by (file, line) tuple (sampled — same-rule-different-line entries here don't move the score):
  - `react-doctor/design-no-three-period-ellipsis` × 16
  - `react-doctor/js-combine-iterations` × 11

### onlook-dev/onlook

- v1 filtered score: **27** vs v2 filtered: **27**
- Unique rules in v1 only (drive v2's higher score):
  - `react-doctor/design-no-three-period-ellipsis`
- Missing in v2 by (file, line) tuple (sampled — same-rule-different-line entries here don't move the score):
  - `react-doctor/design-no-three-period-ellipsis` × 32
  - `react-doctor/js-combine-iterations` × 10

### calcom/cal.com

- v1 filtered score: **18** vs v2 filtered: **18**
- Unique rules in v1 only (drive v2's higher score):
  - `react-doctor/design-no-three-period-ellipsis`
- Missing in v2 by (file, line) tuple (sampled — same-rule-different-line entries here don't move the score):
  - `react-doctor/nextjs-no-img-element` × 28
  - `react-doctor/design-no-three-period-ellipsis` × 13
  - `react-doctor/nextjs-no-use-search-params-without-suspense` × 6
  - `react-doctor/js-combine-iterations` × 2
  - `react-doctor/nextjs-no-native-script` × 1
- Extra in v2 by (file, line) tuple (sampled):
  - `react-doctor/design-no-redundant-size-axes` × 94
  - `react-doctor/async-parallel` × 37
  - `react-doctor/js-batch-dom-css` × 11
  - `react-doctor/server-sequential-independent-await` × 4
  - `react-doctor/js-set-map-lookups` × 2
  - `effect/no-initialize-state` × 2
  - `effect/no-pass-data-to-parent` × 1
  - `effect/no-derived-state` × 1
  - `react-doctor/rendering-hydration-no-flicker` × 1

### PostHog/posthog

- v1 filtered score: **25** vs v2 filtered: **29**
- Unique rules in v1 only (drive v2's higher score):
  - `react-doctor/design-no-three-period-ellipsis`
  - `react-doctor/nextjs-missing-metadata`
  - `react-doctor/nextjs-no-client-side-redirect`
  - `react-doctor/nextjs-no-img-element`
  - `react-doctor/react-compiler-destructure-method`
- Missing in v2 by (file, line) tuple (sampled — same-rule-different-line entries here don't move the score):
  - `react-doctor/design-no-three-period-ellipsis` × 139
  - `react-doctor/js-combine-iterations` × 60
  - `react-doctor/design-no-bold-heading` × 26
  - `react-doctor/design-no-default-tailwind-palette` × 14
  - `react-doctor/design-no-space-on-flex-children` × 13
  - `jsx-a11y/label-has-associated-control` × 8
  - `react-doctor/rendering-hydration-mismatch-time` × 8
  - `react-doctor/nextjs-missing-metadata` × 7
  - `react-doctor/nextjs-no-client-side-redirect` × 3
  - `react-doctor/react-compiler-destructure-method` × 3
  - `react-doctor/nextjs-no-img-element` × 3
  - `effect/no-initialize-state` × 2
  - `react-doctor/client-localstorage-no-version` × 2
  - `react-doctor/no-giant-component` × 2
  - `jsx-a11y/click-events-have-key-events` × 2
  - `react-doctor/no-effect-event-handler` × 2
  - `react-doctor/rerender-state-only-in-handlers` × 1
  - `effect/no-derived-state` × 1
  - `effect/no-event-handler` × 1
  - `effect/no-adjust-state-on-prop-change` × 1
- Extra in v2 by (file, line) tuple (sampled):
  - `react-doctor/js-set-map-lookups` × 6
  - `react-doctor/js-tosorted-immutable` × 3
  - `react-doctor/async-await-in-loop` × 3
  - `react-doctor/js-combine-iterations` × 2
  - `react-doctor/js-flatmap-filter` × 1
  - `react-doctor/js-index-maps` × 1
  - `react-doctor/async-parallel` × 1
  - `react-doctor/async-defer-await` × 1
  - `react-doctor/design-no-redundant-size-axes` × 1

### appsmithorg/appsmith

- v1 filtered score: **12** vs v2 filtered: **13**
- Unique rules in v1 only (drive v2's higher score):
  - `react-doctor/design-no-three-period-ellipsis`
- Missing in v2 by (file, line) tuple (sampled — same-rule-different-line entries here don't move the score):
  - `react-doctor/js-combine-iterations` × 68
  - `react-doctor/design-no-three-period-ellipsis` × 5
- Extra in v2 by (file, line) tuple (sampled):
  - `react-hooks-js/refs` × 2
  - `react-doctor/js-index-maps` × 1
  - `react-doctor/advanced-event-handler-refs` × 1
  - `react-hooks-js/use-memo` × 1
  - `react-doctor/no-full-lodash-import` × 1
  - `react-doctor/no-mutable-in-deps` × 1
  - `effect/no-event-handler` × 1

### getsentry/sentry

- v1 filtered score: **24** vs v2 filtered: **25**
- Unique rules in v1 only (drive v2's higher score):
  - `react-doctor/design-no-three-period-ellipsis`
- Missing in v2 by (file, line) tuple (sampled — same-rule-different-line entries here don't move the score):
  - `react-doctor/js-combine-iterations` × 87
  - `react-doctor/design-no-three-period-ellipsis` × 2

### lobehub/lobe-chat

- v1 filtered score: **27** vs v2 filtered: **27**
- Unique rules in v1 only (drive v2's higher score):
  - `react-doctor/design-no-three-period-ellipsis`
- Missing in v2 by (file, line) tuple (sampled — same-rule-different-line entries here don't move the score):
  - `react-doctor/js-combine-iterations` × 73
  - `react-doctor/design-no-three-period-ellipsis` × 6
- Extra in v2 by (file, line) tuple (sampled):
  - `react-doctor/async-parallel` × 2
  - `react-doctor/js-flatmap-filter` × 1
  - `react-doctor/async-await-in-loop` × 1
  - `react-doctor/js-hoist-regexp` × 1

### dubinc/dub

- v1 filtered score: **24** vs v2 filtered: **24**
- Unique rules in v1 only (drive v2's higher score):
  - `react-doctor/design-no-three-period-ellipsis`
- Missing in v2 by (file, line) tuple (sampled — same-rule-different-line entries here don't move the score):
  - `react-doctor/js-combine-iterations` × 13
  - `react-doctor/design-no-three-period-ellipsis` × 13
  - `react-doctor/nextjs-no-img-element` × 1

### TanStack/query

- v1 filtered score: **50** vs v2 filtered: **51**
- Unique rules in v1 only (drive v2's higher score):
  - `react-doctor/design-no-three-period-ellipsis`
- Missing in v2 by (file, line) tuple (sampled — same-rule-different-line entries here don't move the score):
  - `react-doctor/design-no-three-period-ellipsis` × 78
- Extra in v2 by (file, line) tuple (sampled):
  - `react-doctor/no-barrel-import` × 19
  - `jsx-a11y/anchor-is-valid` × 8
  - `react-doctor/async-await-in-loop` × 6
  - `react-doctor/js-combine-iterations` × 3
  - `react-doctor/async-parallel` × 2
  - `react-doctor/no-prevent-default` × 2
  - `react-doctor/rendering-hydration-mismatch-time` × 2
  - `react-doctor/js-index-maps` × 1
  - `react-doctor/js-set-map-lookups` × 1
  - `react-doctor/no-uncontrolled-input` × 1
  - `react-doctor/design-no-vague-button-label` × 1
  - `react-doctor/async-defer-await` × 1

### pmndrs/react-three-fiber

- v1 filtered score: **80** vs v2 filtered: **78**
- Unique rules in v2 only (drive v1's higher score):
  - `react-doctor/rn-no-raw-text`
- Extra in v2 by (file, line) tuple (sampled):
  - `react-doctor/rn-no-raw-text` × 7
  - `react-doctor/rn-prefer-expo-image` × 1

### react-hook-form/react-hook-form

- v1 filtered score: **75** vs v2 filtered: **76**
- Unique rules in v1 only (drive v2's higher score):
  - `react-doctor/design-no-three-period-ellipsis`
- Missing in v2 by (file, line) tuple (sampled — same-rule-different-line entries here don't move the score):
  - `react-doctor/design-no-three-period-ellipsis` × 2

### framer/motion

- v1 filtered score: **49** vs v2 filtered: **49**
- Extra in v2 by (file, line) tuple (sampled):
  - `react-doctor/async-await-in-loop` × 2

### expo/expo

- v1 filtered score: **14** vs v2 filtered: **15**
- Unique rules in v1 only (drive v2's higher score):
  - `react-doctor/design-no-three-period-ellipsis`
- Missing in v2 by (file, line) tuple (sampled — same-rule-different-line entries here don't move the score):
  - `react-doctor/js-combine-iterations` × 15
  - `react-doctor/design-no-three-period-ellipsis` × 14
- Extra in v2 by (file, line) tuple (sampled):
  - `effect/no-event-handler` × 80
  - `react-doctor/js-combine-iterations` × 53
  - `react-doctor/no-dynamic-import-path` × 43
  - `react-doctor/async-parallel` × 37
  - `react-doctor/js-set-map-lookups` × 32
  - `react-doctor/server-sequential-independent-await` × 31
  - `react-doctor/async-await-in-loop` × 29
  - `react-doctor/rn-prefer-reanimated` × 20
  - `react-doctor/effect-needs-cleanup` × 18
  - `react-doctor/no-barrel-import` × 17
  - `react-doctor/js-flatmap-filter` × 13
  - `react-doctor/js-index-maps` × 11
  - `react-doctor/js-cache-property-access` × 8
  - `react-doctor/js-length-check-first` × 8
  - `effect/no-pass-data-to-parent` × 7
  - `react-doctor/rerender-state-only-in-handlers` × 7
  - `react-doctor/js-tosorted-immutable` × 6
  - `react-doctor/no-react19-deprecated-apis` × 6
  - `react-doctor/no-cascading-set-state` × 5
  - `react-doctor/no-effect-event-handler` × 5

### frontend

- v1 filtered score: **64** vs v2 filtered: **65**
- Unique rules in v1 only (drive v2's higher score):
  - `react-doctor/design-no-three-period-ellipsis`
- Missing in v2 by (file, line) tuple (sampled — same-rule-different-line entries here don't move the score):
  - `react-doctor/design-no-three-period-ellipsis` × 5

### cheffect

- v1 filtered score: **92** vs v2 filtered: **93**
- Unique rules in v1 only (drive v2's higher score):
  - `react-doctor/design-no-three-period-ellipsis`
- Missing in v2 by (file, line) tuple (sampled — same-rule-different-line entries here don't move the score):
  - `react-doctor/design-no-three-period-ellipsis` × 2

## Cross-fixture unique-rule rollup

Each rule below is one that fires on at least one fixture in one version but not the other. These are the rules whose alignment would close the score-parity gap.

### Rules firing in v1 but not v2 (sorted by fixture count)

| Rule | Fixtures | Where |
|---|---:|---|
| `react-doctor/design-no-three-period-ellipsis` | 28 | RhysSullivan/executor, tldraw/tldraw, pingdotgg/t3code, better-auth/better-auth, mastra-ai/mastra, payloadcms/payload, baptisteArno/typebot.io, makeplane/plane, medusajs/medusa, RocketChat/Rocket.Chat, twentyhq/twenty, unkeyed/unkey, shadcn-ui/ui, triggerdotdev/trigger.dev, langfuse/langfuse, ToolJet/ToolJet, onlook-dev/onlook, calcom/cal.com, PostHog/posthog, appsmithorg/appsmith, getsentry/sentry, lobehub/lobe-chat, dubinc/dub, TanStack/query, react-hook-form/react-hook-form, expo/expo, frontend, cheffect |
| `react-doctor/nextjs-no-a-element` | 1 | nodejs/nodejs.org |
| `react-doctor/nextjs-missing-metadata` | 1 | PostHog/posthog |
| `react-doctor/nextjs-no-client-side-redirect` | 1 | PostHog/posthog |
| `react-doctor/nextjs-no-img-element` | 1 | PostHog/posthog |
| `react-doctor/react-compiler-destructure-method` | 1 | PostHog/posthog |

### Rules firing in v2 but not v1 (sorted by fixture count)

| Rule | Fixtures | Where |
|---|---:|---|
| `react-doctor/no-secrets-in-client-code` | 3 | nodejs/nodejs.org, tldraw/tldraw, mastra-ai/mastra |
| `react-doctor/js-min-max-loop` | 2 | excalidraw/excalidraw, mastra-ai/mastra |
| `react-doctor/prefer-use-effect-event` | 1 | excalidraw/excalidraw |
| `react-doctor/js-length-check-first` | 1 | mastra-ai/mastra |
| `react-doctor/async-parallel` | 1 | shadcn-ui/ui |
| `react-doctor/js-cache-property-access` | 1 | shadcn-ui/ui |
| `react-doctor/rn-no-raw-text` | 1 | pmndrs/react-three-fiber |

