import React, { useState, useCallback } from "react";
import { useRole } from "@/components/RoleShell";
import PageHeader from "@/components/PageHeader";
import StoreCustomise from "@/components/agents/StoreCustomise";
import { getAgentsFromSupabaseLive } from "@/lib/supabaseData";

export default function AgentStoreManage() {
  const { agent } = useRole();
  const [current, setCurrent] = useState(agent);

  const refresh = useCallback(async () => {
    const rows = await getAgentsFromSupabaseLive().catch(() => []);
    const updated = (rows || []).find((row) => row.id === agent.id) || agent;
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