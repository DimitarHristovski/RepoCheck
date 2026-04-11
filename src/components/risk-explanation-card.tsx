import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export type LlmRiskExplanationView = {
  executiveSummary: string;
  hotspots: {
    filePath: string | null;
    severity: string;
    whatWeDetected: string;
    whyRisky: string;
    potentialHarm: string;
    whatToVerify: string;
  }[];
  overallAssessment: string;
};

export function RiskExplanationCard(props: {
  explanation?: LlmRiskExplanationView | null;
  error?: { reason: string; message: string } | null;
}) {
  const { explanation, error } = props;

  if (error?.reason === "no_model") {
    return (
      <Card className="border-zinc-700">
        <CardHeader>
          <CardTitle className="text-base">AI risk map</CardTitle>
          <CardDescription>
            Optional: configure OPENAI_API_KEY or Ollama in Settings to get a plain-language map of where
            signals cluster and why they matter.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="border-amber-900/50">
        <CardHeader>
          <CardTitle className="text-base">AI risk map</CardTitle>
          <CardDescription className="text-amber-200/80">
            Could not generate explanation ({error.reason}): {error.message}
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (!explanation) return null;

  return (
    <Card className="border-emerald-900/40">
      <CardHeader>
        <CardTitle className="text-base">AI risk map</CardTitle>
        <CardDescription>
          Plain-language read of static signals only — not a malware verdict. Paths come from the scanner.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm leading-relaxed text-zinc-200">{explanation.executiveSummary}</p>
        <div className="space-y-3">
          {explanation.hotspots.map((h, i) => (
            <div
              key={i}
              className="rounded-lg border border-zinc-800 bg-zinc-950/80 p-3 text-sm"
            >
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <Badge variant="outline">{h.severity}</Badge>
                {h.filePath ? (
                  <code className="break-all text-xs text-emerald-300/90">{h.filePath}</code>
                ) : (
                  <span className="text-xs text-zinc-500">(scan-wide signal)</span>
                )}
              </div>
              <dl className="space-y-1.5 text-zinc-300">
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wide text-zinc-500">Detected</dt>
                  <dd>{h.whatWeDetected}</dd>
                </div>
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wide text-zinc-500">Why risky</dt>
                  <dd>{h.whyRisky}</dd>
                </div>
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wide text-zinc-500">If harmful</dt>
                  <dd>{h.potentialHarm}</dd>
                </div>
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wide text-zinc-500">Verify</dt>
                  <dd>{h.whatToVerify}</dd>
                </div>
              </dl>
            </div>
          ))}
        </div>
        <p className="border-t border-zinc-800 pt-3 text-sm text-zinc-400">{explanation.overallAssessment}</p>
      </CardContent>
    </Card>
  );
}
