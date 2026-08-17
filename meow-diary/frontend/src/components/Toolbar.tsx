import type { Mode } from './Page'
import type { Ruling } from '../lib/types'

export const PEN_COLORS = ['#6b4728', '#e98d8d', '#e79c53', '#8bb0d4', '#8fb583', '#b79ad4']

interface Props {
  mode: Mode
  setMode: (m: Mode) => void
  color: string
  setColor: (c: string) => void
  brush: number
  setBrush: (n: number) => void
  eraser: boolean
  setEraser: (b: boolean) => void
  ruling: Ruling
  setRuling: (r: Ruling) => void
  trayOpen: boolean
  toggleTray: () => void
  onUndo: () => void
  onClearDrawing: () => void
  /* lật trang — chỉ hiện trên màn nhỏ, thay cho hai nút hai bên cuốn sổ */
  onPrev: () => void
  onNext: () => void
  canPrev: boolean
  canNext: boolean
  posLabel: string
}

export default function Toolbar({
  mode,
  setMode,
  color,
  setColor,
  brush,
  setBrush,
  eraser,
  setEraser,
  ruling,
  setRuling,
  trayOpen,
  toggleTray,
  onUndo,
  onClearDrawing,
  onPrev,
  onNext,
  canPrev,
  canNext,
  posLabel,
}: Props) {
  return (
    <div className="toolbar">
      <div className="tool-group only-mobile">
        <button className="chip" onClick={onPrev} disabled={!canPrev} title="Trang trước">
          ‹
        </button>
        <span className="label">{posLabel}</span>
        <button className="chip" onClick={onNext} disabled={!canNext} title="Trang sau">
          ›
        </button>
      </div>

      <div className="tool-group">
        <span className="label">Chế độ</span>
        {(
          [
            ['write', '✏️ Viết'],
            ['draw', '🖍 Vẽ'],
            ['sticker', '🐾 Sticker'],
          ] as [Mode, string][]
        ).map(([m, label]) => (
          <button
            key={m}
            className={`chip${mode === m ? ' active' : ''}`}
            onClick={() => {
              setMode(m)
              if (m === 'sticker' && !trayOpen) toggleTray()
              if (m !== 'sticker' && trayOpen) toggleTray()
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {mode === 'draw' && (
        <div className="tool-group">
          {PEN_COLORS.map((c) => (
            <button
              key={c}
              className={`swatch${color === c && !eraser ? ' active' : ''}`}
              style={{ background: c }}
              title="Màu bút"
              onClick={() => {
                setColor(c)
                setEraser(false)
              }}
            />
          ))}
          <button
            className={`chip${eraser ? ' active' : ''}`}
            title="Tẩy"
            onClick={() => setEraser(!eraser)}
          >
            🧽
          </button>
          <input
            type="range"
            min={1}
            max={16}
            value={brush}
            title="Độ dày nét"
            onChange={(e) => setBrush(Number(e.target.value))}
          />
          <button className="chip" onClick={onUndo} title="Hoàn tác nét vẽ">
            ↩︎
          </button>
          <button className="chip" onClick={onClearDrawing} title="Xoá hết nét vẽ của trang">
            🗑
          </button>
        </div>
      )}

      {mode === 'sticker' && (
        <button className="pill" onClick={toggleTray}>
          {trayOpen ? 'Đóng khay sticker' : 'Mở khay sticker'}
        </button>
      )}

      <div className="tool-group">
        <span className="label">Giấy</span>
        {(
          [
            ['line', 'Kẻ ngang'],
            ['dot', 'Chấm bi'],
            ['blank', 'Trơn'],
          ] as [Ruling, string][]
        ).map(([r, label]) => (
          <button
            key={r}
            className={`chip${ruling === r ? ' active' : ''}`}
            onClick={() => setRuling(r)}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  )
}
