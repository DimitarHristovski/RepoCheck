import Link from "next/link";
import { listScanSessions } from "@/lib/store/repository";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const dynamic = "force-dynamic";

export default function SessionsListPage() {
  const sessions = listScanSessions(80).filter(
    (s) => s.type === "repo" || s.type === "upload"
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-50">Sessions</h1>
        <p className="mt-1 text-sm text-zinc-400">
          GitHub ZIP scans, local paths, and dashboard uploads. Open a session for export, deterministic verdict, and
          links to findings.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base text-zinc-100">Recent scans</CardTitle>
          <CardDescription>Newest first (local JSON store)</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {sessions.length === 0 ? (
            <p className="text-sm text-zinc-500">No sessions yet. Run a scan from the dashboard.</p>
          ) : (
            <ul className="space-y-2">
              {sessions.map((s) => (
                <li
                  key={s.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-zinc-800 bg-zinc-900/40 px-3 py-2"
                >
                  <div>
                    <p className="text-sm capitalize text-zinc-200">
                      {s.type} · {s.status}
                    </p>
                    <p className="font-mono text-xs text-zinc-500">{s.id}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="secondary" asChild>
                      <Link href={`/sessions/${s.id}`}>Open</Link>
                    </Button>
                    <Button size="sm" variant="outline" asChild>
                      <Link href={`/findings?session=${s.id}`}>Findings</Link>
                    </Button>
                    <Button size="sm" variant="outline" asChild>
                      <Link href={`/actions?session=${s.id}`}>Actions</Link>
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
