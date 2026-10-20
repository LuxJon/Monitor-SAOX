# SAOX agent guide

This repository is a React + TypeScript + Vite theme for Monitor, not a Komari Vue app.

- Product: SAOX; install/config identity: saox; maintainer: LuxJon.
- Keep theme.json and package.json versions synchronized. Preserve upstream MIT attribution and public/licenses.
- Never read or write original SAO preferences/config endpoints; use saox browser keys and /api/themes/saox/config.
- Default desktop/mobile cards stay compact. Mobile does not support list mode.
- Backend theme.json declares primitive fields; frontend ThemeManage edits advanced structures. Keep schema/default parity tests passing.
- Preserve public routes, guest price/privacy controls and server-side authorization. Never fabricate probe values or node locations.
- Work from source; keep API transport, reactive hooks and UI responsibilities separate.
- Run npm run lint, npm run typecheck, npm test and npm run package before release.
- Packages must contain root theme.json, preview.png, LICENSE, THIRD_PARTY_NOTICES.md and dist/. The installation asset is theme.tar.gz, not the source ZIP.
- Do not commit node_modules, dist, .env files, archives, old references or personal account data.
- Verify GitHub Actions and downloadable Release assets after publishing.
- Personal-use distribution only: do not submit PRs to monitor-probe/themes, edit any public theme registry or request marketplace listing. Release only to LuxJon/Monitor-SAOX unless the owner explicitly changes this instruction.
