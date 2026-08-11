import React, { createContext, useContext, useEffect, useState } from "react";
import { Outlet } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import Layout from "@/components/Layout";
import AgentLayout from "@/components/AgentLayout";
import AgentOrderNotifier from "@/components/agents/AgentOrderNotifier";
import SignupTokenRequired from "@/components/SignupTokenRequired";

const RoleContext = createContext({ role: "admin", agent: null, loading: true });

export const useRole = () => useContext(RoleContext);

export function RoleRoute({ admin, agent }) {
  const { role, loading } = useRole();
  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-7 h-7 border-4 border-neutral-200 border-t-neutral-800 rounded-full animate-spin" />
      </div>
    );
  }
  return role === "agent" ? agent : admin;
}

export default function RoleShell() {
  const { user } = useAuth();
  const [agent, setAgent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [needsToken, setNeedsToken] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      if (!user?.email) { setLoading(false); return; }

      const isDemoUser = user?.id === "demo-agent" || user?.email === "agent@example.com";
      if (isDemoUser) {
        if (active) {
          setAgent({
            id: user.id,
            email: user.email,
            full_name: user.full_name || "Demo Agent",
            store_name: user.store_name || "Demo Store",
            commission_rate: user.commission_rate || 10,
          });
          setNeedsToken(false);
          setLoading(false);
        }
        return;
      }

      try {
        if (user.role === "admin") {
          if (active) { setAgent(null); setLoading(false); }
          return;
        }
        // Established agents skip the sign-up gate entirely.
        const agents = await base44.entities.Agent.filter({ email: user.email });
        if (active) setAgent(agents[0] || null);
        if (agents[0]) { if (active) setLoading(false); return; }

        // New account: provision via ensureAgentAccount, which requires a valid
        // sign-up token (or a pending pre-authorization). If it returns
        // signup_required, show the token screen instead of the app.
        try {
          const res = await base44.functions.invoke("ensureAgentAccount", {});
          if (active && res?.agent) setAgent(res.agent);
        } catch (err) {
          if (String(err?.message || "").includes("signup_required")) {
            if (active) setNeedsToken(true);
          } else {
            throw err;
          }
        }
      } catch {
        /* ignore */
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [user?.email]);

  const role = user?.role === "admin" ? "admin" : "agent";

  if (needsToken) {
    return <SignupTokenRequired />;
  }

  const Shell = role === "agent" ? AgentLayout : Layout;

  return (
    <RoleContext.Provider value={{ role, agent, loading }}>
      {role === "agent" && <AgentOrderNotifier agent={agent} />}
      <Shell />
    </RoleContext.Provider>
  );
}