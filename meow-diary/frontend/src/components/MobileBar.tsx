import { useEffect, useRef, useState } from 'react'
import type { Mode } from './Page'
import { PEN_COLORS } from './Toolbar'

const MODES: { id: Mode; icon: string; label: string }[] = [
  { id: 'write', icon: '✏️', label: 'Viết' },
  { id: 'draw', icon: '🖍', label: 'Vẽ' },
  { id: 'sticker', icon: '🐾', label: 'Sticker' },
]

interface Props {
  mode: Mode
  setMode: (m: Mode) => void
  color: string
  setColor: (c: string) => void
  brush: number
  setBrush: (n: number) => void
  eraser: boolean
  setEraser: (b: boolean) => void
  onUndo: () => void
  onClearDrawing: () => void
  onPrev: () => void
  onNext: () => void
  canPrev: boolean
  canNext: boolean
  posLabel: string
  onOpenIndex: () => void
  onAddPage: () => void
  /** bàn phím ảo đang bật — nhường hết chỗ cho trang giấy, chỉ chừa nút "Xong" */
  keyboardOpen: boolean
  onDoneTyping: () => void
}

/** Thanh công cụ dưới cùng cho điện thoại: mọi thứ vừa một hàng, không cuộn ngang */
export default function MobileBar({
  mode,
  setMode,
  color,
  setColor,
  brush,
  setBrush,
  eraser,
  setEraser,
  onUndo,
  onClearDrawing,
  onPrev,
  onNext,
  canPrev,
  canNext,
  posLabel,
  onOpenIndex,
  onAddPage,
  keyboardOpen,
  onDoneTyping,
}: Props) {
  const [modeOpen, setModeOpen] = useState(false)
  const [brushOpen, setBrushOpen] = useState(false)
  const barRef = useRef<HTMLDivElement>(null)

  // chạm ra ngoài thì đóng các popover
  useEffect(() => {
    if (!modeOpen && !brushOpen) return
    const onDown = (e: PointerEvent) => {
      if (!barRef.current?.contains(e.target as Node)) {
        setModeOpen(false)
        setBrushOpen(false)
      }
    }
    document.addEventListener('pointerdown', onDown)
    return () => document.removeEventListener('pointerdown', onDown)
  }, [modeOpen, brushOpen])

  const current = MODES.find((m) => m.id === mode) ?? MODES[0]

  // đang gõ thì cả thanh công cụ nhường chỗ, chỉ còn một nút thoát bàn phím
  if (keyboardOpen) {
    return (
      <div className="mobile-bar typing">
        <button className="done-btn" onClick={onDoneTyping}>
          ✓ Xong
        </button>
      </div>
    )
  }

  return (
    <div className="mobile-bar" ref={barRef}>
      {/* công cụ vẽ chỉ hiện khi đang ở chế độ vẽ */}
      {mode === 'draw' && (
        <div className="draw-row">
          {PEN_COLORS.map((c) => (
            <button
              key={c}
              className={`swatch${color === c && !eraser ? ' active' : ''}`}
              style={{ background: c }}
              aria-label="Màu bút"
              onClick={() => {
                setColor(c)
                setEraser(false)
              }}
            />
          ))}
          <button
            className={`round${eraser ? ' active' : ''}`}
            aria-label="Tẩy"
            onClick={() => setEraser(!eraser)}
          >
            🧽
          </button>
          <button className="round" aria-label="Độ dày nét" onClick={() => setBrushOpen((v) => !v)}>
            <span className="brush-dot" style={{ width: brush + 4, height: brush + 4 }} />
          </button>
          <button className="round" aria-label="Hoàn tác" onClick={onUndo}>
            ↩︎
          </button>
          <button className="round" aria-label="Xoá hết nét vẽ" onClick={onClearDrawing}>
            🗑
          </button>

          {brushOpen && (
            <div className="brush-pop">
              <input
                type="range"
                min={1}
                max={16}
                value={brush}
                onChange={(e) => setBrush(Number(e.target.value))}
              />
            </div>
          )}
        </div>
      )}

      <div className="bar-row">
        <button className="round big" onClick={onPrev} disabled={!canPrev} aria-label="Trang trước">
          ‹
        </button>

        <div className="mode-wrap">
          {modeOpen && (
            <div className="mode-pop">
              {MODES.map((m) => (
                <button
                  key={m.id}
                  className={`mode-item${m.id === mode ? ' active' : ''}`}
                  onClick={() => {
                    setMode(m.id)
                    setModeOpen(false)
                  }}
                >
                  <span>{m.icon}</span> {m.label}
                </button>
              ))}
            </div>
          )}
          <button
            className={`mode-btn${modeOpen ? ' open' : ''}`}
            onClick={() => setModeOpen((v) => !v)}
          >
            <span>{current.icon}</span> {current.label} <span className="caret">▴</span>
          </button>
        </div>

        <button className="page-chip" onClick={onOpenIndex} aria-label="Mục lục">
          {posLabel}
        </button>

        <button className="round big" onClick={onAddPage} aria-label="Thêm trang mới">
          ＋
        </button>

        <button className="round big" onClick={onNext} disabled={!canNext} aria-label="Trang sau">
          ›
        </button>
      </div>
    </div>
  )
}
