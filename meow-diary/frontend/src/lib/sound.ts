/**
 * Âm thanh của Meow Diary — tổng hợp bằng WebAudio, không dùng file nào.
 *
 * Nguyên tắc chung để không chói tai:
 * - chỉ dùng sóng sine/triangle (không saw/square)
 * - luôn qua lowpass ~2.2kHz, nên phần lớn năng lượng nằm dưới ngưỡng gây gắt
 * - biên độ nhỏ (đỉnh ~0.1) và bao hình vào/ra mềm để không có tiếng "tạch"
 */

type Ctxish = BaseAudioContext

let ctx: AudioContext | null = null
let lastMeowAt = 0

function ensureCtx(): AudioContext | null {
  try {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!AC) return null
    ctx = ctx ?? new AC()
    if (ctx.state === 'suspended') void ctx.resume()
    return ctx
  } catch {
    return null
  }
}

/** cửa ra chung: lowpass cắt phần gắt + âm lượng tổng */
function softOut(c: Ctxish, dest: AudioNode, gain: number) {
  const lp = c.createBiquadFilter()
  lp.type = 'lowpass'
  lp.frequency.value = 2200
  lp.Q.value = 0.6
  const g = c.createGain()
  g.gain.value = gain
  lp.connect(g).connect(dest)
  return lp
}

/**
 * Tiếng "meo" — hai formant quét từ nguyên âm "e" sang "o", đúng kiểu mèo kêu,
 * cao độ đi lên rồi rơi xuống mềm.
 */
export function buildMeow(c: Ctxish, dest: AudioNode, at = 0, pitch = 1, level = 0.5) {
  const dur = 0.5
  // hai bộ lọc bandpass ăn mất khá nhiều năng lượng nên cần bù lại,
  // mức này đo được đỉnh ~0.11 — ngang với các âm khác, vẫn rất khẽ
  const out = softOut(c, dest, 0.5 * level)

  const osc = c.createOscillator()
  osc.type = 'triangle'
  const f0 = 460 * pitch
  osc.frequency.setValueAtTime(f0 * 0.85, at)
  osc.frequency.linearRampToValueAtTime(f0 * 1.18, at + 0.12)
  osc.frequency.linearRampToValueAtTime(f0 * 0.72, at + dur)

  // hai bộ cộng hưởng giả giọng: F1 và F2 trượt xuống → nghe thành "me-ow"
  const f1 = c.createBiquadFilter()
  f1.type = 'bandpass'
  f1.Q.value = 4
  f1.frequency.setValueAtTime(760 * pitch, at)
  f1.frequency.linearRampToValueAtTime(480 * pitch, at + dur)

  const f2 = c.createBiquadFilter()
  f2.type = 'bandpass'
  f2.Q.value = 6
  f2.frequency.setValueAtTime(1750 * pitch, at)
  f2.frequency.linearRampToValueAtTime(1050 * pitch, at + dur)

  const env = c.createGain()
  env.gain.setValueAtTime(0.0001, at)
  env.gain.exponentialRampToValueAtTime(1, at + 0.07)
  env.gain.setValueAtTime(1, at + 0.2)
  env.gain.exponentialRampToValueAtTime(0.0001, at + dur)

  osc.connect(f1)
  osc.connect(f2)
  f1.connect(env)
  f2.connect(env)
  env.connect(out)

  osc.start(at)
  osc.stop(at + dur + 0.05)
  return dur
}

/** tiếng "chíu" rất ngắn khi xoa đầu mèo — như tiếng mừng rỡ */
export function buildChirp(c: Ctxish, dest: AudioNode, at = 0) {
  const dur = 0.22
  const out = softOut(c, dest, 0.13)

  const osc = c.createOscillator()
  osc.type = 'sine'
  osc.frequency.setValueAtTime(620, at)
  osc.frequency.exponentialRampToValueAtTime(1080, at + 0.09)
  osc.frequency.exponentialRampToValueAtTime(880, at + dur)

  const env = c.createGain()
  env.gain.setValueAtTime(0.0001, at)
  env.gain.exponentialRampToValueAtTime(1, at + 0.03)
  env.gain.exponentialRampToValueAtTime(0.0001, at + dur)

  osc.connect(env).connect(out)
  osc.start(at)
  osc.stop(at + dur + 0.05)
  return dur
}

/** mèo ngân nga "la la lá" — vài nốt ngũ cung, chậm và nhẹ */
export function buildSong(c: Ctxish, dest: AudioNode, at = 0) {
  // Đô–Rê–Mi–Sol–La, quãng ngũ cung nên nốt nào ghép cũng thuận tai
  const scale = [523.25, 587.33, 659.25, 783.99, 880]
  const shapes = [
    [0, 2, 4, 2],
    [2, 4, 3, 1],
    [0, 2, 3, 2, 0],
    [4, 3, 2, 0],
  ]
  const notes = shapes[Math.floor(Math.random() * shapes.length)]
  const step = 0.26
  const out = softOut(c, dest, 0.1)

  notes.forEach((n, i) => {
    const t = at + i * step
    const dur = step * 0.95

    const osc = c.createOscillator()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(scale[n], t)

    // rung nhẹ cho giống tiếng hát chứ không phải tiếng máy
    const vib = c.createOscillator()
    vib.type = 'sine'
    vib.frequency.value = 5.5
    const vibAmt = c.createGain()
    vibAmt.gain.value = 3.5
    vib.connect(vibAmt).connect(osc.frequency)

    const env = c.createGain()
    env.gain.setValueAtTime(0.0001, t)
    env.gain.exponentialRampToValueAtTime(1, t + 0.06)
    env.gain.setValueAtTime(1, t + dur * 0.55)
    env.gain.exponentialRampToValueAtTime(0.0001, t + dur)

    osc.connect(env).connect(out)
    osc.start(t)
    osc.stop(t + dur + 0.05)
    vib.start(t)
    vib.stop(t + dur + 0.05)
  })

  return notes.length * step
}

/* ---------- các hàm gọi từ giao diện ---------- */

/** lật trang: một tiếng "meo" khẽ, có giới hạn để lật nhanh không thành ồn */
export function playPageFlip(enabled: boolean) {
  if (!enabled) return
  const now = Date.now()
  if (now - lastMeowAt < 1200) return
  lastMeowAt = now
  const c = ensureCtx()
  if (!c) return
  // mỗi lần lệch cao độ một chút cho đỡ đơn điệu
  buildMeow(c, c.destination, c.currentTime + 0.01, 0.94 + Math.random() * 0.16, 0.75)
}

/** xoa đầu mèo */
export function playPet(enabled: boolean) {
  if (!enabled) return
  const c = ensureCtx()
  if (!c) return
  buildChirp(c, c.destination, c.currentTime + 0.01)
}

/** mèo ngân nga vài nốt */
export function playSong(enabled: boolean) {
  if (!enabled) return
  const c = ensureCtx()
  if (!c) return
  buildSong(c, c.destination, c.currentTime + 0.02)
}

// tiện cho việc đo đạc trong lúc phát triển (render offline, xem biên độ + phổ)
if (import.meta.env.DEV) {
  ;(window as unknown as Record<string, unknown>).__meowSound = { buildMeow, buildChirp, buildSong }
}
