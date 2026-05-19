import type { CommunityPost, ProfileRole } from './types'
import { CONCEPT_LIKE_THRESHOLD } from './boardConstants'

/** 0=일반, 1=활동, 2=우수(공지 가능), 3=운영진(공지 가능) */
export type CommunityGradeLevel = 0 | 1 | 2 | 3

export const NOTICE_MIN_GRADE = 2 as CommunityGradeLevel

export const COMMUNITY_GRADE_LABELS: Record<CommunityGradeLevel, string> = {
  0: '일반',
  1: '활동',
  2: '우수',
  3: '운영진',
}

export function gradeLabel(grade: number): string {
  if (grade >= 3) return COMMUNITY_GRADE_LABELS[3]
  if (grade === 2) return COMMUNITY_GRADE_LABELS[2]
  if (grade === 1) return COMMUNITY_GRADE_LABELS[1]
  return COMMUNITY_GRADE_LABELS[0]
}

export function canWriteNotice(role: ProfileRole, grade: number): boolean {
  if (role === 'admin') return true
  return grade >= NOTICE_MIN_GRADE
}

/** 개념글: 공지가 아니며 추천 수가 기준 이상 */
export function isConceptPost(post: Pick<CommunityPost, 'likeCount' | 'isNotice'>): boolean {
  if (post.isNotice) return false
  return post.likeCount >= CONCEPT_LIKE_THRESHOLD
}

export function conceptCriteriaText(): string {
  return `추천 ${CONCEPT_LIKE_THRESHOLD}개 이상`
}
