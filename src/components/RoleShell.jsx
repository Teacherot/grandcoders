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
    let unsubscribe = null;

    const loadAgent = async (baseUser = user) => {
      if (!baseUser?.email) {
        if (active) {
          setAgent(null);
          setLoading(false);
        }
        return;
      }

      try {
        if (baseUser.role === "admin") {
          if (active) { setAgent(null); setLoading(false); }
          return;
        }

        let profile = null;
        if (supabase) {
          try {
            const { data: byId, error: byIdError } = await supabase.from('agents').select('*').eq('id', baseUser.id).limit(1);
            if (!byIdError && byId?.[0]) {
              profile = byId[0];
            } else {
              const { data: byEmail, error: byEmailError } = await supabase.from('agents').select('*').eq('email', baseUser.email).limit(1);
              if (!byEmailError && byEmail?.[0]) {
                profile = byEmail[0];
              }
            }

            if (!profile) {
              const fallbackAgent = {
                id: baseUser.id,
                email: baseUser.email,
                full_name: baseUser.full_name || baseUser.email?.split('@')[0] || 'Agent',
                role: 'agent',
                status: 'active',
                commission_rate: 10,
                created_at: new Date().toISOString(),
                created_date: new Date().toISOString(),
              };

              const { data: created, error: createError } = await supabase
                .from('agents')
                .insert(fallbackAgent)
                .select()
                .single();

              if (!createError && created) {
                profile = created;
              } else {
                profile = fallbackAgent;
              }
            }
          } catch (profileError) {
            console.warn('Unable to resolve agent profile', profileError);
          }
        }

        if (active) {
          const safeProfile = profile
            ? {
                ...profile,
                full_name: profile.full_name || baseUser.full_name || baseUser.email?.split('@')[0] || 'Agent',
                email: profile.email || baseUser.email,
                role: profile.role || 'agent',
                status: profile.status || 'active',
                commission_rate: profile.commission_rate ?? 10,
              }
            : null;

          setAgent(
            safeProfile || {
              id: baseUser.id,
              email: baseUser.email,
              full_name: baseUser.full_name || baseUser.email?.split('@')[0] || 'Agent',
              role: 'agent',
              status: 'active',
              commission_rate: 10,
            }
          );
        }
      } catch (error) {
        console.warn('RoleShell initialization failed', error);
        if (active) {
          setAgent({
            id: baseUser?.id,
            email: baseUser?.email,
            full_name: baseUser?.full_name || baseUser?.email?.split('@')[0] || 'Agent',
            role: 'agent',
            status: 'active',
            commission_rate: 10,
          });
        }
      } finally {
        if (active) setLoading(false);
      }
    };

    (async () => {
      await loadAgent(user);

      if (!supabase) return;
      const { data } = supabase.auth.onAuthStateChange(async (event, session) => {
        if (!active) return;
        if ((event === 'SIGNED_IN' || event === 'INITIAL_SESSION') && session?.user) {
          await loadAgent({
            id: session.user.id,
            email: session.user.email,
            full_name: user?.full_name || session.user.user_metadata?.full_name,
            role: user?.role || session.user.user_metadata?.role || 'agent',
          });
        }
      });
      unsubscribe = data?.subscription?.unsubscribe || null;
    })();

    return () => {
      active = false;
      if (typeof unsubscribe === 'function') unsubscribe();
    };
  }, [user?.id, user?.email, user?.full_name, user?.role]);

  const role = user?.role === "admin" ? "admin" : "agent";

  const Shell = role === "agent" ? AgentLayout : Layout;

  return (
    <RoleContext.Provider value={{ role, agent, loading }}>
      {role === "agent" && <AgentOrderNotifier agent={agent} />}
      <Shell />
    </RoleContext.Provider>
  );
}