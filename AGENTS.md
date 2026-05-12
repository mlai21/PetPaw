# AGENTS.md

## Cursor Cloud specific instructions

### Project overview

PetPaw is a monorepo with two services:

| Service | Path | Stack | Dev commands |
|---------|------|-------|-------------|
| **API** | `services/api` | Node.js 22, Express, TypeScript, pnpm 11 | See `README.md` |
| **Mobile** | `apps/mobile` | Flutter (Dart SDK ≥3.3.0) | See `README.md` |

### Environment prerequisites

- **Node.js 22** and **pnpm 11** (installed via `corepack enable && corepack prepare pnpm@11.0.8 --activate`).
- **Flutter SDK ≥3.3.0** at `/opt/flutter/bin` (added to `PATH` in `~/.bashrc`).

### Running the API server

`index.ts` exports the Express `app` but does not call `app.listen()`. To start the dev server:

```bash
cd services/api
npx --yes tsx -e "const {app} = require('./src/index'); app.listen(3000, () => console.log('listening on 3000'));"
```

Endpoints: `POST /advisor/chat`, `POST /review/monthly`, `POST /sync/push`.

No database or external services are needed — all repositories are in-memory stubs.

### Lint

- **Flutter**: `cd apps/mobile && flutter analyze` — zero issues expected.
- **API**: No ESLint is configured. `tsc --noEmit` fails due to missing `@types/node` (not in package.json) — this is a known pre-existing issue. Tests run fine via `ts-jest`.

### Tests

- **API**: `cd services/api && pnpm test` — 14 tests, all pass.
- **Mobile**: `cd apps/mobile && flutter test` — 34 pass, 1 pre-existing failure in `home_shell_navigation_test.dart` ("today completed CTA switches to advisor with context and can return to today" — looks for text "你可以这样开始：" which is not rendered).

### Optional: LLM API keys

To get real AI responses from `/advisor/chat`, copy `services/api/.env.example` to `services/api/.env` and set `DASHSCOPE_API_KEY` (Alibaba Cloud Bailian). Without it, the endpoint returns stub responses which is fine for development and testing.
