import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const body = fs.readFileSync(
  path.join(__dirname, 'community-guide-notice-body.html'),
  'utf8',
)
const title = '[공지] 우리 가계부·다이어리 — 전체 기능 사용 설명서'
const name = '김상현'
const authorId = 'cf985c51-f258-494f-8a29-8cdcd490ebd6'

const sql = `INSERT INTO public.posts (
  author_id,
  author_display_name,
  title,
  body,
  hidden,
  visibility,
  is_notice
) VALUES (
  '${authorId}',
  convert_from(decode('${Buffer.from(name, 'utf8').toString('base64')}', 'base64'), 'UTF8'),
  convert_from(decode('${Buffer.from(title, 'utf8').toString('base64')}', 'base64'), 'UTF8'),
  convert_from(decode('${Buffer.from(body, 'utf8').toString('base64')}', 'base64'), 'UTF8'),
  false,
  'public',
  true
)
RETURNING id, title, is_notice, created_at;`

fs.writeFileSync(path.join(__dirname, '_guide-insert-b64.sql'), sql, 'utf8')
console.log('OK', sql.length, 'chars')
