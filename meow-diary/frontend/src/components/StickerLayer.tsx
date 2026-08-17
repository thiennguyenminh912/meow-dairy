import { useRef } from 'react'
import type { Sticker } from '../lib/types'

interface Props {
  stickers: Sticker[]
  active: boolean
  selectedId: string | null
  onSelect: (id: string | null) => void
  onChange: (stickers: Sticker[]) => void
}

export default function StickerLayer({ stickers, active, selectedId, onSelect, onChange }: Props) {
  const layerRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<{ id: string; dx: number; dy: number } | null>(null)

  const patch = (id: string, next: Partial<Sticker>) =>
    onChange(stickers.map((s) => (s.id === id ? { ...s, ...next } : s)))

  const onPointerDown = (e: React.PointerEvent, sticker: Sticker) => {
    if (!active) return
    e.stopPropagation()
    const rect = layerRef.current?.getBoundingClientRect()
    if (!rect) return
    onSelect(sticker.id)
    dragRef.current = {
      id: sticker.id,
      dx: ((e.clientX - rect.left) / rect.width) * 100 - sticker.x,
      dy: ((e.clientY - rect.top) / rect.height) * 100 - sticker.y,
    }
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  }

  const onPointerMove = (e: React.PointerEvent) => {
    const drag = dragRef.current
    const rect = layerRef.current?.getBoundingClientRect()
    if (!drag || !rect) return
    const x = ((e.clientX - rect.left) / rect.width) * 100 - drag.dx
    const y = ((e.clientY - rect.top) / rect.height) * 100 - drag.dy
    patch(drag.id, {
      x: Math.min(98, Math.max(2, x)),
      y: Math.min(98, Math.max(2, y)),
    })
  }

  const endDrag = () => {
    dragRef.current = null
  }

  return (
    <div
      ref={layerRef}
      className="sticker-layer"
      style={{ pointerEvents: active ? 'auto' : 'none' }}
      onPointerDown={() => onSelect(null)}
    >
      {stickers.map((s) => {
        const selected = active && s.id === selectedId
        return (
          <div
            key={s.id}
            className={`sticker${active ? ' editable' : ''}${selected ? ' selected' : ''}`}
            style={{
              left: `${s.x}%`,
              top: `${s.y}%`,
              transform: `translate(-50%, -50%) rotate(${s.rotation}deg) scale(${s.scale})`,
            }}
            onPointerDown={(e) => onPointerDown(e, s)}
            onPointerMove={onPointerMove}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
          >
            {s.kind === 'emoji' ? (
              <span className="emoji">{s.value}</span>
            ) : (
              <img src={s.value} alt="sticker" draggable={false} />
            )}

            {selected && (
              <div
                className="sticker-tools"
                style={{ transform: `translateX(-50%) rotate(${-s.rotation}deg)` }}
                onPointerDown={(e) => e.stopPropagation()}
              >
                <button title="Nhỏ lại" onClick={() => patch(s.id, { scale: Math.max(0.3, s.scale - 0.15) })}>
                  ➖
                </button>
                <button title="To lên" onClick={() => patch(s.id, { scale: Math.min(3, s.scale + 0.15) })}>
                  ➕
                </button>
                <button title="Xoay" onClick={() => patch(s.id, { rotation: s.rotation + 15 })}>
                  🔄
                </button>
                <button
                  title="Gỡ sticker"
                  onClick={() => {
                    onSelect(null)
                    onChange(stickers.filter((x) => x.id !== s.id))
                  }}
                >
                  🗑️
                </button>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
