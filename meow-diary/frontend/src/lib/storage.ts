import type { Diary, DiaryPage } from './types'

const KEY = 'meow-diary-v1'

export const uid = () => Math.random().toString(36).slice(2, 10)

export const todayLabel = (d = new Date()) =>
  `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`

export function makePage(partial: Partial<DiaryPage> = {}): DiaryPage {
  return {
    id: uid(),
    date: todayLabel(),
    title: '',
    text: '',
    drawing: null,
    stickers: [],
    ruling: 'line',
    ...partial,
  }
}

export function emptyDiary(): Diary {
  return {
    ownerName: '',
    buddyId: null,
    buddyName: '',
    pages: [makePage({ title: 'Trang đầu tiên' }), makePage({ title: '' })],
  }
}

export function loadDiary(): Diary | null {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Diary
    if (!parsed || !Array.isArray(parsed.pages)) return null
    return parsed
  } catch {
    return null
  }
}

export function saveDiary(diary: Diary) {
  try {
    localStorage.setItem(KEY, JSON.stringify(diary))
    return true
  } catch {
    // hết dung lượng localStorage (thường do quá nhiều nét vẽ)
    return false
  }
}
