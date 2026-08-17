import { useState } from 'react'
import { CATS } from '../lib/cats'

interface Props {
  initialOwner?: string
  initialBuddy?: string | null
  initialBuddyName?: string
  onDone: (data: { ownerName: string; buddyId: string; buddyName: string }) => void
  onCancel?: () => void
}

export default function CatPicker({
  initialOwner = '',
  initialBuddy = null,
  initialBuddyName = '',
  onDone,
  onCancel,
}: Props) {
  const [buddyId, setBuddyId] = useState<string | null>(initialBuddy)
  const [owner, setOwner] = useState(initialOwner)
  const [buddyName, setBuddyName] = useState(initialBuddyName)

  const selected = CATS.find((c) => c.id === buddyId)

  return (
    <div className="picker">
      <h1>Chọn một bạn mèo đồng hành 🐾</h1>
      <p className="lead">
        Bạn ấy sẽ ngồi cạnh cuốn nhật ký, hóng bạn viết mỗi ngày.
      </p>

      <div className="cat-grid">
        {CATS.map((cat) => (
          <button
            key={cat.id}
            className={`cat-card${cat.id === buddyId ? ' selected' : ''}`}
            onClick={() => {
              setBuddyId(cat.id)
              if (!buddyName) setBuddyName(cat.name)
            }}
          >
            <img src={cat.src} alt={cat.name} />
            <span>{cat.name}</span>
          </button>
        ))}
      </div>

      <div className="picker-form">
        <label className="field">
          Tên của bạn
          <input
            value={owner}
            placeholder="Ví dụ: Thiên"
            onChange={(e) => setOwner(e.target.value)}
          />
        </label>
        <label className="field">
          Đặt tên cho bé mèo
          <input
            value={buddyName}
            placeholder={selected ? selected.name : 'Ví dụ: Bơ'}
            onChange={(e) => setBuddyName(e.target.value)}
          />
        </label>
      </div>

      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
        {onCancel && (
          <button className="pill" onClick={onCancel}>
            Quay lại sổ
          </button>
        )}
        <button
          className="btn-primary"
          disabled={!buddyId}
          onClick={() =>
            buddyId &&
            onDone({
              ownerName: owner.trim() || 'tớ',
              buddyId,
              buddyName: buddyName.trim() || selected?.name || 'Mèo',
            })
          }
        >
          Mở cuốn nhật ký ✨
        </button>
      </div>
    </div>
  )
}
