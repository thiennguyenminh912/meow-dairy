import { useEffect, useRef, useState } from 'react'
import type { ReactNode, RefObject } from 'react'

export type PeekMode = 'hover' | 'drag' | 'settle'
export type PeekDir = 'next' | 'prev'

export interface Peek {
  /** chỉ số tờ giấy (spread) hoặc mặt giấy (một trang) đang bị nắm */
  leaf: number
  dir: PeekDir
  /** góc xoay hiện tại của tờ giấy đang bị nắm (deg) */
  angle: number
  mode: PeekMode
}

interface Props {
  /** mỗi phần tử là 1 mặt giấy; ở chế độ sổ mở, 2 mặt liên tiếp ghép thành 1 tờ */
  faces: ReactNode[]
  /** vị trí hiện tại: số tờ đã lật (spread) hoặc chỉ số mặt đang xem (single) */
  pos: number
  /** true = màn hẹp, chỉ hiện 1 trang mỗi lần */
  single: boolean
  scale: number
  peek: Peek | null
  bookRef: RefObject<HTMLDivElement>
  onCornerDown: (dir: PeekDir, e: React.PointerEvent) => void
  onCornerMove: (e: React.PointerEvent) => void
  onCornerUp: (e: React.PointerEvent) => void
}

export default function Book({
  faces,
  pos,
  single,
  scale,
  peek,
  bookRef,
  onCornerDown,
  onCornerMove,
  onCornerUp,
}: Props) {
  // ở chế độ một trang, tờ đã lật bị ẩn đi cho gọn — nhưng phải giữ nó hiện
  // trong lúc animation chạy, nếu không sẽ mất hẳn hiệu ứng lật
  const [animating, setAnimating] = useState(false)
  const prevPos = useRef(pos)

  useEffect(() => {
    if (prevPos.current === pos) return
    prevPos.current = pos
    setAnimating(true)
    const t = window.setTimeout(() => setAnimating(false), 850)
    return () => window.clearTimeout(t)
  }, [pos])

  const units = single ? faces.length - 1 : Math.ceil(faces.length / 2)
  const atStart = pos === 0
  const atEnd = pos === units

  const corner = (dir: PeekDir) => (
    <div
      className={`corner-hot ${dir}${
        peek?.dir === dir && peek.mode === 'hover' ? ' armed' : ''
      }`}
      onPointerDown={(e) => onCornerDown(dir, e)}
      onPointerMove={onCornerMove}
      onPointerUp={onCornerUp}
      onPointerCancel={onCornerUp}
      title={dir === 'next' ? 'Nắm góc kéo sang trái để lật' : 'Nắm góc kéo sang phải để lật lại'}
    >
      <span className="dog-ear" />
    </div>
  )

  const leafClass = (i: number, flipped: boolean) => {
    const held = peek?.leaf === i
    return {
      className: `leaf${single ? ' single' : ''}${flipped ? ' flipped' : ''}${
        held ? ` held ${peek!.mode}` : ''
      }`,
      style: {
        zIndex: held ? faces.length + 5 : flipped ? i + 1 : faces.length - i,
        ...(held ? { transform: `rotateY(${peek!.angle}deg)` } : null),
      } as React.CSSProperties,
    }
  }

  return (
    <div className="book-scale" style={{ ['--book-scale' as string]: scale }}>
      <div
        ref={bookRef}
        className={`book${single ? ' single' : ''}${atStart ? ' at-start' : ''}${
          atEnd ? ' at-end' : ''
        }`}
      >
        {!single && <div className="book-stack left" />}
        <div className="book-stack right" />

        {single
          ? // chế độ một trang: mỗi mặt giấy là một tờ riêng, mặt sau để trơn.
            // giữ tờ trước/sau trong DOM để hiệu ứng lật còn chỗ chạy.
            faces.map((face, i) => {
              if (i > pos + 1 || i < pos - 1) return null
              const flipped = i < pos
              const cls = leafClass(i, flipped)
              // tờ đã lật: chỉ ẩn khi mọi thứ đứng yên
              const parked = flipped && !animating && peek?.leaf !== i
              return (
                <div
                  key={i}
                  {...cls}
                  className={`${cls.className}${parked ? ' parked' : ''}`}
                >
                  <div className="leaf-face front">{face}</div>
                  <div className="leaf-face back blank-back" />
                </div>
              )
            })
          : Array.from({ length: units }, (_, i) => (
              <div key={i} {...leafClass(i, i < pos)}>
                <div className="leaf-face front">{faces[i * 2]}</div>
                <div className="leaf-face back">{faces[i * 2 + 1]}</div>
              </div>
            ))}

        {!atEnd && corner('next')}
        {!atStart && corner('prev')}
      </div>
    </div>
  )
}
