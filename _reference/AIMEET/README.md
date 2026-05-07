# `_reference/AIMEET/` — Ghi âm cuộc họp + summary + task extraction

Production: https://aimeet--meet2-afb35.asia-southeast1.hosted.app/

App này là **mẫu chuẩn** cho UAE18 app có:
- Audio input (Web Speech API browser-side, không cần Whisper server-side)
- Long-running transcript (1-3 giờ audio → cần chunking)
- Trích xuất task / action items từ text dài
- Báo cáo dạng DOCX/PDF từ summary

## File quan trọng nhất (đọc trước)

| File | Pattern |
|---|---|
| `ui/Recorder.tsx` | Wrapper `SpeechRecognition` API: track interim/final transcript, handle browser quirks (Chrome vs Safari). KHÔNG dùng Whisper API server-side trừ khi cần độ chính xác cao — tốn $0.006/phút audio. |
| `lib/anthropic.ts` | Anthropic wrapper riêng của AIMEET (so sánh với `lib/claude.ts` của DGDCHP2 và kit base). Lưu ý: kit base đã có wrapper rate-limit + usage_logs đầy đủ hơn → ưu tiên dùng kit base. |
| `lib/docx.ts` | Sinh meeting report DOCX từ transcript + tasks. Chú ý cách render bảng tasks (status + assignee + due date). |
| `lib/pdf.ts` | PDF report tương đương — pattern font Vietnamese giống DGDCHP2. |
| `lib/types.ts` | `MeetingDoc`, `TaskDoc`, `ReportDoc` — domain model rõ ràng, đáng tham khảo cho cách design schema Firestore. |

## Route handlers

| File | Pattern |
|---|---|
| `api/transcribe.route.ts` | Endpoint nhận transcript text từ client (Web Speech đã chạy ở browser), không stream audio thật. Đơn giản nhưng quan trọng — đừng overengineer. |
| `api/meetings.route.ts` | CRUD meeting cơ bản, ownerId scoped — copy được nguyên cho app khác. |
| `api/tasks.route.ts` | Pattern "Claude trích task từ transcript" — system prompt yêu cầu output JSON `{ tasks: [{ title, owner, due }] }`, parse qua `extractJson`. |
| `api/reports.route.ts` | Generate report = summary + tasks + key decisions. Long-running, có pattern cập nhật progress vào Firestore. |
| `api/reports-download.route.ts` | Stream DOCX/PDF qua `NextResponse(buf, { headers })`. Set `Content-Disposition: attachment; filename=...`. |

## UI patterns

| File | Pattern |
|---|---|
| `ui/Recorder.tsx` | State machine: idle → recording → paused → stopped. Hiển thị thời lượng + waveform animation. |
| `ui/TaskItem.tsx` | List task có thể edit inline. Optimistic update Firestore (set local state trước khi await). |

## Gotcha cụ thể đã từng dính

1. **Web Speech API không có ở Firefox / Safari iOS**. AIMEET hiện chỉ
   support Chromium-based. Nếu app mới cần cross-browser, fallback sang
   upload audio file rồi Whisper server-side.
2. **SpeechRecognition.continuous = true** vẫn tự ngắt sau ~30s im lặng.
   Phải watchdog rồi `start()` lại — `Recorder.tsx` có pattern này.
3. **Transcript dài > 100K chars** vượt context Sonnet một call. Phải
   chunk theo segment 5-10 phút (timestamps có sẵn trong Web Speech result).
   Aggregate gửi summary thay vì raw text.
4. **Task extraction prompt** dễ trả false positive (mọi câu mệnh lệnh đều
   thành task). AIMEET dùng few-shot example trong system prompt. Xem
   `api/tasks.route.ts`.

## Khi build app tương tự, đừng làm gì

- Đừng stream audio thẳng từ browser lên server — tốn băng thông + cost.
  Dùng Web Speech API browser-side, server chỉ nhận text.
- Đừng lưu raw audio vào Firebase Storage trừ khi user yêu cầu (privacy).
- Đừng gửi nguyên transcript 50K từ vào Claude một lần — chunk + summarize.
