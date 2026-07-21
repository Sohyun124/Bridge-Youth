# Bridge Youth

청년이 자신의 조건에 맞는 정부·지자체 혜택을 비교하고, 예상 이득과 공식 신청 정보를 확인할 수 있도록 돕는 의사결정 지원 서비스입니다.

현재 버전은 로그인 없이 사용할 수 있는 비교 MVP입니다. 교통비 비교를 중심으로 주거·교육·자산형성 정책을 확장할 수 있는 구조를 포함합니다.

## 주요 기능

- 나이, 지역, 청년 상태, 교통 이용 조건 입력
- 교통·주거·교육·자산형성 정책 비교
- 입력 조건 기준 예상 이득과 추천 이유 표시
- 공식 출처, 기준일, 갱신일, 접수 기간 표시
- 정책 상세 설명, 주의사항, 준비 서류 안내
- 혜택 저장 및 알림 상태 확인
- 공식 링크 클릭과 비교 여정의 익명 이벤트 기록
- 검토가 완료된 공식 정책만 결과에 표시

> 화면의 금액과 자격은 입력 조건을 바탕으로 한 예상치입니다. 실제 신청 가능 여부와 혜택은 반드시 공식 공고를 확인해야 합니다.

## 기술 스택

- Node.js 20+
- Node.js HTTP server
- Vanilla JavaScript, HTML, CSS
- Supabase REST API 및 PostgreSQL
- Vercel Serverless Function 또는 Docker 기반 Render 배포

## 프로젝트 구조

```text
.
├─ app.js                 # 브라우저 UI와 비교 로직
├─ index.html             # 애플리케이션 화면
├─ styles.css             # 화면 스타일
├─ server.js              # 정적 파일·API 서버 및 서버리스 핸들러
├─ api/index.js           # Vercel 진입점
├─ database.js            # 정책·이벤트 데이터 접근
├─ supabase/              # 데이터베이스 마이그레이션
├─ scripts/               # 검증·동기화·운영 스크립트
├─ Dockerfile             # Render용 컨테이너 설정
└─ vercel.json            # Vercel 라우팅 설정
```

## 로컬 실행

필요 조건: Node.js 20 이상

```bash
npm install
cp .env.example .env
npm start
```

Windows PowerShell에서는 다음처럼 실행할 수 있습니다.

```powershell
npm install
Copy-Item .env.example .env
npm start
```

브라우저에서 `http://localhost:4173`을 엽니다.

## 환경변수

`.env.example`을 참고하세요. 서버 전용 비밀값은 브라우저 코드나 GitHub에 포함하지 않습니다.

필수 운영 변수:

- `SUPABASE_URL`
- `SUPABASE_SECRET_KEY`

선택 변수:

- `OPENAI_API_KEY`, `OPENAI_MODEL`
- `YOUTH_POLICY_API_KEY`
- `ADMIN_MAINTENANCE_TOKEN`
- `EVENT_RETENTION_DAYS`
- `POLICY_STALE_DAYS`
- `BRIDGE_BASE_URL`

## 검증 명령

```bash
npm run check
npm run smoke:server
npm run check:source-urls
```

배포된 주소를 확인하려면:

```bash
BRIDGE_BASE_URL=https://your-domain.example npm run check:deployment
```

## 배포

### Vercel

GitHub `main` 브랜치에 푸시하면 Vercel이 자동 배포하도록 구성할 수 있습니다. `vercel.json`은 모든 요청을 `api/index.js` 서버리스 핸들러로 전달하고, 서버가 정적 파일과 API를 함께 처리합니다.

### Render

`render.yaml`과 `Dockerfile`을 사용합니다. Render 환경변수에 Supabase 서버 키를 등록하고 `/api/health`가 정상 응답하는지 확인합니다.

## 데이터·안전 원칙

- 정책 결과는 공식 출처 URL과 기준일이 확인된 데이터만 사용합니다.
- 확정적인 자격·금액 대신 “입력 조건 기준 예상 이득”과 “신청 가능성” 표현을 사용합니다.
- 공식 확인이 필요한 정보는 결과에서 명시적으로 표시합니다.
- 이벤트 로그에는 익명 여정 데이터만 기록하며 민감한 개인정보를 수집하지 않습니다.
- 실제 신청은 항상 공식 기관의 공고와 신청 페이지에서 진행합니다.

## 현재 범위

포함:

- 정책 비교와 예상 이득 계산
- 공식 출처 기반 상세 안내
- 저장·알림 상태 화면
- 익명 이벤트 로그

향후 방향:

- 공식 공고 기반 RAG 검색·요약
- 더 많은 지역·정책 카테고리
- 실제 알림 및 신청 여정 연계

## 라이선스

현재 내부 MVP 프로젝트입니다.
