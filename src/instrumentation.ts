export async function register() {
  const isBuildPhase = process.env.NEXT_PHASE === "phase-production-build";
  if (process.env.NEXT_RUNTIME === "nodejs" && !isBuildPhase) {
    const { startGuardianService } = await import("@/lib/services/guardian.service");
    startGuardianService();
  }
}

