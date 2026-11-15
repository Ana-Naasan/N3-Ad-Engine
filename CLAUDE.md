# Unskippable VR

WebXR page for Meta Quest 3 (Vite, vanilla JS, three.js). Spec: GitHub issue #3.

- Testing facts (commands, what runs where): [docs/agents/testing.md](docs/agents/testing.md)
- The attention module (`src/attention/`) is pure and tested through
  `createAttention(lineup).update(signals)` only, with `test/helpers/frames.js`.
  Tests live in `test/<name>.test.js`. Each rule is a file in
  `src/attention/rules/` exporting `id` and `createRule()`; the list in
  `src/attention/rules/index.js` is already complete, so don't edit it.
- Don't run a dev server on port 5173: the live Cloudflare tunnel uses it.
