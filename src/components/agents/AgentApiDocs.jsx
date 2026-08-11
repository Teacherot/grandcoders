import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Copy, Check } from "lucide-react";

// Full reference for the agent-facing API. Rendered on the Agent API page so
// agents integrating their own systems have every action, parameter, response
// shape, and error code documented in one place.

const ACTIONS = [
  { key: "placeOrder", label: "Make Orders", method: "POST", desc: "Create an order and send it to the supplier" },
  { key: "listOrders", label: "Get Orders", method: "POST", desc: "Fetch your recent orders" },
  { key: "getPackages", label: "Get Packages", method: "POST", desc: "List active bundles and your sell prices" },
  { key: "getBalance", label: "Check Balance", method: "POST", desc: "Check your wallet balance" },
  { key: "getOrderStatus", label: "Get Order Status", method: "POST", desc: "Fetch a single order by id or code" },
];

function CodeBlock({ code, onCopy, copied }) {
  return (
    <div className="relative">
      <pre className="text-xs bg-neutral-900 text-neutral-100 rounded-xl p-4 pr-12 overflow-x-auto whitespace-pre-wrap">{code}</pre>
      <Button
        size="icon"
        variant="outline"
        onClick={onCopy}
        className="absolute top-3 right-3 h-7 w-7 bg-neutral-800 border-neutral-700 text-neutral-200 hover:bg-neutral-700"
        title="Copy"
      >
        {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
      </Button>
    </div>
  );
}

function Row({ name, type, required, note }) {
  return (
    <tr className="border-t border-border">
      <td className="py-2.5 pr-4 align-top">
        <code className="text-xs font-medium text-foreground">{name}</code>
        {required && <span className="ml-1.5 text-[10px] font-semibold text-rose-500 uppercase">req</span>}
      </td>
      <td className="py-2.5 pr-4 align-top text-xs text-muted-foreground">{type}</td>
      <td className="py-2.5 align-top text-xs text-muted-foreground">{note}</td>
    </tr>
  );
}

function ParamTable({ rows }) {
  return (
    <div className="mt-4 overflow-x-auto">
      <table className="w-full text-left">
        <thead className="text-[11px] uppercase tracking-wider text-muted-foreground">
          <tr>
            <th className="py-2 pr-4 font-normal">Field</th>
            <th className="py-2 pr-4 font-normal">Type</th>
            <th className="py-2 font-normal">Description</th>
          </tr>
        </thead>
        <tbody>{rows.map((r, i) => <Row key={i} {...r} />)}</tbody>
      </table>
    </div>
  );
}

function MethodBadge({ method }) {
  const isPost = method === "POST";
  return (
    <span className={`text-[10px] font-semibold uppercase tracking-wide rounded px-1.5 py-0.5 ${isPost ? "bg-emerald-900/60 text-emerald-300" : "bg-blue-900/60 text-blue-300"}`}>
      {method}
    </span>
  );
}

export default function AgentApiDocs({ endpoint, apiKey }) {
  const [copied, setCopied] = useState("");
  const copy = (txt, key) => {
    navigator.clipboard?.writeText(txt);
    setCopied(key);
    setTimeout(() => setCopied(""), 1500);
  };

  const placeExample = `curl -X POST ${endpoint} \\
  -H "x-api-key: ${apiKey}" \\
  -H "Content-Type: application/json" \\
  -d '{"action":"placeOrder","recipientNumber":"0244000000","network":"MTN","volumeGb":1}'`;

  const listExample = `curl -X POST ${endpoint} \\
  -H "x-api-key: ${apiKey}" \\
  -H "Content-Type: application/json" \\
  -d '{"action":"listOrders","limit":50}'`;

  const packagesExample = `curl -X POST ${endpoint} \\
  -H "x-api-key: ${apiKey}" \\
  -H "Content-Type: application/json" \\
  -d '{"action":"getPackages"}'`;

  const balanceExample = `curl -X POST ${endpoint} \\
  -H "x-api-key: ${apiKey}" \\
  -H "Content-Type: application/json" \\
  -d '{"action":"getBalance"}'`;

  const statusExample = `curl -X POST ${endpoint} \\
  -H "x-api-key: ${apiKey}" \\
  -H "Content-Type: application/json" \\
  -d '{"action":"getOrderStatus","code":"O8X2K4AB"}'`;

  const placeResponse = `{
  "ok": true,
  "order": {
    "id": "O8X2K4",
    "code": "O8X2K4AB",
    "recipient_number": "0244000000",
    "network": "MTN",
    "package_name": "MTN 1GB",
    "volume_gb": 1,
    "amount": 5.5,
    "status": "pending",
    "reference": "",
    "created_date": "2026-08-09T03:30:00.000Z"
  },
  "provider": { "ok": true, "status": "processing" }
}`;

  const listResponse = `{
  "ok": true,
  "orders": [
    { "id": "O8X2K4", "code": "O8X2K4AB", "recipient_number": "0244000000", "network": "MTN", "package_name": "MTN 1GB", "volume_gb": 1, "amount": 5.5, "status": "completed", "reference": "GL-12345", "created_date": "2026-08-09T03:30:00.000Z" }
  ]
}`;

  const packagesResponse = `{
  "ok": true,
  "packages": [
    { "id": "pk1", "name": "MTN 1GB", "network": "MTN", "volume_gb": 1, "validity": "No expiry", "base_price": 4.5, "price": 5.5 },
    { "id": "pk2", "name": "MTN 5GB", "network": "MTN", "volume_gb": 5, "validity": "No expiry", "base_price": 20, "price": 23 }
  ]
}`;

  const balanceResponse = `{
  "ok": true,
  "balance": 120.0,
  "currency": "GHS",
  "agent": { "id": "ag1", "name": "Kofi Agent", "status": "active" }
}`;

  const statusResponse = `{
  "ok": true,
  "order": {
    "id": "O8X2K4",
    "code": "O8X2K4AB",
    "recipient_number": "0244000000",
    "network": "MTN",
    "package_name": "MTN 1GB",
    "volume_gb": 1,
    "amount": 5.5,
    "status": "completed",
    "reference": "GL-12345",
    "created_date": "2026-08-09T03:30:00.000Z"
  }
}`;

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
        <h3 className="text-sm font-semibold text-foreground">Authentication</h3>
        <p className="text-sm text-muted-foreground mt-1.5">
          Every request must include your API key in the <code className="text-foreground">x-api-key</code> header. Your key identifies your agent account and wallet — keep it secret. Regenerate it above if it leaks. Requests with a missing or unknown key return <code className="text-foreground">401</code>; suspended agents get <code className="text-foreground">403</code>.
        </p>
        <div className="mt-3 grid sm:grid-cols-2 gap-3 text-xs">
          <div className="rounded-lg bg-muted px-3 py-2"><span className="text-muted-foreground">Method:</span> <code className="text-foreground">POST</code></div>
          <div className="rounded-lg bg-muted px-3 py-2"><span className="text-muted-foreground">Content-Type:</span> <code className="text-foreground">application/json</code></div>
        </div>
        <p className="text-xs text-muted-foreground mt-3">
          All actions share the single endpoint above. Choose the action by setting the <code className="text-foreground">action</code> field in the JSON body.
        </p>
      </div>

      <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
        <h3 className="text-sm font-semibold text-foreground mb-3">Endpoints</h3>
        <div className="divide-y divide-border">
          {ACTIONS.map((a) => (
            <div key={a.key} className="flex items-center gap-3 py-2.5">
              <MethodBadge method={a.method} />
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground">{a.label}</p>
                <p className="text-xs text-muted-foreground"><code>action: "{a.key}"</code> · {a.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-foreground">placeOrder</h3>
          <span className="text-xs text-muted-foreground">Create an order and send it to the supplier</span>
        </div>
        <p className="text-xs text-muted-foreground mt-1">Creates a pending order using your agent price (never below the admin base price), then pushes it to the supplier and debits your wallet on delivery.</p>
        <ParamTable rows={[
          { name: "action", type: "string", required: true, note: 'Must be "placeOrder".' },
          { name: "recipientNumber", type: "string", required: true, note: "Ghana mobile number, e.g. 0244000000 or 233244000000." },
          { name: "network", type: "string", required: true, note: "One of: MTN, Telecel, AirtelTigo, Other." },
          { name: "volumeGb", type: "number", required: true, note: "Bundle size in GB. Must match an active package for the network." },
          { name: "customerName", type: "string", note: "Optional customer name for your records." },
          { name: "paymentMethod", type: "string", note: "momo (default), cash, or wallet." },
        ]} />
        <p className="text-xs font-medium text-foreground mt-4 mb-2">Request</p>
        <CodeBlock code={placeExample} onCopy={() => copy(placeExample, "place")} copied={copied === "place"} />
        <p className="text-xs font-medium text-foreground mt-4 mb-2">Response (200)</p>
        <CodeBlock code={placeResponse} onCopy={() => copy(placeResponse, "placeRes")} copied={copied === "placeRes"} />
        <ul className="mt-3 space-y-1.5 text-xs text-muted-foreground list-disc pl-5">
          <li><span className="text-foreground font-medium">provider.status</span> reflects the supplier result: <code>processing</code>, <code>completed</code>, or <code>pending</code> (held for retry).</li>
          <li>If your wallet can't cover the amount, the order is created as <code>pending</code> and <span className="text-foreground font-medium">not</span> pushed — top up your wallet, then retry.</li>
          <li>If no active package matches the network + volume, you get <code>404</code>.</li>
        </ul>
      </div>

      <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-foreground">listOrders</h3>
          <span className="text-xs text-muted-foreground">Fetch your recent orders</span>
        </div>
        <ParamTable rows={[
          { name: "action", type: "string", required: true, note: 'Must be "listOrders".' },
          { name: "limit", type: "number", note: "Max orders to return. Default 50, capped at 200." },
        ]} />
        <p className="text-xs font-medium text-foreground mt-4 mb-2">Request</p>
        <CodeBlock code={listExample} onCopy={() => copy(listExample, "list")} copied={copied === "list"} />
        <p className="text-xs font-medium text-foreground mt-4 mb-2">Response (200)</p>
        <CodeBlock code={listResponse} onCopy={() => copy(listResponse, "listRes")} copied={copied === "listRes"} />
        <p className="mt-3 text-xs text-muted-foreground">Orders are returned newest-first. Each order's <code className="text-foreground">status</code> is one of: pending, processing, completed, failed, cancelled.</p>
      </div>

      <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-foreground">getPackages</h3>
          <span className="text-xs text-muted-foreground">List active bundles and your sell prices</span>
        </div>
        <p className="text-xs text-muted-foreground mt-1">Returns every active package across all networks with the admin base price and your current sell price (which is never below the base).</p>
        <ParamTable rows={[
          { name: "action", type: "string", required: true, note: 'Must be "getPackages".' },
        ]} />
        <p className="text-xs font-medium text-foreground mt-4 mb-2">Request</p>
        <CodeBlock code={packagesExample} onCopy={() => copy(packagesExample, "pk")} copied={copied === "pk"} />
        <p className="text-xs font-medium text-foreground mt-4 mb-2">Response (200)</p>
        <CodeBlock code={packagesResponse} onCopy={() => copy(packagesResponse, "pkRes")} copied={copied === "pkRes"} />
        <p className="mt-3 text-xs text-muted-foreground">Use <code className="text-foreground">network</code> + <code className="text-foreground">volume_gb</code> to call <code>placeOrder</code>. <code className="text-foreground">price</code> is what your wallet is charged.</p>
      </div>

      <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-foreground">getBalance</h3>
          <span className="text-xs text-muted-foreground">Check your wallet balance</span>
        </div>
        <ParamTable rows={[
          { name: "action", type: "string", required: true, note: 'Must be "getBalance".' },
        ]} />
        <p className="text-xs font-medium text-foreground mt-4 mb-2">Request</p>
        <CodeBlock code={balanceExample} onCopy={() => copy(balanceExample, "bal")} copied={copied === "bal"} />
        <p className="text-xs font-medium text-foreground mt-4 mb-2">Response (200)</p>
        <CodeBlock code={balanceResponse} onCopy={() => copy(balanceResponse, "balRes")} copied={copied === "balRes"} />
        <p className="mt-3 text-xs text-muted-foreground">Check this before placing orders to avoid pending holds when funds are insufficient.</p>
      </div>

      <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-foreground">getOrderStatus</h3>
          <span className="text-xs text-muted-foreground">Fetch a single order by id or code</span>
        </div>
        <ParamTable rows={[
          { name: "action", type: "string", required: true, note: 'Must be "getOrderStatus".' },
          { name: "orderId", type: "string", note: "The order id. Either this or code is required." },
          { name: "code", type: "string", note: "The human-readable order code, e.g. O8X2K4AB." },
        ]} />
        <p className="text-xs font-medium text-foreground mt-4 mb-2">Request</p>
        <CodeBlock code={statusExample} onCopy={() => copy(statusExample, "st")} copied={copied === "st"} />
        <p className="text-xs font-medium text-foreground mt-4 mb-2">Response (200)</p>
        <CodeBlock code={statusResponse} onCopy={() => copy(statusResponse, "stRes")} copied={copied === "stRes"} />
        <p className="mt-3 text-xs text-muted-foreground">Returns <code className="text-foreground">404</code> if the order doesn't exist or belongs to another agent.</p>
      </div>

      <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
        <h3 className="text-sm font-semibold text-foreground">Error responses</h3>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-left">
            <thead className="text-[11px] uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="py-2 pr-4 font-normal">Status</th>
                <th className="py-2 font-normal">Meaning</th>
              </tr>
            </thead>
            <tbody className="text-xs">
              <tr className="border-t border-border"><td className="py-2.5 pr-4"><code className="text-foreground">401</code></td><td className="py-2.5 text-muted-foreground">Missing or invalid <code>x-api-key</code>.</td></tr>
              <tr className="border-t border-border"><td className="py-2.5 pr-4"><code className="text-foreground">403</code></td><td className="py-2.5 text-muted-foreground">Agent account is suspended.</td></tr>
              <tr className="border-t border-border"><td className="py-2.5 pr-4"><code className="text-foreground">400</code></td><td className="py-2.5 text-muted-foreground">Missing required fields, or unknown action.</td></tr>
              <tr className="border-t border-border"><td className="py-2.5 pr-4"><code className="text-foreground">404</code></td><td className="py-2.5 text-muted-foreground">No active package for the requested network + volume, or order not found.</td></tr>
              <tr className="border-t border-border"><td className="py-2.5 pr-4"><code className="text-foreground">500</code></td><td className="py-2.5 text-muted-foreground">Unexpected server error. Retry with backoff.</td></tr>
            </tbody>
          </table>
        </div>
        <div className="mt-4 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 px-4 py-3 text-xs text-amber-800 dark:text-amber-300">
          <p className="font-medium">Wallet balance check</p>
          <p className="mt-1">Before calling <code>placeOrder</code>, make sure your wallet can cover the order amount. Orders that exceed your balance are created as <code>pending</code> and won't reach the supplier until you top up. Use <code>getBalance</code> to check first.</p>
        </div>
      </div>
    </div>
  );
}