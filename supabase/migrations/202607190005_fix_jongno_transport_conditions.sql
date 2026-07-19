-- Correct a transport-policy calculation and residence condition using the reviewed official notice.
-- The official benefit is up to KRW 60,000 per quarter; KRW 20,000 is only the disclosed three-month comparison average.
update public.policies
set
  eligibility = coalesce(eligibility, '{}'::jsonb) || '{"requiredDistrict":"종로구"}'::jsonb,
  benefit = (coalesce(benefit, '{}'::jsonb) - 'maxMonthlyBenefit') ||
    '{"quarterlyCap":60000,"benefitPeriodMonths":3,"maxMonthlyBenefit":20000,"calculationType":"quarterly_bus_refund_cap_normalized_monthly"}'::jsonb,
  easy_summary = '종로구 거주 청년이 서울 시내·마을버스를 이용하면 분기 최대 6만 원 한도로 정산 지원 가능성이 있어요. 비교 화면의 월 최대 2만 원은 이 분기 한도를 3개월로 나눈 참고값입니다.',
  caution = '신청일 기준 종로구 주민등록, 서울 내 승하차, 카드 태그, 중복 수혜 제한을 반드시 확인해야 합니다. 종로구 외 거주자는 추천하지 않습니다.',
  updated_at = now()
where id = 'jongno-bus-support';
