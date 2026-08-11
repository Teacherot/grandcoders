import React, { useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { toast } from "@/components/ui/use-toast";

// Fires an immediate toast when one of the agent's orders transitions to "completed".
// Receives the agent via props to avoid a circular import with RoleShell.
export default function AgentOrderNotifier({ agent }) {
  const statuses = useRef(new Map());

  useEffect(() => {
    if (!agent?.id) return;

    let active = true;
    base44.entities.Order.filter({ agent_id: agent.id }, "-updated_date", 500)
      .then((orders) => {
        if (!active) return;
        (orders || []).forEach((o) => statuses.current.set(o.id, o.status));
      })
      .catch(() => {});

    const unsub = base44.entities.Order.subscribe((ev) => {
      if (ev.type !== "update" && ev.type !== "create") return;
      const o = ev.data;
      if (!o || o.agent_id !== agent.id) return;
      const prev = statuses.current.get(o.id);
      statuses.current.set(o.id, o.status);
      if (o.status === "completed" && prev !== "completed") {
        toast({
          title: "Order completed",
          description: `${o.code || o.package_name || "Order"} for ${o.customer_name || o.recipient_number || "customer"} is now delivered.`,
        });
      }
    });

    return () => {
      active = false;
      if (typeof unsub === "function") unsub();
    };
  }, [agent?.id]);

  return null;
}