# [TEN-APP-O-DAY] — Claude operating manual

> File này là tham chiếu mặc định cho mọi phiên Claude làm việc trên repo. Đọc
> hết trước khi viết dòng code đầu tiên. Nếu nội dung mâu thuẫn với prompt
> tức thời của user, hỏi lại trước khi tiến hành.

---

## 0. Mỗi session bắt buộc làm theo thứ tự này

1. Mở **CLAUDE.md** (file này) đọc hết, đặc biệt mục "Project-specific
   configuration" cuối file.
2. Mở **`_reference/README.md`** → bản đồ 3 app mẫu (DGDCHP2, AIMEET, CBTS).
   Code mẫu **đã ở ngay trong repo** dưới `_reference/<APP>/lib/`,
   `_reference/<APP>/api/`, `_reference/<APP>/ui/` — không cần đi ra
   `C:\dev\templates\<APP>/`. Chọn app gần nhất với app mới đang build
   rồi đọc README trong sub-folder đó để biết file nào cần xem trước.
3. Mở **`docs/SETUP.md`** nếu đây là lần đầu touch repo (kiểm tra Firebase,
   Secret Manager, GitHub đã setup chưa).
4. Liệt kê file đã đọc + đề xuất plan ngắn (5-8 dòng): file structure, route
   chính, Firestore collections, chiến lược xử lý dữ liệu lớn (chunking,
   streaming...). **Không code ở bước này.**
5. Chờ user confirm plan. Sau khi confirm mới scaffold + build feature theo
   thứ tự cam kết, mỗi feature một commit theo chuẩn conventional, dừng để
   user test localhost trước khi sang feature kế tiếp.

---

## 1. Stack bắt buộc (không tự ý đổi)

| Lớp | Lựa chọn | Ghi chú |
|---|---|---|
| Framework | **Next.js 14.2.18** App Router, TypeScript strict, Server Components ưu tiên | Đồng bộ với 18 app trong hệ sinh thái |
| UI | **Tailwind CSS** + **shadcn/ui** (Radix primitives) | Reuse `globals.css` utility classes (`btn-primary`, `card`, `score-pill`...) |
| Backend platform | **Firebase App Hosting**, region **`asia-southeast1`** | Cloud Run dưới mui xe; rollout từ branch `main` |
| Database | **Firestore Native mode**, region `asia-southeast1` | Mọi ghi đi qua Admin SDK |
| Storage | **Firebase Storage**, bucket `<project>.appspot.com` | Path `uploads/{ownerId}/...`, max 50 MB |
| Auth | **Firebase Auth** Google provider + server session cookie | Xem mục 2 |
| AI | **Anthropic Claude** (`@anthropic-ai/sdk`), default `claude-sonnet-4-6` | Server-side ONLY |
| File parsing | **mammoth** (DOCX), **pdf-parse** (PDF) | Server-side, có fallback text |
| Export | **docx** + **pdfkit** | Cần DejaVu font cho tiếng Việt trong PDF |
| Validation | **zod** ở mọi route handler / server action | Không trust input |

Các package KHÔNG dùng: `firebase-functions` (đã chuyển sang App Hosting),
`next-auth` (đã có Firebase Auth), `axios` (dùng `fetch` native).

---

## 2. Auth pattern — Google sign-in + session cookie

Pipeline cố định, đừng tự sáng tạo cách khác:

1. Client (`'use client'`) sign-in với `signInWithPopup(auth, googleProvider)`,
   lấy `idToken` qua `cred.user.getIdToken(true)`.
2. POST `/api/auth/session` với body `{ idToken }`. Route:
   - `zod` validate `idToken` non-empty.
   - `adminAuth.verifyIdToken(idToken, true)` (check revoked).
   - Reject nếu `auth_time` cũ hơn 5 phút.
   - `adminAuth.createSessionCookie(idToken, { expiresIn: 14 days })`.
   - Set cookie tên `__session`: `httpOnly`, `sameSite: 'lax'`, `secure` ở
     production, `path: '/'`, `maxAge: 14 days`.
3. Server components / route handlers dùng `getCurrentUser()` (đọc cookie qua
   `cookies()` từ `next/headers`, verify bằng
   `adminAuth.verifySessionCookie(value, true)`).
4. Sign-out: DELETE `/api/auth/session` (xoá cookie). KHÔNG revoke refresh
   token mặc định để các thiết bị khác giữ session.

Pattern đã chạy production ở DGDCHP2 và textbook-review. Khi touch auth, ưu
tiên đọc `src/lib/auth.ts` + `src/app/api/auth/session/route.ts` của 2 app
đó trước khi sửa.

---

## 3. Claude API pattern — server-side, kiểm soát chi phí

**Quy tắc bất di bất dịch**:
- `ANTHROPIC_API_KEY` chỉ tồn tại server-side (`process.env.ANTHROPIC_API_KEY`).
  KHÔNG bao giờ bundle vào client. Không pass key qua `NEXT_PUBLIC_*`.
- Trước MỖI lần gọi Claude:
  - Validate input length `>= MIN_CONTENT_LENGTH` (50) — input ngắn hơn
    gần như chắc chắn là user gõ nhầm, gọi Claude tốn token vô ích.
  - Check rate limit: query `usage_logs` cho `ownerId`, nếu vượt
    `RATE_LIMIT_PER_HOUR` (5) hoặc `RATE_LIMIT_PER_DAY` (30) → reject 429
    với message tiếng Việt thân thiện.
- Sau MỖI lần gọi (success/error đều log):
  - Insert vào `usage_logs/{auto-id}`: `{ ownerId, route, model, tokensIn,
    tokensOut, costUsd, latencyMs, status, errorCode? }`.
  - **KHÔNG** log nội dung user upload (giáo trình, audio transcript,
    document...). Chỉ log metadata.
- Error handling: wrap mọi call trong helper `describeClaudeError(e)` trả về
  message tiếng Việt cho 401, 404, 429, 5xx, timeout, connection error.
  Không leak raw stack về client.
- Timeout SDK: `timeout: 240_000` ms, `maxRetries: 1`. Cloud Run timeout
  cap ở 540s — để headroom 240s/call cho retries trong cùng 1 request.

`src/lib/claude.ts` đã đóng gói pattern; route handler chỉ gọi
`evaluateXxx(...)` chứ không tự gọi `messages.create` trực tiếp.

---

## 4. Firestore Rules pattern — ownerId === request.auth.uid

Mọi document đều có field `ownerId: string` (UID người tạo). Rules mặc định
deny, mở từng collection theo cùng pattern:

```
function isAuthenticated() { return request.auth != null; }
function isOwner(ownerId)  { return isAuthenticated() && request.auth.uid == ownerId; }

match /[collection]/{docId} {
  allow read:                if isOwner(resource.data.ownerId);
  allow create:              if isAuthenticated() && request.resource.data.ownerId == request.auth.uid;
  allow update, delete:      if isOwner(resource.data.ownerId);
}
```

Server (Admin SDK) bypass rules; client SDK CHỈ dùng cho Auth. Rules này
là **defence-in-depth** — đừng dùng client SDK để write vì kém hiệu quả và
dễ bị racy.

`usage_logs/` là immutable: cho phép `create` nếu `userId === uid`, cấm
`update`/`delete`.

---

## 5. Secret Manager pattern (apphosting.yaml)

**Không bao giờ** dùng `value:` cho credential thật trong `apphosting.yaml`.
Chỉ dùng `value:` cho config public (project ID, model name, region...).
Mọi key, JSON, token đi qua Secret Manager:

```yaml
# OK — credential
- variable: ANTHROPIC_API_KEY
  secret: ANTHROPIC_API_KEY        # tên secret trên Secret Manager
  availability: [RUNTIME]

# OK — config public
- variable: NEXT_PUBLIC_FIREBASE_PROJECT_ID
  value: [TEN-PROJECT-FIREBASE]
  availability: [BUILD, RUNTIME]
```

Tạo secret:
```
firebase apphosting:secrets:set ANTHROPIC_API_KEY
firebase apphosting:secrets:grantaccess ANTHROPIC_API_KEY --backend [TEN-APP-O-DAY]
```

Quên `grantaccess` → build OK nhưng container start fail vì không đọc được
secret.

---

## 6. File parsing pattern — DOCX/PDF + fallback

`src/lib/parseFile.ts` (sẽ thêm khi cần):
- DOCX → `mammoth.extractRawText({ buffer })`.
- PDF → `require('pdf-parse/lib/pdf-parse.js')` (TUYỆT ĐỐI dùng
  `require` form này, không `import 'pdf-parse'`; `index.js` của
  pdf-parse có side effect chạy test mode khi import bình thường, sẽ
  crash production).
- TXT/MD → `buffer.toString('utf8')`.
- Mọi nhánh đều `.trim()` rồi check empty; nếu rỗng → trả message
  "File rỗng hoặc không đọc được, vui lòng paste nội dung trực tiếp" và
  cho user nhập textarea fallback. KHÔNG crash route.

PDF với phông tiếng Việt: nếu xuất ra (pdfkit), nhớ
`apk add ttf-dejavu` trong Dockerfile + đăng ký font qua
`doc.registerFont('Body', '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf')`.

---

## 7. Long-running tasks pattern

Khi tổng thời gian > 10 giây (đánh giá giáo trình dài, tổng hợp transcript
nhiều giờ...):

1. Tách thành sub-task có thể chạy song song (chunk theo chương / theo
   cụm 5 phút audio...). Ghi mỗi sub-task thành 1 document trong Firestore
   (`chunks/`, `segments/`...) **trước khi** kick off Claude calls — giúp
   resume sau lỗi.
2. Cap concurrency 3 với `p-limit` để né rate-limit Anthropic.
3. Stream progress về client qua SSE: `event: chunk`, `event: done`,
   `event: error`. Client hiển thị progress bar by id, không spinner mù.
4. Aggregate call cuối CHỈ dùng summary + scores từ các chunk, **không**
   gửi lại raw text — vừa tiết kiệm token vừa tránh vượt context window.
5. App Hosting timeout cứng 540s (`timeoutSeconds: 540` trong
   `apphosting.yaml`); SDK Anthropic 240s/call → tổng cùng 1 HTTP request
   không vượt được 540s. Nếu task lâu hơn, dùng
   "trigger background job + polling status" pattern thay vì giữ HTTP request.

---

## 8. Anti-patterns — 8 lỗi đã thực sự gặp ở UAE18

Đừng lặp lại:

1. **Thiếu `public/` folder** → Docker COPY fail ở `COPY --from=builder
   /app/public ./public`. **Luôn** tạo `public/.gitkeep` từ commit đầu.
2. **`empty content` 400 từ Anthropic** vì lười validate input client-side.
   Server check `>= 50 chars` trước khi tốn 1 round-trip.
3. **Hardcode `sk-ant-...` trong code** (cả khi commit nhánh dev). Mỗi PR
   phải scan `sk-ant-`, `AIza`, `ya29.` trước khi push.
4. **`value:` cho credential trong apphosting.yaml**. Build vẫn pass nhưng
   key xuất hiện trên dashboard, ai đọc được logs đều copy được.
5. **Stack PR / branch chồng nhau**. Mỗi feature một PR thẳng vào `main`,
   merge xong tạo branch mới. Không làm chuỗi PR phụ thuộc lẫn nhau —
   App Hosting auto-deploy main, mọi PR chồng đều vô tác dụng cho deploy.
6. **`firestore.rules` để mở `allow read, write: if true`** "tạm thời rồi
   sửa". Lần đầu deploy = lần đầu user external scrape DB. Mặc định luôn
   `if false` rồi mở từng collection theo `ownerId`.
7. **Không rate-limit / không log usage**. Một test loop client-side là
   user đã đốt $50 Claude credit trong 1 đêm. Bắt buộc check `usage_logs`
   trước call.
8. **Quên `timeoutSeconds: 540` + retry SDK quá tham lam** → Cloud Run kill
   socket giữa chừng, user thấy "Connection error" mơ hồ. SDK timeout
   240s + 1 retry, Cloud Run 540s — header rõ.

---

## 9. Reference apps (đọc khi cần pattern cụ thể)

| App | Production | Pattern đáng đọc | File chốt (trong `_reference/`) |
|---|---|---|---|
| **DGDCHP2** | https://dgdchp2--dgdchp2.asia-southeast1.hosted.app/ | Đánh giá DOCX/PDF + revision flow | `_reference/DGDCHP2/lib/parseFile.ts`, `evaluator.ts`, `exporters.ts`, `_reference/DGDCHP2/api/evaluate.route.ts` |
| **AIMEET** | https://aimeet--meet2-afb35.asia-southeast1.hosted.app/ | Web Speech API + chunked transcript + task extraction | `_reference/AIMEET/ui/Recorder.tsx`, `_reference/AIMEET/api/transcribe.route.ts`, `tasks.route.ts` |
| **CBTS** | https://cbts--cbts-e6b0e.asia-southeast1.hosted.app/ | RAG chatbot + streaming chat UI | `_reference/CBTS/api/chat.route.ts`, `_reference/CBTS/lib/knowledge.ts`, `_reference/CBTS/ui/ChatWidget.tsx` |

Code mẫu nằm sẵn trong repo dưới `_reference/<APP>/`, đã được loại trừ khỏi
build (`tsconfig.json`), lint (`.eslintignore`), Docker (`.dockerignore`).
**KHÔNG sửa file trong `_reference/`** — coi như read-only snapshot. Mỗi
sub-folder có README riêng liệt kê pattern đáng đọc + gotcha cụ thể.

---

## 10. Code quality

- TypeScript **strict** trên toàn repo (`tsconfig.json` đã set). Không tắt
  `strictNullChecks` cho file riêng.
- **Cấm `any`**. Dùng `unknown` rồi narrow, hoặc tạo interface chính xác.
- **Cấm magic strings** — collection names, route paths, criterion ids đều
  ở `src/lib/constants.ts` hoặc enum. Cấm gõ `'usage_logs'` vào nhiều file.
- Mọi route handler / server action **phải** validate input bằng zod ngay
  đầu hàm. Trả 400 với message tiếng Việt nếu fail.
- **Không** export default function 100+ dòng. Tách thành sub-component
  với props rõ ràng.
- Comment trong code: chỉ viết khi giải thích **lý do** (vì sao chọn
  approach này, hoặc cảnh báo edge case). Không lặp lại tên hàm thành
  comment.

---

## 11. Auto-commit rules

- Sau mỗi đơn vị công việc hoàn chỉnh (feature build xong, test localhost
  pass) → commit ngay, không gom nhiều feature vào 1 commit.
- **Trước commit luôn scan**:
  - `git diff --cached --name-only` không chứa `.env`, `.env.local`,
    `service-account*.json`, `firebase-adminsdk*.json`,
    `application_default_credentials.json`.
  - `git diff --cached -U0` không match `sk-ant-[A-Za-z0-9_-]{30,}`,
    `AIza[A-Za-z0-9_-]{30,}`, `ya29\.[A-Za-z0-9_-]{30,}`.
- **Conventional commit format** (luôn dùng):
  - `feat(scope): mô tả ngắn` — tính năng mới
  - `fix(scope): mô tả` — sửa lỗi
  - `chore: mô tả` — config, dependency, refactor không thay behavior
  - `docs: mô tả` — README, CLAUDE.md
  - `refactor(scope): mô tả` — refactor không đổi behavior
- Body commit (nếu có): bullet list các thay đổi đáng nhớ + lý do.

---

## 12. Branch + PR strategy

- `main` là default + branch deploy. Mỗi push vào `main` triggers App
  Hosting rollout.
- Feature → branch `feat/<short-name>` → PR vào `main` → review (hoặc
  self-review nếu solo) → merge.
- **KHÔNG stack PR**. Một PR phụ thuộc PR khác chưa merge = sai.
  Rebase `feat/...` lên main mới mở PR.
- Squash merge mặc định (giữ commit history `main` sạch).
- Trước khi merge: CI workflow phải pass (`typecheck` + `build`).

---

## 13. Cost monitoring

- **Budget alerts** trong GCP Billing: cảnh báo 50%, 80%, 100% ngân sách
  tháng. Mỗi app UAE18 default $50/tháng — vượt nghĩa là có loop rò.
- **Rate limit** trong code (mục 3). Default 5/giờ + 30/ngày là sàn an toàn;
  app cụ thể có thể nâng nếu cần.
- **`usage_logs/` collection** là single source of truth cho cost. Có
  query helper trong `src/lib/usage.ts` (sẽ thêm theo nhu cầu) để
  tính tổng `costUsd` 24h, 7d, 30d.
- **Firebase App Check** bật cho Auth + Firestore + Storage:
  reCAPTCHA v3 site key qua `NEXT_PUBLIC_FIREBASE_APPCHECK_SITE_KEY`,
  client-side init lazy (xem `src/lib/firebase.ts`).
- Server route nặng cost (Claude calls): yêu cầu Auth qua
  `requireAuth(request)` ở dòng đầu. Không có auth = 401 ngay, không
  tốn token.

---

## 14. Project-specific configuration

> **EDIT MÌNH SECTION NÀY khi tạo app mới từ template.** Mọi giá trị
> trong dấu `[...]` cần thay bằng giá trị thật.

- **Tên app**: `[TEN-APP-O-DAY]`
- **Mục đích**: `[mô tả 1-2 câu app này làm gì cho user]`
- **Firebase project ID**: `[project-id]` (region `asia-southeast1`)
- **Tên backend App Hosting**: `[ten-backend]` (thường = tên app, snake-case)
- **GitHub repo**: `https://github.com/[org]/[ten-repo]`
- **Production URL**: `https://[ten-app]--[project-id].asia-southeast1.hosted.app/`
- **Domain custom (nếu có)**: `[domain]`
- **Reference app gần nhất**: `[DGDCHP2 / AIMEET / CBTS / AI-OBE2]` —
  copy pattern từ đó trước.
- **Firestore collections**: `[textbooks, chunks, evaluations, ...]`
- **Storage paths**: `uploads/{ownerId}/...`
- **Rate limit override** (nếu khác default 5/giờ + 30/ngày):
  - `RATE_LIMIT_PER_HOUR=[N]`
  - `RATE_LIMIT_PER_DAY=[N]`
- **Claude model**: `claude-sonnet-4-6` (đổi nếu app có yêu cầu khác)
- **Long-running**: `[Có / Không]` — nếu có, mô tả chiến lược chunking.
- **External integrations**: `[Web Speech API / Vector DB / ...]`
