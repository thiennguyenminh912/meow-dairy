# Meow Diary 🐾

Cuốn nhật ký giấy giả lập chạy trên trình duyệt: lật trang 3D như sổ thật, viết tay, vẽ, dán
sticker, và có một bạn mèo ngồi cạnh nói chuyện. Cài được về màn hình chính (PWA), chạy offline,
đăng nhập Google để đồng bộ giữa các thiết bị.

React 18 + Vite 5 + TypeScript · Supabase (Postgres + Auth) · không có backend riêng.

---

## Chạy

```bash
cd meow-diary/frontend
pnpm install
pnpm dev                     # http://localhost:5173
pnpm build && pnpm preview   # bản production: có service worker + chạy offline
```

Cần Node ≥ 18. Biến môi trường (tuỳ chọn — thiếu thì app vẫn chạy, chỉ mất phần đồng bộ):

```bash
cp .env.example .env.local
# VITE_SUPABASE_URL=https://<project-id>.supabase.co
# VITE_SUPABASE_ANON_KEY=sb_publishable_...
```

## Cấu trúc kho

```
VillaQuest/
  meow-diary/
    frontend/            # app React (thư mục này)
    docs/
      deploy.md                     # hướng dẫn deploy GitHub + Vercel
      supabase-setup.sql            # SQL tạo bảng + RLS, chạy một lần
      research-backend-2026-08.md   # so sánh DB free tier, lý do chọn Supabase
  Resources/             # ảnh gốc dùng để tách sticker mèo
```

```
src/
  App.tsx                 # điều phối: trạng thái sổ, lật trang, xé trang, kéo sticker, đồng bộ
  components/
    Book.tsx              # khung 3D của cuốn sổ (xem "Mô hình tờ giấy" bên dưới)
    Page.tsx              # một trang: dòng kẻ + chữ + canvas vẽ + sticker + nút ✂️
    DrawCanvas.tsx        # canvas vẽ, lưu ảnh nét vẽ dạng WebP dataURL
    StickerLayer.tsx      # sticker đã dán: kéo, phóng to, xoay, gỡ
    StickerTray.tsx       # khay sticker theo nhóm
    CatBuddy.tsx          # bạn mèo: cảm xúc, lời thoại, kéo thả, thu nhỏ
    Toolbar.tsx           # thanh công cụ máy tính (≥900px)
    MobileBar.tsx         # thanh dưới cho điện thoại / máy tính bảng dọc
    MobileMenu.tsx        # sheet ⋯ gom thao tác ít dùng
    CatPicker.tsx         # màn chọn bạn mèo
    AuthButton.tsx        # đăng nhập / trạng thái đồng bộ
  lib/
    types.ts  storage.ts  supabase.ts  cats.ts  stickers.ts  catLines.ts  sound.ts
public/
  cats/       # 15 sticker mèo PNG nền trong suốt (tách từ Resources/MauMeo.jpg)
  stickers/   # 63 sticker Fluent Emoji 3D + index.json (7 nhóm, tên tiếng Việt)
  icons/      # bộ icon PWA (thường + maskable + apple-touch)
```

---

## Tính năng

| Khu vực | Chi tiết |
|---|---|
| **Lật trang** | Rê chuột tới góc dưới → góc giấy cuộn lên; nắm góc kéo ngang để lật như sổ thật, thả giữa chừng thì trang bật lại. Ngoài ra: nút hai bên (máy tính), nút trong thanh dưới (điện thoại), phím ← →. Có tiếng giấy tạo bằng WebAudio (tắt được) |
| **Viết** | Textarea trong suốt căn đúng dòng kẻ, font viết tay Playpen Sans (đủ dấu tiếng Việt) |
| **Vẽ** | Canvas riêng mỗi trang · 6 màu bút · chỉnh độ dày · tẩy · hoàn tác 15 bước · xoá cả trang |
| **Sticker** | 15 mèo + 63 Fluent Emoji 3D chia 7 nhóm. Kéo thả từ khay vào trang (có ghost bay theo tay) hoặc bấm để dán nhanh; sau đó kéo di chuyển, phóng to/thu nhỏ, xoay, gỡ |
| **Giấy** | Kẻ ngang / chấm bi / trơn, đổi riêng từng trang |
| **Trang** | Thêm trang mới; mục lục nhảy tới trang bất kỳ và **kéo ⠿ đổi thứ tự** (chạy được cả bằng ngón tay) |
| **Xé trang** | Nút ✂️ ngay **góc trang cần xé** — bấm lần đầu trang rạn nứt + rung, hộp xác nhận nổi giữa trang, bấm lần nữa thì trang xé rời bay ra |
| **Bạn mèo** | 15 bé để chọn · 7 trạng thái cảm xúc có animation riêng (vui, quẩy, khóc, ngủ, thương, ngáo, thường) · ~40 câu thoại chill/động viên + câu riêng cho ban đêm · phản ứng theo hành động (lật trang, viết, vẽ, dán sticker, xé trang) · bấm để xoa đầu · **kéo thả tới chỗ bất kỳ**, thu nhỏ/phóng to, tự mờ đi khi bạn đang gõ · vị trí và cỡ được nhớ |
| **PWA** | Cài về màn hình chính, chạy offline hoàn toàn (98 file precache ~4MB, gồm cả sticker) |
| **Đồng bộ** | Đăng nhập Google → nhật ký lưu lên Supabase, mở máy khác thấy y nguyên |

---

## Những quyết định kỹ thuật đáng nhớ

### Mô hình tờ giấy

Cuốn sổ không phải danh sách trang, mà là danh sách **mặt giấy** (`faces`):

```
[bìa trước] [trang lót] [trang 1] [trang 2] … [(trang trắng nếu cần cho chẵn)] [bìa sau]
```

- **Máy tính (≥900px)** — hai mặt liên tiếp ghép thành **một tờ**; lật tờ = `rotateY(0 → -180deg)`
  quanh cạnh trái, `z-index` đảo theo trạng thái đã lật/chưa lật.
- **Điện thoại & máy tính bảng dọc (<900px)** — mỗi mặt là một tờ riêng, mặt sau để trơn.
  Chỉ giữ trong DOM các tờ `pos-1 … pos+1`; tờ đã lật bị ẩn (`.parked`) **nhưng chỉ sau khi
  animation chạy xong 850ms** — nếu ẩn ngay thì hiệu ứng lật biến mất, trang chỉ "nhảy" cái độp.

`pos` mang nghĩa khác nhau ở hai chế độ (số tờ đã lật / chỉ số mặt đang xem) nên khi đổi kích
thước cửa sổ có phép quy đổi hai chiều: `pos*2` và `Math.ceil(pos/2)`.

### Lật trang: một nguồn sự thật duy nhất

Đây là chỗ từng sinh ra hai lỗi khó chịu, cách sửa như sau:

1. **Kéo không được chạm vào React state.** Trong lúc kéo, góc lật được ghi thẳng vào DOM qua
   biến CSS `--held-angle` (gộp bằng `requestAnimationFrame`), `rect` của cuốn sổ đo **một lần**
   lúc bắt đầu kéo. Trước đây mỗi lần nhích chuột là một `setState` → React render lại cả app
   (100+ sticker) → giật, và trang hay cứng đơ giữa chừng.
2. **Vị trí trang được chốt ngay lúc thả tay**, không đợi animation. Tờ giấy đang nắm vẫn giữ
   đúng góc đích nên hình ảnh không nhảy, còn `setTimeout` sau đó chỉ làm mỗi việc dọn dẹp.
   Trước đây nó vừa dọn vừa đổi trang, nên khi người dùng bấm nút trong lúc animation còn chạy,
   cái timer cũ ghi đè vị trí một nhịp sau → **nhảy về trang cũ**, kẹt ở trang 2, hoặc trang cuối
   bật ngược về trang 1.
3. **Mọi lối đổi trang đều đi qua `goTo()`**, và `goTo` luôn `cancelPeek()` trước — huỷ timer,
   huỷ khung hình chờ, nhả tờ giấy. Bấm nút luôn thắng cú kéo đang dang dở.
4. **`posRef` cạnh `pos`.** Bấm nút hai lần trong cùng một nhịp render thì cả hai lần đều đọc
   `pos` cũ và chỉ ăn một lần; đọc/ghi qua ref thì bấm bao nhiêu ăn bấy nhiêu.
5. Xoay máy hoặc thêm/xoá trang giữa chừng cũng gọi `cancelPeek()` để tờ giấy không dính lại
   ở bố cục mới.

Đo thực tế bằng `requestAnimationFrame` (trung bình / p95 / xấu nhất, ms mỗi khung hình):

| Thao tác | Trung bình | p95 | Xấu nhất | Khung > 50ms |
|---|---|---|---|---|
| Kéo lật trang (30 bước) | 15.9 | 16.8 | 29.2 | 0 |
| Vẽ (40 nét) | 15.7 | 16.8 | 41.7 | 0 |
| Gõ 120 ký tự tiếng Việt | 15.4 | 16.8 | 20.8 | 0 |

### Lưu trữ

- **Máy này**: toàn bộ nhật ký nằm trong một khoá `localStorage` (`meow-diary-v1`), ghi sau 600ms
  ngừng thao tác. Nét vẽ lưu dạng **WebP dataURL** (nhẹ hơn PNG nhiều) — `localStorage` chỉ có ~5MB
  nên khi đầy app sẽ báo thay vì im lặng mất dữ liệu.
- **Đám mây**: bảng `diaries` — một dòng cho một người, cột `data jsonb` + `updated_at`. RLS bật,
  4 policy đều là `auth.uid() = user_id`, nên không ai đọc được nhật ký của người khác.
- **Chọn bản nào khi hai máy lệch nhau**: so `updatedAt`; bản mới hơn thắng. Khi kéo bản trên mây
  về, một cờ `skipSync` chặn việc đẩy ngược lên để không tạo vòng lặp.

### Sticker mèo

15 bé mèo được **tách tự động** từ `Resources/MauMeo.jpg`: flood-fill nền kem từ mọi pixel biên,
rồi lọc connected component để bỏ tim/hoa/dấu chân trang trí, cuối cùng cắt theo bounding box.
Bộ sticker còn lại là [Microsoft Fluent Emoji](https://github.com/microsoft/fluentui-emoji)
style 3D (giấy phép MIT) — xem `public/stickers/index.json`.

### Giao diện trên điện thoại

Không có hàng nút cuộn ngang giấu chức năng. Thay vào đó, theo lối các app ghi chú:

- **Thanh dưới cố định**: `‹` · nút chế độ (bấm mới bung Viết/Vẽ/Sticker) · số trang (bấm mở mục
  lục) · `＋` · `›`. Công cụ vẽ chỉ hiện khi đang ở chế độ vẽ.
- **Menu ⋯**: mục lục, thêm trang, kiểu giấy, tiếng giấy, đổi bạn mèo, đăng nhập.
- Khay sticker và mục lục là **bottom sheet**; mọi nút ≥44px; ô nhập ≥16px để iOS không tự phóng to.
- Tôn trọng `env(safe-area-inset-*)` và **bàn phím ảo**: chiều cao thật lấy từ `visualViewport`
  và cuốn sổ được định vị tuyệt đối + scale, nên bàn phím bật lên không đẩy thanh công cụ ra
  khỏi màn hình.

---

## Deploy

Xem `../docs/deploy.md`. Tóm tắt: push GitHub → Vercel import repo với **Root Directory =
`meow-diary/frontend`** → khai 2 biến `VITE_*` → nhớ thêm domain production vào Supabase
(URL Configuration) và Google Cloud (Authorized JavaScript origins).

GitHub Actions (`.github/workflows/ci.yml`) chạy typecheck + build và **kiểm tra `dist/sw.js` +
`dist/manifest.webmanifest` có được sinh ra không** — PWA hỏng thường rất im lặng.

---

## Giới hạn đã biết

- Nét vẽ nằm chung trong `jsonb`; vẽ rất nhiều trang sẽ phình dữ liệu. Hướng xử lý: đẩy ảnh sang
  Supabase Storage (đã phân tích trong `docs/research-backend-2026-08.md` mục 2).
- Supabase free tier tự pause sau ~7 ngày không có request; bấm Restore là chạy lại, không mất dữ liệu.
- Chưa có giải quyết xung đột khi hai máy sửa cùng lúc lúc đang offline — bản có `updatedAt`
  mới hơn sẽ ghi đè bản kia.
- Tiếng lật giấy chỉ kêu sau khi người dùng chạm vào trang lần đầu (chính sách autoplay của trình duyệt).

## Bẫy khi test bản đã build

Service worker **giữ bản cũ trong cache**. Sửa code xong build lại mà thấy lỗi cũ vẫn còn thì
gần như chắc chắn bạn đang chạy bản cũ, không phải code chưa sửa — chuyện này đã xảy ra thật
trong lúc sửa bug lật trang.

- Đã bật `skipWaiting` + `clientsClaim` + `cleanupOutdatedCaches` nên bản mới chiếm quyền ngay
  từ lần tải lại đầu tiên.
- Nếu vẫn nghi ngờ: DevTools → Application → Service Workers → *Unregister*, rồi Clear storage.
  Hoặc chạy trong Console:
  ```js
  (async () => {
    for (const r of await navigator.serviceWorker.getRegistrations()) await r.unregister()
    for (const k of await caches.keys()) await caches.delete(k)
    location.reload()
  })()
  ```
