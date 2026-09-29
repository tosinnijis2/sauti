"use client";
import { useCallback, useEffect, useState } from "react";
import { Send } from "lucide-react";
import { blockUser, reportMessage } from "@/app/actions/chat";
type ChatMessage = { id: string; body: string; authorId: string; author: { name: string }; createdAt: string };
export function ChatPanel({ userId, conversationId, country }: { userId: string; conversationId?: string; country?: string }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [body, setBody] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [older, setOlder] = useState(false);
  const query = new URLSearchParams(conversationId ? { conversationId } : { country: country! }).toString();
  const refresh = useCallback(async () => {
    try {
      const response = await fetch("/api/chat?" + query, { cache: "no-store" });
      if (!response.ok) throw new Error("Messages unavailable. Refresh or sign in again.");
      const data = await response.json();
      setMessages(current => {
        const boundary = data.messages[0]?.createdAt;
        return [...(boundary && data.messages.length === 50 ? current.filter(m => m.createdAt < boundary) : []), ...data.messages];
      });
    } catch (e) { setError(e instanceof Error ? e.message : "Connection lost."); }
  }, [query]);
  useEffect(() => {
    const first = setTimeout(() => void refresh(), 0);
    const interval = setInterval(() => { if (document.visibilityState === "visible") void refresh(); }, 5000);
    return () => { clearTimeout(first); clearInterval(interval); };
  }, [refresh]);
  async function loadOlder() {
    setOlder(true);
    try {
      const response = await fetch("/api/chat?" + query + "&before=" + encodeURIComponent(messages[0].createdAt));
      if (!response.ok) throw new Error("Could not load older messages.");
      const data = await response.json();
      setMessages(current => [...data.messages, ...current]);
      if (!data.messages.length) setError("No older messages.");
    } catch { setError("Could not load older messages."); }
    finally { setOlder(false); }
  }
  return <section className="mt-6 min-w-0 border-y border-[#eadfdf]">
    {error && <p role="alert" className="my-3 text-sm text-red-700">{error}</p>}
    <div className="max-h-[55vh] min-h-48 space-y-4 overflow-y-auto py-5" aria-label="Messages">
      {messages.length >= 50 && <button disabled={older} onClick={loadOlder} className="underline">Load older messages</button>}
      {!messages.length && <p className="text-[#6f626b]">No messages yet.</p>}
      {messages.map(message => <article key={message.id} className={"max-w-[90%] rounded-lg p-3 " + (message.authorId === userId ? "ml-auto bg-[#ffe0df]" : "bg-white border border-[#eadfdf]")}>
        <div className="flex flex-wrap justify-between gap-2 text-xs text-[#6f626b]"><strong>{message.authorId === userId ? "You" : message.author.name}</strong><time dateTime={message.createdAt}>{new Date(message.createdAt).toLocaleString()}</time></div>
        <p className="mt-2 whitespace-pre-wrap break-words [overflow-wrap:anywhere]">{message.body}</p>
        {message.authorId !== userId && <details className="mt-2 text-xs"><summary className="cursor-pointer">Report or block</summary>
          <form action={reportMessage} className="mt-2 grid gap-2">
            <input type="hidden" name="messageId" value={message.id} />
            <label className="grid gap-1">Reason<input required minLength={3} maxLength={500} name="reason" className="rounded border p-2" /></label>
            <button className="p-2 text-left underline">Report message</button>
          </form>
          <form action={blockUser}><input type="hidden" name="userId" value={message.authorId} /><button className="p-2 text-red-700 underline">Block user</button></form>
        </details>}
      </article>)}
    </div>
    <form className="flex items-end gap-2 border-t border-[#eadfdf] py-4" onSubmit={async e => {
      e.preventDefault(); setPending(true); setError("");
      try {
        const response = await fetch("/api/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ conversationId, country, body }) });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error);
        setBody(""); await refresh();
      } catch (e) { setError(e instanceof Error ? e.message : "Could not send."); }
      finally { setPending(false); }
    }}>
      <label className="grid min-w-0 flex-1 gap-1 text-sm">Message<textarea value={body} onChange={e => setBody(e.target.value)} maxLength={2000} required rows={2} className="w-full rounded-lg border bg-white p-3" /></label>
      <button disabled={pending || !body.trim()} aria-label="Send message" title="Send message" className="grid size-12 shrink-0 place-items-center rounded-lg bg-[#20141d] text-white disabled:opacity-40"><Send size={20} /></button>
    </form>
  </section>;
}
