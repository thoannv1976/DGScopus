# `_reference/CBTS/` — Chatbot tuyển sinh với RAG

Production: https://cbts--cbts-e6b0e.asia-southeast1.hosted.app/

App này là **mẫu chuẩn** cho UAE18 app có:
- Chat conversational UI streaming (giống ChatGPT, không request/response)
- Knowledge base có cấu trúc + semantic search (RAG pattern)
- Admin UI để upsert knowledge / FAQ
- Auto-generate FAQ từ conversation history

## File quan trọng nhất (đọc trước)

| File | Pattern |
|---|---|
| `api/chat.route.ts` | Streaming chat handler. Lấy user message → retrieve knowledge → build context prompt → `claude.messages.stream()` → forward chunks về client qua SSE / `ReadableStream`. Đây là pattern **streaming Claude → client** đáng đọc nhất. |
| `lib/knowledge.ts` | Pattern RAG đơn giản: full-text search Firestore (không dùng vector DB cho budget tiết kiệm), top-K results, normalize relevance score. Adequate cho knowledge base < 1000 entries. |
| `lib/claude.ts` | Wrapper Claude với system prompt template cho chatbot mode. Khác `lib/claude.ts` ở DGDCHP2 (evaluation mode) ở chỗ giữ history + nhiều turns. |
| `ui/ChatWidget.tsx` | UI chat streaming: handle SSE/`ReadableStream` chunks, render markdown progressively, scroll-to-bottom on new message. Chú ý cleanup AbortController khi unmount. |
| `ui/AuthProvider.tsx` | Pattern Provider context cho auth state phía client (khác kit base — kit base lấy từ server cookie). Dùng khi cần realtime sync user state. |

## Route handlers

| File | Pattern |
|---|---|
| `api/chat.route.ts` | Streaming. Dùng `ReadableStream` + `TransformStream` để forward Claude output. |
| `api/generate-faqs.route.ts` | Cron-style endpoint: lấy N conversation gần nhất → cluster theo topic → Claude tổng hợp thành FAQ entry. Pattern cho mọi loại "batch summary". |
| `api/knowledge.route.ts` | CRUD knowledge entries với search index update. |

## Gotcha cụ thể đã từng dính

1. **Streaming response qua App Hosting** — Cloud Run buffers nếu không
   set `Content-Type: text/event-stream` + `Cache-Control: no-cache, no-transform`.
   Forget = client thấy response một cục cuối cùng.
2. **AbortController không cleanup** khi user navigate đi giữa chừng →
   server vẫn tiêu token đến hết. `ChatWidget.tsx` có pattern abort khi
   unmount.
3. **Knowledge full-text search Firestore** không phân biệt dấu tiếng Việt
   (Firestore không có collation tiếng Việt). CBTS chuẩn hoá `lowercase
   + remove diacritics` cả input và stored field. Index riêng cho field
   normalized.
4. **Cost RAG dễ bùng** nếu top-K quá lớn → mỗi turn gửi 5K-10K tokens
   knowledge context. CBTS giới hạn top-3 + max 500 tokens / entry.

## Khi build app tương tự, đừng làm gì

- Đừng dùng vector DB ngoài (Pinecone, Weaviate...) cho knowledge base
  < 1000 entries. Firestore + tiêu chí relevance đơn giản đã đủ.
- Đừng giữ message history client-only (re-fetch từ Firestore mỗi turn).
  Không scale, không có cross-device. CBTS lưu conversation Firestore.
- Đừng cho user (anonymous) gọi Claude qua chat — luôn yêu cầu auth, ngay
  cả với chatbot public, để rate-limit theo `userId`. CBTS có cơ chế
  anonymous Auth, vẫn tạo `userId` Firebase.
