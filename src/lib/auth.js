import { supabase } from "@/lib/supabaseClient";

function ensureSupabase() {
  if (!supabase) {
    throw new Error("Supabase is not configured.");
  }
}

async function upsertAgentProfile(user, fullName = "") {
  if (!user?.id || !user?.email) return null;

  const profile = {
    id: user.id,
    email: user.email,
    full_name: fullName || user.user_metadata?.full_name || user.email.split("@")[0],
    role: "agent",
    status: "active",
    commission_rate: 10,
    created_at: new Date().toISOString(),
    created_date: new Date().toISOString(),
  };

  const { error } = await supabase.from("agents").upsert(profile, { onConflict: "id" });
  if (error) throw error;
  return profile;
}

export async function signUpAgent(email, password, fullName) {
  ensureSupabase();

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: fullName || "",
      },
    },
  });

  if (error) throw error;

  if (data?.user && data?.session) {
    await upsertAgentProfile(data.user, fullName || "");
  }

  return data;
}

export async function signInAgent(email, password) {
  ensureSupabase();

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;

  if (data?.user) {
    await upsertAgentProfile(data.user);
  }

  return data;
}

export async function getCurrentAgent() {
  ensureSupabase();

  const { data: userRes, error: userErr } = await supabase.auth.getUser();
  if (userErr) throw userErr;

  const user = userRes?.user;
  if (!user) throw new Error("No session");

  const { data: agent, error } = await supabase
    .from("agents")
    .select("*")
    .eq("id", user.id)
    .single();

  if (error) throw error;
  return agent;
}

export async function signOut() {
  ensureSupabase();
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}
