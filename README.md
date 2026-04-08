# RepoCheck

Local-first security assistant for **organizing approved folders** and **inspecting repositories** with static heuristics, transparent risk scoring, and optional LLM explanations (metadata-first by default). Built with **Next.js**, **LangGraph**, a **JSON file store**, and **Zod**.

## Defensive boundaries

- **No auto-execution** of install scripts, repo code, or shell from this tool.
- **No auto-delete**; organization moves require explicit approval workflows (v0.1 records approve/reject; wire moves when you are ready).
- **No scanning outside user-approved directories** for personal folders and local repo paths.
- **Remote clones** go only under `REPOCHECK_ANALYSIS_ROOT` (default `.repocheck-analysis/`), not your home directory. Legacy env `FILESENTINEL_ANALYSIS_ROOT` is still read if set.
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

## Folder structure (high level)

```
src/
  app/                 # App Router pages + API route handlers
  components/          # UI (shadcn-style primitives + layout)
  lib/
    store/             # JSON persistence + repository helpers
    graph/             # LangGraph workflow + LLM prompts
    llm/               # OpenAI / Ollama adapter
    services/          # Scanner, heuristics, scoring, redaction, audit, actions
    security/          # Path guard / approved roots
    validations/       # Zod API contracts
    mock/              # Sample findings for demos
fixtures/              # Harmless repo patterns for tests
```

## Data model

All entities live in one JSON document (`src/lib/store/types.ts`): approved folders, scan sessions, scanned items, repositories, findings, risk scores, proposed actions, audit logs, and app settings. There is **no SQL database**.

## LangGraph state & workflow

- **State** (`src/lib/graph/state.ts`): typed with Zod; carries request type, inventory, heuristic findings, risk score, optional LLM narrative, safety flags.
- **Graph** (`src/lib/graph/repoCheckGraph.ts`): linear pipeline — `intake` → `static_scan` (folder + repo heuristics) → `score` → `plan` → `llm` → `safety` → `report`.
- **Agents (mapped to nodes / services)**:
  - Intake + safety: path / approved-root checks.
  - File inventory: `fileScanner.service.ts`.
  - Threat heuristics: `heuristicsEngine.service.ts` + `manifestParser.service.ts`.
  - Repo: `repoScanner.service.ts`.
  - Risk: `riskScorer.service.ts` (weighted, explainable).
  - Organization proposals: `organizationPlanner.service.ts` (no direct I/O).
  - LLM reasoning: `prompts.ts` + `modelAdapter.ts`.
  - Report: combine persistence via API.

Invoke full graph: `POST /api/graph/run` with `{ "requestType": "mixed", "approvedFolderPath": "...", "repoLocalPath": "...", "privacyMetadataOnly": true }`.

## API route plan

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/health` | Liveness + store writable |
| GET/POST | `/api/folders` | List / add approved folders |
| DELETE | `/api/folders/[id]` | Remove approval |
| POST | `/api/scan/folder` | Inventory + heuristics + persist session |
| POST | `/api/scan/repo` | Clone or analyze local repo path + persist |
| GET | `/api/sessions` | Recent sessions |
| GET | `/api/sessions/[id]` | Session detail + items + findings + actions |
| GET | `/api/findings` | List findings (`sessionId`, `severity` query) |
| PATCH | `/api/findings/[id]` | Mark reviewed |
| POST | `/api/actions/[id]/approve` | Approve proposed action (record only in v0.1) |
| POST | `/api/actions/[id]/reject` | Reject proposed action |
| GET/PATCH | `/api/settings` | Settings in JSON store |
| GET | `/api/dashboard/summary` | JSON summary for dashboards |
| POST | `/api/graph/run` | Run LangGraph workflow |

## Risk scoring

Weights live in `riskScorer.service.ts` (e.g. install hooks, shell execution, persistence). Output: **0–100** score, **subscores**, **confidence**, and labels: `low_risk`, `suspicious`, `high_risk`, `strongly_unsafe`. Copy is cautious: static matches are **indicators**, not courtroom verdicts.

## LLM reasoning prompts

System prompt in `src/lib/graph/prompts.ts` enforces: evidence vs inference, plain-language impact, no “definite malware” without overwhelming proof, JSON-only response shape for parsing.

## Tests

```bash
npm test
```

Includes unit tests for scoring and heuristics plus a validation smoke test for folder scan input. Fixtures under `fixtures/suspicious-patterns/` are safe strings for pattern checks.

## Environment variables

Prefer `REPOCHECK_*` for model provider, LLM model id, analysis root, and optional `REPOCHECK_STORE_PATH`. The older `FILESENTINEL_*` names are still honored for provider / model / analysis root.

## Privacy model

- Default **provider `none`**: no outbound model calls.
- **Metadata-only mode** (default in settings): LLM sees structured finding summaries, not raw files.
- **Redaction** (`redaction.service.ts`) strips common secret patterns before any model call.
- **Local-first**: primary data stays in the JSON store on disk.

## Limitations (v0.1)

- No package vulnerability database integration yet.
- Proposed filesystem moves are persisted as plans; **execute-on-host** should be added with strict path checks and undo logs (`actionExecutor.service.ts` sketches safe moves).
- Large repos truncate walks at `maxRepoWalkFiles` (see `config.ts`).
- Git clone requires `git` on `PATH`.
- The JSON store is not ideal for huge datasets or high concurrency; SQLite or another DB can be reintroduced if you outgrow a single file.

## Security note on Next.js

This scaffold pins Next 15.5.x. If your audit flags a CVE for your exact version, upgrade to the **latest patched** release in the same major line and re-run `npm run build`.
