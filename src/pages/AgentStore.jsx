import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import PageHeader from "@/components/PageHeader";
import StoreCustomise from "@/components/agents/StoreCustomise";
import StorePrices from "@/components/agents/StorePrices";
import StoreWithdrawals from "@/components/agents/StoreWithdrawals";

export default function AgentStore() {
  const [agents, setAgents] = useState(null);
  const [agentId, setAgentId] = useState("");
  const [tab, setTab] = useState("customise");

  useEffect(() => { base44.entities.Agent.list().then(setAgents); }, []);
  const agent = agents?.find((a) => a.id === agentId);
  const refresh = () => base44.entities.Agent.list().then(setAgents);

  return (
    <div>
      <PageHeader title="Agent stores" subtitle="Customise storefronts, set agent prices and manage commission payouts" />
      <div className="mb-6">
        <select className="h-10 rounded-md border border-input bg-card px-3 text-sm text-foreground" value={agentId} onChange={(e) => setAgentId(e.target.value)}>
          <option value="">Select an agent…</option>
          {agents?.map((a) => <option key={a.id} value={a.id}>{a.full_name}</option>)}
        </select>
      </div>
      {!agent ? (
        <div className="rounded-2xl border border-dashed border-border bg-card p-16 text-center text-sm text-muted-foreground">Choose an agent to manage their store.</div>
      ) : (
        <>
          <div className="flex gap-1 mb-6 rounded-xl bg-muted/50 border border-border p-1 w-fit">
            {[["customise", "Customise"], ["prices", "Prices"], ["payouts", "Payouts"]].map(([k, l]) => (
              <button key={k} onClick={() => setTab(k)} className={`rounded-lg px-4 py-1.5 text-xs ${tab === k ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}>{l}</button>
            ))}
          </div>
          {tab === "customise" && <StoreCustomise key={agent.id} agent={agent} onSave={refresh} />}
          {tab === "prices" && <StorePrices key={agent.id} agent={agent} />}
          {tab === "payouts" && <StoreWithdrawals key={agent.id} agent={agent} />}
        </>
      )}
    </div>
  );
}