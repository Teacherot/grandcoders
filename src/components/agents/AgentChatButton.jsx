import React, { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useRole } from "@/components/RoleShell";
import { MessageCircle } from "lucide-react";
import { getChatMessagesFromSupabase } from "@/lib/supabaseData";

export default function AgentChatButton() {
  const { agent } = useRole();
  const { pathname } = useLocation();
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    if (!agent) return;
    const load = () =>
      getChatMessagesFromSupabase().then((rows) => {
        const msgs = (rows || []).filter((m) => m.agent_id === agent.id);
        setUnread(msgs.filter((m) => m.sender === "admin" && !m.read).length);
      });
    load();
    const timer = setInterval(load, 12000);
    return () => clearInterval(timer);
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