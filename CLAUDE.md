# Unskippable VR

WebXR page for Meta Quest 3 (Vite, vanilla JS, three.js). Spec: GitHub issue #3.

- Testing facts (commands, what runs where): [docs/agents/testing.md](docs/agents/testing.md)
- The attention module (`src/attention/`) is pure and tested through
  `createAttention(lineup).update(signals)` only, with `test/helpers/frames.js`.
  One test file per rule (`test/rule-<name>.test.js`); register rules with one
  line in `src/attention/rules/index.js`.
- Don't run a dev server on port 5173: the live Cloudflare tunnel uses it.
