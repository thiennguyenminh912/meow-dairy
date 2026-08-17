import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Book, { type Peek, type PeekDir } from './components/Book'
import CatBuddy from './components/CatBuddy'
import CatPicker from './components/CatPicker'
import Page, { type Mode } from './components/Page'
import StickerTray from './components/StickerTray'
import Toolbar, { PEN_COLORS } from './components/Toolbar'
import MobileBar from './components/MobileBar'
import MobileMenu from './components/MobileMenu'
import type { DrawCanvasHandle } from './components/DrawCanvas'
import { getCat } from './lib/cats'
import type { StickerItem } from './lib/stickers'
import { playPageFlip } from './lib/sound'
import AuthButton, { type SyncState } from './components/AuthButton'
import {
  fetchRemoteDiary,
  pushRemoteDiary,
  signInWithGoogle,
  signOut,
  supabase,
  type User,
} from './lib/supabase'
import { DEFAULT_SETTINGS, emptyDiary, loadDiary, makePage, saveDiary, uid } from './lib/storage'
import { isBlankDiary, mergeDiaries } from './lib/merge'
import type { Diary, DiaryPage, Ruling } from './lib/types'

const PAGE_W = 430
const PAGE_H = 600
const SETTLE_MS = 700
const TEAR_MS = 650

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v))

export default function App() {
  const [diary, setDiary] = useState<Diary>(() => loadDiary() ?? emptyDiary())
  const [showPicker, setShowPicker] = useState(() => !loadDiary()?.buddyId)
  const [pos, setPos] = useState(1)
  const [single, setSingle] = useState(() => window.innerWidth < 900)
  // dưới 900px (điện thoại + máy tính bảng dọc) dùng bộ điều khiển gọn:
  // thanh dưới cố định + menu ⋯, không có hàng nút cuộn ngang
  const [compact, setCompact] = useState(() => window.innerWidth < 900)
  const [menuOpen, setMenuOpen] = useState(false)
  const [mode, setMode] = useState<Mode>('write')
  const [color, setColor] = useState(PEN_COLORS[0])
  const [brush, setBrush] = useState(3)
  const [eraser, setEraser] = useState(false)
  const [trayOpen, setTrayOpen] = useState(false)
  const [indexOpen, setIndexOpen] = useState(false)
  const [focusedPageId, setFocusedPageId] = useState<string | null>(null)
  const [selectedSticker, setSelectedSticker] = useState<string | null>(null)
  const [scale, setScale] = useState(1)
  const [toast, setToast] = useState<string | null>(null)

  // lật trang bằng cách nắm góc giấy
  const [peek, setPeek] = useState<Peek | null>(null)
  const bookRef = useRef<HTMLDivElement>(null)
  // giữ rect của cuốn sổ ngay lúc bắt đầu kéo — khỏi phải đo lại mỗi lần di chuột
  const cornerDragRef = useRef<{ dir: PeekDir; leaf: number; rect: DOMRect } | null>(null)
  // hẹn giờ cho pha "thả tay, tờ giấy tự chạy nốt" — phải huỷ được khi có thao tác mới
  const settleTimer = useRef<number | null>(null)
  const rafRef = useRef<number | null>(null)
  // vị trí trang đọc-ngay-lập-tức: bấm nút hai lần liền nhau phải ăn cả hai,
  // state của React cập nhật sau một nhịp nên không dùng được cho việc này
  const posRef = useRef(pos)

  // xoá trang: nứt trước, xé sau
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [tearingId, setTearingId] = useState<string | null>(null)

  // kéo thả trong mục lục
  const [indexDrag, setIndexDrag] = useState<number | null>(null)
  const [indexOver, setIndexOver] = useState<number | null>(null)

  // kéo sticker từ khay vào trang
  const [ghostPos, setGhostPos] = useState<{ x: number; y: number } | null>(null)
  const [dragging, setDragging] = useState(false)
  const ghostRef = useRef<{
    item: StickerItem
    startX: number
    startY: number
    moved: boolean
  } | null>(null)

  // sự kiện gửi cho bé mèo
  const [buddyEvent, setBuddyEvent] = useState<string | null>(null)
  const eventSeq = useRef(0)
  const writeMark = useRef(0)

  // tài khoản + đồng bộ đám mây
  const [user, setUser] = useState<User | null>(null)
  const [syncState, setSyncState] = useState<SyncState>(supabase ? 'idle' : 'off')
  const localStamp = useRef<number>(loadDiary()?.updatedAt ?? 0)
  const skipSync = useRef(false)

  const drawRefs = useRef<Record<string, DrawCanvasHandle | null>>({})
  const buddy = getCat(diary.buddyId)

  // tuỳ chọn nằm trong cuốn sổ nên đi theo tài khoản, không dính vào máy nào cả
  const settings = { ...DEFAULT_SETTINGS, ...diary.settings }
  const soundOn = settings.soundOn
  const setSettings = useCallback((patch: Partial<typeof DEFAULT_SETTINGS>) => {
    setDiary((d) => ({ ...d, settings: { ...DEFAULT_SETTINGS, ...d.settings, ...patch } }))
  }, [])
  const setSoundOn = useCallback(
    (on: boolean) => setSettings({ soundOn: on }),
    [setSettings],
  )

  const ping = useCallback((kind: string) => {
    eventSeq.current += 1
    setBuddyEvent(`${kind}:${eventSeq.current}`)
  }, [])

  /* ---------- lưu máy này + đẩy lên đám mây ---------- */
  useEffect(() => {
    const t = setTimeout(() => {
      const fromCloud = skipSync.current
      const stamp = fromCloud ? localStamp.current : Date.now()
      const snapshot = { ...diary, updatedAt: stamp }
      localStamp.current = stamp

      if (!saveDiary(snapshot)) {
        setToast('Bộ nhớ trình duyệt đã đầy — hãy xoá bớt nét vẽ ở vài trang nhé!')
      }

      if (fromCloud) {
        skipSync.current = false
        return
      }
      if (!supabase || !user) return
      setSyncState('syncing')
      pushRemoteDiary(user.id, snapshot)
        .then(() => setSyncState('saved'))
        .catch(() => {
          setSyncState('error')
          setToast('Không đẩy được lên đám mây — nhật ký vẫn an toàn trên máy này.')
        })
    }, 600)
    return () => clearTimeout(t)
  }, [diary, user])

  /* ---------- phiên đăng nhập ---------- */
  useEffect(() => {
    if (!supabase) return
    supabase.auth.getSession().then(({ data }) => setUser(data.session?.user ?? null))
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) =>
      setUser(session?.user ?? null),
    )
    return () => sub.subscription.unsubscribe()
  }, [])

  /* ---------- đăng nhập xong thì kéo bản trên mây về ---------- */
  useEffect(() => {
    if (!supabase || !user) return
    let alive = true
    setSyncState('syncing')
    fetchRemoteDiary(user.id)
      .then((remote) => {
        if (!alive) return
        if (!remote) {
          // chưa có gì trên mây → lần lưu kế tiếp sẽ tự đẩy bản của máy này lên
          setSyncState('saved')
          return
        }
        setDiary((localDiary) => {
          const cloud: Diary = { ...remote.data, updatedAt: remote.updatedAt }
          const merged = mergeDiaries({ ...localDiary, updatedAt: localStamp.current }, cloud)

          // sổ của máy này còn trắng → coi như chỉ nhận bản trên mây, không đẩy ngược
          if (isBlankDiary(localDiary)) {
            skipSync.current = true
            localStamp.current = remote.updatedAt
            setToast('Đã tải nhật ký của bạn từ đám mây về ☁️')
          } else if (merged.pages.length > localDiary.pages.length) {
            setToast(
              `Đã gộp nhật ký hai nơi: ${merged.pages.length} trang (giữ nguyên tất cả) ☁️`,
            )
          }
          if (merged.buddyId && !localDiary.buddyId) setShowPicker(false)
          return merged
        })
        setSyncState('saved')
      })
      .catch(() => {
        if (!alive) return
        setSyncState('error')
        setToast('Chưa đồng bộ được — kiểm tra lại bảng diaries trên Supabase nhé.')
      })
    return () => {
      alive = false
    }
  }, [user])

  const handleSignIn = () => {
    signInWithGoogle().catch((e: Error) =>
      setToast(
        /provider is not enabled|Unsupported provider/i.test(e.message)
          ? 'Supabase chưa bật đăng nhập Google — bật ở Authentication → Providers.'
          : `Không đăng nhập được: ${e.message}`,
      ),
    )
  }

  const handleSignOut = () => {
    void signOut().then(() => setToast('Đã đăng xuất — nhật ký vẫn còn trên máy này.'))
  }

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 3200)
    return () => clearTimeout(t)
  }, [toast])

  /* ---------- co giãn cuốn sổ + chọn chế độ 1 trang / 2 trang ---------- */
  useEffect(() => {
    const fit = () => {
      const vw = window.innerWidth
      // chiều cao thật của vùng nhìn thấy (bàn phím ảo không được che sổ)
      const vh = window.visualViewport?.height ?? window.innerHeight
      const oneUp = vw < 900
      setSingle(oneUp)
      setCompact(oneUp)

      const chromeH = oneUp ? 150 : 215
      const chromeW = oneUp ? 24 : 170
      // một trang thì cho phép phóng to để lấp màn hình máy tính bảng
      const s = Math.min(
        oneUp ? 1.6 : 1,
        (vw - chromeW) / (PAGE_W * (oneUp ? 1 : 2)),
        (vh - chromeH) / PAGE_H,
      )
      setScale(Math.max(0.32, s))
      document.documentElement.style.setProperty('--app-h', `${vh}px`)
    }
    fit()
    window.addEventListener('resize', fit)
    window.addEventListener('orientationchange', fit)
    window.visualViewport?.addEventListener('resize', fit)
    return () => {
      window.removeEventListener('resize', fit)
      window.removeEventListener('orientationchange', fit)
      window.visualViewport?.removeEventListener('resize', fit)
    }
  }, [])

  /** ghi góc lật thẳng vào DOM — không đụng tới React state nên kéo không giật */
  const paintAngle = (deg: number) => {
    bookRef.current?.style.setProperty('--held-angle', `${deg}deg`)
  }

  /** dừng mọi thứ đang dang dở: hẹn giờ, khung hình chờ, tờ giấy đang bị nắm */
  const cancelPeek = useCallback(() => {
    if (settleTimer.current !== null) {
      window.clearTimeout(settleTimer.current)
      settleTimer.current = null
    }
    if (rafRef.current !== null) {
      window.cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
    cornerDragRef.current = null
    setPeek(null)
  }, [])

  useEffect(() => cancelPeek, [cancelPeek])

  // đổi giữa 1 trang ↔ 2 trang thì giữ nguyên chỗ đang đọc
  const prevSingle = useRef(single)
  useEffect(() => {
    if (prevSingle.current === single) return
    prevSingle.current = single
    // xoay máy giữa chừng thì bỏ tờ giấy đang nắm, tránh nó dính lại ở bố cục mới
    cancelPeek()
    const next = single ? posRef.current * 2 : Math.ceil(posRef.current / 2)
    posRef.current = next
    setPos(next)
  }, [single, cancelPeek])


  /* ---------- các mặt giấy ---------- */
  const pages = diary.pages

  const patchPage = useCallback((id: string, patch: Partial<DiaryPage>) => {
    setDiary((d) => ({
      ...d,
      pages: d.pages.map((p) => (p.id === id ? { ...p, ...patch, updatedAt: Date.now() } : p)),
    }))
  }, [])

  // face 0 = bìa trước, face 1 = trang lót, rồi tới các trang nhật ký, cuối cùng là bìa sau
  const faceKinds = useMemo(() => {
    const kinds: (
      | { kind: 'cover' }
      | { kind: 'inside' }
      | { kind: 'page'; index: number }
      | { kind: 'end' }
      | { kind: 'backcover' }
    )[] = [
      { kind: 'cover' },
      { kind: 'inside' },
      ...pages.map((_, index) => ({ kind: 'page' as const, index })),
    ]
    if ((kinds.length + 1) % 2 !== 0) kinds.push({ kind: 'end' })
    kinds.push({ kind: 'backcover' })
    return kinds
  }, [pages])

  // spread: pos = số tờ đã lật · single: pos = chỉ số mặt giấy đang xem
  const units = single ? faceKinds.length - 1 : Math.ceil(faceKinds.length / 2)
  const visibleFaces = single ? [pos] : [pos * 2 - 1, pos * 2]

  const isActiveFace = (i: number) => visibleFaces.includes(i)

  const activePageIds = useMemo(
    () =>
      visibleFaces
        .map((i) => faceKinds[i])
        .filter((f): f is { kind: 'page'; index: number } => !!f && f.kind === 'page')
        .map((f) => pages[f.index].id),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [faceKinds, visibleFaces[0], visibleFaces[1], pages],
  )

  // trang đang thao tác: trang vừa chạm, mặc định là trang bên phải
  const targetPageId = activePageIds.includes(focusedPageId ?? '')
    ? (focusedPageId as string)
    : activePageIds[activePageIds.length - 1] ?? null

  const targetPage = pages.find((p) => p.id === targetPageId) ?? null

  // số trang đổi (thêm/xoá) thì giữ vị trí trong khoảng hợp lệ
  useEffect(() => {
    if (posRef.current <= units) return
    cancelPeek()
    posRef.current = units
    setPos(units)
  }, [units, cancelPeek])

  /* ---------- lật trang ---------- */


  // pha cong góc (hover) và pha chạy nốt (settle) do React quyết định góc,
  // vẫn ghi qua cùng một biến CSS để chỉ có một nguồn sự thật
  useEffect(() => {
    if (peek && peek.mode !== 'drag') {
      bookRef.current?.style.setProperty('--held-angle', `${peek.angle}deg`)
    }
  }, [peek])

  /** nguồn duy nhất được phép đổi trang — luôn đi qua đây để ref và state không lệch nhau */
  const goTo = useCallback(
    (to: number) => {
      const next = clamp(to, 0, units)
      // bấm nút / bấm phím luôn thắng: huỷ pha thả tay đang chạy để nó khỏi
      // ghi đè vị trí trang một nhịp sau đó
      cancelPeek()
      if (next === posRef.current) return
      posRef.current = next
      setPos(next)
      playPageFlip(soundOn)
      setSelectedSticker(null)
      ping('flip')
    },
    [units, soundOn, ping, cancelPeek],
  )

  const flipTo = goTo
  /** lật tương đối — bấm liên tiếp bao nhiêu lần thì đi bấy nhiêu trang */
  const flipBy = useCallback((delta: number) => goTo(posRef.current + delta), [goTo])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = document.activeElement
      const typing = el instanceof HTMLTextAreaElement || el instanceof HTMLInputElement
      if (typing) return
      if (e.key === 'ArrowRight') flipBy(1)
      if (e.key === 'ArrowLeft') flipBy(-1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [flipBy])

  /* ---------- nắm góc giấy kéo lật ---------- */
  const leafOf = (dir: PeekDir) => (dir === 'next' ? pos : pos - 1)

  const angleFor = (dir: PeekDir, clientX: number, rect: DOMRect) =>
    dir === 'next'
      ? -180 * clamp((rect.right - clientX) / rect.width, 0, 1)
      : -180 * (1 - clamp((clientX - rect.left) / rect.width, 0, 1))

  // rê chuột tới góc dưới của cuốn sổ thì góc giấy cong lên mời kéo
  useEffect(() => {
    let queued = false
    const onMove = (e: PointerEvent) => {
      if (cornerDragRef.current || queued) return
      queued = true
      // gộp vào một khung hình: đo đạc layout tối đa 60 lần/giây
      window.requestAnimationFrame(() => {
        queued = false
        if (cornerDragRef.current) return
        const rect = bookRef.current?.getBoundingClientRect()
        if (!rect) return
        const zoneW = Math.min(160, rect.width * 0.2)
        const zoneH = Math.min(190, rect.height * 0.3)
        const inBottom = e.clientY > rect.bottom - zoneH && e.clientY < rect.bottom + 12
        const dir: PeekDir | null =
          inBottom && e.clientX > rect.right - zoneW && e.clientX < rect.right + 12 && pos < units
            ? 'next'
            : inBottom && e.clientX < rect.left + zoneW && e.clientX > rect.left - 12 && pos > 0
              ? 'prev'
              : null

        setPeek((cur) => {
          if (cur && cur.mode !== 'hover') return cur
          if (!dir) return cur ? null : cur
          const leaf = dir === 'next' ? pos : pos - 1
          if (cur && cur.dir === dir && cur.leaf === leaf) return cur
          return { leaf, dir, angle: dir === 'next' ? -5 : -175, mode: 'hover' }
        })
      })
    }
    window.addEventListener('pointermove', onMove)
    return () => {
      window.removeEventListener('pointermove', onMove)
    }
  }, [pos, units])

  const cornerDown = (dir: PeekDir, e: React.PointerEvent) => {
    const leaf = leafOf(dir)
    if (leaf < 0 || leaf >= units) return
    const rect = bookRef.current?.getBoundingClientRect()
    if (!rect) return
    e.preventDefault()
    // bắt đầu lượt kéo mới thì huỷ hẳn lượt cũ còn sót
    if (settleTimer.current !== null) {
      window.clearTimeout(settleTimer.current)
      settleTimer.current = null
    }
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    cornerDragRef.current = { dir, leaf, rect }
    paintAngle(angleFor(dir, e.clientX, rect))
    setPeek({ leaf, dir, angle: 0, mode: 'drag' })
  }

  const cornerMove = (e: React.PointerEvent) => {
    const drag = cornerDragRef.current
    if (!drag) return
    const x = e.clientX
    if (rafRef.current !== null) return
    rafRef.current = window.requestAnimationFrame(() => {
      rafRef.current = null
      if (!cornerDragRef.current) return
      paintAngle(angleFor(drag.dir, x, drag.rect))
    })
  }

  const cornerUp = (e: React.PointerEvent) => {
    const drag = cornerDragRef.current
    if (!drag) return
    cornerDragRef.current = null
    if (rafRef.current !== null) {
      window.cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }

    const angle = angleFor(drag.dir, e.clientX, drag.rect)
    const progress = Math.abs(angle) / 180
    const complete = drag.dir === 'next' ? progress > 0.32 : progress < 0.68
    const target = drag.dir === 'next' ? (complete ? -180 : 0) : complete ? 0 : -180

    // để CSS chạy nốt quãng còn lại
    paintAngle(target)
    setPeek({ leaf: drag.leaf, dir: drag.dir, angle: target, mode: 'settle' })

    // CHỐT VỊ TRÍ NGAY LÚC THẢ TAY, không đợi animation xong.
    // Tờ giấy đang bị nắm vẫn giữ đúng góc `target` nên hình ảnh không hề nhảy,
    // mà thao tác tiếp theo (bấm nút, kéo tiếp) không còn cách nào ghi đè lên nó nữa
    // — đây chính là chỗ trước kia gây "chuyển nhầm trang".
    if (complete) {
      const want = clamp(drag.dir === 'next' ? drag.leaf + 1 : drag.leaf, 0, units)
      posRef.current = want
      setPos(want)
      playPageFlip(soundOn)
      setSelectedSticker(null)
      ping('flip')
    }

    settleTimer.current = window.setTimeout(() => {
      settleTimer.current = null
      setPeek(null)
    }, SETTLE_MS)
  }

  /* ---------- trang ---------- */
  const addPage = () => {
    const page = makePage({ ruling: settings.defaultRuling })
    setDiary((d) => ({ ...d, pages: [...d.pages, page] }))
    goToFace(pages.length + 2)
    ping('newpage')
  }

  /** nhảy tới một mặt giấy bất kỳ, đúng cho cả chế độ 1 trang lẫn 2 trang */
  const goToFace = (faceIndex: number) => flipTo(single ? faceIndex : Math.ceil(faceIndex / 2))

  const goToPage = (index: number) => goToFace(index + 2)

  /** đổi chế độ; nếu đang ở bìa/trang lót thì mở luôn trang viết được */
  const chooseMode = (m: Mode) => {
    setMode(m)
    setTrayOpen(m === 'sticker')
    if (!targetPageId && pages.length) goToPage(0)
  }

  const movePage = (from: number, to: number) => {
    if (from === to) return
    setDiary((d) => {
      const next = [...d.pages]
      const [moved] = next.splice(from, 1)
      next.splice(to, 0, moved)
      return { ...d, pages: next }
    })
    setToast('Đã đổi thứ tự trang.')
  }

  const deletePage = (id: string) => {
    if (pages.length <= 1) {
      setToast('Cuốn sổ phải còn ít nhất một trang nhé.')
      return
    }
    setConfirmDeleteId(null)
    setTearingId(id)
    ping('deletepage')
    window.setTimeout(() => {
      setDiary((d) => ({ ...d, pages: d.pages.filter((p) => p.id !== id) }))
      setTearingId(null)
      setToast('Đã xé trang khỏi cuốn sổ.')
    }, TEAR_MS)
  }

  const setRuling = (ruling: Ruling) => {
    setSettings({ defaultRuling: ruling })
    if (targetPage) patchPage(targetPage.id, { ruling })
  }

  const onWrite = (id: string, text: string) => {
    patchPage(id, { text })
    // thỉnh thoảng để mèo góp vui, không phải mỗi phím
    if (text.length > 0 && Math.floor(text.length / 45) !== writeMark.current) {
      writeMark.current = Math.floor(text.length / 45)
      ping('write')
    }
  }

  /* ---------- sticker ---------- */
  const addStickerTo = useCallback(
    (pageId: string | null, item: StickerItem, x = 42 + Math.random() * 16, y = 45 + Math.random() * 18) => {
      if (!pageId) return
      setDiary((d) => ({
        ...d,
        pages: d.pages.map((p) =>
          p.id === pageId
            ? {
                ...p,
                stickers: [
                  ...p.stickers,
                  {
                    id: uid(),
                    kind: item.kind,
                    value: item.value,
                    x: clamp(x, 4, 96),
                    y: clamp(y, 4, 96),
                    scale: item.kind === 'cat' ? 0.85 : 1,
                    rotation: Math.round((Math.random() - 0.5) * 16),
                  },
                ],
              }
            : p,
        ),
      }))
      ping('sticker')
    },
    [ping],
  )

  const startStickerDrag = (item: StickerItem, e: React.PointerEvent) => {
    e.preventDefault()
    ghostRef.current = { item, startX: e.clientX, startY: e.clientY, moved: false }
    setGhostPos({ x: e.clientX, y: e.clientY })
    setDragging(true)
  }

  useEffect(() => {
    if (!dragging) return

    const move = (e: PointerEvent) => {
      const g = ghostRef.current
      if (!g) return
      if (Math.abs(e.clientX - g.startX) > 6 || Math.abs(e.clientY - g.startY) > 6) g.moved = true
      setGhostPos({ x: e.clientX, y: e.clientY })
    }

    const up = (e: PointerEvent) => {
      const g = ghostRef.current
      ghostRef.current = null
      setDragging(false)
      setGhostPos(null)
      if (!g) return

      if (!g.moved) {
        addStickerTo(targetPageId, g.item)
        return
      }

      const el = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null
      const body = el?.closest('[data-page-id]') as HTMLElement | null
      const pageId = body?.dataset.pageId
      if (!body || !pageId || !activePageIds.includes(pageId)) {
        setToast('Thả sticker vào trang đang mở nhé 🐾')
        return
      }
      const rect = body.getBoundingClientRect()
      addStickerTo(
        pageId,
        g.item,
        ((e.clientX - rect.left) / rect.width) * 100,
        ((e.clientY - rect.top) / rect.height) * 100,
      )
    }

    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    return () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
    }
  }, [dragging, targetPageId, activePageIds, addStickerTo])

  /* ---------- render các mặt giấy ---------- */
  const faces = faceKinds.map((face, i) => {
    if (face.kind === 'cover') {
      return (
        <div className="cover" key="cover" onClick={() => pos === 0 && flipTo(1)}>
          <div className="cover-frame">
            <p className="sub">My Little</p>
            <h1>Meow Diary</h1>
            {buddy && <img className="buddy-cover" src={buddy.src} alt={diary.buddyName} />}
            <p className="sub">
              của {diary.ownerName || 'tớ'} &amp; {diary.buddyName || 'bé mèo'}
            </p>
          </div>
          <span className="hint">Bấm vào bìa hoặc nắm góc giấy kéo sang trái ✨</span>
        </div>
      )
    }

    if (face.kind === 'inside') {
      return (
        <div className="inside-cover" key="inside">
          <p className="owner-line">Cuốn sổ này thuộc về</p>
          <p className="owner-line" style={{ fontSize: 30 }}>
            {diary.ownerName || 'tớ'}
          </p>
          {buddy && <img src={buddy.src} alt={diary.buddyName} style={{ width: 120 }} />}
          <small>
            Bạn đồng hành: <b>{diary.buddyName}</b>
            <br />
            Có {pages.length} trang · nắm góc dưới của trang rồi kéo để lật
          </small>
        </div>
      )
    }

    if (face.kind === 'page') {
      const page = pages[face.index]
      return (
        <Page
          key={page.id}
          page={page}
          pageNumber={face.index + 1}
          side={single || i % 2 === 0 ? 'right' : 'left'}
          active={isActiveFace(i)}
          targeted={page.id === targetPageId}
          cracking={page.id === confirmDeleteId}
          tearing={page.id === tearingId}
          mode={mode}
          color={color}
          brush={brush}
          eraser={eraser}
          selectedSticker={selectedSticker}
          onSelectSticker={setSelectedSticker}
          onPatch={(patch) => {
            if (typeof patch.text === 'string') {
              onWrite(page.id, patch.text)
            } else {
              patchPage(page.id, patch)
              if ('drawing' in patch && patch.drawing && Math.random() < 0.25) ping('draw')
            }
          }}
          onFocus={() => setFocusedPageId(page.id)}
          registerDraw={(handle) => {
            drawRefs.current[page.id] = handle
          }}
          canDelete={pages.length > 1}
          onRequestDelete={() =>
            confirmDeleteId === page.id ? deletePage(page.id) : setConfirmDeleteId(page.id)
          }
          onCancelDelete={() => setConfirmDeleteId(null)}
        />
      )
    }

    if (face.kind === 'end') {
      return (
        <div className="inside-cover" key="end">
          <p className="owner-line">Hết rồi~ 🐾</p>
          <small>Còn nhiều chuyện muốn kể chứ?</small>
          <button className="btn-primary" onClick={addPage}>
            ➕ Viết thêm trang mới
          </button>
        </div>
      )
    }

    return (
      <div className="cover back" key="backcover">
        <div className="cover-frame">
          <p className="sub">The end… for now</p>
          {buddy && <img className="buddy-cover" src={buddy.src} alt={diary.buddyName} />}
          <p className="sub">Hẹn gặp lại ngày mai nhé!</p>
        </div>
      </div>
    )
  })

  /* ---------- màn chọn bạn mèo ---------- */
  if (showPicker) {
    return (
      <CatPicker
        auth={
          <AuthButton
            configured={!!supabase}
            user={user}
            syncState={syncState}
            onSignIn={handleSignIn}
            onSignOut={handleSignOut}
          />
        }
        initialOwner={diary.ownerName}
        initialBuddy={diary.buddyId}
        initialBuddyName={diary.buddyName}
        onCancel={diary.buddyId ? () => setShowPicker(false) : undefined}
        onDone={({ ownerName, buddyId, buddyName }) => {
          setDiary((d) => ({ ...d, ownerName, buddyId, buddyName }))
          setShowPicker(false)
          posRef.current = 0
          setPos(0)
        }}
      />
    )
  }

  return (
    <div className="app">
      {compact ? (
        <div className="topbar compact">
          <div className="brand">
            {buddy && <img src={buddy.src} alt={diary.buddyName} />}
            <span>Meow Diary</span>
          </div>
          <div className="spacer" />
          <button
            className={`pill icon${menuOpen ? ' active' : ''}`}
            onClick={() => setMenuOpen((v) => !v)}
            aria-label="Menu"
          >
            ⋯
          </button>
        </div>
      ) : (
        <div className="topbar">
          <div className="brand">
            {buddy && <img src={buddy.src} alt={diary.buddyName} />}
            <span>Meow Diary</span>
          </div>
          <button className="pill" onClick={() => setIndexOpen((v) => !v)}>
            📖 Mục lục
          </button>
          <button className="pill" onClick={addPage}>
            ➕ Trang mới
          </button>
          <div className="spacer" />
          <button className="pill" onClick={() => setSoundOn(!soundOn)}>
            {soundOn ? '🔊' : '🔇'} Tiếng mèo
          </button>
          <button className="pill" onClick={() => setShowPicker(true)}>
            🐱 Đổi bạn mèo
          </button>
          <AuthButton
            configured={!!supabase}
            user={user}
            syncState={syncState}
            onSignIn={handleSignIn}
            onSignOut={handleSignOut}
          />
        </div>
      )}

      <div
        className={`stage${trayOpen ? ' tray-open' : ''}${
          trayOpen || indexOpen ? ' sheet-open' : ''
        }`}
      >
        <button
          className="nav-btn prev only-desktop"
          onClick={() => flipBy(-1)}
          disabled={pos === 0}
          title="Trang trước"
        >
          ‹
        </button>

        <Book
          faces={faces}
          pos={pos}
          single={single}
          scale={scale}
          peek={peek}
          bookRef={bookRef}
          onCornerDown={cornerDown}
          onCornerMove={cornerMove}
          onCornerUp={cornerUp}
        />

        <button
          className="nav-btn next only-desktop"
          onClick={() => flipBy(1)}
          disabled={pos === units}
          title="Trang sau"
        >
          ›
        </button>

        {buddy && <CatBuddy
            src={buddy.src}
            name={diary.buddyName}
            soundOn={soundOn}
            event={buddyEvent}
          />}

        {indexOpen && (
          <div className="index-panel">
            <h3>Mục lục ({pages.length} trang)</h3>
            <p className="index-hint">Kéo ⠿ để đổi thứ tự · 🗑 để xé trang</p>
            {pages.map((p, i) => (
              <div
                key={p.id}
                data-row={i}
                className={`index-row${indexDrag === i ? ' dragging' : ''}${
                  indexOver === i && indexDrag !== null && indexDrag !== i ? ' drag-over' : ''
                }`}
              >
                <span
                  className="index-grip"
                  title="Kéo để đổi thứ tự"
                  // pointer events để kéo được cả bằng chuột lẫn ngón tay
                  onPointerDown={(e) => {
                    e.preventDefault()
                    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
                    setIndexDrag(i)
                    setIndexOver(i)
                  }}
                  onPointerMove={(e) => {
                    if (indexDrag === null) return
                    const el = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null
                    const row = el?.closest('[data-row]') as HTMLElement | null
                    if (row?.dataset.row) setIndexOver(Number(row.dataset.row))
                  }}
                  onPointerUp={() => {
                    if (indexDrag !== null && indexOver !== null) movePage(indexDrag, indexOver)
                    setIndexDrag(null)
                    setIndexOver(null)
                  }}
                  onPointerCancel={() => {
                    setIndexDrag(null)
                    setIndexOver(null)
                  }}
                >
                  ⠿
                </span>
                <button
                  className={`index-item${activePageIds.includes(p.id) ? ' active' : ''}`}
                  onClick={() => goToPage(i)}
                >
                  {i + 1}. {p.title || 'Chưa có tiêu đề'}
                  <small>
                    {p.date} · {p.text.trim() ? `${p.text.trim().slice(0, 26)}…` : 'trang trống'}
                  </small>
                </button>
                <button
                  className={`index-del${confirmDeleteId === p.id ? ' armed' : ''}`}
                  disabled={pages.length <= 1}
                  title="Xé trang này"
                  onClick={() => {
                    if (confirmDeleteId === p.id) {
                      deletePage(p.id)
                    } else {
                      setConfirmDeleteId(p.id)
                      goToPage(i)
                    }
                  }}
                >
                  {confirmDeleteId === p.id ? 'Xé?' : '🗑'}
                </button>
              </div>
            ))}
          </div>
        )}

        {trayOpen && (
          <StickerTray onDragStart={startStickerDrag} onClose={() => setTrayOpen(false)} />
        )}

        {ghostPos && ghostRef.current && (
          <div className="sticker-ghost" style={{ left: ghostPos.x, top: ghostPos.y }}>
            {ghostRef.current.item.kind === 'emoji' ? (
              <span className="emoji">{ghostRef.current.item.value}</span>
            ) : (
              <img src={ghostRef.current.item.value} alt="" />
            )}
          </div>
        )}

        {toast && <div className="toast">{toast}</div>}
      </div>

      {compact ? (
        <MobileBar
          mode={mode}
          setMode={chooseMode}
          color={color}
          setColor={setColor}
          brush={brush}
          setBrush={setBrush}
          eraser={eraser}
          setEraser={setEraser}
          onUndo={() => targetPageId && drawRefs.current[targetPageId]?.undo()}
          onClearDrawing={() => targetPageId && drawRefs.current[targetPageId]?.clear()}
          onPrev={() => flipBy(-1)}
          onNext={() => flipBy(1)}
          canPrev={pos > 0}
          canNext={pos < units}
          posLabel={`${pos}/${units}`}
          onOpenIndex={() => setIndexOpen((v) => !v)}
          onAddPage={addPage}
        />
      ) : (
        <Toolbar
          mode={mode}
          setMode={chooseMode}
          color={color}
          setColor={setColor}
          brush={brush}
          setBrush={setBrush}
          eraser={eraser}
          setEraser={setEraser}
          ruling={targetPage?.ruling ?? 'line'}
          setRuling={setRuling}
          trayOpen={trayOpen}
          toggleTray={() => setTrayOpen((v) => !v)}
          onUndo={() => targetPageId && drawRefs.current[targetPageId]?.undo()}
          onClearDrawing={() => targetPageId && drawRefs.current[targetPageId]?.clear()}
          onPrev={() => flipBy(-1)}
          onNext={() => flipBy(1)}
          canPrev={pos > 0}
          canNext={pos < units}
          posLabel={`${pos}/${units}`}
        />
      )}

      {menuOpen && (
        <MobileMenu
          ruling={targetPage?.ruling ?? 'line'}
          setRuling={setRuling}
          soundOn={soundOn}
          setSoundOn={setSoundOn}
          pageCount={pages.length}
          onOpenIndex={() => setIndexOpen(true)}
          onAddPage={addPage}
          onChangeBuddy={() => setShowPicker(true)}
          onClose={() => setMenuOpen(false)}
          cloudReady={!!supabase}
          user={user}
          syncState={syncState}
          onSignIn={handleSignIn}
          onSignOut={handleSignOut}
        />
      )}

    </div>
  )
}
