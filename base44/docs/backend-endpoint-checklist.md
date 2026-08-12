# Backend Endpoint Checklist

Use this checklist to confirm the backend is fully wired to the current frontend.

## Base URL

- Frontend calls use `VITE_API_BASE_URL` when set.
- Fallback is `/api`.

## Required Endpoints

### 1) Health probe

- Method: `GET`
- Path: `/api/health`
- Used by: diagnostics panel and backend health badge
- Expected status: `200`
- Expected JSON shape:

```json
{
  "ok": true,
  "service": "api",
  "time": "2026-08-12T00:00:00.000Z"
}
```

### 2) Agent payout data

- Method: `GET`
- Path: `/api/agents/:agentId/payout-data`
- Used by: `StoreWithdrawals`
- Expected status: `200`
- Expected JSON shape:

```json
{
  "orders": [],
  "withdrawals": []
}
```

### 3) Agent wallet history

- Method: `GET`
- Path: `/api/agents/:agentId/wallet-history`
- Used by: `StoreWithdrawals`, `AgentWalletHistory`
- Expected status: `200`
- Expected JSON shape:

```json
{
  "balance": 0,
  "transactions": [],
  "momo_transactions": []
}
```

### 4) Create withdrawal request

- Method: `POST`
- Path: `/api/agents/:agentId/withdrawals`
- Used by: `StoreWithdrawals`
- Expected request JSON:

```json
{
  "amount": 50,
  "method": "momo",
  "account_info": "0244..."
}
```

- Expected status: `200` or `201`
- Expected JSON shape:

```json
{
  "ok": true,
  "withdrawal": {
    "id": "wd-...",
    "status": "pending"
  }
}
```

### 5) Convert commission to wallet

- Method: `POST`
- Path: `/api/agents/:agentId/convert-commission`
- Used by: `StoreWithdrawals`
- Expected request JSON:

```json
{
  "amount": 25
}
```

- Expected status: `200`
- Expected JSON shape:

```json
{
  "ok": true,
  "transaction": {
    "id": "tx-..."
  }
}
```

### 6) MCP consent info (if using MCP OAuth flow)

- Method: `GET`
- Path: `/api/apps/:appId/mcp/consent-info?handle=:ctx`
- Used by: `OAuthConsent`
- Expected status: `200` for valid handle
- Expected JSON shape:

```json
{
  "authenticated": true,
  "app_name": "GrandCoders",
  "client_name": "AI Client",
  "tools": []
}
```

### 7) MCP authorize grant (if using MCP OAuth flow)

- Method: `POST`
- Path: `/api/apps/:appId/mcp/authorize-grant`
- Used by: `OAuthConsent`
- Expected request JSON:

```json
{
  "ctx": "opaque-handle",
  "action": "approve"
}
```

- Expected status: `200`
- Expected JSON shape:

```json
{
  "redirect_url": "cursor://..."
}
```

## Frontend Diagnostics Panel Alignment

The frontend diagnostics panel probes paths from:

- `VITE_BACKEND_DIAGNOSTIC_PATHS` (comma-separated), or
- default `health`

Recommended setting:

```bash
VITE_BACKEND_DIAGNOSTIC_PATHS=health
```

Optional expanded probes (enable only if endpoints exist):

```bash
VITE_BACKEND_DIAGNOSTIC_PATHS=health,ready,ping
```

## Quick Verification Commands (PowerShell)

```powershell
# Health
Invoke-RestMethod -Method GET -Uri "https://your-domain.com/api/health"

# Wallet history
Invoke-RestMethod -Method GET -Uri "https://your-domain.com/api/agents/agent-001/wallet-history"

# Payout data
Invoke-RestMethod -Method GET -Uri "https://your-domain.com/api/agents/agent-001/payout-data"
```

## Failure Logging Contract

When a request fails, backend should return:

```json
{
  "error": "Human-readable message",
  "code": "MACHINE_CODE"
}
```

This maps cleanly to frontend toast errors and diagnostics log entries.
