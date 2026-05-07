# [TEN-APP-O-DAY]

> [Mô tả 1-2 câu về app này: làm cho ai, giải quyết vấn đề gì.]

Thành viên hệ sinh thái **UAE18** (University AI Ecosystem). Stack chuẩn:
Next.js 14 + Firebase (Auth/Firestore/Storage/App Hosting) + Anthropic
Claude API.

## Production

- URL: `https://[ten-app]--[project-id].asia-southeast1.hosted.app/`
- Region: `asia-southeast1`
- Backend App Hosting: `[ten-backend]`
- Firebase project: `[project-id]`

## Local development

```bash
git clone https://github.com/[org]/[ten-repo].git
cd [ten-repo]
cp .env.example .env.local        # rồi điền giá trị thật
npm install
npm run dev                       # http://localhost:3000
```

Lần đầu setup từ đầu (Firebase project mới, secrets, App Hosting backend...)
xem `docs/SETUP.md`.

## Scripts

| Lệnh | Việc làm |
|---|---|
| `npm run dev` | Next dev server |
| `npm run build` | Build production (standalone) |
| `npm start` | Start server đã build (prod) |
| `npm run typecheck` | `tsc --noEmit` toàn repo |
| `npm run lint` | ESLint |

## Cấu trúc

```
src/
├── app/             Next App Router (layout, pages, API routes)
├── components/      React components reusable (shadcn/ui style)
└── lib/             Server logic — Firebase admin, Claude, auth, types
```

Xem chi tiết pattern và quy ước trong **`CLAUDE.md`** (file CRITICAL —
mọi ai làm việc với Claude trên repo này phải đọc trước).

## Bảo mật

- Mọi credential qua **Secret Manager** (xem `apphosting.yaml`).
- `firestore.rules` deny by default + `ownerId` pattern.
- Mọi route gọi Claude phải qua `requireAuth()` + rate limit
  (xem `src/lib/auth.ts`, `src/lib/claude.ts`).
- `usage_logs/` chỉ ghi metadata (token, latency, cost), **không** ghi
  nội dung user upload.

## License

[Internal — UAE18 ecosystem]
