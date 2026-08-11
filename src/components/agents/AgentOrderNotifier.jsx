import React, { useEffect, useRef } from "react";
import { toast } from "@/components/ui/use-toast";
import { getOrdersFromSupabase } from "@/lib/supabaseData";

// Fires an immediate toast when one of the agent's orders transitions to "completed".
// Receives the agent via props to avoid a circular import with RoleShell.
export default function AgentOrderNotifier({ agent }) {
  const statuses = useRef(new Map());

  useEffect(() => {
    if (!agent?.id) return;

    let active = true;
    const tick = async () => {
      const all = await getOrdersFromSupabase().catch(() => []);
      if (!active) return;
      const mine = (all || []).filter((o) => o.agent_id === agent.id).slice(0, 500);
      mine.forEach((o) => {
        const prev = statuses.current.get(o.id);
        statuses.current.set(o.id, o.status);
        if (prev && o.status === "completed" && prev !== "completed") {
          toast({
            title: "Order completed",
            description: `${o.code || o.package_name || "Order"} for ${o.customer_name || o.recipient_number || "customer"} is now delivered.`,
          });
        }
      });
    };

    tick();
    const timer = setInterval(tick, 12000);

    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [agent?.id]);

  return null;
}