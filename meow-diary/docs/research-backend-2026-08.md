# Research: Backend + Auth + Storage cho Meow Diary (tháng 8/2026)

> Bối cảnh: app nhật ký React (Vite + TS), không backend, sắp thêm đăng nhập Google OAuth + lưu dữ liệu theo user để đồng bộ đa thiết bị. Mỗi user: vài chục "trang" JSON (text, sticker, ảnh nét vẽ base64 webp ~50-300KB/trang) → ~5-50MB/user, dưới 100 user. Ưu tiên: free tier bền vững, dễ setup, không cần thẻ nếu được.
>
> Toàn bộ số liệu dưới đây lấy từ trang pricing/docs chính thức, kiểm tra trực tiếp trong phiên nghiên cứu **ngày 17/8/2026** (WebSearch + WebFetch, không đoán từ trí nhớ). Có 2-3 điểm chỉ tìm được qua nguồn thứ cấp (search snippet, trang docs chính thức 404) — được đánh dấu rõ "⚠️ nguồn thứ cấp, chưa xác nhận trên trang chính thức".

---

## 1. Bảng so sánh DB / BaaS free tier

| Provider | Dung lượng free | Giới hạn chính | Cần thẻ? | OAuth Google sẵn có? | Storage ảnh sẵn có? | Ngày kiểm tra + nguồn |
|---|---|---|---|---|---|---|
| **Supabase** | DB 500MB + Storage 1GB riêng | 2 project active/org; **pause sau 7 ngày không hoạt động** (khôi phục được trong 90 ngày); egress 5GB + 5GB cached; Auth 50k MAU free; **không backup tự động ở Free** | Không | **Có** (built-in, 50k MAU) | **Có** (Supabase Storage, max file 50MB) | 17/8/2026 — supabase.com/pricing, supabase.com/docs/guides/platform/free-project-pausing |
| **Neon** | 0.5GB **mỗi project**, tối đa 100 project free | Compute 100 CU-giờ/project/tháng; **scale-to-zero sau 5 phút** không dùng (chỉ cold start, không mất dữ liệu); 10 branch/project; egress 5GB | **Không** | Neon Auth có nhưng free-tier Google OAuth chưa xác nhận rõ trên trang pricing | Object storage đang **beta**, không đảm bảo lâu dài — coi Neon là DB-only | 17/8/2026 — neon.com/pricing (neon.tech/pricing redirect sang neon.com) |
| **Turso** | 5GB | 100 database free; 500M row-read/tháng, 10M row-write/tháng; sync 3GB/tháng; ⚠️ nguồn thứ cấp: DB free **bị archive sau 10 ngày không hoạt động** (trang pricing chính thức không nói điều này, docs.turso.tech/pricing 404) | **Không** | Không (DB-only) | Không (ảnh phải lưu dạng blob/text trong 5GB) | 17/8/2026 — turso.tech/pricing |
| **Cloudflare D1** | 5GB/account, **tối đa 500MB/database**, 10 database/account | 5M row-read/ngày, 100k row-write/ngày; **2MB max/row-BLOB**; 100KB max SQL statement; 30s max query; không thấy chính sách xóa vì không hoạt động | Không | Không (kết hợp Cloudflare Access hoặc tự làm OAuth) | Không (R2 là sản phẩm riêng) | 17/8/2026 — developers.cloudflare.com/d1/platform/pricing, .../limits |
| **MongoDB Atlas M0** | 512MB | 1 cluster M0 free/project (nhiều project = nhiều cluster); **auto-pause sau 30 ngày không có connection nào** (resume được, không mất data); băng thông 10GB in/out mỗi 7 ngày; **không có backup** | Không | Không (Atlas App Services là sản phẩm riêng) | Không (GridFS trong 512MB hoặc bucket ngoài) | 17/8/2026 — mongodb.com/docs/atlas/reference/free-shared-limitations |
| **Firebase Firestore (Spark)** | Firestore 1GiB, egress 10GiB/tháng | 50k đọc/ngày, 20k ghi/ngày, 20k xóa/ngày; Auth free tới 50k MAU **không cần thẻ** | **Không** (riêng Firestore + Auth) | **Có** (Firebase Auth, Google provider, free đến 50k MAU) | ⚠️ **Cloud Storage for Firebase từ 3/2/2026 bắt buộc gói Blaze (thẻ tín dụng)** — kể cả khi dùng trong hạn mức free, dự án chỉ dùng Spark sẽ bị lỗi 402/403 khi động vào Storage | 17/8/2026 — firebase.google.com/pricing, firebase.google.com/docs/storage/faqs-storage-changes-announced-sept-2024 |
| **Xata** | **⚠️ Free tier vĩnh viễn đã bị khai tử** | Chỉ còn trial 14 ngày (có nơi nói $100 credit onboarding), sau đó **bắt buộc thẻ**, tính theo pay-as-you-go | Có (sau trial) | Không | Không (files API đã gỡ khỏi free từ 1/2025) | 17/8/2026 — xata.io/pricing (trang cũ xata.io/blog/changes-free-tier đã lỗi thời, đừng dùng số liệu ở đó) |
| **CockroachDB Cloud (Basic)** | **10GiB storage + 50 triệu RU/tháng** — free lớn nhất trong bảng | Không nêu rõ giới hạn số cluster free; compute scale-to-zero; không thấy chính sách xóa vì không hoạt động | **Không** ("No credit card required for Basic and Standard plans", còn tặng $400 trial credit) | Không (DB-only) | Không | 17/8/2026 — cockroachlabs.com/pricing |
| **Railway Postgres** | ⚠️ **Không còn free tier thật sự** | Trial: $5 credit/30 ngày, không cần thẻ. Sau trial: gói "Free" chỉ còn **$1 credit/tháng** — không đủ chạy DB liên tục; hết credit là ngừng toàn bộ workload | Cần thẻ để duy trì sau trial | Không | Không | 17/8/2026 — railway.com/pricing, docs.railway.com/reference/pricing/plans |
| **Render Postgres** | ⚠️ **DB free bị xóa sau 30 ngày** (+ 14 ngày ân hạn) kể từ lúc **tạo**, không phải lúc không hoạt động | 1GB, chỉ 1 DB free/workspace; **không dùng được cho production, không có backup** | Không nêu rõ | Không | Không | 17/8/2026 — render.com/docs/free |

**Ghi chú riêng cho object storage (không phải DB):**

| Storage | Free | Giới hạn | Nguồn |
|---|---|---|---|
| **Supabase Storage** | 1GB (tách quota với DB 500MB) | Egress 5GB/tháng, file tối đa 50MB, pause cùng lịch với project (7 ngày) | supabase.com/pricing |
| **Cloudflare R2** | **10GB-month** | 1 triệu Class A ops (ghi/upload/list) + 10 triệu Class B ops (đọc) free/tháng; **egress hoàn toàn miễn phí** (điểm mạnh nhất của R2) | developers.cloudflare.com/r2/pricing |
| **Firebase Cloud Storage** | 5GB-months (bucket mới `*.firebasestorage.app`, chỉ vài region US) hoặc 5GB (bucket cũ `*.appspot.com`) | ⚠️ Từ 3/2/2026 **bắt buộc gói Blaze (đã gắn thẻ)** mới tạo/dùng được bucket, dù chi phí thực tế = 0 | firebase.google.com/docs/storage/faqs-storage-changes-announced-sept-2024 |

**Backend hosting free tier (nếu cần chạy API server riêng):**

| Host | Còn free 8/2026? | Cần thẻ? | Sleep/cold-start? | Ghi chú |
|---|---|---|---|---|
| **Fly.io** | ❌ Không — free tier đã bỏ từ 10/2024, chỉ còn trial 2 giờ/7 ngày | Không cho trial, cần thẻ để tiếp tục | N/A | Thực chất đã là dịch vụ trả phí (~$2-4/tháng tối thiểu) |
| **Render** | ✅ Có, 750 giờ free/tháng | Không | Sleep sau **15 phút** không có traffic, cold start ~30-60s | Đủ dùng cho app ít traffic như journal cá nhân |
| **Railway** | ⚠️ Chỉ mang tính hình thức ($1 credit/tháng sau trial) | Cần thẻ để duy trì | — | Không thực tế cho chạy liên tục |
| **Cloudflare Workers** | ✅ Có, 100.000 request/ngày | Không | **Không sleep**, luôn "ấm" ở edge | Nhưng **không phải Node/Express truyền thống** — chạy trên V8 isolate, giới hạn 10ms CPU time/request (bản free) → phù hợp route JSON đơn giản, không phù hợp xử lý ảnh nặng inline |

---

## 2. Base64-in-DB hay Object Storage riêng?

**Khuyến nghị: dùng object storage riêng (Supabase Storage hoặc R2), KHÔNG nhét base64 vào cột DB.**

Lý do:
- Ảnh nét vẽ 50-300KB/trang × vài chục trang/user × <100 user → riêng phần ảnh có thể chiếm 2-15MB/user, dễ vượt quota DB rất nhỏ (Supabase 500MB, Neon 0.5GB, Atlas 512MB) nếu nhét chung vào bảng.
- Base64 làm phình dữ liệu ~33% so với binary gốc — lãng phí quota vốn đã eo hẹp.
- Query/backup/index trên bảng chứa blob lớn chậm hơn và tốn RAM hơn (đặc biệt các free-tier compute rất nhỏ, RAM 256MB-1GB).
- Tách ảnh ra storage bucket giữ bảng Postgres/JSON gọn (chỉ text + metadata + URL/key ảnh), room để mở rộng số user/trang trước khi chạm trần free tier DB.

**Chọn storage nào:**
- **Nếu đi theo kiến trúc Supabase (top pick, xem mục 3):** dùng **Supabase Storage** — cùng vendor, cùng RLS/auth token, setup đơn giản nhất, 1GB đủ cho <100 user ở quy mô hiện tại (ước tính thực tế 0.5-2GB, không phải 5-50GB worst-case tuyệt đối).
- **Nếu cần nhiều chỗ hơn hoặc dự phòng:** **Cloudflare R2** — 10GB free (gấp 10 lần Supabase), egress miễn phí hoàn toàn, không có chính sách pause. Đánh đổi: phải tự viết logic upload/presigned URL, không tích hợp sẵn với auth như Supabase.
- **Tránh Firebase Storage** cho case "free tuyệt đối, không thẻ" vì thay đổi chính sách 2/2026 bắt buộc gắn thẻ Blaze mới dùng được Storage, dù Firestore + Auth vẫn free không cần thẻ.

---

## 3. Khuyến nghị kiến trúc

### Top pick: Supabase toàn bộ (Postgres + Auth + Storage), gọi thẳng từ frontend qua SDK, KHÔNG cần backend riêng

- **DB:** Supabase Postgres (500MB) — bảng `pages` lưu JSON (text, sticker layout), khóa theo `user_id`, bật **Row Level Security** để mỗi user chỉ đọc/ghi được data của mình.
- **Storage ảnh:** Supabase Storage (1GB) — bucket riêng, policy RLS theo `user_id`, ảnh lưu file webp thật (không base64) và bảng `pages` chỉ lưu path/URL.
- **Auth:** Supabase Auth, bật provider Google — Supabase quản lý toàn bộ redirect/token exchange, frontend chỉ gọi `supabase.auth.signInWithOAuth({provider:'google'})`.
- **Backend riêng:** **Không cần.** Supabase JS SDK gọi thẳng từ frontend (Vite), bảo mật dựa vào RLS policy thay vì server trung gian — phù hợp app cá nhân <100 user, không có logic nghiệp vụ phức tạp cần giấu ở server.
- **Lý do chọn:** đây là provider **duy nhất cùng lúc có sẵn Google OAuth + Postgres + object storage trong 1 gói free, không cần thẻ, không cần dựng backend**. Việc pause sau 7 ngày không hoạt động là rủi ro thật nhưng nhẹ — có thể khắc phục bằng 1 cron ping định kỳ (ví dụ GitHub Actions free chạy request rỗng mỗi vài ngày), và kể cả bị pause thì restore được trong 90 ngày, không mất dữ liệu.

### Phương án dự phòng: Cloudflare D1 + R2 + Cloudflare Workers, tự làm Google OAuth

Dùng khi: quota Supabase (500MB DB / 1GB storage) trở nên chật, hoặc lo ngại chính sách pause 7 ngày.

- **DB:** Cloudflare D1 (5GB/account, không thấy chính sách xóa vì không hoạt động)
- **Storage ảnh:** Cloudflare R2 (10GB free, egress miễn phí, cùng vendor với D1 → egress giữa Workers-R2-D1 cũng miễn phí)
- **Backend:** Cloudflare Workers (100k request/ngày free, luôn "ấm" không cold-start) — viết route xác thực JWT + CRUD JSON, giới hạn 10ms CPU/request nên tránh xử lý ảnh nặng ngay trong Worker (chỉ generate presigned URL để client upload thẳng lên R2).
- **Auth:** Tự implement Google OAuth (authorization code flow) trong Worker — cần lưu `GOOGLE_CLIENT_SECRET` làm Worker secret, tự viết token exchange + issue JWT session.
- **Đánh đổi:** nhiều việc setup hơn hẳn (không có SDK auth có sẵn như Supabase), nhưng quota rộng hơn nhiều lần và không có rủi ro pause.

---

## 4. Checklist CHÍNH XÁC việc phải tự setup (theo top pick: Supabase)

### A. Tạo Supabase project
1. Vào supabase.com → đăng nhập (GitHub/Google) → **New Project**.
2. Chọn tên project, database password (Supabase tự sinh), region gần Việt Nam nhất (Singapore).
3. Không cần thẻ ở bước này.

### B. Google Cloud Console — lấy OAuth Client ID/Secret

> Lưu ý 2026: Google đã đổi UI "OAuth consent screen" cũ thành **"Google Auth Platform"**, chia thành các tab **Branding / Audience / Data Access / Clients**. Đây là thay đổi ổn định, không phải test tạm thời.

1. Vào `console.cloud.google.com` → tạo project mới (hoặc chọn project có sẵn).
2. Vào menu **APIs & Services → Google Auth Platform** → bấm **Get Started** nếu chưa cấu hình.
   - Tab **Branding**: điền App name, Support email, Authorized domains (domain production của bạn), link Homepage/Privacy Policy (bắt buộc phải host trên domain đã khai ở Authorized domains).
   - Tab **Audience**: chọn **Testing** (giới hạn 100 test user, phải add email thủ công) hoặc bấm **Publish App** để chuyển **In production** (mở cho mọi tài khoản Google). Với app cá nhân/gia đình <100 user, để **Testing** và add email các user cụ thể là đủ, không cần publish.
   - Tab **Data Access**: dùng scope mặc định `openid`, `.../auth/userinfo.email`, `.../auth/userinfo.profile` — **không cần Google verification review** vì đây là scope không nhạy cảm.
3. Vào tab **Clients** → **Create Client** → Application type = **Web application**.
   - **Authorized JavaScript origins:** thêm cả 2 dòng:
     - `http://localhost:5173` (dev, đúng port mặc định Vite)
     - `https://<domain-production-cua-ban>` (production)
   - **Authorized redirect URIs** (bắt buộc vì Supabase Auth dùng redirect flow):
     - Lấy redirect URI chính xác từ Supabase Dashboard → **Authentication → Providers → Google** (dạng cố định `https://<project-ref>.supabase.co/auth/v1/callback`) → dán vào đây.
     - Nếu có dev local bằng Supabase CLI: thêm thêm `http://127.0.0.1:54321/auth/v1/callback`.
4. Bấm **Create** → Google trả về **Client ID** và **Client Secret**.

### C. Dán credentials vào Supabase
1. Supabase Dashboard → **Authentication → Providers → Google** → bật **Enable**.
2. Dán **Client ID** và **Client Secret** từ bước B4 vào đúng ô.
3. Save. (Supabase tự lưu/giữ secret, không cần đưa secret vào code frontend.)

### D. Tạo bảng DB + bucket Storage + RLS
1. Supabase Dashboard → **Table Editor** → tạo bảng ví dụ `pages` (columns: `id`, `user_id` FK tới `auth.users`, `content_json`, `created_at`, `updated_at`).
2. Bật **Row Level Security** trên bảng, thêm policy: user chỉ SELECT/INSERT/UPDATE/DELETE row có `user_id = auth.uid()`.
3. **Storage** → tạo bucket mới (ví dụ `page-images`), set policy tương tự: user chỉ truy cập file trong path `user_id/...` của chính mình.

### E. Frontend
1. `npm install @supabase/supabase-js` (⚠️ không thuộc phạm vi cấm sửa `package.json`/`src` — bước này Thien tự làm hoặc báo lại để làm riêng).
2. Khởi tạo client bằng `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY`.
3. Gọi `supabase.auth.signInWithOAuth({ provider: 'google' })` để login.

---

### Danh sách biến env cần Thien gửi lại / tạo

| Biến | Lấy ở đâu | Dùng ở đâu |
|---|---|---|
| `VITE_SUPABASE_URL` | Supabase Dashboard → Project Settings → API → "Project URL" | Frontend (Vite, public — an toàn để lộ) |
| `VITE_SUPABASE_ANON_KEY` | Supabase Dashboard → Project Settings → API → "anon public" key | Frontend (Vite, public — an toàn để lộ, bảo vệ bằng RLS chứ không giấu key) |
| `GOOGLE_CLIENT_ID` | Google Cloud Console → Google Auth Platform → Clients → client vừa tạo | Dán vào Supabase Dashboard (Provider Google), KHÔNG cần đưa vào code frontend |
| `GOOGLE_CLIENT_SECRET` | Google Cloud Console → Google Auth Platform → Clients → client vừa tạo | Dán vào Supabase Dashboard (Provider Google) — **tuyệt đối không đưa vào frontend/`VITE_` prefix** |

Nếu sau này chuyển sang phương án dự phòng (Cloudflare D1/R2/Workers + tự làm OAuth), sẽ cần thêm: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` làm Worker secret (`wrangler secret put`), và tự định nghĩa `OAUTH_REDIRECT_URI` theo domain Worker.

---

## 5. Ghi chú PWA

**`vite-plugin-pwa` vẫn là lựa chọn tốt nhất, không có gì thay thế nổi bật.**

- Bản mới nhất: **1.3.0**, phát hành 5/5/2026 — repo vẫn active, commit gần nhất cùng ngày với release (nâng workbox lên 7.4.1).
- Tương thích: `peerDependencies` khai `vite: "^3 || ^4 || ^5 || ^6 || ^7 || ^8"` → dùng tốt với Vite 5 + React 18 hiện tại của Meow Diary.
- Không có PWA support chính thức nào được Vite core thêm vào tính đến 8/2026; cũng không có plugin đối thủ nào nổi lên thay thế.
- Cấu hình cơ bản (tham khảo, KHÔNG áp dụng vào code — theo yêu cầu không sửa file trong `src`/`package.json`):

```ts
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      manifest: { /* name, short_name, theme_color, icons[], ... */ },
      devOptions: { enabled: true } // để test SW trong `vite dev`
    })
  ]
})
```

> Nên lấy field manifest đầy đủ trực tiếp từ `vite-pwa-org.netlify.app/guide/` khi cấu hình thật, vì bản fetch trong lần research này chỉ lấy được snippet rút gọn.

---

## Nguồn đã kiểm tra (17/8/2026)

- supabase.com/pricing, supabase.com/docs/guides/platform/free-project-pausing, supabase.com/changelog/27497-paused-free-plan-projects-are-restorable-for-90-days, supabase.com/docs/guides/auth/social-login/auth-google
- neon.com/pricing, neon.com/docs/introduction/plans
- turso.tech/pricing
- developers.cloudflare.com/d1/platform/pricing, developers.cloudflare.com/d1/platform/limits, developers.cloudflare.com/r2/pricing, developers.cloudflare.com/workers/platform/limits
- mongodb.com/docs/atlas/reference/free-shared-limitations
- firebase.google.com/pricing, firebase.google.com/docs/storage/faqs-storage-changes-announced-sept-2024
- xata.io/pricing
- cockroachlabs.com/pricing
- railway.com/pricing, docs.railway.com/reference/pricing/plans
- render.com/docs/free
- fly.io/docs/about/pricing, fly.io/docs/about/free-trial
- developers.google.com/identity/gsi/web/guides/get-google-api-clientid, developers.google.com/identity/protocols/oauth2/web-server, support.google.com/cloud/answer/15549257, developers.google.com/identity/protocols/oauth2/production-readiness/sensitive-scope-verification
- npmjs.com/package/vite-plugin-pwa, github.com/vite-pwa/vite-plugin-pwa, vite-pwa-org.netlify.app
