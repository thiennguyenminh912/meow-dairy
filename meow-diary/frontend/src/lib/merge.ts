import { DEFAULT_SETTINGS } from './storage'
import type { Diary, DiaryPage } from './types'

/** trang chưa có gì: không tiêu đề, không chữ, không nét vẽ, không sticker */
export const isBlankPage = (p: DiaryPage) =>
  !p.title.trim() && !p.text.trim() && !p.drawing && p.stickers.length === 0

/** cuốn sổ chưa được viết gì — dùng để biết bên nào là bản "mới toanh" */
export const isBlankDiary = (d: Diary) => d.pages.every(isBlankPage)

/** đếm lượng nội dung của một trang, để khi hai bên cùng sửa thì giữ bản đậm đà hơn */
const weigh = (p: DiaryPage) =>
  p.title.trim().length + p.text.trim().length + (p.drawing ? 5000 : 0) + p.stickers.length * 50

function pickPage(a: DiaryPage, b: DiaryPage): DiaryPage {
  const ta = a.updatedAt ?? 0
  const tb = b.updatedAt ?? 0
  if (ta !== tb) return ta > tb ? a : b
  return weigh(a) >= weigh(b) ? a : b
}

/**
 * Gộp hai cuốn sổ mà KHÔNG bỏ sót trang nào.
 *
 * Nguyên tắc: thà thừa một trang trắng còn hơn mất một trang có chữ.
 * - Bên nào chưa viết gì thì nhường hẳn bên kia (khỏi sinh ra trang trắng thừa).
 * - Trang cùng id  → giữ bản sửa sau (hoặc bản nhiều nội dung hơn nếu không có mốc thời gian).
 * - Trang chỉ có ở một bên → luôn giữ lại.
 * - Thứ tự lấy theo bản mới hơn, trang lạ của bên kia nối vào cuối.
 */
export function mergeDiaries(local: Diary, remote: Diary): Diary {
  if (isBlankDiary(local)) return remote
  if (isBlankDiary(remote)) return local

  const newerIsRemote = (remote.updatedAt ?? 0) >= (local.updatedAt ?? 0)
  const lead = newerIsRemote ? remote : local
  const follow = newerIsRemote ? local : remote

  const byId = new Map<string, DiaryPage>()
  for (const p of lead.pages) byId.set(p.id, p)
  for (const p of follow.pages) {
    const existing = byId.get(p.id)
    byId.set(p.id, existing ? pickPage(existing, p) : p)
  }

  const order: string[] = []
  for (const p of lead.pages) order.push(p.id)
  for (const p of follow.pages) if (!order.includes(p.id)) order.push(p.id)

  return {
    ...lead,
    // thông tin cá nhân: lấy của bản mới hơn, nhưng không để trống đè lên có
    ownerName: lead.ownerName || follow.ownerName,
    buddyId: lead.buddyId ?? follow.buddyId,
    buddyName: lead.buddyName || follow.buddyName,
    settings: { ...DEFAULT_SETTINGS, ...follow.settings, ...lead.settings },
    pages: order.map((id) => byId.get(id)!),
    updatedAt: Math.max(local.updatedAt ?? 0, remote.updatedAt ?? 0),
  }
}

// tiện cho việc kiểm thử tay trong lúc phát triển
if (import.meta.env.DEV) {
  ;(window as unknown as Record<string, unknown>).__meowMerge = { mergeDiaries, isBlankDiary }
}
