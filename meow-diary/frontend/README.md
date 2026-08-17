# Meow Diary 🐾

Nhật ký giả lập sổ giấy thật: lật trang 3D, giấy kẻ ngang/chấm bi, viết chữ, vẽ tay, dán sticker mèo.
React + Vite + TypeScript, **không backend, không DB** — mọi thứ lưu trong `localStorage`.

## Chạy

```bash
cd meow-diary/frontend
pnpm install
pnpm dev       # http://localhost:5173  (cần Node >= 18)
pnpm build && pnpm preview   # bản production, có PWA + chạy offline
```

## Cấu trúc kho

```
VillaQuest/
  meow-diary/
    frontend/          # app React (chỗ bạn đang đọc)
    docs/              # research backend/auth/DB
  Resources/           # ảnh gốc dùng để tách sticker
```

## Tính năng

| Khu vực | Mô tả |
|---|---|
| Chọn bạn đồng hành | 15 bé mèo, đặt tên chủ + tên mèo |
| Bạn mèo | Nhảy giữa 4 góc màn hình, 7 trạng thái cảm xúc (vui/quẩy/khóc/ngủ/thương/ngáo), ~40 câu thoại chill; bấm vào mèo để xoa đầu |
| Lật trang | Rê chuột tới góc dưới → góc giấy cuộn lên; nắm góc kéo ngang để lật như sổ thật (thả giữa chừng thì trang bật lại). Vẫn có nút hai bên + phím ← →, kèm tiếng giấy (WebAudio, tắt được) |
| Viết | Textarea trong suốt căn đúng dòng kẻ, font viết tay Playpen Sans |
| Vẽ | Canvas mỗi trang, 6 màu bút, chỉnh độ dày, tẩy, hoàn tác, xoá hết |
| Sticker | 15 mèo + 63 sticker Fluent Emoji 3D chia 7 nhóm; **kéo thả từ khay vào trang** (hoặc bấm để dán nhanh), kéo di chuyển, phóng to/thu nhỏ, xoay, gỡ |
| Giấy | Kẻ ngang / chấm bi / trơn theo từng trang |
| Mục lục | Nhảy tới trang bất kỳ, **kéo ⠿ đổi thứ tự trang**, xé trang ngay trong danh sách |
| Mèo tuỳ chỉnh | Kéo thả mèo tới bất kỳ đâu, thu nhỏ/phóng to, thả tự do lại; mèo mờ đi khi đang gõ; vị trí + cỡ được nhớ |
| PWA | Cài về màn hình chính (manifest + service worker), chạy offline hoàn toàn |
| Mobile / iPad | Dưới 900px tự chuyển chế độ **một trang** + bộ điều khiển gọn: thanh dưới cố định (‹ · chế độ · số trang · ＋ · ›), menu **⋯** cho mục lục/kiểu giấy/tiếng giấy/đổi mèo, công cụ vẽ chỉ hiện khi đang vẽ, khay sticker & mục lục là bottom sheet. Không có hàng nút cuộn ngang giấu chức năng; mọi nút ≥44px, chữ ≥16px (iOS không tự phóng), tôn trọng safe-area + bàn phím ảo (`visualViewport`) |
| Xé trang | Nút ✂️ nằm ngay góc trang cần xé (không phải nút chung ở thanh trên) — bấm lần đầu trang rạn nứt và hiện hộp xác nhận giữa trang |

## Cấu trúc

```
src/
  App.tsx                 # state cuốn sổ, dựng các mặt giấy, lật-kéo-góc, xé trang, kéo thả sticker
  components/
    Book.tsx              # khung 3D: gộp 2 mặt giấy thành 1 tờ, z-index + góc lật + vùng nắm góc
    Page.tsx              # 1 trang: dòng kẻ + chữ + canvas + sticker + vết nứt
    DrawCanvas.tsx        # canvas vẽ, lưu dataURL webp
    StickerLayer.tsx      # kéo thả / chỉnh sticker trên trang
    StickerTray.tsx       # khay sticker theo nhóm
    CatBuddy.tsx          # bé mèo: chỗ đậu, cảm xúc, lời thoại, hiệu ứng
    Toolbar.tsx           # thanh công cụ máy tính (>=900px)
    MobileBar.tsx         # thanh dưới cho điện thoại/máy tính bảng dọc
    MobileMenu.tsx        # sheet ⋯ gom thao tác ít dùng
    CatPicker.tsx         # màn chọn bạn mèo
  lib/                    # types, cats, stickers, catLines, storage (localStorage), sound
public/cats/              # 15 sticker mèo PNG nền trong suốt
public/stickers/          # 63 sticker Fluent Emoji 3D + index.json (nhóm, tên tiếng Việt)
```

## Lưu ý

- Nét vẽ lưu dạng ảnh WebP base64 trong `localStorage` (~5MB tổng). Vẽ quá nhiều trang sẽ đầy —
  app hiện thông báo và bạn cần xoá bớt nét vẽ.
- Sticker mèo được tách tự động từ `Resources/MauMeo.jpg` (flood-fill nền + lọc connected component).
- Bộ sticker trong `public/stickers/` lấy từ [Microsoft Fluent Emoji](https://github.com/microsoft/fluentui-emoji)
  (style 3D, giấy phép MIT) — xem `public/stickers/index.json`.
