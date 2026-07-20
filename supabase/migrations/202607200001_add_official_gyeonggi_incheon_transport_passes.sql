-- Officially reviewed regional K-pass benefit records for route-aware transport comparison.
-- Sources checked on 2026-07-20. These benefits require resident-registration eligibility;
-- they are shown for a matching travel region but are not estimated for visitors.

insert into public.policies (
  id, source_key, category, official_title, provider, region, source_url, application_url,
  source_published_at, source_checked_at, expires_at, application_period, status,
  eligibility, benefit, easy_summary, caution, required_documents, raw_source
) values
(
  'the-gyeonggi-pass-2026',
  'official:gyeonggi:the-gyeonggi-pass-2026',
  'transport',
  'The 경기패스',
  '경기도청',
  '경기',
  'https://www.gg.go.kr/bbs/boardView.do?bIdx=119939976&bsIdx=838&menuId=1534',
  'https://korea-pass.kr/join/join.do',
  '2025-12-26T00:00:00+09:00',
  '2026-07-20T00:00:00+09:00',
  null,
  '{"kind":"ongoing","startsAt":null,"endsAt":null,"label":"K-패스 카드 발급 후 K-패스 앱·홈페이지에서 상시 가입"}'::jsonb,
  'active',
  '{"minAge":19,"maxAge":39,"minMonthlyRides":15,"residence":"신청일 기준 주민등록상 경기도 거주자. 타 시·도 거주자는 K-패스 기본 혜택만 공식 확인 필요","income":"소득 조건 없음. 다자녀·저소득 등 추가 유형은 공식 확인 필요"}'::jsonb,
  '{"type":"best-of-refund-or-threshold","refundRate":0.30,"regularThreshold":55000,"plusThreshold":90000,"calculationType":"best_of_monthly_refund_or_threshold_excess","duplicateCondition":"K-패스와 별도 사업이 아니며 경기도 거주 확인 시 추가 혜택이 자동 적용됨. 타 지역 거주자는 The 경기패스 추가 혜택을 계산하지 않음"}'::jsonb,
  '경기도 주민등록 청년(만 19~39세)이 월 15회 이상 대중교통을 이용하면 30% 환급 방식과 기준금액 초과분 환급 방식 중 더 큰 금액이 자동 적용될 수 있어요.',
  '경기도 주민등록 거주자만 The 경기패스 추가 혜택 대상입니다. 서울·인천 등 다른 지역을 오간다는 사실만으로 대상이 되지 않으며, 카드 등록·주소지 검증과 이용 교통수단은 공식 안내를 확인해야 합니다.',
  '["K-패스 카드 발급", "K-패스 앱 또는 홈페이지 회원가입·카드 등록", "주민등록상 경기도 주소지 검증"]'::jsonb,
  '{"source":"official_gyeonggi_notice","checkedBy":"manual_web_verification","routeAware":"resident_only_regional_benefit"}'::jsonb
),
(
  'incheon-i-pass',
  'official:incheon:i-pass-faq',
  'transport',
  '인천 I-패스',
  '인천광역시 교통·도로',
  '인천',
  'https://www.incheon.go.kr/traffic/TR080301?curPage=1',
  'https://korea-pass.kr/join/join.do',
  '2024-04-29T00:00:00+09:00',
  '2026-07-20T00:00:00+09:00',
  null,
  '{"kind":"ongoing","startsAt":null,"endsAt":null,"label":"K-패스 카드 발급 후 K-패스 앱·홈페이지에서 상시 가입"}'::jsonb,
  'active',
  '{"minAge":19,"maxAge":39,"minMonthlyRides":15,"residence":"주민등록상 주소지가 인천광역시인 19세 이상 시민","income":"소득 조건 없음. 저소득층 추가 환급은 공식 확인 필요"}'::jsonb,
  '{"type":"regional-refund","refundRate":0.30,"calculationType":"monthly_transit_cost_refund_no_ride_cap","duplicateCondition":"K-패스와 별도 사업이 아니며 인천 거주 확인 시 추가 혜택이 자동 적용됨. 타 지역 거주자는 인천 I-패스 추가 혜택을 계산하지 않음"}'::jsonb,
  '인천 주민등록 청년(만 19~39세)이 월 15회 이상 대중교통을 이용하면 K-패스 청년 환급 기준을 바탕으로 횟수 상한 없이 환급받을 가능성이 있어요.',
  '인천 I-패스 추가 혜택은 주민등록상 인천시 거주자 대상입니다. 서울·경기에서 인천으로 이동한다는 사실만으로 대상이 되지 않으며, 카드 등록·주소지와 이용 교통수단은 공식 안내를 확인해야 합니다.',
  '["K-패스 카드 발급", "K-패스 앱 또는 홈페이지 회원가입·카드 등록", "주민등록상 인천광역시 주소지 검증"]'::jsonb,
  '{"source":"official_incheon_faq","checkedBy":"manual_web_verification","routeAware":"resident_only_regional_benefit"}'::jsonb
)
on conflict (source_key) do update set
  official_title = excluded.official_title,
  provider = excluded.provider,
  region = excluded.region,
  source_url = excluded.source_url,
  application_url = excluded.application_url,
  source_published_at = excluded.source_published_at,
  source_checked_at = excluded.source_checked_at,
  expires_at = excluded.expires_at,
  application_period = excluded.application_period,
  status = excluded.status,
  eligibility = excluded.eligibility,
  benefit = excluded.benefit,
  easy_summary = excluded.easy_summary,
  caution = excluded.caution,
  required_documents = excluded.required_documents,
  raw_source = excluded.raw_source,
  updated_at = now();
