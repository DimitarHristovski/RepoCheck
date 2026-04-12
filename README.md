# RepoCheck

Local-first **repository** static analysis with heuristics, risk scoring, optional LLM explanations, dashboard **Risk copilot**, and **zip / file attachments**. Built with **Next.js**, **LangGraph**, a **JSON file store**, and **Zod**. Folder inventory and “approved folders” flows have been removed in favor of repo URLs, local repo paths, and uploads.

## Defensive boundaries

- **No auto-execution** of install scripts, repo code, or shell from this tool.
- **No auto-delete**; proposed actions from legacy scans may still be approved/rejected in the UI without automatic file moves unless you wire execution.
- **Local repo scans** use an absolute path you provide; **remote clones** go only under `REPOCHECK_ANALYSIS_ROOT` (default `.repocheck-analysis/`). Legacy env `FILESENTINEL_ANALYSIS_ROOT` is still read if set.
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
| POST | `/api/scan/repo` | Local path or HTTPS clone + static analysis + persist |
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
