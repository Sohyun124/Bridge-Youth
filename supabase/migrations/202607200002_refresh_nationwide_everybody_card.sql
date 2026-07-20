-- 2026-07-20 official transport refresh.
-- Policy rows remain visible when a current official operation check exists, even if a
-- regional FAQ page itself was last updated earlier. Both dates are retained for users.

update public.policies
set
  official_title = '모두의 카드(K-패스)',
  provider = '국토교통부 / K-패스 공식 누리집',
  region = '전국',
  source_url = 'https://www.molit.go.kr/USR/NEWS/dtl.jsp?id=95091662&lcmspage=2',
  application_url = 'https://korea-pass.kr/join/join.do',
  source_published_at = '2026-02-03T00:00:00+09:00',
  source_checked_at = '2026-07-20T00:00:00+09:00',
  application_period = '{"kind":"ongoing","startsAt":null,"endsAt":null,"label":"K-패스 카드 발급 후 K-패스 누리집에서 상시 가입"}'::jsonb,
  eligibility = '{"minAge":19,"maxAge":34,"minMonthlyRides":15,"income":"청년 기준은 만 19~34세입니다. 다자녀·저소득층 등 다른 유형은 공식 확인이 필요합니다.","residence":"전국 229개 참여 지자체 주민등록 기준입니다."}'::jsonb,
  benefit = '{"type":"all-pass","refundRate":0.30,"capitalRegularThreshold":55000,"capitalPlusThreshold":90000,"localRegularThreshold":50000,"localPlusThreshold":85000,"calculationType":"automatic_best_of_k_pass_refund_or_monthly_cap","programFamily":"k-pass-family","duplicateCondition":"기본 환급과 정액 기준 초과분 중 더 유리한 한 가지 방식이 자동 적용됩니다. K-패스 계열 지역 추가 혜택과 별도로 중복 적립되는 제도는 아닙니다."}'::jsonb,
  easy_summary = '전국 229개 지자체에서 이용하는 K-패스 기반 제도입니다. 월 15회 이상 이용한 청년은 기본 30% 환급과 월 기준금액 초과분 환급 중 더 유리한 방식이 자동 적용될 수 있습니다.',
  caution = '일반형은 1회 3천 원 미만 대중교통 기준, 플러스형은 3천 원 이상 교통수단 이용분까지 포함하는 방식으로 안내됩니다. KTX·SRT·항공·선박은 비교 대상이 아니며 주민등록지, 카드 등록, 실제 이용내역은 공식 안내를 확인해야 합니다.',
  required_documents = '["K-패스 카드 발급", "K-패스 또는 카드사 앱 회원가입·카드 등록", "주민등록상 참여 지자체 주소지 확인"]'::jsonb,
  raw_source = '{"source":"official_molit_everybody_card","checkedBy":"manual_web_verification","currentOperationVerifiedAt":"2026-02-03T00:00:00+09:00","verificationNote":"국토교통부는 2026년 2월 4일부터 전국 229개 지자체에서 모두의 카드(K-패스) 이용이 가능하다고 안내했습니다."}'::jsonb,
  updated_at = now()
where id = 'k-pass';

update public.policies
set
  benefit = jsonb_set(benefit, '{ddareungiAddOn}', '0'::jsonb, true),
  easy_summary = '만 19~39세 청년이 서울 안에서 지하철·서울 면허 버스를 자주 이용하면 청년 30일권 5만 5천 원과 입력한 월 교통비를 비교해 예상 절감액을 볼 수 있습니다. 따릉이 이용 여부는 이 비교에서 묻지 않습니다.',
  caution = '신분당선, GTX, 광역·공항버스, 서울 외 면허 버스는 이용 범위에서 제외됩니다. 서울 밖으로 이동하거나 위 교통수단을 자주 이용하면 모두의 카드(K-패스)도 함께 비교하세요.',
  source_checked_at = '2026-07-20T00:00:00+09:00',
  updated_at = now()
where id = 'climate-card';

update public.policies
set
  benefit = benefit || '{"programFamily":"k-pass-family"}'::jsonb,
  raw_source = '{"source":"official_gyeonggi_notice","checkedBy":"manual_web_verification","currentOperationVerifiedAt":"2026-02-03T00:00:00+09:00","verificationNote":"모두의 카드는 전국 229개 지자체에서 운영되며, 경기도 거주 청년은 The 경기패스의 연령 확대와 횟수 상한 없는 지역 혜택을 공식 안내에서 확인해야 합니다.","routeAware":"resident_only_regional_benefit"}'::jsonb,
  source_checked_at = '2026-07-20T00:00:00+09:00',
  updated_at = now()
where id = 'the-gyeonggi-pass-2026';

update public.policies
set
  official_title = '인천 I-패스(모두의 카드 자동 적용)',
  source_checked_at = '2026-07-20T00:00:00+09:00',
  benefit = '{"type":"best-of-refund-or-threshold","refundRate":0.30,"regularThreshold":55000,"plusThreshold":90000,"calculationType":"automatic_best_of_k_pass_refund_or_threshold_excess","programFamily":"k-pass-family","duplicateCondition":"인천 I-패스는 K-패스 계열의 인천 거주자 추가 혜택입니다. 별도 카드로 두 번 적립되는 제도가 아니며, 인천 거주 확인 뒤 적용 여부를 공식 안내에서 확인해야 합니다."}'::jsonb,
  easy_summary = '인천 주민등록 청년(만 19~39세)은 K-패스 계열을 이용할 때 인천 I-패스의 지역 추가 혜택을 확인할 수 있습니다. 2026년에는 모두의 카드 방식이 전국 운영되어 기본 환급과 기준금액 초과분 중 유리한 방식이 자동 적용될 수 있습니다.',
  caution = '인천 I-패스 FAQ 원문은 2024년 안내이므로 인천의 청년 연령 확대·이용 횟수 상한 없는 추가 혜택은 가입 전 다시 확인해야 합니다. 다만 모두의 카드 전국 운영은 2026년 국토교통부 공식 자료로 재확인했습니다. KTX·SRT·항공·선박은 비교 대상이 아닙니다.',
  raw_source = '{"source":"official_incheon_i_pass_faq","checkedBy":"manual_web_verification","originalSourceUpdatedAt":"2024-09-20T00:00:00+09:00","currentOperationVerifiedAt":"2026-02-03T00:00:00+09:00","verificationNote":"인천 I-패스의 지역 FAQ 원문 갱신일은 2024년이며, 2026년 전국 모두의 카드(K-패스) 운영은 국토교통부 공식 자료로 별도 재확인했습니다.","routeAware":"resident_only_regional_benefit"}'::jsonb,
  updated_at = now()
where id = 'incheon-i-pass';
