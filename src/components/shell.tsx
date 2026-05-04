import Link from "next/link";
import { Shield } from "lucide-react";
import { cn } from "@/lib/utils";
import { EntrySplash } from "@/components/entry-splash";
import { HeaderDataTools } from "@/components/header-data-tools";
import { HeaderGuardianAlerts } from "@/components/guardian-alert-popups";

const links = [
  { href: "/", label: "Dashboard" },
  { href: "/settings", label: "Settings" },
];

export function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <EntrySplash />
      <header className="sticky top-0 z-40 border-b border-zinc-800/80 bg-zinc-950/90 backdrop-blur-md">
        <div className="flex h-14 w-full items-center gap-6 px-4 sm:px-6">
          <Link href="/" className="flex items-center gap-2 font-semibold text-zinc-100">
            <Shield className="size-5 text-emerald-400" aria-hidden />
            RepoCheck
          </Link>
          <nav className="flex flex-1 flex-wrap items-center gap-1 text-sm">
            {links.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className={cn(
                  "rounded-md px-3 py-1.5 text-zinc-400 transition-colors hover:bg-zinc-800/80 hover:text-zinc-100"
                )}
              >
                {l.label}
              </Link>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-1 sm:gap-2">
            <HeaderGuardianAlerts />
            <HeaderDataTools />
          </div>
        </div>
      </header>
      <main className="w-full flex-1 px-4 py-8 sm:px-6">
        {children}
      </main>
      <footer className="border-t border-zinc-800/80 py-6 text-center text-xs text-zinc-500">
        Defensive tooling only — static repo and upload analysis, no auto-execution.
      </footer>
    </div>
  );
}
