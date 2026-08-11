import React, { useEffect, useMemo, useState } from "react";
import { base44 } from "@/api/base44Client";
import PageHeader from "@/components/PageHeader";
import ChatThread from "@/components/chat/ChatThread";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, MessageCircle } from "lucide-react";
import { toast } from "@/components/ui/use-toast";

export default function Messages() {
  const [all, setAll] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [q, setQ] = useState("");
  const [sending, setSending] = useState(false);

  const load = () => base44.entities.ChatMessage.list("created_date", 1000).then(setAll);

  useEffect(() => {
    load();
    const unsub = base44.entities.ChatMessage.subscribe(() => load());
    return unsub;
  }, []);

  const conversations = useMemo(() => {
    const map = {};
    (all || []).forEach((m) => {
      if (!m.agent_id) return;
      if (!map[m.agent_id]) map[m.agent_id] = { agent_id: m.agent_id, agent_name: m.agent_name || "Agent", agent_email: m.agent_email || "", messages: [], last: null };
      map[m.agent_id].messages.push(m);
    });
    const list = Object.values(map);
    list.forEach((c) => {
      c.messages.sort((a, b) => new Date(a.created_date) - new Date(b.created_date));
      c.last = c.messages[c.messages.length - 1]?.created_date;
    });
    list.sort((a, b) => new Date(b.last || 0) - new Date(a.last || 0));
    return list;
  }, [all]);

  const selected = conversations.find((c) => c.agent_id === selectedId) || null;
  const filtered = conversations.filter((c) => !q || (c.agent_name || "").toLowerCase().includes(q.toLowerCase()) || (c.agent_email || "").toLowerCase().includes(q.toLowerCase()));

  useEffect(() => {
    if (!selected) return;
    selected.messages
      .filter((m) => m.sender === "agent" && !m.read)
      .forEach((m) => {
        base44.entities.ChatMessage.update(m.id, { read: true }).catch(() => {});
      });
  }, [selectedId, all]);

  const send = async (text, file) => {
    if (!selected) return;
    setSending(true);
    try {
      await base44.entities.ChatMessage.create({
        agent_id: selected.agent_id,
        agent_name: selected.agent_name,
        agent_email: selected.agent_email,
        sender: "admin",
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
      <PageHeader title="Messages" subtitle="Agent conversations — reply and share files" />
      <div className="grid md:grid-cols-[280px_1fr] gap-0 rounded-2xl border border-border bg-card shadow-sm overflow-hidden h-[calc(100vh-13rem)] md:h-[calc(100vh-11rem)]">
        <div className="border-b md:border-b-0 md:border-r border-border flex flex-col min-h-0">
          <div className="p-3 border-b border-border">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input className="pl-9" placeholder="Search agents…" value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto">
            {!all ? (
              <p className="p-6 text-sm text-muted-foreground text-center">Loading…</p>
            ) : filtered.length === 0 ? (
              <p className="p-6 text-sm text-muted-foreground text-center">No conversations yet.</p>
            ) : (
              filtered.map((c) => {
                const unread = c.messages.some((m) => m.sender === "agent" && !m.read);
                return (
                  <button key={c.agent_id} onClick={() => setSelectedId(c.agent_id)} className={`w-full text-left px-4 py-3 border-b border-border hover:bg-muted/50 transition-colors ${selectedId === c.agent_id ? "bg-muted" : ""}`}>
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-[#1E6FE8]/10 text-[#1E6FE8] flex items-center justify-center text-xs font-semibold shrink-0">{(c.agent_name || "A").charAt(0).toUpperCase()}</div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-foreground truncate">{c.agent_name || "Agent"}</p>
                        <p className="text-xs text-muted-foreground truncate">{c.agent_email}</p>
                      </div>
                      {unread && <span className="w-2 h-2 rounded-full bg-[#1E6FE8] shrink-0" />}
                    </div>
                    {c.last && <p className="text-[11px] text-muted-foreground mt-1.5">{new Date(c.last).toLocaleString()}</p>}
                  </button>
                );
              })
            )}
          </div>
        </div>
        <div className="flex flex-col min-h-0">
          {selected ? (
            <ChatThread messages={selected.messages} myRole="admin" onSend={send} sending={sending} headerLabel={selected.agent_name} />
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground p-6 text-center">
              <MessageCircle className="w-10 h-10 mb-3 opacity-40" />
              <p className="text-sm">Select a conversation to reply.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}