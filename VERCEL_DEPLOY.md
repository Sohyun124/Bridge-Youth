# Vercel 배포 안내

이 프로젝트는 `api/index.js` Vercel Function이 Node 서버를 실행하고, `vercel.json`이 모든 요청을 이 함수로 전달하도록 구성되어 있습니다.

## Vercel 환경 변수

Vercel Project Settings → Environment Variables에 다음 값을 Production과 Preview에 설정합니다.

| 변수 | 필요 여부 | 설명 |
| --- | --- | --- |
| `SUPABASE_URL` | 필수 | Supabase 프로젝트 URL |
| `SUPABASE_SECRET_KEY` | 필수 | 서버 전용 Supabase secret key. 브라우저 코드나 `VITE_`/`NEXT_PUBLIC_` 변수에 넣지 않습니다. |
| `APP_BASE_URL` | 필수 | 실제 배포 주소. 예: `https://bridge-youth.vercel.app` |
| `TRUST_PROXY` | 필수 | `true` |
| `OPENAI_API_KEY` | 선택 | 관계자용 관심 분야 요약을 사용할 때만 설정 |
| `OPENAI_MODEL` | 선택 | 미설정 시 서버 기본값 사용 |

배포 후 Vercel에서 할당한 실제 주소로 `APP_BASE_URL`을 바꾸고 재배포합니다.

## Supabase 인증 설정

1. Authentication → URL Configuration에서 Site URL을 실제 Vercel 주소로 설정합니다.
2. Redirect URLs에 `http://localhost:4173`와 실제 Vercel 주소를 각각 추가합니다.
3. Email provider에서 Confirm email을 켭니다.
4. Google provider를 켜고 Google Cloud에서 만든 Client ID와 Client Secret을 입력합니다.
5. Google Cloud OAuth client의 Authorized JavaScript origins에는 로컬 주소와 실제 Vercel 도메인을, Authorized redirect URI에는 Supabase Google provider 화면에 표시된 callback URL을 등록합니다.

## 역할 기반 분석 화면

`thgus6688@gmail.com`은 실행한 Supabase 마이그레이션에서 `staff`로 등록됩니다. 이 이메일로 인증 후 로그인한 사용자만 분석 메뉴와 `/api/admin/dashboard`, `/api/interest-summary`에 접근할 수 있습니다.