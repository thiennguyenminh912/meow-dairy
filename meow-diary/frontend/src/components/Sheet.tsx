import { useEffect, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { pushOverlay } from '../lib/overlay'

/* Ngưỡng lấy đúng theo vaul (thư viện bottom sheet phổ biến nhất hiện nay),
   để cảm giác vuốt giống hệt các app người dùng đang quen. */
const VELOCITY_CLOSE = 0.4 // px/ms — hất tay nhanh là đóng, dù kéo chưa xa
const RATIO_CLOSE = 0.25 // hoặc kéo xuống quá 25% chiều cao sheet
const SAMPLE_MS = 100 // tính vận tốc trên cửa sổ 100ms, một khung hình quá nhiễu
const CLOSE_MS = 220

interface Props {
  /** class riêng cho từng loại: 'index-sheet' | 'tray-sheet' | 'menu-sheet' */
  variant: string
  title?: ReactNode
  onClose: () => void
  children: ReactNode
}

/**
 * Bottom sheet theo đúng thói quen của người dùng điện thoại: đóng được bằng
 * **năm** cách — vuốt xuống, chạm nền mờ, nút ✕, phím Esc, nút Back của máy.
 * Trên máy tính (≥900px) CSS biến nó lại thành panel nổi như cũ.
 */
export default function Sheet({ variant, title, onClose, children }: Props) {
  const sheetRef = useRef<HTMLDivElement>(null)
  const closeRef = useRef(onClose)
  closeRef.current = onClose

  const dragRef = useRef<{
    id: number
    y0: number
    samples: { y: number; t: number }[]
    active: boolean
  } | null>(null)

  /* mở sheet thì cất bàn phím ảo đi, không thì nó che mất nội dung */
  useEffect(() => {
    const el = document.activeElement
    if (el instanceof HTMLTextAreaElement || el instanceof HTMLInputElement) el.blur()
  }, [])

  /* Esc trên bàn phím rời + nút Back của Android */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && closeRef.current()
    window.addEventListener('keydown', onKey)
    const drop = pushOverlay(() => closeRef.current())
    return () => {
      window.removeEventListener('keydown', onKey)
      drop()
    }
  }, [])

  const setOffset = (px: number) => sheetRef.current?.style.setProperty('--sheet-y', `${px}px`)

  /** trượt nốt xuống rồi mới gỡ khỏi màn hình — đóng đánh "cụp" một cái trông rất tệ */
  const slideAway = () => {
    const el = sheetRef.current
    if (!el) return closeRef.current()
    el.classList.remove('dragging')
    setOffset(el.offsetHeight)
    window.setTimeout(() => closeRef.current(), CLOSE_MS)
  }

  const onPointerDown = (e: React.PointerEvent) => {
    if (dragRef.current) return
    const target = e.target as HTMLElement
    // đang cuộn dở danh sách bên trong thì cú kéo đó là để cuộn, không phải để đóng
    const body = target.closest('.sheet-body')
    if (body && body.scrollTop > 0) return
    if (target.closest('input, textarea')) return
    // chỗ đã có cử chỉ kéo riêng (nhấc sticker, đổi thứ tự trang) thì nhường hẳn
    if (target.closest('[data-no-sheet-drag]')) return
    dragRef.current = {
      id: e.pointerId,
      y0: e.clientY,
      samples: [{ y: e.clientY, t: e.timeStamp }],
      active: false,
    }
  }

  const onPointerMove = (e: React.PointerEvent) => {
    const d = dragRef.current
    if (!d || d.id !== e.pointerId) return
    const dy = e.clientY - d.y0

    if (!d.active) {
      // kéo lên = người dùng muốn cuộn, không phải muốn đóng
      if (dy < -6) {
        dragRef.current = null
        return
      }
      if (dy < 8) return
      d.active = true
      sheetRef.current?.classList.add('dragging')
      ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    }

    d.samples.push({ y: e.clientY, t: e.timeStamp })
    while (d.samples.length > 2 && e.timeStamp - d.samples[0].t > SAMPLE_MS) d.samples.shift()
    // kéo ngược lên thì nặng tay dần, cho cảm giác có lực cản như app thật
    setOffset(dy >= 0 ? dy : dy / 4)
  }

  const onPointerUp = (e: React.PointerEvent) => {
    const d = dragRef.current
    dragRef.current = null
    const el = sheetRef.current
    if (!d || !el) return
    el.classList.remove('dragging')
    if (!d.active) return

    const dy = e.clientY - d.y0
    const first = d.samples[0]
    const v = (e.clientY - first.y) / Math.max(1, e.timeStamp - first.t)
    // hoặc kéo đủ xa, hoặc hất tay nhanh — cả hai đều là ý "đóng đi"
    if (dy > el.offsetHeight * RATIO_CLOSE || v > VELOCITY_CLOSE) slideAway()
    else setOffset(0)
  }

  // Gắn thẳng vào body: sân khấu cuốn sổ có `perspective` nên nó trở thành khung
  // quy chiếu của mọi `position: fixed` bên trong — sheet đặt trong đó sẽ dính
  // vào đáy sân khấu chứ không phải đáy màn hình, còn nền mờ thì bị cắt cụt.
  return createPortal(
    <>
      <div className="sheet-backdrop" onPointerDown={slideAway} />
      <div
        ref={sheetRef}
        className={`sheet ${variant}`}
        role="dialog"
        aria-modal="true"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <div className="sheet-grab">
          <span className="sheet-grip" />
        </div>
        <div className="sheet-head">
          <strong>{title}</strong>
          <button className="sheet-x" onClick={slideAway} aria-label="Đóng">
            ✕
          </button>
        </div>
        <div className="sheet-body">{children}</div>
      </div>
    </>,
    document.body,
  )
}
