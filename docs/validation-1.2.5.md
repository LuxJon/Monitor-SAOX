# SAOX 1.2.5 validation

- Scope: mobile region/expiry text tabs, asset text sorting, homepage order reuse and two-row asset cards.
- Local checks: ESLint (0 errors/warnings), TypeScript build, 47 test files / 407 tests and production packaging passed.
- Browser checks: 44 scenarios passed in Chromium using simulated Monitor API responses (29 feature checks and 15 existing regression checks).
- Viewports: 320, 360, 390, 430, 600, 720, 721, 768, 1024, 1440 and 1920 px; dark and light appearances.
- Home: region mode is initially active; small plain text tabs sit below monitoring cards and align left. Expiry mode hides region/group chips, uses the backend threshold, and switches back through the region tab. Desktop keeps the existing expiry button.
- Assets: default order matches home for default, ascending/descending name and price, traffic and speed settings, including offline and excluded-cost nodes. Mobile has exactly three text sorting options; repeated clicks reverse direction. There is no weight button or separate arrow control.
- Card geometry: price is left, monthly cost centered, expiry right under remaining value. No text overlap or horizontal overflow at supported widths, including long names and large amounts. All displayed monthly labels use 月成本.
- Retained coverage: CNY/USD/CAD cost conversion, exact billing months, threshold 0/7/30, today/expired/hidden nodes, guest privacy, 403/500 retry, WebSocket renewal, card modes, map touch/keyboard and reduced motion.
- Previews are fixture data, not actual user server records. No installation was made on the live monitoring site.
- GitHub main/tag workflows validate locked dependencies and publish theme.tar.gz, the source ZIP and SHA256SUMS; the published package is downloaded and verified before handoff.
