import React, { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, ClipboardCopy, RefreshCw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  clearBackendDiagnosticLogs,
  getBackendDiagnosticLogs,
  getBackendDiagnosticPaths,
  runBackendDiagnostics,
} from "@/lib/backend-api";

function shortTime(iso) {
  if (!iso) return "-";
  try {
    return new Date(iso).toLocaleTimeString();
  } catch {
    return String(iso);
  }
}

export default function BackendDiagnosticsPanel({ autoRun = true, intervalMs = 60000 }) {
  const [running, setRunning] = useState(false);
  const [summary, setSummary] = useState(null);
  const [logs, setLogs] = useState(() => getBackendDiagnosticLogs());

  const endpoints = useMemo(() => getBackendDiagnosticPaths(), []);

  const refreshLogs = () => {
    setLogs(getBackendDiagnosticLogs());
  };

  const run = async () => {
    setRunning(true);
    try {
      const result = await runBackendDiagnostics(endpoints);
      setSummary(result);
    } finally {
      setRunning(false);
      refreshLogs();
    }
  };

  useEffect(() => {
    if (!autoRun) return;
    run();
    const timer = setInterval(run, intervalMs);
    return () => clearInterval(timer);
  }, [autoRun, intervalMs]);

  const latestFailure = logs.find((entry) => entry.type === "probe" && !entry.ok);

  const copyLogs = async () => {
    const payload = {
      generatedAt: new Date().toISOString(),
      endpoints,
      summary,
      logs: getBackendDiagnosticLogs(),
    };
    const text = JSON.stringify(payload, null, 2);
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // Clipboard access can fail in some browsers or strict permissions.
    }
  };

  const clearLogs = () => {
    clearBackendDiagnosticLogs();
    refreshLogs();
  };

  return (
    <div className="rounded-2xl border border-border bg-card p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-foreground">Backend diagnostics</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Probes: {endpoints.map((p) => `/api/${p.replace(/^\//, "")}`).join(", ")}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={run} disabled={running}>
            <RefreshCw className={`w-4 h-4 mr-1.5 ${running ? "animate-spin" : ""}`} />
            {running ? "Checking" : "Run check"}
          </Button>
          <Button size="sm" variant="outline" onClick={copyLogs}>
            <ClipboardCopy className="w-4 h-4 mr-1.5" />
            Copy logs
          </Button>
          <Button size="sm" variant="ghost" onClick={clearLogs}>
            <Trash2 className="w-4 h-4 mr-1.5" />
            Clear
          </Button>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
        <span className={`inline-flex items-center rounded-full px-2.5 py-1 font-medium ${summary?.ok ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>
          {summary?.ok ? <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> : <AlertTriangle className="w-3.5 h-3.5 mr-1" />}
          {summary ? (summary.ok ? "All checks passed" : "Backend wiring issue detected") : "No checks yet"}
        </span>
        <span className="text-muted-foreground">Entries: {logs.length}</span>
        {summary?.checkedAt && <span className="text-muted-foreground">Last run: {shortTime(summary.checkedAt)}</span>}
      </div>

      {latestFailure && (
        <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          Last failure: {latestFailure.url} · status {latestFailure.status || 0}
          {latestFailure.error ? ` · ${latestFailure.error}` : ""}
        </div>
      )}
    </div>
  );
}
