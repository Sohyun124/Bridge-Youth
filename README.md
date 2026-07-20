# Bridge Youth

청년이 입력한 나이·거주지·이동 조건을 기준으로 교통·자산형성 정책을 비교하고, 공식 안내 링크까지 연결하는 의사결정 지원 서비스입니다.

## 주요 기능

- 이메일 인증 및 Google OAuth 회원가입·로그인
- 회원 닉네임과 Supabase Auth 고유 ID 관리
- K-패스(모두의 카드), 기후동행카드, 지역 교통 정책 비교
- 입력 조건 기준 예상 월 혜택, 비교 이유, 주의사항 표시
- 조건에 맞는 모두의 카드 자동 비교 포함
- 정책 저장, 공식 링크 이동, 이해하기 어려운 부분 피드백
- 상세 화면 1분 체류 후 정책 어려움 여부 확인 및 익명 이벤트 기록
- 관계자 계정만 접근할 수 있는 분석 대시보드

모든 금액과 자격은 “입력한 조건 기준 예상”이며, 실제 신청 가능 여부는 공식 공고를 확인해야 합니다.

## 기술 스택

- Node.js 20+
- Node HTTP server / Vercel Serverless Function
- Vanilla JavaScript, HTML, CSS
- Supabase Auth, PostgreSQL, REST API

## 로컬 실행

```bash
npm install
copy .env.example .env
npm start
```

브라우저에서 `http://localhost:4173`을 엽니다. `.env`에는 실제 비밀 키를 넣고 GitHub에 커밋하지 않습니다.

## 환경 변수

필수 배포 변수:

- `SUPABASE_URL`
- `SUPABASE_SECRET_KEY` (서버 전용, 브라우저에 노출 금지)
- `APP_BASE_URL` (예: `https://bridge-youth.vercel.app`)
- `TRUST_PROXY=true` (Vercel)

선택 변수와 정책 수집 변수는 [`.env.example`](.env.example)를 참고하세요.

## Supabase 설정

1. `supabase/migrations`의 SQL을 파일명 순서대로 Supabase SQL Editor에서 실행합니다.
2. Authentication → URL Configuration에서 Site URL과 Redirect URL에 로컬 및 Vercel 주소를 등록합니다.
3. Email provider의 이메일 인증을 활성화합니다.
4. Google provider를 사용할 경우 Google OAuth Client ID/Secret을 Supabase에 등록합니다.
5. 관계자 분석 권한은 `member_profiles.role`이 `staff` 또는 `admin`인 계정에만 부여합니다.

## Vercel 배포

GitHub 저장소의 `main` 브랜치를 Vercel 프로젝트에 연결하면 자동 배포됩니다.

- Framework Preset: `Other` 또는 `Node`
- Root Directory: `./`
- 환경 변수는 Vercel Project Settings에서 Production/Preview에 각각 등록
- 배포 후 `https://bridge-youth.vercel.app`을 Supabase Redirect URL에 추가

## 검증 명령

```bash
npm run check
npm run check:deployment
npm run smoke:server
```

정책 데이터는 공식 출처와 확인일이 없는 경우 비교 결과에 노출하지 않도록 서버에서 검증합니다.

## 디렉터리 안내

- `client.js`, `index.html`, `styles.css`: 브라우저 앱
- `lib/app-server.cjs`: 로컬·Vercel 공용 서버 진입점
- `api/index.mjs`: Vercel 함수 어댑터
- `database.js`: Supabase 정책·이벤트 조회/저장
- `supabase/migrations`: 데이터베이스 스키마와 정책 시드
- `public/`: Vercel 정적 파일

## 라이선스

현재 저장소는 Bridge Youth MVP 개발용 내부 프로젝트입니다.
