const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';
const DIAG_STORAGE_KEY = 'backend_diag_logs_v1';
const DIAG_MAX_ENTRIES = 150;

function nowIso() {
  return new Date().toISOString();
}

function safeReadLogs() {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(DIAG_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function safeWriteLogs(entries) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(DIAG_STORAGE_KEY, JSON.stringify(entries.slice(0, DIAG_MAX_ENTRIES)));
  } catch {
    // Ignore storage failures in locked/private contexts.
  }
}

export function getBackendDiagnosticLogs() {
  return safeReadLogs();
}

export function clearBackendDiagnosticLogs() {
  safeWriteLogs([]);
}

export function appendBackendDiagnosticLog(entry) {
  const next = [{ timestamp: nowIso(), ...entry }, ...safeReadLogs()];
  safeWriteLogs(next);
}

export function getBackendDiagnosticPaths() {
  const envValue = import.meta.env.VITE_BACKEND_DIAGNOSTIC_PATHS;
  if (typeof envValue === 'string' && envValue.trim()) {
    return envValue
      .split(',')
      .map((part) => part.trim())
      .filter(Boolean);
  }
  return ['health'];
}

async function probePath(path) {
  const normalized = path.startsWith('/') ? path : `/${path}`;
  const url = `${API_BASE_URL}${normalized}`;
  const startedAt = Date.now();

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: { Accept: 'application/json' },
    });
    const durationMs = Date.now() - startedAt;

    const payload = {
      type: 'probe',
      url,
      ok: response.ok,
      status: response.status,
      durationMs,
    };
    appendBackendDiagnosticLog(payload);
    return payload;
  } catch (error) {
    const durationMs = Date.now() - startedAt;
    const payload = {
      type: 'probe',
      url,
      ok: false,
      status: 0,
      durationMs,
      error: error?.message || 'Network error',
    };
    appendBackendDiagnosticLog(payload);
    return payload;
  }
}

export async function runBackendDiagnostics(paths = getBackendDiagnosticPaths()) {
  const checks = await Promise.all((paths || []).map((path) => probePath(path)));
  const ok = checks.every((check) => check.ok);
  const summary = {
    ok,
    checks,
    checkedAt: nowIso(),
  };
  appendBackendDiagnosticLog({
    type: 'summary',
    ok: summary.ok,
    checkedAt: summary.checkedAt,
    failures: checks.filter((check) => !check.ok).map((check) => ({ url: check.url, status: check.status, error: check.error || '' })),
  });
  return summary;
}

export async function getBackendHealth() {
  try {
    const response = await fetch(`${API_BASE_URL}/health`, {
      headers: {
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Backend health check failed with status ${response.status}`);
    }

    return response.json();
  } catch (error) {
    console.error('Backend health check failed', error);
    throw error;
  }
}
