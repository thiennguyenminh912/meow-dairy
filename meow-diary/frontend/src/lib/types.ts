export type Ruling = 'line' | 'dot' | 'blank'

export type StickerKind = 'cat' | 'img' | 'emoji'

export interface Sticker {
  id: string
  kind: StickerKind
  /** cat/img: đường dẫn ảnh — emoji: ký tự (dữ liệu cũ) */
  value: string
  /** vị trí tính theo % chiều rộng/cao của trang */
  x: number
  y: number
  scale: number
  rotation: number
}

export interface DiaryPage {
  id: string
  date: string
  title: string
  text: string
  /** ảnh nét vẽ đã encode (dataURL) */
  drawing: string | null
  stickers: Sticker[]
  ruling: Ruling
}

export interface Diary {
  ownerName: string
  buddyId: string | null
  buddyName: string
  pages: DiaryPage[]
  /** thời điểm sửa gần nhất (ms) — dùng để chọn bản mới hơn khi đồng bộ */
  updatedAt?: number
}
