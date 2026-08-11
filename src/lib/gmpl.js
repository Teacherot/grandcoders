import { base44 } from "@/api/base44Client";
import { toast } from "@/components/ui/use-toast";

// Best-effort push of a local order to the GMPL provider API. Never throws —
// on failure the order is left as "pending" for an admin to retry. When the
// agent's wallet can't cover the order, surfaces a clear toast so they know
// to top up before the order will go to the supplier.
export async function pushOrderToGmpl(order) {
  if (!order || !order.id) return null;
  try {
    const res = await base44.functions.invoke("pushOrderToGmpl", {
      orderId: order.id,
      recipientNumber: order.recipient_number,
      network: order.network,
      volumeGb: order.volume_gb,
    });
    const data = res?.data ?? null;
    if (data?.insufficient) {
      toast({
        title: "Order held — insufficient balance",
        description: `Your wallet can't cover this order (${data.balance ?? 0} available). Top up to send it to the supplier.`,
        variant: "destructive",
      });
    } else if (data?.awaitingStock) {
      toast({
        title: "Awaiting supplier stock",
        description: data.error || "No supplier bundle available right now. The order stays pending and retries when stock reopens.",
      });
    } else if (data?.status === "cancelled") {
      toast({
        title: "Order cancelled by supplier",
        description: data.error || "The supplier rejected this order.",
        variant: "destructive",
      });
    } else if (!data?.ok && data?.status === "failed") {
      toast({
        title: "Couldn't send to supplier",
        description: data.error || "The supplier is unavailable. The order stays pending for retry.",
        variant: "destructive",
      });
    }
    return data;
  } catch (e) {
    console.warn("GMPL push failed:", e?.message || e);
    return null;
  }
}

// Fetches the logged-in agent's wallet balance via the agentSelfService
// backend function (the AgentWallet entity is admin-only, so agents read it
// through that endpoint). Returns a number (0 if unavailable).
export async function getAgentBalance() {
  try {
    const res = await base44.functions.invoke("agentSelfService", {});
    return Number(res?.data?.balance || 0);
  } catch {
    return 0;
  }
}