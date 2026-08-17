import { useState } from 'react'
import type { User } from '../lib/supabase'

export type SyncState = 'off' | 'idle' | 'syncing' | 'saved' | 'error'

const SYNC_ICON: Record<SyncState, string> = {
  off: '',
  idle: '☁️',
  syncing: '⏳',
  saved: '☁️',
  error: '⚠️',
}

const SYNC_TEXT: Record<SyncState, string> = {
  off: '',
  idle: 'chờ đồng bộ',
  syncing: 'đang đồng bộ…',
  saved: 'đã lưu lên mây',
  error: 'lỗi đồng bộ',
}

interface Props {
  configured: boolean
  user: User | null
  syncState: SyncState
  onSignIn: () => void
  onSignOut: () => void
}

export default function AuthButton({ configured, user, syncState, onSignIn, onSignOut }: Props) {
  const [confirm, setConfirm] = useState(false)

  if (!configured) return null

  if (!user) {
    return (
      <button className="pill" onClick={onSignIn} title="Đăng nhập để đồng bộ giữa các thiết bị">
        ☁️ Đăng nhập
      </button>
    )
  }

  const name = user.user_metadata?.full_name || user.email?.split('@')[0] || 'bạn'

  return (
    <button
      className={`pill${confirm ? ' danger' : ''}`}
      onClick={() => (confirm ? onSignOut() : setConfirm(true))}
      onBlur={() => setConfirm(false)}
      title={SYNC_TEXT[syncState]}
    >
      {confirm ? (
        'Đăng xuất?'
      ) : (
        <>
          {SYNC_ICON[syncState]} {name}
        </>
      )}
    </button>
  )
}
