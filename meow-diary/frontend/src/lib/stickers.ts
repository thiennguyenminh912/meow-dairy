import { CATS } from './cats'
import type { StickerKind } from './types'

export interface StickerItem {
  kind: StickerKind
  value: string
  name: string
}

export interface StickerGroup {
  id: string
  label: string
  items: StickerItem[]
}

interface Manifest {
  license: string
  source: string
  groups: { id: string; label: string; items: { file: string; name: string }[] }[]
}

const CAT_GROUP: StickerGroup = {
  id: 'cat',
  label: '🐱 Mèo',
  items: CATS.map((c) => ({ kind: 'cat' as const, value: c.src, name: c.name })),
}

let cache: StickerGroup[] | null = null

/** Bộ sticker Fluent Emoji 3D (MIT) nằm trong public/stickers */
export async function loadStickerGroups(): Promise<StickerGroup[]> {
  if (cache) return cache
  try {
    const res = await fetch('/stickers/index.json')
    const data = (await res.json()) as Manifest
    cache = [
      CAT_GROUP,
      ...data.groups.map((g) => ({
        id: g.id,
        label: g.label,
        items: g.items.map((it) => ({
          kind: 'img' as const,
          value: `/stickers/${it.file}`,
          name: it.name,
        })),
      })),
    ]
  } catch {
    cache = [CAT_GROUP]
  }
  return cache
}
