"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Shield } from "lucide-react";

const SPLASH_KEY = "repocheck-entry-splash-seen";

export function EntrySplash() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const alreadySeen = sessionStorage.getItem(SPLASH_KEY) === "1";
    if (alreadySeen) return;

    setVisible(true);
    sessionStorage.setItem(SPLASH_KEY, "1");

    const timer = window.setTimeout(() => setVisible(false), 2300);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <AnimatePresence>
      {visible ? (
        <motion.div
          key="entry-splash-backdrop"
          className="fixed inset-0 z-[120] flex items-center justify-center bg-zinc-950/85 p-4 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3, ease: "easeOut" }}
        >
          <motion.div
            className="flex w-full max-w-md flex-col items-center rounded-3xl border border-emerald-500/25 bg-zinc-900/90 px-8 py-10 text-center shadow-2xl shadow-emerald-900/20"
            initial={{ y: 22, opacity: 0, scale: 0.96 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: -8, opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
          >
            <motion.div
              className="mb-5 rounded-2xl border border-emerald-400/30 bg-emerald-500/10 p-4"
              initial={{ rotate: -10, scale: 0.85, opacity: 0 }}
              animate={{ rotate: 0, scale: 1, opacity: 1 }}
              transition={{ delay: 0.08, duration: 0.45, ease: "easeOut" }}
            >
              <Shield className="size-10 text-emerald-400" aria-hidden />
            </motion.div>

            <motion.p
              className="text-xs uppercase tracking-[0.28em] text-zinc-400"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15, duration: 0.35 }}
            >
              Initializing Security Workspace
            </motion.p>

            <motion.h1
              className="mt-2 text-4xl font-semibold text-zinc-100"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.22, duration: 0.4, ease: "easeOut" }}
            >
              RepoCheck
            </motion.h1>

            <motion.div
              className="mt-5 h-1.5 w-full overflow-hidden rounded-full bg-zinc-800"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.22, duration: 0.3 }}
            >
              <motion.div
                className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-cyan-400"
                initial={{ width: "0%" }}
                animate={{ width: "100%" }}
                transition={{ delay: 0.3, duration: 1.6, ease: "easeInOut" }}
              />
            </motion.div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
