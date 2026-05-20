import {
  BulkInputTableColGroup,
  bulkThClass,
} from './bulkInputTableLayout'

type Props = {
  showMembers: boolean
  showConfirm?: boolean
  showActions?: boolean
}

export function BulkInputTableHead({
  showMembers,
  showConfirm = false,
  showActions = false,
}: Props) {
  return (
    <>
      <BulkInputTableColGroup showMembers={showMembers} />
      <thead>
        <tr className="border-b border-border-subtle bg-neutral-cool/20">
          <th className={bulkThClass()}>일</th>
          <th className={bulkThClass()}>구분</th>
          <th className={bulkThClass()}>금액</th>
          <th className={bulkThClass()}>카테고리</th>
          <th className={bulkThClass()}>메모</th>
          <th className={bulkThClass()}>결제</th>
          <th className={bulkThClass()}>카드</th>
          {showMembers && <th className={bulkThClass()}>구성원</th>}
          {showConfirm && <th className={bulkThClass()}>확인</th>}
          {showActions && <th className={bulkThClass()}>관리</th>}
        </tr>
      </thead>
    </>
  )
}
