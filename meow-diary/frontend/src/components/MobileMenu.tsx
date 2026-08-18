import Sheet from './Sheet'
import type { Ruling } from '../lib/types'
import type { User } from '../lib/supabase'
import type { SyncState } from './AuthButton'

interface Props {
  ruling: Ruling
  setRuling: (r: Ruling) => void
  soundOn: boolean
  setSoundOn: (b: boolean) => void
  pageCount: number
  onOpenIndex: () => void
  onAddPage: () => void
  onChangeBuddy: () => void
  onClose: () => void
  cloudReady: boolean
  user: User | null
  syncState: SyncState
  onSignIn: () => void
  onSignOut: () => void
}

/** Sheet "⋯" gom các thao tác ít dùng — vuốt xuống / chạm nền / ✕ / Back đều đóng */
export default function MobileMenu({
  ruling,
  setRuling,
  soundOn,
  setSoundOn,
  pageCount,
  onOpenIndex,
  onAddPage,
  onChangeBuddy,
  onClose,
  cloudReady,
  user,
  syncState,
  onSignIn,
  onSignOut,
}: Props) {
  const syncText =
    syncState === 'syncing'
      ? 'đang đồng bộ…'
      : syncState === 'error'
        ? 'lỗi đồng bộ'
        : 'đã lưu lên mây'

  return (
    <Sheet variant="menu-sheet" title="Tuỳ chọn" onClose={onClose}>
      <button
        className="menu-row"
        onClick={() => {
          onOpenIndex()
          onClose()
        }}
      >
        <span>📖</span> Mục lục <small>{pageCount} trang</small>
      </button>

      <button
        className="menu-row"
        onClick={() => {
          onAddPage()
          onClose()
        }}
      >
        <span>➕</span> Thêm trang mới
      </button>

      <div className="menu-row static">
        <span>📄</span> Kiểu giấy
        <div className="menu-choices">
          {(
            [
              ['line', 'Kẻ ngang'],
              ['dot', 'Chấm bi'],
              ['blank', 'Trơn'],
            ] as [Ruling, string][]
          ).map(([r, label]) => (
            <button
              key={r}
              className={`chip${ruling === r ? ' active' : ''}`}
              onClick={() => setRuling(r)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <button className="menu-row" onClick={() => setSoundOn(!soundOn)}>
        <span>{soundOn ? '🔊' : '🔇'}</span> Tiếng mèo
        <small>{soundOn ? 'đang bật' : 'đang tắt'}</small>
      </button>

      <button
        className="menu-row"
        onClick={() => {
          onChangeBuddy()
          onClose()
        }}
      >
        <span>🐱</span> Đổi bạn mèo
      </button>

      {cloudReady && (
        <button
          className="menu-row"
          onClick={() => {
            if (user) onSignOut()
            else onSignIn()
            onClose()
          }}
        >
          <span>{user ? '☁️' : '🔑'}</span>
          {user ? `Đăng xuất (${user.email ?? 'đã đăng nhập'})` : 'Đăng nhập bằng Google'}
          <small>{user ? syncText : 'để đồng bộ giữa các máy'}</small>
        </button>
      )}

      <p className="menu-note">Muốn xé một trang? Bấm nút ✂️ ở góc trên của trang đó.</p>
    </Sheet>
  )
}
