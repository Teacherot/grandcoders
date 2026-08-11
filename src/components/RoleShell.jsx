import React, { createContext, useContext, useEffect, useState } from "react";
import { Outlet } from "react-router-dom";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/lib/AuthContext";
import Layout from "@/components/Layout";
import AgentLayout from "@/components/AgentLayout";
import AgentOrderNotifier from "@/components/agents/AgentOrderNotifier";

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

  useEffect(() => {
    let active = true;
    (async () => {
      if (!user?.email) {
        if (active) {
          setAgent(null);
          setLoading(false);
        }
        return;
      }

      try {
        if (user.role === "admin") {
          if (active) { setAgent(null); setLoading(false); }
          return;
        }

        let profile = null;
        if (supabase) {
          try {
            const { data, error } = await supabase.from('agents').select('*').eq('email', user.email).limit(1);
            if (!error && data?.[0]) {
              profile = data[0];
            }
          } catch (profileError) {
            console.warn('Unable to resolve agent profile', profileError);
          }
        }

        if (active) {
          setAgent(profile || null);
        }
      } catch (error) {
        console.warn('RoleShell initialization failed', error);
        if (active) setAgent(null);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [user?.email, user?.role]);

  const role = user?.role === "admin" ? "admin" : "agent";

  const Shell = role === "agent" ? AgentLayout : Layout;

  return (
    <RoleContext.Provider value={{ role, agent, loading }}>
      {role === "agent" && <AgentOrderNotifier agent={agent} />}
      <Shell />
    </RoleContext.Provider>
  );
}