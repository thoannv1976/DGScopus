# Hướng dẫn setup app mới từ `_uae18-starter-kit`

10 bước để chuyển template này thành một app UAE18 chạy được trên cả
localhost và Firebase App Hosting.

---

## 1. Copy folder template thành folder app mới

```powershell
cd C:\dev
xcopy templates\_uae18-starter-kit [TEN-APP-O-DAY] /E /I /H
cd [TEN-APP-O-DAY]
```

Hoặc trên macOS/Linux:
```bash
cp -R templates/_uae18-starter-kit [TEN-APP-O-DAY]
cd [TEN-APP-O-DAY]
```

> **Tuỳ chọn**: xoá `_reference/` nếu không cần Claude tham chiếu các app
> mẫu nữa (hiếm khi cần xoá ngay; cứ giữ).

---

## 2. Tạo Firebase project mới

1. https://console.firebase.google.com/ → **Add project** →
   `[TEN-PROJECT-FIREBASE]` (gợi ý: viết thường, gạch ngang).
2. Bỏ qua Google Analytics nếu không cần.
3. Vào **Project settings → Usage and billing → Modify plan → Blaze**
   (App Hosting yêu cầu Blaze). Đặt budget alert ở mức 50% / 80% / 100%
   của ngân sách tháng (UAE18 default $50/tháng/app).

## 3. Bật service Firebase

1. **Authentication** → Get started → Sign-in method → bật **Google**.
2. **Authentication → Settings → Authorized domains**: `localhost` mặc định
   có sẵn. Domain App Hosting cấp ở bước 9 sẽ thêm sau.
3. **Firestore Database** → Create → **Native mode** → location
   `asia-southeast1` (KHÔNG đổi sau này được).
4. **Storage** → Get started → Default bucket → location `asia-southeast1`.
5. (Tuỳ chọn) **App Check** → Apps → web app → Register reCAPTCHA v3 →
   copy site key. Bật App Check ở chế độ **Unenforced** trước, theo dõi
   metric vài ngày rồi mới Enforce.

## 4. Tạo GitHub repo trống

1. https://github.com/new → tên repo `[ten-repo]` → Owner `[org]`.
2. KHÔNG tick "Add README/.gitignore/license" (template đã có sẵn).

## 5. Customize `CLAUDE.md` (file critical nhất)

Search-and-replace:
- `[TEN-APP-O-DAY]` → tên app thật (vd: `textbook-review`)
- Cuối file: section **Project-specific configuration** — điền đầy đủ
  Firebase project ID, GitHub repo URL, production URL, reference app
  gần nhất, Firestore collections, rate limit override (nếu khác default).

## 6. Customize `apphosting.yaml`

Search-and-replace:
- `[TEN-APP-O-DAY]` → tên app
- `[TEN-PROJECT-FIREBASE]` → Firebase project ID (vd: `dggt-9fe0c`)
- `[ten-backend]` → tên backend App Hosting (snake-case, thường = tên app)

## 7. Tạo `.env.local`

```bash
cp .env.example .env.local
```

Mở `.env.local`, điền các giá trị thật:
- `ANTHROPIC_API_KEY` — tạo tại https://console.anthropic.com
- `NEXT_PUBLIC_FIREBASE_*` — copy từ Firebase Console → Project settings →
  General → Your apps → Web app → SDK setup
- `FIREBASE_SERVICE_ACCOUNT_JSON` — IAM → Service Accounts → chọn
  `firebase-adminsdk-...@<project>.iam.gserviceaccount.com` → Keys → Add key
  → JSON. Paste nguyên file JSON dưới dạng 1 dòng (escape `"` thành `\"`).

Test localhost:
```bash
npm install
npm run dev
# http://localhost:3000 → bị redirect /login → Đăng nhập với Google → quay
# về / với header có avatar.
```

## 8. Push code lên GitHub

```bash
git init -b main
git add .
git commit -m "feat: initial scaffold from _uae18-starter-kit"
git remote add origin https://github.com/[org]/[ten-repo].git
git push -u origin main
```

> Trước khi push lần đầu, kiểm tra `git diff --cached --name-only` không
> chứa `.env.local`, `service-account*.json`, hoặc bất kỳ file credential
> nào. `.gitignore` đã chặn các pattern này nhưng kiểm tra lại cho chắc.

## 9. Connect App Hosting với GitHub repo

Cách đơn giản nhất qua UI:
1. Firebase Console → **Build → App Hosting** → Get started.
2. Region: `asia-southeast1`.
3. Backend ID: `[ten-backend]` (đúng tên đã đặt trong `apphosting.yaml`).
4. Connect GitHub repository → cho phép Firebase GitHub App truy cập
   `[org]/[ten-repo]` → Live branch `main` → Root directory `/`.

Hoặc CLI:
```bash
firebase apphosting:backends:create --project [TEN-PROJECT-FIREBASE] --location asia-southeast1
```

## 10. Set secrets + grant access + deploy

```bash
firebase use [TEN-PROJECT-FIREBASE]

# Tạo secret (paste giá trị khi được hỏi)
firebase apphosting:secrets:set ANTHROPIC_API_KEY
firebase apphosting:secrets:set FIREBASE_SERVICE_ACCOUNT_JSON
firebase apphosting:secrets:set NEXT_PUBLIC_FIREBASE_API_KEY
firebase apphosting:secrets:set NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
firebase apphosting:secrets:set NEXT_PUBLIC_FIREBASE_APP_ID
firebase apphosting:secrets:set NEXT_PUBLIC_FIREBASE_APPCHECK_SITE_KEY

# Grant cho backend (BẮT BUỘC, quên = container start fail)
for s in ANTHROPIC_API_KEY FIREBASE_SERVICE_ACCOUNT_JSON \
         NEXT_PUBLIC_FIREBASE_API_KEY \
         NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID \
         NEXT_PUBLIC_FIREBASE_APP_ID \
         NEXT_PUBLIC_FIREBASE_APPCHECK_SITE_KEY; do
  firebase apphosting:secrets:grantaccess $s --backend [ten-backend]
done

# Deploy Firestore rules + indexes + Storage rules
firebase deploy --only firestore:rules,firestore:indexes,storage --project [TEN-PROJECT-FIREBASE]

# Trigger first rollout
git commit --allow-empty -m "chore: trigger first rollout"
git push
```

Sau khi rollout SUCCESS:
1. Copy URL App Hosting cấp (dạng `[ten-backend]--[project-id].asia-southeast1.hosted.app`).
2. Quay lại **Authentication → Settings → Authorized domains → Add domain**
   → paste vào.
3. Mở URL → smoke test full flow đăng nhập / đăng xuất.

---

## Checklist sau cùng

- [ ] `CLAUDE.md` đã điền section "Project-specific configuration"
- [ ] `apphosting.yaml` đã thay placeholder
- [ ] `.env.local` có giá trị thật, KHÔNG bị commit
- [ ] GitHub repo có CI workflow chạy pass
- [ ] App Hosting backend SUCCESS
- [ ] Auth domain đã add domain App Hosting
- [ ] Budget alert đã set
- [ ] Smoke test đăng nhập + đăng xuất pass

Khi tất cả tick xong, app sẵn sàng để Claude scaffold feature đầu tiên.
Mở phiên Claude mới, bắt đầu bằng:

> "Đọc CLAUDE.md và `_reference/README.md`, sau đó scaffold feature [X]."
