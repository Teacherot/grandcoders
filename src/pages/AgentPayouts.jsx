import React from "react";
import { useRole } from "@/components/RoleShell";
import PageHeader from "@/components/PageHeader";
import StoreWithdrawals from "@/components/agents/StoreWithdrawals";
import MomoTopUp from "@/components/agents/MomoTopUp";
import AgentWalletHistory from "@/components/agents/AgentWalletHistory";
import AgentWalletOverview from "@/components/agents/AgentWalletOverview";
import AgentWalletClaims from "@/components/agents/AgentWalletClaims";

export default function AgentPayouts() {
  const { agent } = useRole();
  if (!agent) return null;
  return (
    <div className="space-y-8">
      <PageHeader title="Wallet & Payouts" subtitle="Top up your wallet via Mobile Money and request commission withdrawals" />
      <AgentWalletOverview />
      <MomoTopUp />
      <AgentWalletClaims />
      <AgentWalletHistory />
      <StoreWithdrawals key={agent.id} agent={agent} />
    </div>
  );
}