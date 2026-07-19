# AGENTS - Bridge Youth Project Guide

## Project Identity

Bridge Youth is a youth benefit comparison and decision-support app.

The product helps young people compare similar living-support benefits, such as transportation, housing, and asset-building programs, and understand which option is likely to be more beneficial for their own situation.

The MVP focuses on transportation benefit comparison.

## Product Principle

This project is not a generic policy listing app.

Every feature should support at least one of these goals:

1. Help a young person compare benefits in the same category.
2. Show the expected benefit or savings using clear assumptions.
3. Explain why one option is likely to be more beneficial.
4. Link the user to the official source without implying guaranteed eligibility.
5. Collect anonymous journey data about where users stop before applying.

If a feature does not support these goals, keep it out of the MVP.

## MVP Scope

Build a lightweight transportation comparison flow first.

Included:

- Profile and transportation pattern input
- Transportation benefit sample data
- Expected monthly savings comparison
- Best option highlight
- Easy explanation and caution text
- Save/reminder screen
- Official link click tracking
- Feedback and anonymous event logs

Excluded from MVP:

- Real push notifications
- Full automatic crawling
- Production RAG index
- PDF/HWP/HWPX parsing
- Institution dashboard
- Application completion tracking
- Sensitive personal information verification

## Core Screens

| Screen | Purpose |
| --- | --- |
| Profile | Collect age, region, status, monthly transit cost, monthly ride count |
| Compare Result | Compare transportation benefits and highlight the best option |
| Benefit Detail | Show expected savings, reason, caution, official link, feedback |
| Saved / Reminder | Show saved benefits and deadline/reminder state |
| Logs | Show local anonymous journey events for the MVP demo |

## Data Rules

Start with static sample benefit data.

Each benefit should include:

- id
- title
- category
- provider
- region
- minAge
- maxAge
- calculationType
- deadline
- sourceUrl
- summary
- caution
- documents

Use "estimated benefit" language. Do not claim guaranteed savings or guaranteed eligibility.

## RAG Direction

RAG is part of the long-term app direction because Bridge Youth should not invent policies.

Use RAG to:

- Find real government/local-government benefit notices.
- Ground comparison results in official sources.
- Generate easy explanations from the retrieved notice.
- Keep source links and 기준일 visible.

For the 3-day MVP, use static sample data and clearly describe RAG as the production direction.

## Comparison Rules

MVP comparison logic should calculate expected monthly benefit using simple assumptions.

Use these criteria:

- Age match
- Region match or nationwide availability
- Monthly transit cost
- Monthly ride count
- Benefit calculation type
- Official caution/limitations

Display:

- Expected monthly benefit
- Recommendation rank
- Reason
- Caution
- Official link

## Safety Rules

Important safety language:

- Use "입력한 조건 기준 예상 이득" instead of "무조건 이득".
- Use "신청 가능성" instead of "신청 가능 확정".
- Always show the official source link when available.
- Add this notice in result/detail screens: "AI 설명은 참고용이며, 실제 신청 가능 여부와 혜택 금액은 공식 공고를 반드시 확인하세요."
- Do not invent policy details that are not in the source data.
- Mark uncertain details as "공식 기관 확인 필요".

## Journey Analytics

The MVP should prepare lightweight anonymous event logging without a backend.

Important events:

| Event | Meaning |
| --- | --- |
| compare_submit | User submitted comparison inputs |
| comparison_result_view | A benefit appeared in comparison results |
| benefit_card_click | User opened a benefit card |
| benefit_detail_view | User opened benefit detail |
| simple_explanation_view | User viewed easy explanation |
| documents_view | User checked preparation items |
| benefit_save | User saved a benefit |
| reminder_view | User viewed reminder state |
| apply_link_click | User clicked official application/source link |
| confusion_click | User clicked "I don't understand" |
| feedback_submit | User submitted feedback |

Use these analytics to answer:

- Which comparison result attracted attention?
- How long did it take from recommendation to official link click?
- Which benefit was saved?
- Which conditions caused confusion?
- Where did the user stop before applying?

## Implementation Order

1. Update profile input for transportation comparison.
2. Create sample transportation benefit data.
3. Implement expected savings calculation.
4. Build comparison result cards.
5. Build benefit detail screen.
6. Add easy explanation and caution notice.
7. Add save/reminder behavior.
8. Add event logging.
9. Test the demo scenario.

## Demo Scenario

Primary demo user:

- 22 years old
- Lives in Seoul
- Student or early youth user
- Monthly transportation cost: 75,000 KRW
- Monthly rides: 52

Expected flow:

1. User enters profile and transportation pattern.
2. App compares K-패스, 기후동행카드, and 지역 청년 교통비 지원.
3. App highlights the option with the highest estimated benefit.
4. User opens detail and reads the easy explanation.
5. User checks caution and official link.
6. User saves the benefit.
7. User submits feedback about unclear conditions.
8. App records anonymous journey logs.

## Quality Checklist

Before considering the MVP done, check:

- Profile input works.
- Transportation comparison results display.
- Expected benefit amount is visible.
- Best option is highlighted.
- Detail screen includes caution and official confirmation notice.
- Official link click is tracked.
- Saved benefits persist.
- Feedback can be submitted.
- Logs show comparison and apply events.
- Mobile layout does not break.
- No text claims guaranteed eligibility or guaranteed savings.
