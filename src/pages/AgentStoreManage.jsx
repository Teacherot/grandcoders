import React, { useState, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { useRole } from "@/components/RoleShell";
import PageHeader from "@/components/PageHeader";
import StoreCustomise from "@/components/agents/StoreCustomise";

export default function AgentStoreManage() {
  const { agent } = useRole();
  const [current, setCurrent] = useState(agent);

  const refresh = useCallback(async () => {
    const updated = await base44.entities.Agent.get(agent.id);
    setCurrent(updated);
  }, [agent?.id]);

  if (!agent) return null;

  return (
    <div>
      <PageHeader title="My store" subtitle="Customise your storefront and share link" />
      <StoreCustomise key={current.id} agent={current} onSave={refresh} />
    </div>
  );
}