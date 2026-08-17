import { useCallback, useEffect, useRef, useState } from 'react'
import { eventLine, idleLine, pick, type CatLine, type Mood } from '../lib/catLines'
import { playPet, playSong } from '../lib/sound'

/** mèo tự nhảy sang chỗ khác mỗi 10 phút, tự nói chuyện mỗi ~1 phút */
const HOP_EVERY_MS = 10 * 60 * 1000
const TALK_EVERY_MS = 60 * 1000

/** 4 chỗ mèo hay ngồi quanh cuốn sổ — luôn ở rìa để không che trang giấy */
const SPOTS = [
  { left: 0.015, top: 0.74 },
  { left: 0.86, top: 0.74 },
  { left: 0.015, top: 0.03 },
  { left: 0.86, top: 0.03 },
]

const PREF_KEY = 'meow-diary-buddy'

interface Prefs {
  mini: boolean
  /** vị trí do người dùng tự kéo (px so với khung sân khấu); null = mèo tự chọn chỗ */
  x: number | null
  y: number | null
}

function loadPrefs(): Prefs {
  try {
    const raw = localStorage.getItem(PREF_KEY)
    if (raw) return { mini: false, x: null, y: null, ...JSON.parse(raw) }
  } catch {
    /* bỏ qua */
  }
  // màn hẹp thì mặc định để mèo nhỏ cho đỡ che trang
  return { mini: window.innerWidth < 900, x: null, y: null }
}

interface Props {
  src: string
  name: string
  /** tắt tiếng thì mèo cũng im */
  soundOn: boolean
  /** sự kiện mới nhất từ cuốn sổ: 'flip:12', 'sticker:3'… (đổi số để kích hoạt lại) */
  event: string | null
}

interface Puff {
  id: number
  emoji: string
  dx: number
}

export default function CatBuddy({ src, name, soundOn, event }: Props) {
  const [prefs, setPrefs] = useState<Prefs>(loadPrefs)
  const [spot, setSpot] = useState(0)
  const [line, setLine] = useState<CatLine>({ text: 'meo~ chào cậu! 🐾', mood: 'happy' })
  const [hopping, setHopping] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [shy, setShy] = useState(false)
  const [puffs, setPuffs] = useState<Puff[]>([])

  const rootRef = useRef<HTMLDivElement>(null)
  const moodTimer = useRef<number | null>(null)
  const puffId = useRef(0)
  const dragRef = useRef<{ dx: number; dy: number; moved: boolean } | null>(null)

  const say = useCallback((next: CatLine) => {
    setLine(next)
    if (moodTimer.current) window.clearTimeout(moodTimer.current)
    // diễn mood một lúc rồi quay về idle cho đỡ nhức mắt
    moodTimer.current = window.setTimeout(() => {
      setLine((cur) => (cur.text === next.text ? { ...cur, mood: 'idle' } : cur))
    }, 6000)
  }, [])

  const spawnPuffs = (emojis: string[]) => {
    const created = emojis.map((emoji, i) => ({
      id: puffId.current++,
      emoji,
      dx: (i - (emojis.length - 1) / 2) * 26,
    }))
    setPuffs((p) => [...p, ...created])
    window.setTimeout(
      () => setPuffs((p) => p.filter((x) => !created.some((c) => c.id === x.id))),
      1400,
    )
  }

  const hop = () => {
    setHopping(true)
    window.setTimeout(() => setHopping(false), 900)
  }

  const savePrefs = (next: Prefs) => {
    setPrefs(next)
    try {
      localStorage.setItem(PREF_KEY, JSON.stringify(next))
    } catch {
      /* bỏ qua */
    }
  }

  /* mèo tự nói chuyện khi rảnh, thỉnh thoảng ngân nga vài nốt */
  useEffect(() => {
    const talk = window.setInterval(() => {
      say(idleLine())
      if (Math.random() < 0.18) {
        playSong(soundOn)
        setLine({ text: 'la la lá~ 🎶', mood: 'dance' })
      }
    }, TALK_EVERY_MS)
    return () => window.clearInterval(talk)
  }, [say, soundOn])

  /* 10 phút mới đổi chỗ một lần — và chỉ khi người dùng chưa tự đặt chỗ cho mèo */
  useEffect(() => {
    const move = window.setInterval(() => {
      hop()
      if (prefs.x === null) setSpot((s) => (s + 1 + Math.floor(Math.random() * 3)) % SPOTS.length)
    }, HOP_EVERY_MS)
    return () => window.clearInterval(move)
  }, [prefs.x])

  /* phản ứng theo hành động của người viết */
  useEffect(() => {
    if (!event) return
    const kind = event.split(':')[0]
    say(eventLine(kind))
    if (kind === 'sticker' || kind === 'newpage') spawnPuffs(['✨', '🩷', '✨'])
    if (kind === 'deletepage') spawnPuffs(['💧'])
  }, [event, say])

  useEffect(() => () => void (moodTimer.current && window.clearTimeout(moodTimer.current)), [])

  /* đang gõ chữ thì mèo mờ đi cho khỏi vướng mắt */
  useEffect(() => {
    const isField = (el: EventTarget | null) =>
      el instanceof HTMLTextAreaElement || el instanceof HTMLInputElement
    const on = (e: FocusEvent) => isField(e.target) && setShy(true)
    const off = () => setShy(false)
    document.addEventListener('focusin', on)
    document.addEventListener('focusout', off)
    return () => {
      document.removeEventListener('focusin', on)
      document.removeEventListener('focusout', off)
    }
  }, [])

  /* giữ mèo trong màn hình khi đổi kích thước cửa sổ / xoay máy */
  useEffect(() => {
    const onResize = () => {
      setPrefs((cur) => {
        if (cur.x === null || cur.y === null) return cur
        const box = rootRef.current?.parentElement?.getBoundingClientRect()
        if (!box) return cur
        const size = cur.mini ? 64 : 116
        return {
          ...cur,
          x: Math.min(Math.max(0, cur.x), Math.max(0, box.width - size)),
          y: Math.min(Math.max(0, cur.y), Math.max(0, box.height - size)),
        }
      })
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  const pet = () => {
    playPet(soundOn)
    say(eventLine('pet'))
    spawnPuffs(pick([['🩷', '🩷'], ['✨', '🩷', '✨'], ['🎵', '🎶'], ['😽']]))
    hop()
  }

  /* kéo mèo đi chỗ khác */
  const onPointerDown = (e: React.PointerEvent) => {
    const box = rootRef.current?.parentElement?.getBoundingClientRect()
    const self = rootRef.current?.getBoundingClientRect()
    if (!box || !self) return
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    dragRef.current = {
      dx: e.clientX - self.left,
      dy: e.clientY - self.top,
      moved: false,
    }
    setDragging(true)
  }

  const onPointerMove = (e: React.PointerEvent) => {
    const drag = dragRef.current
    const box = rootRef.current?.parentElement?.getBoundingClientRect()
    if (!drag || !box) return
    if (!drag.moved && Math.abs(e.movementX) + Math.abs(e.movementY) < 1) return
    drag.moved = true
    const size = prefs.mini ? 64 : 116
    savePrefs({
      ...prefs,
      x: Math.min(Math.max(0, e.clientX - box.left - drag.dx), Math.max(0, box.width - size)),
      y: Math.min(Math.max(0, e.clientY - box.top - drag.dy), Math.max(0, box.height - size)),
    })
  }

  const onPointerUp = () => {
    const drag = dragRef.current
    dragRef.current = null
    setDragging(false)
    if (drag && !drag.moved) pet()
  }

  /* vị trí + hướng bong bóng */
  const box = rootRef.current?.parentElement?.getBoundingClientRect()
  const pinned = prefs.x !== null && prefs.y !== null
  const style: React.CSSProperties = pinned
    ? { left: prefs.x ?? 0, top: prefs.y ?? 0 }
    : {
        left: `${SPOTS[spot].left * 100}%`,
        top: `${SPOTS[spot].top * 100}%`,
      }

  const ratioX = pinned && box ? (prefs.x ?? 0) / Math.max(1, box.width) : SPOTS[spot].left
  const ratioY = pinned && box ? (prefs.y ?? 0) / Math.max(1, box.height) : SPOTS[spot].top
  const bubbleLeft = ratioX > 0.5
  const bubbleBelow = ratioY < 0.25

  const mood: Mood = hopping ? 'happy' : line.mood

  return (
    <div
      ref={rootRef}
      className={`buddy mood-${mood}${hopping ? ' hopping' : ''}${bubbleLeft ? ' flip-side' : ''}${
        bubbleBelow ? ' bubble-below' : ''
      }${prefs.mini ? ' mini' : ''}${dragging ? ' dragging' : ''}${shy ? ' shy' : ''}`}
      style={style}
    >
      <div
        className="buddy-body"
        role="button"
        tabIndex={0}
        title={`Bấm để xoa đầu ${name} · kéo để đổi chỗ`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && pet()}
      >
        <img src={src} alt={name} draggable={false} />
        {mood === 'cry' && <span className="mood-fx tear">💧</span>}
        {mood === 'sleep' && <span className="mood-fx zzz">💤</span>}
        {mood === 'love' && <span className="mood-fx heart">🩷</span>}
        {mood === 'dance' && <span className="mood-fx note">🎵</span>}
        {puffs.map((p) => (
          <span key={p.id} className="puff" style={{ ['--dx' as string]: `${p.dx}px` }}>
            {p.emoji}
          </span>
        ))}

        <div className="buddy-tools" onPointerDown={(e) => e.stopPropagation()}>
          <button
            title={prefs.mini ? `Phóng to ${name}` : `Thu nhỏ ${name}`}
            onClick={() => savePrefs({ ...prefs, mini: !prefs.mini })}
          >
            {prefs.mini ? '⤢' : '⤡'}
          </button>
          {pinned && (
            <button
              title="Thả mèo tự do (tự chọn chỗ ngồi)"
              onClick={() => savePrefs({ ...prefs, x: null, y: null })}
            >
              🎈
            </button>
          )}
        </div>
      </div>

      {!prefs.mini && (
        <div className="bubble">
          <b>{name}:</b> {line.text}
        </div>
      )}
    </div>
  )
}
