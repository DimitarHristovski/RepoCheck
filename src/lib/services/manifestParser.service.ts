import fs from "fs";
import type { HeuristicFinding } from "@/lib/types/findings";

const RISKY_NPM_SCRIPTS = new Set([
  "preinstall",
  "postinstall",
  "install",
  "prepare",
  "prepublish",
  "prepack",
]);

export function parsePackageJson(
  absPath: string,
  relPath: string
): HeuristicFinding[] {
  const out: HeuristicFinding[] = [];
  let raw: string;
  try {
    raw = fs.readFileSync(absPath, "utf8");
  } catch {
    return out;
  }
  let pkg: { scripts?: Record<string, string>; dependencies?: Record<string, string> };
  try {
    pkg = JSON.parse(raw) as typeof pkg;
  } catch {
    return out;
  }
  if (pkg.scripts) {
    for (const [name, cmd] of Object.entries(pkg.scripts)) {
      if (RISKY_NPM_SCRIPTS.has(name)) {
        out.push({
          severity: "high",
          category: "install_hooks",
          title: `npm script: ${name}`,
          description:
            `Lifecycle script "${name}" runs during install. Malicious packages abuse these to execute code on your machine.`,
          evidence: { script: name, commandPreview: cmd.slice(0, 200) },
          filePath: relPath,
        });
      }
      if (/\bcurl\b.*\|.*\bsh\b|\bwget\b.*\|.*\bsh\b/i.test(cmd)) {
        out.push({
          severity: "critical",
          category: "shell_execution",
          title: `Pipe-to-shell in script ${name}`,
          description: "Install or build script may download and execute remote shell code.",
          evidence: { script: name },
          filePath: relPath,
        });
      }
    }
  }
  if (pkg.dependencies) {
    for (const dep of Object.keys(pkg.dependencies)) {
      if (/^reactt$|^lodahs$|^expresss$/i.test(dep)) {
        out.push({
          severity: "low",
          category: "dependency_typosquat",
          title: `Suspicious dependency name: ${dep}`,
          description:
            "Name resembles a popular package with a typo; verify publisher and registry metadata.",
          evidence: { dep },
          filePath: relPath,
        });
      }
    }
  }
  return out;
}

export function parseRequirementsTxt(
  absPath: string,
  relPath: string
): HeuristicFinding[] {
  const out: HeuristicFinding[] = [];
  let raw: string;
  try {
    raw = fs.readFileSync(absPath, "utf8");
  } catch {
    return out;
  }
  if (/--index-url\s+http:\/\//i.test(raw)) {
    out.push({
      severity: "medium",
      category: "network_exfil",
      title: "requirements.txt uses non-HTTPS index",
      description: "Plain HTTP indexes are vulnerable to tampering; prefer HTTPS and pinned hashes.",
      evidence: {},
      filePath: relPath,
    });
  }
  return out;
}

export function parseDockerfile(
  absPath: string,
  relPath: string
): HeuristicFinding[] {
  const out: HeuristicFinding[] = [];
  let raw: string;
  try {
    raw = fs.readFileSync(absPath, "utf8");
  } catch {
    return out;
  }
  if (/\bADD\s+http/i.test(raw)) {
    out.push({
      severity: "medium",
      category: "network_exfil",
      title: "Dockerfile fetches remote URL via ADD",
      description: "Remote ADD can pull changing content; prefer pinned COPY from known context.",
      evidence: {},
      filePath: relPath,
    });
  }
  if (/\bcurl\b.*\|.*\bsh\b/i.test(raw)) {
    out.push({
      severity: "high",
      category: "shell_execution",
      title: "Dockerfile pipe-to-shell",
      description: "Images that pipe curl into shell are high risk during build.",
      evidence: {},
      filePath: relPath,
    });
  }
  return out;
}

export function parseMakefile(
  absPath: string,
  relPath: string
): HeuristicFinding[] {
  const out: HeuristicFinding[] = [];
  let raw: string;
  try {
    raw = fs.readFileSync(absPath, "utf8");
  } catch {
    return out;
  }
  if (/\brm\s+-rf\s+\//.test(raw)) {
    out.push({
      severity: "high",
      category: "shell_execution",
      title: "Makefile contains rm -rf on absolute path",
      description: "Destructive recursive delete patterns in Makefiles are dangerous.",
      evidence: {},
      filePath: relPath,
    });
  }
  return out;
}

// fix typo HeuristicFindingFinding