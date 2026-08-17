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
  /** sửa lần cuối lúc nào (ms) — để gộp hai thiết bị mà không mất trang */
  updatedAt?: number
  /** ảnh nét vẽ đã encode (dataURL) */
  drawing: string | null
  stickers: Sticker[]
  ruling: Ruling
}

/** tuỳ chọn đi theo người dùng, đồng bộ cùng nhật ký */
export interface DiarySettings {
  soundOn: boolean
  /** kiểu giấy dùng cho trang mới */
  defaultRuling: Ruling
}

export interface Diary {
  ownerName: string
  buddyId: string | null
  buddyName: string
  settings?: DiarySettings
  pages: DiaryPage[]
  /** thời điểm sửa gần nhất (ms) — dùng để chọn bản mới hơn khi đồng bộ */
  updatedAt?: number
}
