# Deploy Meow Diary lên GitHub + Vercel (PWA production)

Repo: `git@github.com:thiennguyenminh912/meow-dairy.git`
App nằm ở `meow-diary/frontend` → **đây là "Root Directory" phải khai với Vercel**.

---

## Bước 1 — Đẩy code lên GitHub

Ở thư mục `/Users/thiennguyen/VillaQuest` — đã `git init`, commit sẵn 1 commit, remote đã trỏ
đúng repo. Bạn chỉ cần chạy:

```bash
cd /Users/thiennguyen/VillaQuest
git branch -M main
git push -u origin main
```

Đã kiểm tra trước: `.env.local` **không** nằm trong commit, và thư mục `meow-diary/secret/`
(ảnh chụp dashboard của bạn) cũng đã bị loại — cả hai đều nằm trong `.gitignore`.

---

## Bước 2 — Tạo project trên Vercel

1. vercel.com → **Add New… → Project** → chọn repo `meow-dairy`.
2. Ở màn hình cấu hình:
   - **Root Directory**: bấm *Edit* → chọn `meow-diary/frontend` ⚠️ (bỏ qua bước này là build fail)
   - **Framework Preset**: Vite (Vercel tự nhận)
   - Build Command / Output: để mặc định — đã khai trong `vercel.json`
3. **Environment Variables** — thêm 2 biến, tick cả *Production*, *Preview*, *Development*:

   | Name | Value |
   |---|---|
   | `VITE_SUPABASE_URL` | `https://vdvczcbmkmwttlgcyozk.supabase.co` |
   | `VITE_SUPABASE_ANON_KEY` | publishable key `sb_publishable_…` |

   Hai biến này có tiền tố `VITE_` nên **nằm trong bundle và ai cũng đọc được** — đúng thiết kế,
   an toàn vì dữ liệu được bảo vệ bằng RLS. Tuyệt đối không thêm `service_role` / `sb_secret_…`.
4. **Deploy**. Xong sẽ có domain dạng `https://meow-dairy.vercel.app`.

Từ đây mỗi lần `git push` lên `main` → Vercel tự build & deploy production; mỗi PR có preview riêng.

---

## Bước 3 — Cho phép đăng nhập Google trên domain mới ⚠️

Nếu bỏ bước này, bấm "Đăng nhập" trên bản production sẽ quay về `localhost` và hỏng.

**Supabase** → Authentication → **URL Configuration**:
- *Site URL*: `https://meow-dairy.vercel.app`
- *Redirect URLs*: thêm cả hai dòng
  - `https://meow-dairy.vercel.app/**`
  - `http://localhost:5173/**` (giữ để còn chạy dev)

**Google Cloud Console** → Google Auth Platform → **Clients** → client web đang dùng:
- *Authorized JavaScript origins*: thêm `https://meow-dairy.vercel.app`
- *Authorized redirect URIs*: **giữ nguyên** `https://vdvczcbmkmwttlgcyozk.supabase.co/auth/v1/callback`
  (Google luôn trả về Supabase, không trả thẳng về Vercel)

---

## Bước 4 — GitHub Actions

`.github/workflows/ci.yml` chạy sẵn ở mỗi push/PR: typecheck → build → kiểm tra `dist/sw.js`
và `dist/manifest.webmanifest` có được sinh ra không (tức là PWA không bị hỏng thầm lặng).

Không cần secret nào để CI chạy. Nếu muốn build trong CI giống hệt production, thêm 2 secret
`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` ở *Settings → Secrets and variables → Actions*.

### Có cần Actions deploy luôn không?

**Không nên.** Vercel Git integration đã lo deploy (nhanh hơn, có preview cho mỗi PR, không cần
giữ token). Actions chỉ nên đóng vai người gác cổng: PR nào build fail thì không merge.

Nếu vẫn muốn Actions cầm quyền deploy, file `.github/workflows/deploy.yml` đã viết sẵn:
mở file, bỏ comment khối `push:`, thêm 3 secret `VERCEL_TOKEN` / `VERCEL_ORG_ID` /
`VERCEL_PROJECT_ID`, rồi vào Vercel → Settings → Git → *Ignored Build Step* điền `exit 0`
để Vercel thôi tự deploy (nếu không sẽ deploy hai lần cho một commit).

---

## Bước 5 — Nghiệm thu bản production

1. Mở domain trên **điện thoại** → Chrome/Safari → *Thêm vào màn hình chính* → mở lên phải
   chạy toàn màn hình (không thanh địa chỉ), icon mèo đúng.
2. Bật chế độ máy bay → mở app → vẫn viết/vẽ được (service worker đã cache).
3. Đăng nhập Google → viết một trang → mở domain trên máy khác, đăng nhập cùng tài khoản →
   phải thấy trang vừa viết.
4. DevTools → Application → *Service Workers*: `activated and running`; *Manifest*: không có lỗi đỏ.
5. **Sau mỗi lần deploy**: service worker cũ có thể phục vụ bản cũ ở lần mở đầu tiên. Cấu hình
   hiện tại (`skipWaiting` + `clientsClaim`) khiến bản mới chiếm quyền ngay, nhưng nếu thấy lỗi
   đã sửa mà vẫn còn thì hãy Unregister service worker trong DevTools rồi tải lại — đừng vội
   kết luận là code chưa sửa.

---

## Cần biết khi vận hành

- **Supabase free tier tự pause project sau ~7 ngày không có request.** Vào dashboard bấm
  *Restore* là chạy lại, dữ liệu không mất. Muốn tránh: đặt một cron (GitHub Actions
  `schedule` hoặc cron-job.org) ping `https://<project>.supabase.co/rest/v1/` vài ngày một lần.
- Nét vẽ đang lưu base64 trong cột `jsonb`. Nếu sau này nặng (>50MB/user), chuyển ảnh sang
  Supabase Storage — xem `research-backend-2026-08.md` mục 2.
- Đổi icon/tên app → sửa `vite.config.ts` (khối `manifest`) + `public/icons/`, rồi push.
