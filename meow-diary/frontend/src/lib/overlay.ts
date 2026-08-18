/**
 * Nút Back của Android (và cử chỉ vuốt-để-quay-lại) phải đóng cái panel đang mở,
 * chứ không phải thoát khỏi app — đây là điều người dùng điện thoại luôn mong đợi.
 *
 * Cách làm: giữ đúng MỘT mốc lịch sử giả trong lúc còn panel nào đó đang mở.
 * Việc thêm/gỡ mốc được hoãn tới cuối lượt render, nên lúc đóng panel này để mở
 * panel khác (menu ⋯ → mục lục) mốc cũ không bị gỡ nhầm rồi thêm lại.
 */

type Closer = () => void

const stack: Closer[] = []
let guarded = false
let scheduled = false

function sync() {
  if (scheduled) return
  scheduled = true
  queueMicrotask(() => {
    scheduled = false
    if (stack.length > 0 && !guarded) {
      guarded = true
      history.pushState({ meowOverlay: true }, '')
    } else if (stack.length === 0 && guarded) {
      guarded = false
      if ((history.state as { meowOverlay?: boolean } | null)?.meowOverlay) history.back()
    }
  })
}

if (typeof window !== 'undefined') {
  window.addEventListener('popstate', () => {
    if (!guarded) return
    // trình duyệt vừa nuốt mất mốc giả của mình
    guarded = false
    stack[stack.length - 1]?.()
    sync()
  })
}

/** đăng ký một panel đang mở; trả về hàm gỡ đăng ký */
export function pushOverlay(close: Closer): () => void {
  stack.push(close)
  sync()
  return () => {
    const i = stack.lastIndexOf(close)
    if (i >= 0) stack.splice(i, 1)
    sync()
  }
}
