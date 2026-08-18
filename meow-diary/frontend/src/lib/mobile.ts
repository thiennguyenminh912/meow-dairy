/**
 * Những hành vi mặc định của trình duyệt làm cho web trên điện thoại "không giống app".
 * Gọi `installGestureGuards()` một lần lúc khởi động.
 */

/**
 * Chạm vào chỗ này thì cứ để trình duyệt lo (cuộn danh sách, kéo thanh trượt…).
 * Trả false nghĩa là chỗ đó không có gì để cuộn — chặn luôn cho khỏi nảy trang.
 */
function browserShouldHandle(start: EventTarget | null): boolean {
  let el = start instanceof Element ? start : null
  // thanh trượt / ô nhập có cử chỉ riêng của hệ điều hành, không được đụng vào
  if (el?.closest('input, [data-native-touch]')) return true
  while (el && el !== document.body) {
    if (el instanceof HTMLTextAreaElement && el.scrollHeight > el.clientHeight + 1) return true
    const cs = getComputedStyle(el)
    const scrolls = (v: string) => v === 'auto' || v === 'scroll'
    if (scrolls(cs.overflowY) && el.scrollHeight > el.clientHeight + 1) return true
    if (scrolls(cs.overflowX) && el.scrollWidth > el.clientWidth + 1) return true
    el = el.parentElement
  }
  return false
}

export function installGestureGuards() {
  const doc = document

  /* --- 1. phóng to bằng hai ngón ---
     `user-scalable=no` bị iOS Safari bỏ qua từ iOS 10, nên phải chặn bằng JS:
     chạm từ 2 ngón trở lên thì không cho trình duyệt xử lý tiếp. */
  const blockMultiTouch = (e: TouchEvent) => {
    if (e.touches.length > 1) e.preventDefault()
  }
  doc.addEventListener('touchstart', blockMultiTouch, { passive: false })

  /* Safari còn bộ sự kiện riêng cho cử chỉ phóng to (kể cả trackpad trên macOS) */
  for (const type of ['gesturestart', 'gesturechange', 'gestureend']) {
    doc.addEventListener(type, (e) => e.preventDefault(), { passive: false })
  }

  /* --- 2. kéo quá đà (rubber-band) và pull-to-refresh ---
     `overscroll-behavior: none` lo phần lớn; phần còn lại: chạm vào chỗ KHÔNG
     cuộn được thì không cho trình duyệt cuộn cả trang.
     Quyết định một lần lúc chạm xuống, không đo lại mỗi khung hình. */
  let allowScroll = false
  doc.addEventListener(
    'touchstart',
    (e) => {
      allowScroll = browserShouldHandle(e.target)
    },
    { passive: true },
  )
  doc.addEventListener(
    'touchmove',
    (e) => {
      if (e.touches.length > 1) {
        e.preventDefault()
        return
      }
      if (!allowScroll && e.cancelable) e.preventDefault()
    },
    { passive: false },
  )

  /* --- 3. giữ lâu ra menu "Lưu ảnh / Sao chép" (Android) ---
     iOS đã tắt bằng -webkit-touch-callout trong CSS. Vẫn chừa lại cho ô nhập
     để người dùng còn dán được chữ. */
  doc.addEventListener('contextmenu', (e) => {
    const el = e.target as HTMLElement | null
    if (el?.closest('input, textarea')) return
    e.preventDefault()
  })

  /* --- 4. kéo ảnh ra ngoài thành file --- */
  doc.addEventListener('dragstart', (e) => {
    if ((e.target as HTMLElement)?.tagName === 'IMG') e.preventDefault()
  })
}

/**
 * Vị trí con trỏ nhập trong một `<textarea>`, tính theo pixel của MÀN HÌNH.
 *
 * Textarea không cho hỏi thẳng toạ độ caret, nên dựng một div "gương" có đúng
 * font/padding/độ rộng, đổ vào phần chữ đứng trước con trỏ rồi đo `offsetTop`
 * của phần còn lại. Đây là cách các thư viện caret-position vẫn dùng.
 *
 * Trả về tâm dòng đang gõ (px so với đỉnh viewport) — đã nhân theo tỉ lệ phóng
 * to của cuốn sổ, vì textarea nằm trong một khối bị `scale()`.
 */
export function caretViewportY(ta: HTMLTextAreaElement): number | null {
  const rect = ta.getBoundingClientRect()
  if (!rect.height || !ta.offsetHeight) return null
  // cuốn sổ bị scale() nên 1px trong textarea không bằng 1px trên màn hình
  const zoom = rect.height / ta.offsetHeight

  const mirror = document.createElement('div')
  const cs = getComputedStyle(ta)
  const copy = [
    'fontFamily',
    'fontSize',
    'fontWeight',
    'fontStyle',
    'letterSpacing',
    'lineHeight',
    'textTransform',
    'wordSpacing',
    'textIndent',
    'paddingTop',
    'paddingRight',
    'paddingBottom',
    'paddingLeft',
  ] as const
  for (const prop of copy) mirror.style[prop] = cs[prop]
  mirror.style.position = 'absolute'
  mirror.style.top = '0'
  mirror.style.left = '-9999px'
  mirror.style.visibility = 'hidden'
  mirror.style.boxSizing = 'border-box'
  mirror.style.border = '0'
  mirror.style.width = `${ta.clientWidth}px`
  mirror.style.whiteSpace = 'pre-wrap'
  mirror.style.overflowWrap = 'break-word'

  const caret = ta.selectionEnd ?? ta.value.length
  mirror.textContent = ta.value.slice(0, caret)
  const marker = document.createElement('span')
  // ký tự mồi để span có chiều cao dòng ngay cả khi con trỏ ở cuối bài
  marker.textContent = ta.value.slice(caret) || '.'
  mirror.appendChild(marker)

  document.body.appendChild(mirror)
  const lineTop = marker.offsetTop
  const lineH = marker.offsetHeight || parseFloat(cs.lineHeight) || 20
  document.body.removeChild(mirror)

  return rect.top + (lineTop - ta.scrollTop + lineH / 2) * zoom
}
