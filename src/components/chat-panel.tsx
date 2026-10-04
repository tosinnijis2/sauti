"use client";
import { useCallback, useEffect, useState } from "react";
import { Send } from "lucide-react";
import { blockUser } from "@/app/actions/chat";
import { Avatar } from "./avatar";
import { SafetyReportForm } from "./safety-report-form";
type ChatMessage = { id: string; body: string; authorId: string; author: { name: string; imageUrl?: string | null }; createdAt: string };
export function ChatPanel({ userId, conversationId, country, disabled = false }: { userId: string; conversationId?: string; country?: string; disabled?: boolean }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [body, setBody] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [older, setOlder] = useState(false);
  const [loading, setLoading] = useState(true);
  const [nextCursor, setNextCursor] = useState<string | null | undefined>(undefined);
  const [clientMessageId, setClientMessageId] = useState("");
  const query = new URLSearchParams(conversationId ? { conversationId } : { country: country! }).toString();
  const refresh = useCallback(async () => {
    try {
      const response = await fetch("/api/chat?" + query, { cache: "no-store" });
      if (!response.ok) throw new Error("Messages unavailable. Refresh or sign in again.");
      const data = await response.json();
      setMessages(current => [...new Map([...current, ...data.messages].map(message => [message.id, message])).values()].sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id)));
      setNextCursor(current => current === undefined ? data.nextCursor : current);
    } catch (e) { setError(e instanceof Error ? e.message : "Connection lost."); }
    finally { setLoading(false); }
  }, [query]);
  useEffect(() => {
    const first = setTimeout(() => void refresh(), 0);
    const interval = setInterval(() => { if (document.visibilityState === "visible") void refresh(); }, 5000);
    return () => { clearTimeout(first); clearInterval(interval); };
  }, [refresh]);
  async function loadOlder() {
    setOlder(true);
    try {
      const response = await fetch("/api/chat?" + query + "&before=" + encodeURIComponent(nextCursor!));
      if (!response.ok) throw new Error("Could not load older messages.");
      const data = await response.json();
      setMessages(current => [...data.messages, ...current]);
      setNextCursor(data.nextCursor);
    } catch { setError("Could not load older messages."); }
    finally { setOlder(false); }
  }
  return <section id="messages" className="mt-6 min-w-0 scroll-mt-24 border-y border-[#eadfdf]">
    {error && <p role="alert" className="my-3 text-sm text-red-700">{error}</p>}
    <div className="max-h-[55vh] min-h-48 space-y-4 overflow-y-auto py-5" aria-label="Messages">
      {nextCursor && <button disabled={older} onClick={loadOlder} className="underline">{older ? "Loading…" : "Load older messages"}</button>}
      {loading && !messages.length && <p className="text-[#6f626b]">Loading messages…</p>}
      {!loading && !messages.length && <p className="text-[#6f626b]">No messages yet. Start the conversation below.</p>}
      {messages.map(message => <article key={message.id} className={"max-w-[90%] rounded-lg p-3 " + (message.authorId === userId ? "ml-auto bg-[#ffe0df]" : "bg-white border border-[#eadfdf]")}>
        <div className="flex items-center gap-2"><Avatar name={message.author.name} imageUrl={message.author.imageUrl} size="sm" /><div className="flex min-w-0 flex-1 flex-wrap justify-between gap-2 text-xs text-[#6f626b]"><strong>{message.authorId === userId ? "You" : message.author.name}</strong><time dateTime={message.createdAt}>{new Date(message.createdAt).toLocaleString()}</time></div></div>
        <p className="mt-2 whitespace-pre-wrap break-words [overflow-wrap:anywhere]">{message.body}</p>
        {message.authorId !== userId && <details className="mt-2 text-xs"><summary className="cursor-pointer">Report or block</summary>
          <div className="mt-2"><SafetyReportForm targetType="MESSAGE" targetId={message.id} returnTo={conversationId ? `/messages/${conversationId}` : `/messages/rooms?country=${country}`} label="Report message" /></div>
          <form action={blockUser}><input type="hidden" name="userId" value={message.authorId} /><button className="p-2 text-red-700 underline">Block user</button></form>
        </details>}
      </article>)}
    </div>
    {!disabled && <form className="sticky bottom-20 z-10 flex items-end gap-2 border-t border-[#eadfdf] bg-[#fffaf8] py-4 md:bottom-0" onSubmit={async e => {
      e.preventDefault(); setPending(true); setError("");
      try {
        const requestId = clientMessageId || crypto.randomUUID();
        if (!clientMessageId) setClientMessageId(requestId);
        const response = await fetch("/api/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ conversationId, country, body, clientMessageId: requestId }) });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error);
        setBody(""); setClientMessageId(""); await refresh();
      } catch (e) { setError(e instanceof Error ? e.message : "Could not send."); }
      finally { setPending(false); }
    }}>
      <label className="grid min-w-0 flex-1 gap-1 text-sm">Message<textarea value={body} onChange={e => { setBody(e.target.value); setClientMessageId(""); }} maxLength={2000} required rows={2} className="w-full rounded-lg border bg-white p-3" /></label>
      <button disabled={pending || !body.trim()} aria-label="Send message" title="Send message" className="grid size-12 shrink-0 place-items-center rounded-lg bg-[#20141d] text-white disabled:opacity-40"><Send size={20} /></button>
    </form>}
    {disabled && <p className="border-t border-[#eadfdf] py-4 text-sm text-[#6f626b]">Messaging is unavailable for this conversation.</p>}
  </section>;
}
