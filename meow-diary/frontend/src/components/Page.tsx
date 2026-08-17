import DrawCanvas, { type DrawCanvasHandle } from './DrawCanvas'
import StickerLayer from './StickerLayer'
import type { DiaryPage, Sticker } from '../lib/types'

export type Mode = 'write' | 'draw' | 'sticker'

interface Props {
  page: DiaryPage
  pageNumber: number
  side: 'left' | 'right'
  /** trang đang mở, cho phép gõ / vẽ / dán */
  active: boolean
  /** trang sẽ nhận sticker / nét vẽ tiếp theo */
  targeted: boolean
  /** đang hỏi xác nhận xoá — trang rạn nứt để biết xoá trang nào */
  cracking: boolean
  /** đang xé bỏ */
  tearing: boolean
  mode: Mode
  color: string
  brush: number
  eraser: boolean
  selectedSticker: string | null
  onSelectSticker: (id: string | null) => void
  onPatch: (patch: Partial<DiaryPage>) => void
  onFocus: () => void
  registerDraw: (handle: DrawCanvasHandle | null) => void
  /** xé trang: bấm lần đầu để trang rạn nứt, bấm lần nữa để xé thật */
  canDelete: boolean
  onRequestDelete: () => void
  onCancelDelete: () => void
}

export default function Page({
  page,
  pageNumber,
  side,
  active,
  targeted,
  cracking,
  tearing,
  mode,
  color,
  brush,
  eraser,
  selectedSticker,
  onSelectSticker,
  onPatch,
  onFocus,
  registerDraw,
  canDelete,
  onRequestDelete,
  onCancelDelete,
}: Props) {
  return (
    <div
      className={`page${active ? '' : ' inactive'}${
        targeted && mode !== 'write' ? ' targeted' : ''
      }${cracking ? ' cracking' : ''}${tearing ? ' tearing' : ''}`}
      onPointerDown={onFocus}
    >
      {(cracking || tearing) && <span className="crack" />}
      <div className={`washi ${side === 'left' ? 'left' : 'right'}`} />

      {active && canDelete && !tearing && (
        <div
          className={`page-tear ${side === 'right' ? 'at-left' : 'at-right'}${
            cracking ? ' confirming' : ''
          }`}
        >
          {cracking ? (
            <>
              <button className="tear-btn armed" onClick={onRequestDelete}>
                ✂️ Xé thật nhé?
              </button>
              <button className="tear-btn" onClick={onCancelDelete} aria-label="Thôi, giữ lại">
                ✕
              </button>
            </>
          ) : (
            <button className="tear-btn" onClick={onRequestDelete} title="Xé trang này">
              ✂️
            </button>
          )}
        </div>
      )}

      <div className="page-head">
        <span className="date-tag">🗓 {page.date}</span>
        <input
          className="title-input"
          value={page.title}
          placeholder="Tiêu đề trang…"
          onChange={(e) => onPatch({ title: e.target.value })}
        />
      </div>

      <div className="page-body" data-page-id={page.id}>
        <div className={`rule-layer ${page.ruling}`} />

        <textarea
          className="page-text"
          value={page.text}
          placeholder={active ? 'Hôm nay của tớ…' : ''}
          spellCheck={false}
          style={{ pointerEvents: mode === 'write' && active ? 'auto' : 'none' }}
          onChange={(e) => onPatch({ text: e.target.value })}
        />

        <DrawCanvas
          ref={registerDraw}
          pageId={page.id}
          drawing={page.drawing}
          active={active && mode === 'draw'}
          color={color}
          size={brush}
          eraser={eraser}
          onCommit={(dataUrl) => onPatch({ drawing: dataUrl })}
        />

        <StickerLayer
          stickers={page.stickers}
          active={active && mode === 'sticker'}
          selectedId={selectedSticker}
          onSelect={onSelectSticker}
          onChange={(stickers: Sticker[]) => onPatch({ stickers })}
        />
      </div>

      <div className="page-foot">
        <span>— {pageNumber} —</span>
      </div>
    </div>
  )
}
