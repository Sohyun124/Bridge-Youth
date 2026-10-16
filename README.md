# Bridge Youth

**[서비스 바로가기](https://bridge-youth.onrender.com/)**

청년 교통비·자산형성 혜택을 비교하고 공식 신청 정보를 안내하는 웹 서비스입니다. **이용 분석 대시보드**에서 비교부터 상세 열람·저장·공식 링크 클릭까지의 이용 흐름과 콘텐츠 반응, 사용자 피드백을 확인할 수 있습니다.

## 기술 스택

- HTML, CSS, Vanilla JavaScript
- Node.js 20+ (HTTP 서버)
- Supabase REST API, PostgreSQL
- Render (Docker) / Vercel 배포 설정

## 구조

```text
public/               # HTML, CSS, 브라우저 JavaScript
server/               # API 서버, DB 접근, 서버 전용 인증
api/                  # Vercel 진입점
supabase/migrations/  # DB 스키마·시드
scripts/              # 운영·검증 스크립트
```

## 로컬 실행

1. Node.js 20 이상을 설치합니다.
2. 루트의 `.env.example`을 `.env`로 복사합니다. 기존 파일이 있으면 유지합니다.
3. 아래 연결 정보를 입력합니다.

```dotenv
SUPABASE_URL=https://<project-ref>.supabase.co
SUPABASE_SECRET_KEY=<server-secret-key>
```

새 Supabase 프로젝트를 사용한다면 `supabase/migrations/`의 SQL을 파일명 순서대로 적용해야 합니다. 키는 서버에서만 사용하며 `.env`는 Git에 포함하지 않습니다. 선택 환경변수는 [.env.example](.env.example)을 참고하세요.

```sh
npm start
```

접속: [http://localhost:4173](http://localhost:4173). 정책 조회에는 Supabase 연결이 필요합니다.

## 검증·배포

- `npm run check`: 구문·데이터 계약·서버 동작 검증
- `npm run check:source-urls`: 공식 출처 링크 확인
- `npm run check:deployment`: `BRIDGE_BASE_URL`로 지정한 배포 주소 검증

Render는 `Dockerfile`·`render.yaml`, Vercel은 `vercel.json`·`api/index.js`를 사용합니다. 배포 환경에도 Supabase 환경변수를 등록하고 `/api/health`에서 연결 상태를 확인합니다.
