import React from "react";
import { useRole } from "@/components/RoleShell";
import PageHeader from "@/components/PageHeader";
import StorePrices from "@/components/agents/StorePrices";

export default function AgentPrices() {
  const { agent } = useRole();
  if (!agent) return null;
  return (
    <div>
      <PageHeader title="Prices" subtitle="Set your selling prices per bundle" />
      <StorePrices key={agent.id} agent={agent} />
    </div>
  );
}