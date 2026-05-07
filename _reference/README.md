# `_reference/` — Code mẫu offline từ các app UAE18 đã chạy production

Khác với `_uae18-starter-kit` v1, kit này mang theo **code thật** copy từ
DGDCHP2, AIMEET, CBTS để Claude có context ngay trong repo, không cần truy
cập folder ngoài. Khi anh push template lên GitHub repo trống, claude.ai/code
đọc được hết các pattern này khi mở session.

> **Folder này không ra production**: được loại trừ trong `tsconfig.json`
> (build), `.eslintignore` (lint), và `.dockerignore` (Docker image). Chỉ
> tồn tại để Claude và developer đọc.

> **Đừng sửa file gốc trong `_reference/`** — coi như read-only snapshot.
> Nếu cần điều chỉnh pattern, làm trong `src/` rồi để pattern thực tế
> tự thay thế.

---

## Bản đồ nhanh

| Folder | App | Pattern lõi | Khi nào đọc |
|---|---|---|---|
| `DGDCHP2/` | Đánh giá đề cương học phần | Parse DOCX/PDF → Claude evaluate parallel groups → export DOCX/PDF | App có user upload tài liệu rồi yêu cầu đánh giá / chấm điểm |
| `AIMEET/`  | Ghi âm cuộc họp + summary | Web Speech API browser-side STT, chunked transcript, task extraction | App liên quan đến audio, transcript dài, hoặc trích xuất action items từ text dài |
| `CBTS/`    | Chatbot tuyển sinh (RAG) | Streaming chat, knowledge base + semantic retrieval, FAQ admin UI | App chatbot, FAQ, bất kỳ flow conversational + retrieval |

Production URLs (chỉ để tham khảo, KHÔNG copy domain vào code app mới):
- DGDCHP2: https://dgdchp2--dgdchp2.asia-southeast1.hosted.app/
- AIMEET:  https://aimeet--meet2-afb35.asia-southeast1.hosted.app/
- CBTS:    https://cbts--cbts-e6b0e.asia-southeast1.hosted.app/

---

## Cấu trúc mỗi sub-folder

```
DGDCHP2/
├── README.md              ← ghi chú: pattern nào đáng đọc, gotcha cụ thể
├── lib/                   ← server-side helpers
│   ├── parseFile.ts
│   ├── exporters.ts
│   ├── claude.ts
│   ├── evaluator.ts
│   └── criteria.ts
├── api/                   ← route handlers
│   ├── evaluate.route.ts
│   ├── upload.route.ts
│   ├── export.route.ts
│   └── revise.route.ts
├── Dockerfile             ← multi-stage build + ttf-dejavu cho tiếng Việt
└── apphosting.yaml        ← Secret Manager + runConfig mẫu
```

`AIMEET/` và `CBTS/` cũng tương tự (xem README riêng trong từng folder).

---

## Quy trình dùng `_reference/`

1. Đọc `CLAUDE.md` ở root — biết app đang build có pattern gần với app nào
   trong bảng trên.
2. Mở `_reference/<APP>/README.md` để biết file nào đáng đọc TRƯỚC.
3. Đọc file mẫu, **hiểu lý do từng quyết định** (pattern `require('pdf-parse/lib/...')`,
   tại sao có Dockerfile + DejaVu font, tại sao validate input ≥50 chars trước
   call Claude, v.v.).
4. Copy đoạn cần thiết sang `src/` của app đang build, **adapt** theo domain
   hiện tại — không paste nguyên xi.
5. Nếu pattern cần cập nhật chung cho cả ecosystem, làm trong app mới rồi
   thông báo maintainer template để họ copy ngược về kit.

---

## Anti-pattern đã thực gặp khi dùng `_reference/`

- **Copy nguyên file `apphosting.yaml`** từ DGDCHP2 mà không đổi project ID
  → backend build thành công nhưng deploy về sai project. Luôn diff lại
  trước khi commit.
- **Copy nguyên `claude.ts` cũ** từ DGDCHP2 (model `claude-opus-4-7`) trong
  app mới → tốn token gấp 3-5x mà không đáng. Kit `src/lib/claude.ts` đã
  set default `claude-sonnet-4-6` — tham khảo `_reference/` để hiểu pattern,
  không để override default.
- **Để `_reference/` trong build production** vì quên cập nhật
  `tsconfig.json` exclude. Kit này đã exclude sẵn — KHÔNG xoá rule đó.
