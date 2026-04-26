# Repository security agent — design & threat model

## 1. Rule engine design

The agent implements a **deterministic pipeline** (no code execution, no `npm install`, no project startup):

`signals → context (file trust) → score (base + combinations) → verdict (thresholds) → hard-rule caps`

| Stage | Role |
|--------|------|
| **Signals** | Regex / `package.json` script parsing → `SignalKind` + excerpt (auditable). |
| **Context** | `FileTrustLevel` down-weights generated bundles; bonuses for obfuscation in handwritten source; penalty if only allowlisted network targets. |
| **Score** | Sum of per-signal points (with trust deltas) + **one-time** combination bonuses. |
| **Verdict** | Map integer score to `CLEAN` … `CONFIRMED_MALICIOUS`. |
| **Hard rules** | Prevent fear-based outcomes (e.g. eval-only, env-only, generated-only repos). |

Configurable inputs: **`DEFAULT_SAFE_DOMAINS`**, **`DEFAULT_GENERATED_MARKERS`**, **`BASE_SIGNAL_POINTS`**, **`COMBINATION_POINTS`** (`src/lib/securityAgent/config.ts`). Pass overrides via `runSecurityAgent(files, { safeDomains, generatedPathMarkers })`.

---

## 2. What this code does **not** do (important)

- Does **not** run the repository, install dependencies, or execute install hooks.
- Does **not** prove runtime behavior; static analysis can miss packers, runtime-only payloads, or polyglot files.
- Does **not** replace malware sandboxes, EDR, or manual code review for high-stakes decisions.
- Does **not** guarantee absence of backdoors — it **prioritizes review** when evidence is ambiguous.

---

## 3. Attack surfaces & typical goals (“what it tries to steal / do”)

Malicious or abused repositories often target:

| Goal | Mechanism | Signals / combos used |
|------|-----------|------------------------|
| **Credential theft** | Read `process.env`, `.env`, key files → POST to attacker URL | `PROCESS_ENV`, `URL_UNKNOWN_DOMAIN`, `SECRET_EXFIL_UNKNOWN_DEST` |
| **Remote access / RAT** | Download second stage, persist via cron/LaunchAgent | `DOWNLOAD_EXECUTE`, `PERSISTENCE_PLUS_EXECUTION` |
| **Supply-chain** | `postinstall` runs `curl \| bash` or obfuscated JS | `INSTALL_*`, `INSTALL_HOOK_PLUS_EXECUTION`, `CURL_PIPE_BASH` |
| **Config abuse** | Extra IIFE after `module.exports` in `next.config.js` | `CONFIG_APPEND_EXECUTABLE`, `CONFIG_APPEND_EXEC` |
| **Mining** | Stratum / pool / xmrig / wallet + hash loops | `MINER_*` (only **strong** patterns are emitted) |
| **CI secret leak** | Workflows exfiltrating `GITHUB_TOKEN` / secrets | High-trust workflow paths + network/exfil patterns |

---

## 4. Verdict semantics (calibrated, not alarmist)

- **CLEAN** — Score 0–2 after rules; benign or negligible in this scan slice.
- **LOW_SUSPICIOUS** — 3–5; common patterns (e.g. env in a server app) without strong correlation.
- **NEEDS_REVIEW** — 6–8; multiple primitives or combos; **preferred** when unsure.
- **LIKELY_MALICIOUS** — 9–12; several corroborating high-risk correlations.
- **CONFIRMED_MALICIOUS** — 13+; reserved for **strong, multi-signal** cases (still not a legal “conviction”).

Hard caps downgrade verdicts when evidence is **single-factor** or **generated-only** (see `verdict.ts`).

## 4.1 Reviewer operating procedure (required)

The reviewer must operate in this order:

1. Inspect evidence.
2. Separate handwritten source from generated/build output.
3. Detect suspicious signals.
4. Check context (expected app behavior, known-safe destinations).
5. Correlate multiple signals (avoid single-signal conclusions).
6. Assign severity using score + combinations + adjustments.
7. Produce verdict using `CLEAN | LOW_SUSPICIOUS | NEEDS_REVIEW | LIKELY_MALICIOUS | CONFIRMED_MALICIOUS`.

Hard rule reinforcement:

- Never mark repo malicious from `.next`, `dist`, `build`, `vendor-chunks`, or minified files alone.
- Never classify as malicious solely because of `eval`, `process.env`, `fetch`, or `axios`.
- Prefer `NEEDS_REVIEW` over false accusation when evidence is ambiguous.

## 4.2 Response formatting rules (required)

Security reviewer answers should be:

- Bullet-point based and clearly sectioned.
- Explicit about project directories/file groups and trust level.
- Explicit about "harmful path" (how damage would happen if code executes).
- Explicit about intent assessment:
  - intentionally malicious,
  - suspicious but inconclusive,
  - likely legitimate behavior.

---

## 5. Example output shapes

See **`examples.ts`** for `exampleCleanReport` and `exampleNeedsReviewReport`. Full runtime output is `SecurityAgentReport` in **`types.ts`**.

---

## 6. Integration

```ts
import { runSecurityAgent } from "@/lib/securityAgent";

const report = runSecurityAgent(
  [{ path: "src/a.ts", content: "..." }],
  { safeDomains: ["api.mycompany.com"], debug: true }
);
```

Wire after file collection (e.g. repo scan) — pass **relative paths + UTF-8 text** for text-like files only.
