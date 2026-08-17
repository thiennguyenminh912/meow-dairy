import type { Diary, DiaryPage, DiarySettings } from './types'

export const DEFAULT_SETTINGS: DiarySettings = { soundOn: true, defaultRuling: 'line' }

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
    updatedAt: Date.now(),
    ...partial,
  }
}

export function emptyDiary(): Diary {
  return {
    ownerName: '',
    buddyId: null,
    buddyName: '',
    settings: { ...DEFAULT_SETTINGS },
    pages: [makePage(), makePage()],
  }
}

export function loadDiary(): Diary | null {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Diary
    if (!parsed || !Array.isArray(parsed.pages)) return null
    // sổ lưu từ bản cũ chưa có settings
    return { ...parsed, settings: { ...DEFAULT_SETTINGS, ...parsed.settings } }
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
