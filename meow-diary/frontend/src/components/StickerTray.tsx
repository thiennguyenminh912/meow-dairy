import { useEffect, useState } from 'react'
import Sheet from './Sheet'
import { loadStickerGroups, type StickerGroup, type StickerItem } from '../lib/stickers'

interface Props {
  /** bắt đầu nhấc sticker; App tự phân biệt click (dán nhanh) và kéo thả */
  onDragStart: (item: StickerItem, e: React.PointerEvent) => void
  onClose: () => void
}

export default function StickerTray({ onDragStart, onClose }: Props) {
  const [groups, setGroups] = useState<StickerGroup[]>([])
  const [tab, setTab] = useState('cat')

  useEffect(() => {
    let alive = true
    loadStickerGroups().then((g) => alive && setGroups(g))
    return () => {
      alive = false
    }
  }, [])

  const current = groups.find((g) => g.id === tab) ?? groups[0]

  return (
    <Sheet variant="tray-sheet" title="Sticker" onClose={onClose}>
      <div className="tray-tabs" data-native-touch>
        {groups.map((g) => (
          <button
            key={g.id}
            className={`chip${g.id === (current?.id ?? '') ? ' active' : ''}`}
            onClick={() => setTab(g.id)}
          >
            {g.label}
          </button>
        ))}
      </div>

      <div className="tray-grid" data-no-sheet-drag>
        {current?.items.map((item) => (
          <button
            key={item.value}
            title={item.name}
            onPointerDown={(e) => onDragStart(item, e)}
          >
            {item.kind === 'emoji' ? (
              <span className="emoji">{item.value}</span>
            ) : (
              <img src={item.value} alt={item.name} draggable={false} />
            )}
          </button>
        ))}
      </div>

      <p className="tray-hint">Kéo thả vào trang · hoặc bấm để dán vào trang đang chọn</p>
    </Sheet>
  )
}
