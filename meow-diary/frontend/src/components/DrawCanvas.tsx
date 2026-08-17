import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react'

export const CANVAS_W = 520
export const CANVAS_H = 726

export interface DrawCanvasHandle {
  undo: () => void
  clear: () => void
}

interface Props {
  pageId: string
  drawing: string | null
  active: boolean
  color: string
  size: number
  eraser: boolean
  onCommit: (dataUrl: string | null) => void
}

function toDataUrl(canvas: HTMLCanvasElement) {
  // webp nhẹ hơn png rất nhiều — localStorage chỉ có ~5MB
  const webp = canvas.toDataURL('image/webp', 0.85)
  return webp.startsWith('data:image/webp') ? webp : canvas.toDataURL('image/png')
}

function isBlank(canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext('2d')
  if (!ctx) return true
  const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height)
  for (let i = 3; i < data.length; i += 4) if (data[i] !== 0) return false
  return true
}

const DrawCanvas = forwardRef<DrawCanvasHandle, Props>(function DrawCanvas(
  { pageId, drawing, active, color, size, eraser, onCommit },
  ref,
) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const drawingRef = useRef(false)
  const lastRef = useRef<{ x: number; y: number } | null>(null)
  const historyRef = useRef<(string | null)[]>([])

  // nạp nét vẽ đã lưu mỗi khi đổi trang
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.clearRect(0, 0, CANVAS_W, CANVAS_H)
    historyRef.current = []
    if (!drawing) return
    const img = new Image()
    img.onload = () => ctx.drawImage(img, 0, 0, CANVAS_W, CANVAS_H)
    img.src = drawing
    // chỉ nạp lại khi đổi trang, không nạp lại theo từng nét vừa vẽ
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageId])

  const restore = (dataUrl: string | null) => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return
    ctx.clearRect(0, 0, CANVAS_W, CANVAS_H)
    if (!dataUrl) {
      onCommit(null)
      return
    }
    const img = new Image()
    img.onload = () => {
      ctx.drawImage(img, 0, 0, CANVAS_W, CANVAS_H)
      onCommit(dataUrl)
    }
    img.src = dataUrl
  }

  useImperativeHandle(ref, () => ({
    undo() {
      if (!historyRef.current.length) return
      restore(historyRef.current.pop() ?? null)
    },
    clear() {
      const canvas = canvasRef.current
      if (!canvas) return
      historyRef.current.push(isBlank(canvas) ? null : toDataUrl(canvas))
      restore(null)
    },
  }))

  const pos = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    return {
      x: ((e.clientX - rect.left) / rect.width) * CANVAS_W,
      y: ((e.clientY - rect.top) / rect.height) * CANVAS_H,
    }
  }

  const onDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!active) return
    const canvas = canvasRef.current
    if (!canvas) return
    e.currentTarget.setPointerCapture(e.pointerId)
    historyRef.current.push(isBlank(canvas) ? null : toDataUrl(canvas))
    if (historyRef.current.length > 15) historyRef.current.shift()
    drawingRef.current = true
    lastRef.current = pos(e)
    stroke(pos(e), pos(e))
  }

  const stroke = (from: { x: number; y: number }, to: { x: number; y: number }) => {
    const ctx = canvasRef.current?.getContext('2d')
    if (!ctx) return
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.globalCompositeOperation = eraser ? 'destination-out' : 'source-over'
    ctx.strokeStyle = color
    ctx.lineWidth = eraser ? size * 3 : size
    ctx.beginPath()
    ctx.moveTo(from.x, from.y)
    ctx.lineTo(to.x, to.y)
    ctx.stroke()
  }

  const onMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current || !lastRef.current) return
    const p = pos(e)
    stroke(lastRef.current, p)
    lastRef.current = p
  }

  const onUp = () => {
    if (!drawingRef.current) return
    drawingRef.current = false
    lastRef.current = null
    const canvas = canvasRef.current
    if (!canvas) return
    onCommit(isBlank(canvas) ? null : toDataUrl(canvas))
  }

  return (
    <canvas
      ref={canvasRef}
      className="draw-layer"
      width={CANVAS_W}
      height={CANVAS_H}
      style={{ pointerEvents: active ? 'auto' : 'none', cursor: active ? 'crosshair' : 'default' }}
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerCancel={onUp}
      onPointerLeave={onUp}
    />
  )
})

export default DrawCanvas
