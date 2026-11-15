# Testing facts

Checked against the code on 2026-11-15.

## Kinds of test
| Kind | How to select it | Where it runs |
|---|---|---|
| Unit | `npm test` (all), `npx vitest run <file>` (one file) | Builder only (no CI) |

No browser, timing or heavy-rendering tests: time is injected into the attention module, and scene code is checked in the headset.

## Commands
- All unit tests: `npm test` (runs `vitest run`)
- One test file: `npx vitest run <file>`
- Production build check: `npm run build`
- Normal runs need no `heavy`: there are no timing or rendering tests.
- Deliberate break checks (change one constant, see a test fail, revert): one per constant, run as `heavy npx vitest run <file> --maxWorkers=1`.
- Note: Vitest loads `vite.config.js`, so its dev-server plugin setup runs and creates `logs/snaps`. That's harmless.

## What CI runs
No CI. Before merging, the builder runs `npm test` and `npm run build` and both must pass.
