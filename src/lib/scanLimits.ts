import { getAppSettings } from "@/lib/settingsStore";

/** Max bytes for reading file contents during scans (from Settings → max file size MB). */
export function getScanMaxFileBytes(): number {
  const mb = getAppSettings().maxFileSizeMb;
  if (typeof mb === "number" && mb > 0) {
    const cap = 500 * 1024 * 1024;
    return Math.min(Math.floor(mb * 1024 * 1024), cap);
  }
  return 2 * 1024 * 1024;
}
