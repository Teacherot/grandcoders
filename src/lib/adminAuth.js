import { supabase, supabaseUrl } from "@/lib/supabaseClient";

export async function resetAgentPassword({ agentId, newPassword }) {
  if (!agentId || !newPassword) {
    throw new Error("agentId and newPassword are required");
  }

  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession();

  if (sessionError || !session?.access_token) {
    throw new Error("You must be logged in");
  }

  if (!supabaseUrl) {
    throw new Error("Supabase URL is not configured");
  }

  const functionUrl = `${supabaseUrl.replace(/\/$/, "")}/functions/v1/reset-agent-password`;

  const res = await fetch(functionUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({
      agent_id: agentId,
      new_password: newPassword,
    }),
  });

  let payload = {};
  try {
    payload = await res.json();
  } catch {
    payload = {};
  }

  if (!res.ok) {
    throw new Error(payload?.error ?? "Failed to reset password");
  }

  return payload;
}