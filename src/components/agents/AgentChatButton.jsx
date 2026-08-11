import React, { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { useRole } from "@/components/RoleShell";
import { MessageCircle } from "lucide-react";

export default function AgentChatButton() {
  const { agent } = useRole();
  const { pathname } = useLocation();
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    if (!agent) return;
    const load = () =>
      base44.entities.ChatMessage.filter({ agent_id: agent.id }, "created_date", 500).then((msgs) => {
        setUnread(msgs.filter((m) => m.sender === "admin" && !m.read).length);
      });
    load();
    const unsub = base44.entities.ChatMessage.subscribe((event) => {
      if (event?.data?.agent_id === agent.id) load();
    });
    return unsub;
  }, [agent?.id]);

  if (!agent || pathname === "/support") return null;

  return (
    <Link
      to="/support"
      aria-label={`Chat with admin${unread > 0 ? `, ${unread} unread` : ""}`}
      className="fixed bottom-5 right-5 z-40 inline-flex items-center justify-center w-14 h-14 rounded-full bg-[#1E6FE8] text-white shadow-lg shadow-[#1E6FE8]/40 hover:bg-[#1a5fc7] active:scale-95 transition-all"
    >
      <MessageCircle className="w-6 h-6" strokeWidth={1.75} />
      {unread > 0 && (
        <span className="absolute -top-1 -right-1 min-w-5 h-5 px-1.5 rounded-full bg-amber-400 text-amber-950 text-xs font-bold flex items-center justify-center ring-2 ring-white">
          {unread > 99 ? "99+" : unread}
        </span>
      )}
    </Link>
  );
}