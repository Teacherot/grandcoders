import React, { useState } from "react";
import { useRole } from "@/components/RoleShell";
import PageHeader from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { base44 } from "@/api/base44Client";
import { Store, User, Phone, Mail, MapPin, KeyRound, Check, Loader2 } from "lucide-react";

export default function AgentSettings() {
  const { agent } = useRole();
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [editingPhone, setEditingPhone] = useState(false);
  const [phoneValue, setPhoneValue] = useState("");
  const [savingPhone, setSavingPhone] = useState(false);
  const [phoneMsg, setPhoneMsg] = useState("");

  const updatePhone = async () => {
    if (!agent?.id || !phoneValue.trim()) return;
    setSavingPhone(true);
    setPhoneMsg("");
    try {
      await base44.entities.Agent.update(agent.id, { phone: phoneValue.trim() });
      setPhoneMsg("Saved. Use this number as your MoMo reference to auto-top-up.");
      setEditingPhone(false);
    } catch (err) {
      setPhoneMsg(err?.response?.data?.error || "Could not update phone — contact an admin.");
    } finally {
      setSavingPhone(false);
    }
  };

  const resetPassword = async () => {
    if (!agent?.email) return;
    setSending(true);
    try {
      await base44.auth.resetPasswordRequest(agent.email);
    } catch {
      /* always show generic success */
    } finally {
      setSending(false);
      setSent(true);
    }
  };

  if (!agent) return null;

  const rows = [
    { icon: User, label: "Full name", value: agent.full_name },
    { icon: Store, label: "Store name", value: agent.store_name },
    { icon: Mail, label: "Email", value: agent.email },
    { icon: MapPin, label: "Region", value: agent.region },
  ];

  return (
    <div>
      <PageHeader title="Settings" subtitle="Your profile and account security" />
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-border bg-card p-6">
          <p className="text-xs uppercase tracking-widest text-muted-foreground mb-5">Profile</p>
          <div className="space-y-4">
            {rows.map(({ icon: Icon, label, value }) => (
              <div key={label} className="flex items-center gap-3">
                <div className="flex items-center justify-center w-9 h-9 rounded-full bg-muted text-muted-foreground">
                  <Icon className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{label}</p>
                  <p className="text-sm font-medium">{value || "—"}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-5 rounded-xl border border-border bg-muted/30 p-4">
            <div className="flex items-center gap-2 mb-3">
              <Phone className="w-4 h-4 text-muted-foreground" />
              <p className="text-xs font-medium text-muted-foreground">MoMo reference number</p>
            </div>
            {editingPhone ? (
              <div className="space-y-2">
                <Input value={phoneValue} onChange={(e) => setPhoneValue(e.target.value)} placeholder="e.g. 024XXXXXXX" disabled={savingPhone} />
                <div className="flex gap-2">
                  <Button size="sm" onClick={updatePhone} disabled={savingPhone || !phoneValue.trim()}>
                    {savingPhone ? "Saving…" : "Save"}
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => { setEditingPhone(false); setPhoneMsg(""); }} disabled={savingPhone}>Cancel</Button>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">{agent.phone || "Not set — add your number to use auto top-up."}</p>
                <Button variant="ghost" size="sm" onClick={() => { setPhoneValue(agent.phone || ""); setEditingPhone(true); setPhoneMsg(""); }}>
                  {agent.phone ? "Update" : "Add number"}
                </Button>
              </div>
            )}
            {phoneMsg && <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-2">{phoneMsg}</p>}
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card p-6">
          <p className="text-xs uppercase tracking-widest text-muted-foreground mb-5">Security</p>
          <div className="flex items-start gap-3 mb-5">
            <div className="flex items-center justify-center w-9 h-9 rounded-full bg-muted text-muted-foreground">
              <KeyRound className="w-4 h-4" />
            </div>
            <div>
              <p className="text-sm font-medium">Password</p>
              <p className="text-xs text-muted-foreground mt-0.5">Send a reset link to your email to set a new password.</p>
            </div>
          </div>
          {sent ? (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 dark:bg-emerald-950/40 dark:border-emerald-900 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-400 flex items-start gap-2">
              <Check className="w-4 h-4 mt-0.5 shrink-0" />
              <span>If an account exists for {agent.email}, a reset link has been sent. Check your inbox and follow the link to set a new password.</span>
            </div>
          ) : (
            <Button onClick={resetPassword} disabled={sending || !agent.email} className="w-full">
              {sending ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Sending reset link…</> : "Send reset link"}
            </Button>
          )}
          {!agent.email && (
            <p className="text-xs text-destructive mt-3">No email on file — contact an admin to set one.</p>
          )}
        </div>
      </div>
    </div>
  );
}