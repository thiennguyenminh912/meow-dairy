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
    Sheet.tsx             # panel nổi (máy tính) / bottom sheet (điện thoại) dùng chung
  lib/
    types.ts  storage.ts  supabase.ts  cats.ts  stickers.ts  catLines.ts  sound.ts
    mobile.ts             # chặn phóng to hai ngón / kéo nảy…, đo vị trí con trỏ nhập
    overlay.ts            # nút Back của máy đóng panel đang mở thay vì thoát app
public/
  cats/       # 15 sticker mèo PNG nền trong suốt (tách từ Resources/MauMeo.jpg)
  stickers/   # 63 sticker Fluent Emoji 3D + index.json (7 nhóm, tên tiếng Việt)
  icons/      # bộ icon PWA (thường + maskable + apple-touch)
```

---

## Tính năng

| Khu vực | Chi tiết |
|---|---|
| **Lật trang** | **Ngón tay: vuốt ngang ở bất kỳ đâu trên trang** — đúng như lật sổ thật, không phải mò đúng một góc. **Chuột: rê tới góc dưới** → góc giấy cuộn lên, nắm kéo ngang; thả giữa chừng thì trang bật lại. Ngoài ra: nút hai bên (máy tính), nút trong thanh dưới (điện thoại), phím ← →. Có tiếng giấy tạo bằng WebAudio (tắt được) |
| **Viết** | Textarea trong suốt căn đúng dòng kẻ, font viết tay Playpen Sans (đủ dấu tiếng Việt) |
| **Vẽ** | Canvas riêng mỗi trang · 6 màu bút · chỉnh độ dày · tẩy · hoàn tác 15 bước · xoá cả trang |
| **Sticker** | 15 mèo + 63 Fluent Emoji 3D chia 7 nhóm. Kéo thả từ khay vào trang (có ghost bay theo tay) hoặc bấm để dán nhanh; sau đó kéo di chuyển, phóng to/thu nhỏ, xoay, gỡ |
| **Giấy** | Kẻ ngang / chấm bi / trơn, đổi riêng từng trang |
| **Trang** | Thêm trang mới; mục lục nhảy tới trang bất kỳ và **kéo ⠿ đổi thứ tự** (chạy được cả bằng ngón tay) |
| **Xé trang** | Nút ✂️ ngay **góc trang cần xé** — bấm lần đầu trang rạn nứt + rung, hộp xác nhận nổi giữa trang, bấm lần nữa thì trang xé rời bay ra |
| **Trên điện thoại** | Vuốt lật trang · mọi panel là bottom sheet đóng được bằng 5 cách · viết chữ mà cuốn sổ giữ nguyên cỡ · chặn phóng to hai ngón / kéo nảy / giữ-lâu-ra-menu — xem "Giao diện trên điện thoại" bên dưới |
| **Bạn mèo** | 15 bé để chọn · 7 trạng thái cảm xúc có animation riêng (vui, quẩy, khóc, ngủ, thương, ngáo, thường) · ~40 câu thoại chill/động viên + câu riêng cho ban đêm · phản ứng theo hành động (lật trang, viết, vẽ, dán sticker, xé trang) · bấm để xoa đầu · **kéo thả tới chỗ bất kỳ**, thu nhỏ/phóng to, tự mờ đi khi bạn đang gõ · vị trí và cỡ được nhớ |
| **PWA** | Cài về màn hình chính, chạy offline hoàn toàn (98 file precache ~4MB, gồm cả sticker) |
| **Âm thanh** | Tất cả tổng hợp bằng WebAudio, không dùng file: lật trang kêu "meo" khẽ (có giới hạn 1.2s/lần), xoa đầu mèo kêu "chíu", thỉnh thoảng mèo ngân nga vài nốt ngũ cung. Tắt/bật bằng một nút |
| **Đồng bộ** | Đăng nhập Google → nhật ký lưu lên Supabase, mở máy khác thấy y nguyên. Nút đăng nhập có sẵn **ngay màn chọn mèo** để người quay lại lấy nhật ký cũ trước khi tạo sổ mới |
| **Tuỳ chọn theo người** | Bật/tắt tiếng, kiểu giấy mặc định, bạn mèo, tên chủ — nằm trong cuốn sổ nên đi theo tài khoản, không dính vào một máy |

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

### Đồng bộ: tuyệt đối không được nuốt mất trang

Phiên bản đầu chọn theo kiểu "bên nào mới hơn thì thắng cả cuốn" — và nó **ăn mất bài viết thật**:
máy mới mở web có `localStorage` trống, app dựng sổ trắng rồi lưu ngay, thế là mốc thời gian của
sổ trắng mới tinh **lớn hơn** bản trên mây viết từ hôm trước. Đăng nhập vào là bản trắng thắng,
rồi lần lưu kế tiếp đẩy luôn bản trắng đè lên đám mây.

Nay `lib/merge.ts` hợp nhất theo nguyên tắc *thà thừa một trang trắng còn hơn mất một trang có chữ*:

- Bên nào **chưa viết gì** thì nhường hẳn bên kia (khỏi đẻ ra trang trắng thừa).
- Trang **trùng id** → giữ bản có `updatedAt` mới hơn; không có mốc thì giữ bản nhiều nội dung hơn
  (chữ + nét vẽ + sticker).
- Trang **chỉ có ở một bên** → luôn giữ.
- Thứ tự theo bản mới hơn, trang lạ của bên kia nối vào cuối.

Bốn tình huống đã kiểm thử (chạy thật trong trình duyệt qua `window.__meowMerge` ở chế độ dev):

| Tình huống | Kết quả |
|---|---|
| Web còn trắng gặp bản trên mây có bài | giữ nguyên bài, bỏ trang trắng thừa |
| Máy có bài gặp bản trên mây trắng | giữ nguyên bài |
| Hai bên đều có bài khác nhau | đủ cả 3 trang, không mất bên nào |
| Cùng một trang sửa ở hai nơi | bản sửa sau thắng, cả hai chiều gộp |

### Âm thanh

Không có file audio nào, tất cả dựng bằng WebAudio (`lib/sound.ts`):

- **"Meo"** — dao động triangle với cao độ đi lên rồi rơi, qua hai bandpass quét từ formant "e"
  sang "o" nên nghe ra tiếng mèo chứ không phải tiếng còi.
- **"Chíu"** — sine ngắn 0.22s khi xoa đầu mèo.
- **"La la lá"** — 4–5 nốt ngũ cung (Đô-Rê-Mi-Sol-La, ghép kiểu gì cũng thuận tai) kèm vibrato nhẹ.

Chống chói: chỉ sine/triangle, mọi thứ đi qua lowpass 2.2kHz, bao hình vào/ra mềm để không có
tiếng "tạch". Đo bằng `OfflineAudioContext` — đỉnh biên độ 0.11–0.14 (không hề clip), năng lượng
trên 4kHz chỉ 2.6–4.3%.

### Lưu trữ

- **Máy này**: toàn bộ nhật ký nằm trong một khoá `localStorage` (`meow-diary-v1`), ghi sau 600ms
  ngừng thao tác. Nét vẽ lưu dạng **WebP dataURL** (nhẹ hơn PNG nhiều) — `localStorage` chỉ có ~5MB
  nên khi đầy app sẽ báo thay vì im lặng mất dữ liệu.
- **Đám mây**: bảng `diaries` — một dòng cho một người, cột `data jsonb` + `updated_at`. RLS bật,
  4 policy đều là `auth.uid() = user_id`, nên không ai đọc được nhật ký của người khác.
- **Chọn bản nào khi hai máy lệch nhau**: so `updatedAt`; bản mới hơn thắng. Khi kéo bản trên mây
  về, một cờ `skipSync` chặn việc đẩy ngược lên để không tạo vòng lặp.
- **Chưa đọc được bản trên mây thì không đẩy gì lên** (`cloudKnown`). Trước đây fetch lỗi (mất
  mạng, token hết hạn) thì app vẫn đẩy sổ hiện có lên — mà lúc đó nó có thể đang là sổ trắng.
  Nay lần lưu kế tiếp sẽ thử đọc lại thay vì đẩy đại.

### Khởi động: chưa biết mình là ai thì chưa được hỏi gì

Bản cũ quyết định "có bắt chọn mèo không" ngay lúc mount, chỉ dựa vào `localStorage`. Người dùng
đã đăng nhập nhưng mở trên máy khác / xoá cache / cài lại PWA thì `localStorage` trống → app bắt
chọn mèo và đặt tên lại từ đầu, dù nhật ký vẫn còn nguyên trên đám mây.

Nay có một pha `booting`: khi đã cấu hình Supabase, app hiện màn hình chờ cho tới khi biết xong
phiên đăng nhập **và** (nếu có đăng nhập) đọc xong bản trên mây, rồi mới quyết định. Có hàng rào
8 giây để mạng chập chờn cũng không treo mãi, và trong lúc `booting` thì tuyệt đối không lưu/đẩy
gì — nếu không sổ trắng lúc khởi động sẽ đè lên bản thật.

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
- Mọi nút ≥44px; ô nhập ≥16px để iOS không tự phóng to; tôn trọng `env(safe-area-inset-*)`.

Bốn thứ dưới đây là chỗ bản đầu làm sai, và cách sửa:

#### 1. Chặn hành vi mặc định của trình duyệt (`lib/mobile.ts`)

Web muốn giống app thì phải tắt mấy thứ chỉ hợp với trang tài liệu:

- **Phóng to hai ngón** — `user-scalable=no` bị iOS Safari bỏ qua từ iOS 10, nên phải chặn bằng JS:
  `touchstart`/`touchmove` có từ 2 ngón thì `preventDefault`, cộng thêm bộ sự kiện riêng của
  WebKit (`gesturestart/change/end`).
- **Chạm hai lần để phóng to** — `touch-action: manipulation`. *Không* dùng mẹo chặn `touchend`
  trong 300ms: nó nuốt luôn cú bấm thứ hai, bấm nút lật trang liên tiếp sẽ mất một nhịp.
- **Kéo nảy / kéo-xuống-để-tải-lại** — `body { position: fixed; inset: 0; overflow: hidden }`.
  Một dòng này diệt luôn cả cú tự cuộn của iOS mỗi lần chạm vào ô nhập. Phần còn lại: chạm vào
  chỗ không có gì để cuộn thì chặn `touchmove` (quyết định **một lần** lúc chạm xuống, không đo
  lại mỗi khung hình).
- **Giữ lâu ra menu "Lưu ảnh"** — `-webkit-touch-callout: none` + chặn `contextmenu`, nhưng chừa
  lại ô nhập để còn dán chữ được.

#### 2. Panel nào cũng đóng được bằng 5 cách (`components/Sheet.tsx`)

Mục lục bản cũ chỉ đóng được bằng đúng cái nút đã mở nó — trên điện thoại thì gần như là bí.
Nay mọi thứ bung ra (mục lục, khay sticker, menu ⋯) đều đi qua một component: **vuốt xuống ·
chạm nền mờ · nút ✕ · phím Esc · nút Back của máy**. Ngưỡng vuốt lấy theo `vaul`: đóng khi hất
tay nhanh hơn `0.4 px/ms` **hoặc** kéo quá 25% chiều cao, vận tốc tính trên cửa sổ mẫu 100ms
(một khung hình quá nhiễu).

Hai chi tiết dễ sai:

- Sheet phải **render vào `document.body` qua portal**: sân khấu cuốn sổ có `perspective` nên nó
  trở thành khung quy chiếu của mọi `position: fixed` bên trong — để trong đó thì sheet dính vào
  đáy sân khấu chứ không phải đáy màn hình, còn nền mờ bị `overflow: hidden` cắt cụt.
- Chỗ đã có cử chỉ kéo riêng (nhấc sticker, kéo ⠿ đổi thứ tự trang) phải gắn `data-no-sheet-drag`,
  nếu không kéo sticker xuống là sheet tưởng mình bị đuổi.
- Nút Back: giữ đúng **một** mốc lịch sử giả trong lúc còn panel mở, và việc thêm/gỡ mốc hoãn tới
  cuối lượt render (`lib/overlay.ts`) — nếu không, lúc đóng menu ⋯ để mở mục lục, mốc cũ bị gỡ rồi
  thêm lại và cú `history.back()` đang xếp hàng sẽ đóng luôn cái vừa mở.

#### 3. Viết chữ: cuốn sổ không được thu nhỏ

Bản cũ lấy `visualViewport.height` làm chiều cao để tính `scale`, nên bàn phím bật lên là cuốn sổ
teo lại còn ~60% — chữ bé tí, viết rất khó chịu. Ba thay đổi:

- **Bỏ `interactive-widget=resizes-content`** khỏi thẻ viewport. Nó co luôn layout viewport khi bàn
  phím bật. Để mặc định (`resizes-visual`) thì `window.innerHeight` đứng yên, chỉ `visualViewport`
  co — nhờ đó đo được chiều cao bàn phím: `innerHeight - visualViewport.height - offsetTop`.
- **Cỡ sổ tính theo chiều cao lúc chưa có bàn phím** (`roomH`), nên nó không đổi một pixel nào.
- **Trượt cuốn sổ lên theo con trỏ nhập** (`--kb-lift`): textarea không cho hỏi thẳng toạ độ caret,
  nên dựng một div "gương" cùng font/padding/độ rộng, đổ vào phần chữ đứng trước con trỏ rồi đo
  `offsetTop` của phần còn lại — nhớ nhân với tỉ lệ `scale` của cuốn sổ. Cùng lúc đó thanh trên ẩn
  đi, thanh dưới rút còn mỗi nút "✓ Xong", mèo tạm lánh.

#### 4. Lật trang và con mèo

- **Vuốt ngang ở bất kỳ đâu trên trang**, không chỉ ở góc. `touch-action: pan-y` trên sân khấu để
  trình duyệt tự lọc hộ cú cuộn dọc; JS chỉ khoá trục sau khi ngón tay đi được 10px và chiều ngang
  hơn chiều dọc 1.2 lần. Lật khi `|vx| > 0.4 px/ms && |dx| > 40px` **hoặc** kéo quá 25% bề ngang
  trang (ngưỡng tham khảo Embla / use-gesture / Swiper). `pointercancel` → nhả trang về chỗ cũ.
  Vùng nắm góc `.corner-hot` bị ẩn trên `pointer: coarse` vì nó chỉ tổ cướp mất cú vuốt.
  Đang gõ dở thì vuốt trên ô chữ là để chọn chữ, không lật.
- **Mèo ngồi phía trên** ở màn hẹp (`SPOTS_NARROW`) — góc dưới là chỗ mép trang quét qua lúc lật.
  Khung bao mèo `pointer-events: none`, chỉ mình con mèo nhận chạm.
  Và một lỗi thật: chỗ kéo mèo dùng `e.movementX`, mà Safari trên iOS trả 0 cho pointer event của
  ngón tay → mèo không tài nào kéo đi được. Nay so với điểm bắt đầu.

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
