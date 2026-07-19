-- Officially verified historical saving products. These rows remain expired so the app
-- can disclose their current enrollment state without recommending or estimating them.
-- Sources checked on 2026-07-19.

insert into public.policies (
  id, source_key, category, official_title, provider, region, source_url, application_url,
  source_published_at, source_checked_at, expires_at, application_period, status,
  eligibility, benefit, easy_summary, caution, required_documents, raw_source
) values (
  'youth-tomorrow-savings-account-2026',
  'official:hope:youth-tomorrow-savings-account-2026',
  'saving',
  '청년내일저축계좌',
  '보건복지부 / 한국자활복지개발원',
  '전국',
  'https://hope.welfareinfo.or.kr/ntcn/B000000070/ntcnDetail.do?nttNo=13191',
  'https://www.bokjiro.go.kr/ssis-tbu/',
  '2026-04-20T00:00:00+09:00',
  '2026-07-19T00:00:00+09:00',
  '2026-05-20T23:59:59+09:00',
  '{"kind":"closed","startsAt":"2026-05-04T00:00:00+09:00","endsAt":"2026-05-20T23:59:59+09:00","label":"2026년 신규 모집 접수 종료 (5월 4일~20일)"}'::jsonb,
  'expired',
  '{"minAge":15,"maxAge":39,"income":"가구소득·연령·근로 기준에 따라 구분되며, 2026년부터 차상위초과 신규 모집은 없음","householdIncome":"기준 중위소득 50% 이하 등 가구소득 기준을 공식 심사에서 확인 필요","employment":"근로·사업소득 유지 및 추가 교육·자금사용계획서 조건을 공식 확인 필요"}'::jsonb,
  '{"type":"matched_savings","monthlyLimit":500000,"termMonths":36,"fixedMonthlyGovernmentContribution":300000,"calculationType":"fixed_monthly_government_contribution_only_excluding_interest","duplicateCondition":"국가·지자체 자산형성 지원사업 중복 참여 여부는 신청 시 공식 심사에서 확인 필요"}'::jsonb,
  '근로하는 저소득 청년이 본인 저축을 유지하면 정부지원금이 함께 적립되는 3년 만기 자산형성 통장입니다. 2026년 신규 모집은 종료되어 현재는 새 신청을 추천하지 않습니다.',
  '정부지원금 전액 수령에는 3년간 근로활동·저축 유지, 교육 이수, 자금사용계획서 제출 등이 필요합니다. 중도해지·미납·근로중단 시 지급액이 달라질 수 있으므로 공식 안내를 확인하세요.',
  '["신분증", "근로·사업소득 및 가구소득 확인 서류", "자금사용계획서", "자립역량교육 이수 확인"]'::jsonb,
  '{"source":"hope_official_notice","checkedBy":"manual_official_review","statusReason":"2026_new_applications_closed"}'::jsonb
),
(
  'youth-leap-account-closed-2025',
  'official:kinfa:youth-leap-account-closed-2025',
  'saving',
  '청년도약계좌',
  '서민금융진흥원',
  '전국',
  'https://www.kinfa.or.kr/financialProduct/youthLeapAccount.do',
  'https://ylaccount.kinfa.or.kr/',
  '2025-12-31T00:00:00+09:00',
  '2026-07-19T00:00:00+09:00',
  '2025-12-31T23:59:59+09:00',
  '{"kind":"closed","startsAt":null,"endsAt":"2025-12-31T23:59:59+09:00","label":"신규 가입 운영 종료 (2025년 12월 31일)"}'::jsonb,
  'expired',
  '{"minAge":19,"maxAge":34,"income":"개인소득·가구소득·금융소득 요건이 있었으며 현재 신규 가입은 중단","householdIncome":"가구원 수 기준 중위소득 250% 이하 요건은 과거 가입 기준","employment":"별도 고용형태 요건 없음"}'::jsonb,
  '{"type":"matched_savings","monthlyLimit":700000,"termMonths":60,"maxMonthlyGovernmentContribution":33000,"calculationType":"closed_product_no_current_estimate","duplicateCondition":"운영 종료 상품으로 신규 가입·중복 여부를 현재 비교하지 않음"}'::jsonb,
  '청년도약계좌는 청년의 중장기 자산형성을 위해 운영됐던 정책형 금융상품입니다. 공식 안내에 따라 신규 가입은 2025년 12월 31일까지 운영됐고 현재는 종료 상태입니다.',
  '현재 신규 가입을 추천하거나 예상 혜택을 계산하지 않습니다. 기존 가입자의 유지·해지·갈아타기 관련 사항은 공식 사이트와 취급기관 안내에서 확인하세요.',
  '["기존 가입자라면 취급기관 안내", "공식 상품 안내", "갈아타기·특별중도해지 해당 여부 공식 확인"]'::jsonb,
  '{"source":"kinfa_official","checkedBy":"manual_official_review","statusReason":"new_enrollment_ended_2025_12_31"}'::jsonb
)
on conflict (source_key) do update set
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