import { Suspense } from "react";

export default function ActionsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <Suspense fallback={<p className="text-sm text-zinc-500">Loading…</p>}>{children}</Suspense>;
}
