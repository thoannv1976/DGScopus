"use client";

import { useEffect, useRef, useState } from "react";
import { Send, Bot, User as UserIcon, Loader2, Sparkles, RotateCcw } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { ChatMessage } from "@/lib/types";
import { v4 as uuid } from "uuid";

const STARTERS = [
  "Trường có những ngành nào? Học phí mỗi ngành ra sao?",
  "Phương thức xét tuyển năm nay gồm những gì?",
  "Điểm chuẩn năm ngoái của ngành Công nghệ thông tin?",
  "Có học bổng nào cho thí sinh đầu vào không?",
];

export function ChatWidget() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome",
      role: "assistant",
      createdAt: Date.now(),
      content:
        "Xin chào! Mình là **trợ lý tuyển sinh AI** của trường. Bạn có thể hỏi về ngành học, học phí, phương thức xét tuyển, điểm chuẩn, học bổng… Mình sẽ trả lời dựa trên kho tri thức chính thức của nhà trường.",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string>(() => uuid());
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  async function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || loading) return;
    const userMsg: ChatMessage = { id: uuid(), role: "user", content: trimmed, createdAt: Date.now() };
    const next = [...messages, userMsg];
    setMessages(next);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversationId,
          messages: next.filter((m) => m.id !== "welcome").map(({ role, content }) => ({ role, content })),
        }),
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setMessages((m) => [
        ...m,
        {
          id: uuid(),
          role: "assistant",
          content: data.reply || "Xin lỗi, mình chưa tìm được câu trả lời phù hợp.",
          createdAt: Date.now(),
          sources: data.sources,
        },
      ]);
    } catch (err) {
      setMessages((m) => [
        ...m,
        {
          id: uuid(),
          role: "assistant",
          content: "⚠️ Đã có lỗi xảy ra khi kết nối tới máy chủ. Bạn vui lòng thử lại sau ít phút.",
          createdAt: Date.now(),
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  function reset() {
    setMessages([messages[0]!]);
    setConversationId(uuid());
  }

  return (
    <div className="flex flex-col h-[640px] max-h-[80vh] rounded-2xl bg-white border border-slate-200 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 bg-gradient-to-r from-brand-50 to-purple-50">
        <div className="flex items-center gap-3">
          <div className="size-9 rounded-xl bg-gradient-to-br from-brand-600 to-purple-500 grid place-items-center shadow-md">
            <Bot className="size-5 text-white" />
          </div>
          <div>
            <div className="font-semibold text-slate-800 flex items-center gap-2">
              Trợ lý tuyển sinh
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded">
                <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse-soft" /> Online
              </span>
            </div>
            <div className="text-xs text-slate-500">Powered by Claude AI</div>
          </div>
        </div>
        <button onClick={reset} title="Bắt đầu cuộc hội thoại mới" className="btn-ghost text-xs">
          <RotateCcw className="size-4" />
        </button>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-5 space-y-4 bg-gradient-to-b from-white to-slate-50">
        {messages.map((m) => (
          <Bubble key={m.id} message={m} />
        ))}

        {loading && (
          <div className="flex items-start gap-2">
            <div className="size-8 rounded-full bg-brand-100 grid place-items-center shrink-0">
              <Bot className="size-4 text-brand-700" />
            </div>
            <div className="rounded-2xl rounded-tl-sm bg-white border border-slate-200 px-4 py-3 text-slate-500 flex items-center gap-2 text-sm">
              <Loader2 className="size-4 animate-spin" /> Đang suy nghĩ…
            </div>
          </div>
        )}

        {messages.length <= 1 && !loading && (
          <div className="pt-2">
            <div className="text-xs text-slate-500 mb-2 flex items-center gap-1.5">
              <Sparkles className="size-3.5" /> Gợi ý câu hỏi
            </div>
            <div className="flex flex-wrap gap-2">
              {STARTERS.map((s) => (
                <button
                  key={s}
                  onClick={() => send(s)}
                  className="text-left text-sm px-3 py-2 rounded-xl bg-white border border-slate-200 hover:border-brand-300 hover:bg-brand-50 transition"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
        className="border-t border-slate-100 p-3 bg-white flex gap-2"
      >
        <input
          autoFocus
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Nhập câu hỏi của bạn về tuyển sinh…"
          className="input"
          disabled={loading}
        />
        <button type="submit" className="btn-primary" disabled={loading || !input.trim()}>
          <Send className="size-4" />
        </button>
      </form>
    </div>
  );
}

function Bubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user";
  return (
    <div className={`flex items-start gap-2 ${isUser ? "flex-row-reverse" : ""}`}>
      <div
        className={`size-8 rounded-full grid place-items-center shrink-0 ${
          isUser ? "bg-brand-600 text-white" : "bg-brand-100 text-brand-700"
        }`}
      >
        {isUser ? <UserIcon className="size-4" /> : <Bot className="size-4" />}
      </div>
      <div
        className={`max-w-[82%] rounded-2xl px-4 py-3 text-sm leading-relaxed prose-chat ${
          isUser
            ? "bg-brand-600 text-white rounded-tr-sm"
            : "bg-white border border-slate-200 text-slate-800 rounded-tl-sm shadow-sm"
        }`}
      >
        {isUser ? (
          <div>{message.content}</div>
        ) : (
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.content}</ReactMarkdown>
        )}
        {message.sources && message.sources.length > 0 && (
          <div className="mt-2 pt-2 border-t border-slate-100 text-[11px] text-slate-500">
            Nguồn tham khảo: {message.sources.slice(0, 3).join(" • ")}
          </div>
        )}
      </div>
    </div>
  );
}
