export interface Cat {
  id: string
  name: string
  src: string
}

/** 15 bạn mèo được tách từ tấm sticker gốc trong Resources/MauMeo.jpg */
export const CATS: Cat[] = [
  { id: 'cat-01', name: 'Nâu Mì', src: '/cats/cat-01.png' },
  { id: 'cat-02', name: 'Cam Sữa', src: '/cats/cat-02.png' },
  { id: 'cat-03', name: 'Mun', src: '/cats/cat-03.png' },
  { id: 'cat-04', name: 'Tuxedo', src: '/cats/cat-04.png' },
  { id: 'cat-05', name: 'Bông', src: '/cats/cat-05.png' },
  { id: 'cat-06', name: 'Tam Thể', src: '/cats/cat-06.png' },
  { id: 'cat-07', name: 'Xiêm', src: '/cats/cat-07.png' },
  { id: 'cat-08', name: 'Xám Vằn', src: '/cats/cat-08.png' },
  { id: 'cat-09', name: 'Bí Ngô', src: '/cats/cat-09.png' },
  { id: 'cat-10', name: 'Đen Trắng', src: '/cats/cat-10.png' },
  { id: 'cat-11', name: 'Cam Cười', src: '/cats/cat-11.png' },
  { id: 'cat-12', name: 'Kem', src: '/cats/cat-12.png' },
  { id: 'cat-13', name: 'Khói', src: '/cats/cat-13.png' },
  { id: 'cat-14', name: 'Xù', src: '/cats/cat-14.png' },
  { id: 'cat-15', name: 'Cà Rốt', src: '/cats/cat-15.png' },
]

export const getCat = (id: string | null) => CATS.find((c) => c.id === id) ?? null

