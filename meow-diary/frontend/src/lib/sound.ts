let ctx: AudioContext | null = null

/** Tiếng "sột" của giấy — tạo bằng noise burst, không cần file audio */
export function playPageFlip(enabled: boolean) {
  if (!enabled) return
  try {
    const AC = window.AudioContext ?? (window as any).webkitAudioContext
    if (!AC) return
    ctx = ctx ?? new AC()
    if (ctx.state === 'suspended') void ctx.resume()

    const dur = 0.32
    const buffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * dur), ctx.sampleRate)
    const data = buffer.getChannelData(0)
    for (let i = 0; i < data.length; i++) {
      const t = i / data.length
      // tiếng giấy: nhiễu trắng có bao hình lên nhanh, tắt dần
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - t, 2.4) * Math.min(1, t * 18)
    }

    const src = ctx.createBufferSource()
    src.buffer = buffer

    const filter = ctx.createBiquadFilter()
    filter.type = 'bandpass'
    filter.frequency.value = 2600
    filter.Q.value = 0.7

    const gain = ctx.createGain()
    gain.gain.value = 0.12

    src.connect(filter).connect(gain).connect(ctx.destination)
    src.start()
  } catch {
    /* im lặng nếu trình duyệt chặn audio */
  }
}
