# `_reference/DGDCHP2/` — Đánh giá đề cương học phần

Production: https://dgdchp2--dgdchp2.asia-southeast1.hosted.app/

App này là **mẫu chuẩn nhất** cho các app UAE18 có flow:

1. User upload tài liệu (DOCX/PDF) hoặc paste text.
2. Server parse → gửi Claude → nhận điểm + nhận xét theo rubric.
3. Hiển thị dashboard kết quả + cho phép user chỉnh sửa AI lần nữa.
4. Xuất kết quả ra DOCX hoặc PDF.

Đọc theo thứ tự sau khi sang app mới có pattern tương tự:

## File quan trọng nhất (đọc trước)

| File | Pattern |
|---|---|
| `lib/parseFile.ts` | DOCX qua `mammoth`, PDF qua `require('pdf-parse/lib/pdf-parse.js')`. Đừng `import 'pdf-parse'` — `index.js` của package có side effect chạy test mode. Lỗi này từng khiến cả production crash. |
| `lib/exporters.ts` | PDFkit + DejaVu font cho tiếng Việt. Built-in fonts của pdfkit chỉ Latin-1, sẽ rỗng / box ô vuông với diacritics. Pair với Dockerfile `apk add ttf-dejavu`. |
| `lib/evaluator.ts` | Pattern chia rubric thành nhiều "group" rồi `Promise.all` gọi Claude song song. Mỗi group là một prompt riêng. Aggregate trả về điểm TB. |
| `lib/claude.ts` | `describeClaudeError` — translate lỗi Anthropic SDK sang message tiếng Việt. `extractJson` — parse JSON tolerant với `\`\`\`json` fence và prose xung quanh. |
| `lib/criteria.ts` | Rubric như **data structure** thuần (mảng object), không nhúng vào prompt template. Cho phép thay đổi rubric không đụng prompt. |

## Route handlers

| File | Pattern |
|---|---|
| `api/evaluate.route.ts` | `runtime: 'nodejs'`, `dynamic: 'force-dynamic'`, `maxDuration: 300`. Wrap mọi error qua `describeClaudeError`. |
| `api/upload.route.ts` | `formData()` parse file, `Buffer.from(arrayBuffer())`, gọi `parseUploadedFile`. Đơn giản nhưng cần — đừng nhận file binary qua JSON body. |
| `api/export.route.ts` | Query param `format=docx\|pdf`, set `Content-Disposition`, return `Buffer` qua `NextResponse(buf, { headers })`. |
| `api/revise.route.ts` | Pattern "AI revise lần 2" — gửi đánh giá + đề cương gốc + user instructions tuỳ chọn → Claude trả `{ revised, changeLog }`. |

## Deployment artefacts

| File | Pattern |
|---|---|
| `Dockerfile` | Multi-stage `deps → builder → runner`. Runner Alpine có `apk add ttf-dejavu`. **Quan trọng**: `COPY --from=builder /app/public ./public` — phải có `public/` từ commit đầu, nếu không Docker fail. |
| `apphosting.yaml` | Mọi secret qua `secret:`, chỉ config public dùng `value:`. **Lưu ý**: file này ID `dgdchp2` cụ thể — đổi khi copy sang app mới. |

## Gotcha cụ thể đã từng dính

1. **`pdf-parse` import** — phải `require('pdf-parse/lib/pdf-parse.js')`,
   không `import 'pdf-parse'`. Lỗi này không reproduce trên dev local Mac
   nhưng crash 100% trên production Alpine.
2. **PDF tiếng Việt rỗng** — quên `apk add ttf-dejavu` trong Dockerfile,
   PDF xuất ra văn bản tiếng Anh OK nhưng tiếng Việt thành ô vuông. Phải
   register font: `doc.registerFont('Body', '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf')`.
3. **Token max_tokens cắt giữa JSON** — `evaluator.ts` check
   `resp.stop_reason === 'max_tokens'` rồi throw. Nếu không, `extractJson`
   sẽ throw "Unbalanced JSON" và user thấy error mơ hồ.
4. **Force-dynamic** — `dynamic = 'force-dynamic'` cho mọi route + page có
   gọi Firebase admin. Quên thì Next 14 build cố static rendering, fail
   tại build time.

## Khi build app tương tự, đừng làm gì

- Đừng dùng client SDK để upload Firestore — luôn qua server (admin SDK
  bypass rules + atomic write).
- Đừng wrap `messages.create` thẳng trong route handler — luôn qua
  `lib/claude.ts` để có error mapping + retry.
- Đừng tạo prompt mới inline trong route handler — tách ra `lib/prompts/`
  riêng (chưa có trong DGDCHP2 v1, nhưng kit base đã set sẵn folder).
