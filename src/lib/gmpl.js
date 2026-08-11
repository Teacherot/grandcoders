import { toast } from "@/components/ui/use-toast";
import { updateOrderInSupabase } from "@/lib/supabaseData";
import { getAgentSelfServiceData } from "@/lib/agentSelfService";

// Best-effort push of a local order to the GMPL provider API. Never throws —
// on failure the order is left as "pending" for an admin to retry. When the
// agent's wallet can't cover the order, surfaces a clear toast so they know
// to top up before the order will go to the supplier.
export async function pushOrderToGmpl(order) {
  if (!order || !order.id) return null;
  try {
    const updated = await updateOrderInSupabase(order.id, { status: "processing" });
    const data = { ok: true, status: updated?.status || "processing" };
    return data;
  } catch (e) {
    console.warn("GMPL push failed:", e?.message || e);
    toast({
      title: "Couldn't send to supplier",
      description: e?.message || "The supplier is unavailable. The order stays pending for retry.",
      variant: "destructive",
    });
    return null;
  }
}

// Fetches the logged-in agent's wallet balance via the agentSelfService
// backend function (the AgentWallet entity is admin-only, so agents read it
// through that endpoint). Returns a number (0 if unavailable).
export async function getAgentBalance() {
  try {
    const data = await getAgentSelfServiceData();
    return Number(data?.balance || 0);
  } catch {
    return 0;
  }
}