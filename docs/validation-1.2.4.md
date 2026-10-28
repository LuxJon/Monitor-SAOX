# SAOX 1.2.4 validation

- Scope: monthly CNY billing cost, backend-configured expiry filtering, transparent glass surfaces.
- Local checks: ESLint (0 errors/warnings), TypeScript build, 47 test files / 407 tests, production build and package all passed.
- Browser checks: 31 scenarios passed using simulated Monitor API responses in Chromium. Widths: 320, 390, 430, 768, 1024, 1440, 1920. Covered dark/light, region/group reset, threshold 0/7/30, today/expired/hidden nodes, denied/failed settings and retry, guest permissions, WebSocket renewal, all card modes, map touch/keyboard, rotation, reduced motion, assets currency conversion and mobile layout.
- Calculation examples: CNY 428.91 / 36 = 11.91 per month; CNY 233.32 / 12 = 19.44 per month; USD/CAD cross-rates checked before monthly division.
- Backend contract: Monitor notify_expiry (0..365), authenticated GET /api/settings. Dates use expires_in from the backend; expiry_digest includes days 0..=notify_expiry. Source inspected at monitor-probe/monitor commit d2ef0ef5ef86bab06223bdf7d336a35d840e05ee.
- The theme does not make admin settings public. Visitors see a login prompt; failures do not silently fall back to seven days. Only the normalized reminder number enters query state, no full settings payload is retained.
- Browser previews use fixtures, not the user's real server data. No installation was performed against the live monitoring site.
- The final GitHub tag workflow validates locked dependencies and publishes theme.tar.gz, source ZIP and SHA256SUMS.
