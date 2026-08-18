import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Book, { type Peek, type PeekDir } from './components/Book'
import CatBuddy from './components/CatBuddy'
import CatPicker from './components/CatPicker'
import Page, { type Mode } from './components/Page'
import StickerTray from './components/StickerTray'
import Toolbar, { PEN_COLORS } from './components/Toolbar'
import MobileBar from './components/MobileBar'
import MobileMenu from './components/MobileMenu'
import Sheet from './components/Sheet'
import type { DrawCanvasHandle } from './components/DrawCanvas'
import { getCat } from './lib/cats'
import type { StickerItem } from './lib/stickers'
import { caretViewportY } from './lib/mobile'
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

/* --- vuốt ngang để lật trang (ngưỡng lấy theo Embla / use-gesture / Swiper) --- */
const AXIS_LOCK = 10 // px: đi được ngần này mới quyết định đây là vuốt ngang hay dọc
const Y_BIAS = 1.2 // thiên vị chiều dọc, tránh cướp mất cú cuộn của người dùng
const FLING_V = 0.4 // px/ms: hất tay nhanh thì lật luôn dù kéo chưa xa
const FLING_MIN_D = 40 // px: nhưng phải đi đủ xa, tránh chạm nhẹ cũng lật
const LONG_RATIO = 0.25 // hoặc kéo quá 25% bề ngang trang
const SAMPLE_MS = 100 // cửa sổ tính vận tốc

/** bàn phím ảo coi như đang bật khi che mất hơn ngần này */
const KB_MIN = 120

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v))

/** app đã cài về màn hình chính? lúc đó không còn cử chỉ vuốt-mép của trình duyệt */
const standalone =
  window.matchMedia('(display-mode: standalone)').matches ||
  (window.navigator as { standalone?: boolean }).standalone === true

export default function App() {
  const [diary, setDiary] = useState<Diary>(() => loadDiary() ?? emptyDiary())
  // Chưa biết máy này có đang đăng nhập hay không thì TUYỆT ĐỐI chưa được kết
  // luận "người này chưa chọn mèo" — đó chính là lỗi bắt chọn lại mèo dù đã có
  // nhật ký trên đám mây. Chờ xong phiên đăng nhập + bản trên mây rồi mới quyết.
  const [booting, setBooting] = useState(() => !!supabase)
  const [showPicker, setShowPicker] = useState(() => !supabase && !loadDiary()?.buddyId)
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
  /** chiều cao bàn phím ảo (px); 0 = đang không gõ */
  const [kb, setKb] = useState(0)

  // lật trang bằng cách nắm góc giấy hoặc vuốt ngang ở bất kỳ đâu trên trang
  const [peek, setPeek] = useState<Peek | null>(null)
  const bookRef = useRef<HTMLDivElement>(null)
  const stageRef = useRef<HTMLDivElement>(null)
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
  // Chưa đọc được bản trên mây thì KHÔNG được đẩy gì lên: không biết trên đó
  // đang có gì, đẩy đại là có ngày sổ trắng đè mất bài viết cũ.
  const cloudKnown = useRef(false)
  // đổi số này để thử tải lại bản trên mây
  const [retry, setRetry] = useState(0)

  const drawRefs = useRef<Record<string, DrawCanvasHandle | null>>({})
  const buddy = getCat(diary.buddyId)

  // đọc được sổ hiện tại từ trong các callback bất đồng bộ mà không dính bản cũ
  const diaryRef = useRef(diary)
  diaryRef.current = diary
  const bootedRef = useRef(!supabase)

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

  /**
   * Xong phần khởi động: giờ mới đủ dữ kiện để biết có phải bắt chọn mèo không.
   * Gọi bao nhiêu lần cũng được — lần đầu tiên là lần có giá trị.
   */
  const finishBoot = useCallback((d: Diary) => {
    if (bootedRef.current) return
    bootedRef.current = true
    setBooting(false)
    setShowPicker(!d.buddyId)
  }, [])

  /* ---------- lưu máy này + đẩy lên đám mây ---------- */
  useEffect(() => {
    // chưa gộp xong bản trên mây mà đã lưu thì có ngày sổ trắng đè lên bài viết thật
    if (booting) return
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
      if (!cloudKnown.current) {
        // thử đọc lại bản trên mây; đọc được rồi thì lần lưu sau mới đẩy lên
        setRetry((n) => n + 1)
        return
      }
      setSyncState('syncing')
      pushRemoteDiary(user.id, snapshot)
        .then(() => setSyncState('saved'))
        .catch(() => {
          setSyncState('error')
          setToast('Không đẩy được lên đám mây — nhật ký vẫn an toàn trên máy này.')
        })
    }, 600)
    return () => clearTimeout(t)
  }, [diary, user, booting])

  /* ---------- phiên đăng nhập ---------- */
  useEffect(() => {
    if (!supabase) return
    // cùng một người thì giữ nguyên object cũ, nếu không effect kéo sổ về
    // sẽ chạy lại mỗi lần Supabase phát lại phiên (getSession + INITIAL_SESSION)
    const remember = (next: User | null) =>
      setUser((cur) => (cur?.id === next?.id ? cur : next))

    supabase.auth.getSession().then(({ data }) => {
      const session = data.session
      remember(session?.user ?? null)
      // chưa đăng nhập thì không có gì để chờ nữa
      if (!session) finishBoot(diaryRef.current)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) =>
      remember(session?.user ?? null),
    )
    return () => sub.subscription.unsubscribe()
  }, [finishBoot])

  /* ---------- đăng nhập xong thì kéo bản trên mây về ---------- */
  useEffect(() => {
    if (!supabase || !user) return
    let alive = true
    setSyncState('syncing')

    // mạng chập chờn thì cũng không được treo màn hình khởi động mãi
    const bail = window.setTimeout(() => alive && finishBoot(diaryRef.current), 8000)

    fetchRemoteDiary(user.id)
      .then((remote) => {
        if (!alive) return
        cloudKnown.current = true
        if (!remote) {
          // chưa có gì trên mây → lần lưu kế tiếp sẽ tự đẩy bản của máy này lên
          setSyncState('saved')
          finishBoot(diaryRef.current)
          return
        }

        const localDiary = diaryRef.current
        const cloud: Diary = { ...remote.data, updatedAt: remote.updatedAt }
        const merged = mergeDiaries({ ...localDiary, updatedAt: localStamp.current }, cloud)

        // sổ của máy này còn trắng → coi như chỉ nhận bản trên mây, không đẩy ngược
        if (isBlankDiary(localDiary)) {
          skipSync.current = true
          localStamp.current = remote.updatedAt
          setToast('Đã tải nhật ký của bạn từ đám mây về ☁️')
        } else if (merged.pages.length > localDiary.pages.length) {
          setToast(`Đã gộp nhật ký hai nơi: ${merged.pages.length} trang (giữ nguyên tất cả) ☁️`)
        }

        diaryRef.current = merged
        setDiary(merged)
        setSyncState('saved')
        finishBoot(merged)
      })
      .catch(() => {
        if (!alive) return
        cloudKnown.current = false
        setSyncState('error')
        setToast('Chưa đồng bộ được — nhật ký vẫn an toàn trên máy này.')
        finishBoot(diaryRef.current)
      })
    return () => {
      alive = false
      window.clearTimeout(bail)
    }
  }, [user, retry, finishBoot])

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
  // chiều cao màn hình lúc CHƯA có bàn phím — cỡ cuốn sổ luôn tính theo số này
  const roomH = useRef(window.innerHeight)
  useEffect(() => {
    const fit = () => {
      const vw = window.innerWidth
      const vv = window.visualViewport
      const visH = vv?.height ?? window.innerHeight
      // viewport để mặc định (resizes-visual) nên window.innerHeight đứng yên
      // khi bàn phím bật lên — hiệu số này chính là chiều cao bàn phím
      const kbH = Math.max(0, window.innerHeight - visH - (vv?.offsetTop ?? 0))
      const keyboard = kbH > KB_MIN ? Math.round(kbH) : 0
      setKb(keyboard)
      if (!keyboard) roomH.current = visH

      const oneUp = vw < 900
      setSingle(oneUp)
      setCompact(oneUp)

      const chromeH = oneUp ? 150 : 215
      const chromeW = oneUp ? 24 : 170
      // TÍNH THEO roomH, KHÔNG theo visH: bật bàn phím lên cuốn sổ phải giữ
      // nguyên cỡ, chỉ trượt lên cho khỏi bị che (xem --kb-lift bên dưới).
      // Thu bé cuốn sổ lại là cách xử lý cũ và nó làm việc viết trở nên khó chịu.
      const s = Math.min(
        oneUp ? 1.6 : 1,
        (vw - chromeW) / (PAGE_W * (oneUp ? 1 : 2)),
        (roomH.current - chromeH) / PAGE_H,
      )
      setScale(Math.max(0.32, s))
      // khung app vẫn co lại để thanh dưới nằm ngay trên bàn phím
      document.documentElement.style.setProperty('--app-h', `${visH}px`)
    }
    fit()
    window.addEventListener('resize', fit)
    window.addEventListener('orientationchange', fit)
    window.visualViewport?.addEventListener('resize', fit)
    window.visualViewport?.addEventListener('scroll', fit)
    return () => {
      window.removeEventListener('resize', fit)
      window.removeEventListener('orientationchange', fit)
      window.visualViewport?.removeEventListener('resize', fit)
      window.visualViewport?.removeEventListener('scroll', fit)
    }
  }, [])

  /* ---------- giữ dòng đang gõ luôn nhìn thấy được ----------
     Bàn phím che mất nửa dưới màn hình. Thay vì bóp nhỏ cuốn sổ, đo xem con trỏ
     nhập đang ở đâu rồi trượt cả cuốn sổ lên vừa đủ — sổ giữ nguyên cỡ, dòng
     đang viết luôn nằm trong vùng nhìn thấy. */
  const liftRef = useRef(0)
  const liftRaf = useRef<number | null>(null)
  const kbRef = useRef(kb)
  kbRef.current = kb
  useEffect(() => {
    const setLift = (px: number) => {
      liftRef.current = px
      stageRef.current?.style.setProperty('--kb-lift', `${px}px`)
    }

    const measure = () => {
      liftRaf.current = null
      const stage = stageRef.current
      if (!stage) return
      const el = document.activeElement
      if (!kbRef.current || !(el instanceof HTMLTextAreaElement)) {
        if (liftRef.current) setLift(0)
        return
      }
      const y = caretViewportY(el)
      if (y == null) return
      const box = stage.getBoundingClientRect()
      let next = liftRef.current
      // chừa một dòng thở ở hai đầu cho khỏi sát mép
      if (y > box.bottom - 28) next += y - (box.bottom - 28)
      else if (y < box.top + 16) next -= box.top + 16 - y
      next = clamp(Math.round(next), 0, PAGE_H)
      if (next !== liftRef.current) setLift(next)
    }

    const schedule = () => {
      if (liftRaf.current === null) liftRaf.current = window.requestAnimationFrame(measure)
    }

    document.addEventListener('selectionchange', schedule)
    document.addEventListener('input', schedule)
    document.addEventListener('focusin', schedule)
    document.addEventListener('focusout', schedule)
    window.visualViewport?.addEventListener('resize', schedule)
    return () => {
      document.removeEventListener('selectionchange', schedule)
      document.removeEventListener('input', schedule)
      document.removeEventListener('focusin', schedule)
      document.removeEventListener('focusout', schedule)
      window.visualViewport?.removeEventListener('resize', schedule)
      if (liftRaf.current !== null) window.cancelAnimationFrame(liftRaf.current)
    }
  }, [])

  // bàn phím vừa đóng thì hạ cuốn sổ về chỗ cũ
  useEffect(() => {
    if (!kb) {
      liftRef.current = 0
      stageRef.current?.style.setProperty('--kb-lift', '0px')
    }
  }, [kb])

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

  /** góc lật khi kéo theo QUÃNG ĐƯỜNG ngón tay đi được (vuốt ở giữa trang) */
  const angleFromDelta = (dir: PeekDir, dx: number, span: number) =>
    dir === 'next'
      ? -180 * clamp(-dx / span, 0, 1)
      : -180 * (1 - clamp(dx / span, 0, 1))

  // rê chuột tới góc dưới của cuốn sổ thì góc giấy cong lên mời kéo
  useEffect(() => {
    let queued = false
    const onMove = (e: PointerEvent) => {
      // chỉ là gợi ý cho con chuột; ngón tay đã có cách vuốt ngang tiện hơn nhiều
      if (e.pointerType !== 'mouse') return
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

  /**
   * Thả tay: cho tờ giấy chạy nốt quãng còn lại và CHỐT VỊ TRÍ NGAY, không đợi
   * animation xong. Tờ giấy đang nắm vẫn giữ đúng góc đích nên hình ảnh không
   * nhảy, mà thao tác kế tiếp không còn cách nào ghi đè lên nó nữa — đây chính
   * là chỗ trước kia gây "chuyển nhầm trang".
   * Dùng chung cho cả hai lối lật: nắm góc giấy và vuốt ngang.
   */
  const settleFlip = useCallback(
    (dir: PeekDir, leaf: number, complete: boolean) => {
      const target = dir === 'next' ? (complete ? -180 : 0) : complete ? 0 : -180
      paintAngle(target)
      setPeek({ leaf, dir, angle: target, mode: 'settle' })

      if (complete) {
        const want = clamp(dir === 'next' ? leaf + 1 : leaf, 0, units)
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
    },
    [units, soundOn, ping],
  )

  const cornerUp = (e: React.PointerEvent) => {
    const drag = cornerDragRef.current
    if (!drag) return
    cornerDragRef.current = null
    if (rafRef.current !== null) {
      window.cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }

    const progress = Math.abs(angleFor(drag.dir, e.clientX, drag.rect)) / 180
    settleFlip(drag.dir, drag.leaf, drag.dir === 'next' ? progress > 0.32 : progress < 0.68)
  }

  /* ---------- vuốt ngang ở BẤT KỲ ĐÂU trên trang để lật ----------
     Lật sổ thật thì cả mép giấy đều lật được, không ai chỉ nắm đúng một góc.
     Trên điện thoại đây mới là thao tác chính; góc giấy chỉ còn là gợi ý cho chuột. */
  const swipeRef = useRef<{
    id: number
    x0: number
    y0: number
    axis: 'x' | null
    dir: PeekDir | null
    leaf: number
    span: number
    samples: { x: number; t: number }[]
  } | null>(null)

  const swipeDown = (e: React.PointerEvent) => {
    // con chuột đã có góc giấy + nút hai bên; kéo ngang bằng chuột là để bôi đen chữ
    if (e.pointerType === 'mouse' || swipeRef.current) return
    const el = e.target as HTMLElement
    if (
      el.closest(
        '.corner-hot, .mobile-bar, .sheet, .sheet-backdrop, .buddy, .sticker, .sticker-tools, .page-tear, .draw-layer, button, input, a',
      )
    ) {
      return
    }
    // đang gõ dở thì cú vuốt trên ô chữ là để chọn chữ, không phải để lật
    if (el instanceof HTMLTextAreaElement && document.activeElement === el) return
    // trong tab trình duyệt, hai mép màn hình là chỗ vuốt-để-quay-lại của hệ điều hành
    if (!standalone && (e.clientX < 24 || e.clientX > window.innerWidth - 24)) return

    const rect = bookRef.current?.getBoundingClientRect()
    if (!rect || !rect.width) return
    swipeRef.current = {
      id: e.pointerId,
      x0: e.clientX,
      y0: e.clientY,
      axis: null,
      dir: null,
      leaf: -1,
      span: single ? rect.width : rect.width / 2,
      samples: [{ x: e.clientX, t: e.timeStamp }],
    }
  }

  const swipeMove = (e: React.PointerEvent) => {
    const s = swipeRef.current
    if (!s || s.id !== e.pointerId) return
    const dx = e.clientX - s.x0
    const dy = e.clientY - s.y0

    if (!s.axis) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) < AXIS_LOCK) return
      // nghiêng về chiều dọc thì nhường hẳn, đừng cướp cú cuộn của người dùng
      if (Math.abs(dx) <= Math.abs(dy) * Y_BIAS) {
        swipeRef.current = null
        return
      }
      const dir: PeekDir = dx < 0 ? 'next' : 'prev'
      const leaf = dir === 'next' ? posRef.current : posRef.current - 1
      if (leaf < 0 || leaf >= units) {
        swipeRef.current = null
        return
      }
      s.axis = 'x'
      s.dir = dir
      s.leaf = leaf
      // cú vuốt mới thắng mọi thứ đang dang dở
      if (settleTimer.current !== null) {
        window.clearTimeout(settleTimer.current)
        settleTimer.current = null
      }
      const active = document.activeElement
      if (active instanceof HTMLTextAreaElement || active instanceof HTMLInputElement) active.blur()
      try {
        // Safari ném lỗi nếu ngón tay đã nhấc ra trước khi kịp giữ
        ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
      } catch {
        /* không giữ được thì thôi, sự kiện vẫn nổi bọt lên tới đây */
      }
      // đánh dấu để cancelPeek() và hiệu ứng cong góc biết là đang có người nắm giấy
      cornerDragRef.current = { dir, leaf, rect: bookRef.current!.getBoundingClientRect() }
      // ghi góc TRƯỚC khi render, nếu không tờ giấy loé một khung hình ở góc cũ
      paintAngle(angleFromDelta(dir, dx, s.span))
      setPeek({ leaf, dir, angle: 0, mode: 'drag' })
    }

    s.samples.push({ x: e.clientX, t: e.timeStamp })
    while (s.samples.length > 2 && e.timeStamp - s.samples[0].t > SAMPLE_MS) s.samples.shift()

    if (rafRef.current !== null) return
    rafRef.current = window.requestAnimationFrame(() => {
      rafRef.current = null
      if (!swipeRef.current?.dir) return
      paintAngle(angleFromDelta(swipeRef.current.dir, dx, s.span))
    })
  }

  const swipeUp = (e: React.PointerEvent) => {
    const s = swipeRef.current
    swipeRef.current = null
    if (!s || s.axis !== 'x' || !s.dir) return
    cornerDragRef.current = null
    if (rafRef.current !== null) {
      window.cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }

    const dx = e.clientX - s.x0
    const first = s.samples[0]
    const vx = (e.clientX - first.x) / Math.max(1, e.timeStamp - first.t)
    // đi đúng chiều mới tính; kéo ngược lại giữa chừng là đổi ý, trả trang về chỗ cũ
    const forward = s.dir === 'next' ? dx < 0 : dx > 0
    const fling = Math.abs(vx) > FLING_V && Math.abs(dx) > FLING_MIN_D
    const long = Math.abs(dx) > s.span * LONG_RATIO
    settleFlip(s.dir, s.leaf, forward && (fling || long))
  }

  /** trình duyệt giành lại cử chỉ (cuộn, phóng to) → nhả tờ giấy ra */
  const swipeCancel = () => {
    const s = swipeRef.current
    swipeRef.current = null
    if (!s || s.axis !== 'x' || !s.dir) return
    cornerDragRef.current = null
    settleFlip(s.dir, s.leaf, false)
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

  /* ---------- còn đang hỏi đám mây xem người này là ai ---------- */
  if (booting) {
    return (
      <div className="boot">
        <div className="boot-book">📔</div>
        <p>Đang mở cuốn nhật ký của bạn…</p>
      </div>
    )
  }

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

  const sheetOpen = trayOpen || indexOpen || menuOpen

  return (
    <div className={`app${kb ? ' kb-open' : ''}${sheetOpen ? ' sheet-open' : ''}`}>
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
        ref={stageRef}
        className={`stage${trayOpen ? ' tray-open' : ''}${
          trayOpen || indexOpen ? ' sheet-open' : ''
        }`}
        onPointerDown={swipeDown}
        onPointerMove={swipeMove}
        onPointerUp={swipeUp}
        onPointerCancel={swipeCancel}
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

        {buddy && (
          <CatBuddy
            src={buddy.src}
            name={diary.buddyName}
            soundOn={soundOn}
            event={buddyEvent}
            compact={compact}
          />
        )}

        {indexOpen && (
          <Sheet
            variant="index-sheet"
            title={`Mục lục (${pages.length} trang)`}
            onClose={() => setIndexOpen(false)}
          >
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
                  // đây là cử chỉ kéo riêng, sheet không được hiểu nhầm thành "vuốt để đóng"
                  data-no-sheet-drag
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
          </Sheet>
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
          keyboardOpen={!!kb}
          onDoneTyping={() => (document.activeElement as HTMLElement | null)?.blur?.()}
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
