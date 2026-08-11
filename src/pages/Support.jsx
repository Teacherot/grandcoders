import React, { useEffect, useState } from "react";
import { useRole } from "@/components/RoleShell";
import PageHeader from "@/components/PageHeader";
import ChatThread from "@/components/chat/ChatThread";
import { toast } from "@/components/ui/use-toast";
import { createChatMessageInSupabase, getChatMessagesFromSupabase, updateChatMessageInSupabase } from "@/lib/supabaseData";

export default function Support() {
  const { agent } = useRole();
  const [messages, setMessages] = useState(null);
  const [sending, setSending] = useState(false);

  const load = async () => {
    const rows = await getChatMessagesFromSupabase().catch(() => []);
    setMessages((rows || []).filter((m) => m.agent_id === agent?.id));
  };

  useEffect(() => {
    if (!agent) return;
    load();
    const timer = setInterval(load, 12000);
    return () => clearInterval(timer);
  }, [agent?.id]);

  useEffect(() => {
    if (!messages) return;
    messages
      .filter((m) => m.sender === "admin" && !m.read)
      .forEach((m) => updateChatMessageInSupabase(m.id, { read: true }).catch(() => {}));
  }, [messages]);

  if (!agent) return null;

  const send = async (text, file) => {
    setSending(true);
    try {
      await createChatMessageInSupabase({
        agent_id: agent.id,
        agent_name: agent.full_name,
        agent_email: agent.email,
        sender: "agent",
        message: text,
        file_url: file?.file_url || "",
        file_name: file?.file_name || "",
        read: false,
      });
      load();
    } catch (err) {
      toast({ title: "Message not sent", description: err.message, variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  return (
    <div>
      <PageHeader title="Support" subtitle="Chat directly with the GrandCoders admin team" />
      <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden h-[calc(100vh-13rem)] md:h-[calc(100vh-11rem)]">
        <ChatThread messages={messages} myRole="agent" onSend={send} sending={sending} headerLabel="Admin support" />
      </div>
    </div>
  );
}