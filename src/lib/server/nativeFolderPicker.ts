import { execFileSync } from "child_process";
import os from "os";

/**
 * Opens an OS folder dialog (dev machine only). Returns absolute path or null if cancelled / unsupported.
 */
export function pickFolderNative(): { path: string | null; reason?: string } {
  const platform = os.platform();

  if (platform === "darwin") {
    try {
      const script =
        'POSIX path of (choose folder with prompt "RepoCheck — choose a folder to scan")';
      const out = execFileSync(
        "/usr/bin/osascript",
        ["-e", script],
        {
          encoding: "utf8",
          timeout: 120_000,
          windowsHide: true,
        }
      );
      const p = out.trim();
      return p ? { path: p } : { path: null, reason: "No folder selected" };
    } catch {
      return { path: null, reason: "Dialog cancelled or Accessibility permission needed for Terminal/Node" };
    }
  }

  if (platform === "win32") {
    try {
      const cmd = [
        "$shell = New-Object -ComObject Shell.Application",
        '$folder = $shell.BrowseForFolder(0, "RepoCheck — choose a folder", 0, "")',
        "if ($null -ne $folder) { $folder.Self.Path } else { \"\" }",
      ].join("; ");
      const out = execFileSync("powershell.exe", ["-NoProfile", "-Command", cmd], {
        encoding: "utf8",
        timeout: 120_000,
        windowsHide: true,
      });
      const p = out.trim().replace(/\r/g, "");
      return p ? { path: p } : { path: null, reason: "No folder selected" };
    } catch {
      return { path: null, reason: "Folder dialog failed (try typing the path instead)" };
    }
  }

  // Linux: zenity or kdialog
  if (platform === "linux") {
    for (const [bin, args] of [
      ["zenity", ["--file-selection", "--directory", "--title=RepoCheck — choose folder"]],
      [
        "kdialog",
        ["--getexistingdirectory", ".", "--title", "RepoCheck — choose folder"],
      ],
    ] as const) {
      try {
        const out = execFileSync(bin, [...args], {
          encoding: "utf8",
          timeout: 120_000,
        });
        const p = out.trim();
        if (p) return { path: p };
      } catch {
        /* try next */
      }
    }
    return {
      path: null,
      reason: "Install zenity or kdialog, or type the folder path manually",
    };
  }

  return { path: null, reason: "Native picker not available on this OS" };
}
