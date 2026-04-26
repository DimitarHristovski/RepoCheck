# RepoCheck

Local-first **repository** static analysis with heuristics, risk scoring, optional LLM explanations, dashboard **Risk copilot**, and **zip / file attachments**. Built with **Next.js**, **LangGraph**, a **JSON file store**, and **Zod**. Folder inventory and “approved folders” flows have been removed in favor of repo URLs, local repo paths, and uploads.

## Defensive boundaries

- **No auto-execution** of install scripts, repo code, or shell from this tool.
- **No auto-delete**; proposed actions from legacy scans may still be approved/rejected in the UI without automatic file moves unless you wire execution.
- **Local repo scans** use an absolute path you provide; **GitHub repos** are fetched as ZIP archives (no git) under `REPOCHECK_ANALYSIS_ROOT` (default `.repocheck-analysis/`). Private repos require a GitHub token (set in Settings or `REPOCHECK_GITHUB_TOKEN`). Legacy env `FILESENTINEL_ANALYSIS_ROOT` is still read if set.
- **LLM calls** are off by default; when enabled, prompts use **redacted, structured findings** unless you change privacy settings.

## Quick start

```bash
cp .env.example .env
npm install
mkdir -p data
npm run dev
```

Persistence is written to `data/repocheck-store.json` by default (override with `REPOCHECK_STORE_PATH`).

Open [http://localhost:3000](http://localhost:3000).

## LangGraph workflow

- **State** (`src/lib/graph/state.ts`): repo scan findings, risk score, LLM narrative.
- **Graph** (`src/lib/graph/repoCheckGraph.ts`): `static_scan` → `score` → `llm` → `done`.

Invoke: `POST /api/graph/run` with `{ "requestType": "repo_scan", "repoLocalPath": "/path/to/repo", "privacyMetadataOnly": true }`.

## Main API routes

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/scan/repo` | Local path or github.com repo (ZIP; private supported with token) + static analysis + persist |
| POST | `/api/dashboard/chat` | Risk copilot (store findings + optional attachment context) |
| POST | `/api/dashboard/analyze-upload` | Zip / text files → heuristic summary for copilot |
| GET/PATCH | `/api/settings` | Settings in JSON store |
| POST | `/api/store/reset` | Clear scans or full store wipe |
| POST | `/api/graph/run` | LangGraph repo workflow |

## Tests

```bash
npm test
```

## License

Private / your policy.


## Always-on guardian mode

Run RepoCheck as a continuous monitor while the Next.js server is running:

- Polls configured GitHub repos at a fixed interval and scans each latest default branch ZIP (private supported with token).
- Watches configured local directories on your machine and re-scans on file changes.
- Emits alerts (console + audit log) when high/critical suspicious findings are detected.

Configure in `.env`:

```bash
REPOCHECK_GUARDIAN_ENABLED=true
REPOCHECK_GUARDIAN_GITHUB_REPOS=vercel/next.js,nodejs/node
REPOCHECK_GUARDIAN_LOCAL_WATCH_DIRS=/Users/you/Downloads,/Users/you/Desktop/Git-Projects
REPOCHECK_GUARDIAN_POLL_MS=300000
REPOCHECK_GUARDIAN_ALERT_MIN_SEVERITY=high
REPOCHECK_GITHUB_TOKEN=ghp_your_token_here
```

Check runtime status at `GET /api/guardian/status`.

