export type Mood = 'idle' | 'happy' | 'dance' | 'cry' | 'sleep' | 'love' | 'silly'

export interface CatLine {
  text: string
  mood: Mood
}

/** Mèo tự nói khi rảnh — chill, ngáo ngáo, tích cực */
export const IDLE_LINES: CatLine[] = [
  { text: 'meo~ 🐾', mood: 'idle' },
  { text: 'Meo meo… à không có gì, tớ gọi chơi thôi 😽', mood: 'silly' },
  { text: 'Cậu ăn gì chưa? Tớ ăn ké với nha 🍚', mood: 'happy' },
  { text: 'Uống nước đi cậu ơiii, một ngụm thôi cũng được 💧', mood: 'idle' },
  { text: 'Chill thôi, deadline chạy sau lưng thì kệ nó 😌', mood: 'silly' },
  { text: 'Tớ vừa ngủ dậy, lông tai bù xù luôn á', mood: 'sleep' },
  { text: 'Nằm ườn xíu rồi viết tiếp cũng được mà~', mood: 'sleep' },
  { text: 'Ngồi lâu rồi đó, đứng dậy vươn vai cái nào!', mood: 'dance' },
  { text: 'Tớ đếm được 3 con chim ngoài cửa sổ rồi nè 🐦', mood: 'silly' },
  { text: 'Cậu thơm ghê… hay tại tớ đói ta 🤔', mood: 'silly' },
  { text: 'Hôm nay cậu có mệt không? Kể tớ nghe với.', mood: 'love' },
  { text: 'Tớ không giỏi gì đâu, tớ chỉ giỏi thương cậu thôi 🩷', mood: 'love' },
  { text: 'Vũ trụ ơi cho cậu ấy một ngày dễ thở nhaaa ✨', mood: 'happy' },
  { text: 'Mình quẩy một chút cho tỉnh nè~ 🎵', mood: 'dance' },
  { text: 'Cậu biết không, cá là món ngon nhất thế giới đó.', mood: 'silly' },
  { text: 'Nếu hôm nay tệ thì mai mình làm lại, dễ mà 💪', mood: 'happy' },
  { text: 'Tớ vừa mơ thấy một núi cá khô 🐟', mood: 'sleep' },
  { text: 'Cậu đã làm tốt hơn cậu nghĩ nhiều đó.', mood: 'love' },
  { text: 'Nhớ chớp mắt nha, mắt khô là tớ buồn á 🥺', mood: 'cry' },
  { text: 'Hôm nay trời hợp để nằm dài ghê ☁️', mood: 'sleep' },
  { text: 'Cậu cứ chậm chậm thôi, tớ đợi được mà.', mood: 'idle' },
  { text: 'Tự hào về cậu ghê á, thật đó không xạo đâu!', mood: 'happy' },
  { text: 'Mệt thì nghỉ nha, cậu đâu phải cái máy 🫧', mood: 'love' },
  { text: 'Tớ đang tập làm mèo chăm chỉ… được 5 giây rồi 😴', mood: 'silly' },
  { text: 'Hít vào… thở ra… rồi, ổn rồi 🌿', mood: 'idle' },
]

export const NIGHT_LINES: CatLine[] = [
  { text: 'Khuya rồi đó, viết nốt rồi đi ngủ nha 🌙', mood: 'sleep' },
  { text: 'Tớ buồn ngủ quá… mà cậu chưa ngủ thì tớ thức cùng.', mood: 'sleep' },
  { text: 'Đi ngủ sớm giùm tớ một hôm thôi mà 🥺', mood: 'cry' },
]

export const EVENT_LINES: Record<string, CatLine[]> = {
  flip: [
    { text: 'Sột soạt… tớ mê tiếng lật trang ghê 📖', mood: 'happy' },
    { text: 'Trang này có gì hay không kể tớ nghe với!', mood: 'idle' },
    { text: 'Ơ, lật nhanh vậy tớ chóng mặt á 😵', mood: 'silly' },
    { text: 'Đi tiếp nàoooo~', mood: 'dance' },
  ],
  write: [
    { text: 'Viết đi viết đi, tớ hóng nè 👀', mood: 'happy' },
    { text: 'Chữ cậu xinh dữ á!', mood: 'love' },
    { text: 'Kể hết ra đi, tớ không mách ai đâu 🤫', mood: 'idle' },
    { text: 'Hôm nay của cậu đáng được ghi lại đó.', mood: 'love' },
  ],
  draw: [
    { text: 'Ơ vẽ đẹp á! Nghệ sĩ ghê ta 🎨', mood: 'happy' },
    { text: 'Vẽ tớ một cái đi mà, tớ ngồi im cho 😽', mood: 'love' },
    { text: 'Nét này nghệ thuật đó nha!', mood: 'dance' },
  ],
  sticker: [
    { text: 'Dán thêm cái nữa đi 🐾', mood: 'happy' },
    { text: 'Trang này lung linh quá trời ✨', mood: 'love' },
    { text: 'Cho tớ một cái sticker cá nha 🐟', mood: 'silly' },
  ],
  newpage: [
    { text: 'Trang mới thơm mùi giấy nè!', mood: 'happy' },
    { text: 'Giấy trắng tinh, hồi hộp ghê 🫧', mood: 'idle' },
  ],
  deletepage: [
    { text: 'Rẹttt… tạm biệt trang nhé 🥺', mood: 'cry' },
    { text: 'Xé rồi thì thôi, mình viết cái mới hay hơn!', mood: 'happy' },
  ],
  pet: [
    { text: 'Meoooo~ gãi cằm nữa đi 😽', mood: 'love' },
    { text: 'Grừ grừ grừ… (tiếng mèo kêu sung sướng)', mood: 'love' },
    { text: 'Nhột! Nhưng mà thích 🩷', mood: 'happy' },
    { text: 'Tớ quẩy cho cậu xem nè~ 🎶', mood: 'dance' },
    { text: 'Bế tớ lên đi, tớ nhẹ lắm (xạo đó) 🐈', mood: 'silly' },
  ],
}

export const pick = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)]

export function idleLine(): CatLine {
  const hour = new Date().getHours()
  if (hour >= 23 || hour < 5) return pick([...NIGHT_LINES, ...NIGHT_LINES, ...IDLE_LINES])
  return pick(IDLE_LINES)
}

export function eventLine(event: keyof typeof EVENT_LINES): CatLine {
  return pick(EVENT_LINES[event] ?? IDLE_LINES)
}
