# 커뮤니티 로컬 개발 및 배포

## 1. 목업(기본)

`VITE_COMMUNITY_BACKEND` 를 비우거나 주석 처리하면 헤더의 **데모 로그인**으로 글 CRUD를 시험합니다.

## 2. 로컬 Supabase (Docker 필요)

저장소 루트(이 `web/` 의 상위)에서:

```bash
npx supabase start
```

출력되는 **API URL** 과 **anon key** 를 `web/.env.local` 에 넣습니다.

```env
VITE_SUPABASE_URL=http://127.0.0.1:54321
VITE_SUPABASE_ANON_KEY=(supabase status 출력값)
VITE_COMMUNITY_BACKEND=supabase
```

그다음 웹 디렉터리에서:

```bash
npm run dev
```

### Google OAuth 로컬

Supabase 로컬 Studio → Authentication → URL 설정 에 콜백으로 `http://localhost:5173/auth/callback` 을 허용하고, Providers 에서 Google 클라이언트 ID를 넣습니다. 로컬에서 OAuth 설정이 부담되면 Studio에서 **Magic link / 이메일** 제공자를 임시로 켠 뒤 같은 redirect URL을 등록할 수 있습니다(대시보드에서 메일 테스트).

### 첫 관리자 지정

SQL Editor(로컬 또는 클라우드)에서 해당 사용자 UUID로 실행:

```sql
update public.profiles set role = 'admin' where id = '<auth.users 의 id>';
```

## 3. 프로덕션 이사 (Vercel + Supabase 클라우드)

1. Supabase 클라우드 프로젝트에 `supabase/migrations` 와 동일한 스키마를 적용합니다(`db push` 또는 SQL Editor).
2. Authentication → Google 활성화, Site URL 과 Redirect URLs 에 `https://<배포도메인>/auth/callback` 추가.
3. Vercel 프로젝트 환경 변수에 `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_LEDGER_ID`, 그리고 `VITE_COMMUNITY_BACKEND=supabase` 를 설정합니다.
