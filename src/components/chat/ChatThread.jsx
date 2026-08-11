import React, { useEffect, useRef, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Paperclip, Send, X, FileText } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Image } from "@/components/ui/image";
import { format } from "date-fns";

const isImage = (url) => /\.(png|jpe?g|gif|webp|bmp|svg)(\?|$)/i.test(url || "");

export default function ChatThread({ messages, myRole, onSend, sending, headerLabel }) {
  const [text, setText] = useState("");
  const [file, setFile] = useState(null);
  const scrollRef = useRef(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages?.length, sending]);

  const submit = async (e) => {
    e?.preventDefault();
    if ((!text.trim() && !file) || sending) return;
    await onSend(text.trim(), file);
    setText("");
    setFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const onPick = async (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file: f });
      setFile({ file_url, file_name: f.name });
    } catch (_) {
      /* ignore — parent toasts on send */
    }
  };

  return (
    <div className="flex flex-col h-full">
      {headerLabel && (
        <div className="px-4 py-3 border-b border-border bg-card/60">
          <p className="font-medium text-foreground">{headerLabel}</p>
        </div>
      )}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-5 space-y-3">
        {(!messages || messages.length === 0) && (
          <p className="text-center text-sm text-muted-foreground py-12">No messages yet. Start the conversation.</p>
        )}
        {(messages || []).map((m) => {
          const mine = m.sender === myRole;
          return (
            <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[80%] rounded-2xl px-3.5 py-2.5 text-sm ${mine ? "bg-[#1E6FE8] text-white rounded-br-md" : "bg-muted text-foreground rounded-bl-md"}`}>
                {m.message && <p className="whitespace-pre-wrap break-words">{m.message}</p>}
                {m.file_url && (
                  isImage(m.file_url) ? (
                    <a href={m.file_url} target="_blank" rel="noreferrer" className="block mt-2">
                      <Image src={m.file_url} alt={m.file_name || "attachment"} fittingType="fit" className="rounded-lg max-h-48 w-auto" />
                    </a>
                  ) : (
                    <a href={m.file_url} target="_blank" rel="noreferrer" className={`inline-flex items-center gap-2 mt-2 text-xs underline ${mine ? "text-white/90" : "text-primary"}`}>
                      <FileText className="w-4 h-4" /> {m.file_name || "Download file"}
                    </a>
                  )
                )}
                <p className={`text-[10px] mt-1 ${mine ? "text-white/70" : "text-muted-foreground"}`}>
                  {m.created_date ? format(new Date(m.created_date), "MMM d, HH:mm") : ""}
                </p>
              </div>
            </div>
          );
        })}
      </div>
      <form onSubmit={submit} className="border-t border-border bg-card p-3">
        {file && (
          <div className="flex items-center gap-2 mb-2 rounded-lg bg-muted px-3 py-2 text-xs">
            <Paperclip className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="truncate flex-1">{file.file_name}</span>
            <button type="button" onClick={() => { setFile(null); if (fileInputRef.current) fileInputRef.current.value = ""; }}>
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => fileInputRef.current?.click()} className="inline-flex items-center justify-center w-9 h-9 rounded-md border border-input hover:bg-accent shrink-0" aria-label="Attach file">
            <Paperclip className="w-4 h-4" />
          </button>
          <input ref={fileInputRef} type="file" className="hidden" onChange={onPick} />
          <Input value={text} onChange={(e) => setText(e.target.value)} placeholder="Type a message…" className="flex-1" />
          <Button type="submit" disabled={sending || (!text.trim() && !file)} className="shrink-0">
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </form>
    </div>
  );
}