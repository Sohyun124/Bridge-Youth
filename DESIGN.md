# Bridge Youth Design Guide

## Design Intent

Bridge Youth uses a Notion-inspired, information-first visual language: calm work surfaces, restrained dividers, and clear document hierarchy. It is not a product marketing site. The interface must remain practical for comparing public benefits, reading conditions, and taking repeated actions.

## Non-Negotiable Principles

- One screen should ask for one decision at a time.
- Show only the minimum fields needed for a comparison; reveal extra fields conditionally.
- Policy cards must prioritize expected benefit or "official confirmation needed", then reason, caution, source, and date.
- Never make eligibility or savings sound guaranteed.
- Use easy Korean. Explain administrative terms beside the decision, not in a separate help page.
- Mobile and accessibility are product requirements, not polish work.

## Tokens

| Token | Value | Use |
| --- | --- | --- |
| Action Blue | `#0066cc` | Every primary interactive element on light surfaces |
| Focus Blue | `#0071e3` | Keyboard focus indicator |
| Dark Surface | `#272729` | High-attention result or insight band |
| Ink | `#1d1d1f` | Main text |
| Canvas | `#ffffff` | Primary page surface |
| Parchment | `#f5f5f7` | Alternating section surface |
| Hairline | `#e0e0e0` | Borders and dividers |
| Muted Text | `#7a7a7a` | Secondary information |

## Typography

- Font stack: `system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`.
- Display: 34–40px, weight 600, line-height 1.1.
- Section heading: 24–28px, weight 600, line-height 1.2.
- Body: 17px, weight 400, line-height 1.5.
- Caption: 14px, weight 400, line-height 1.45.
- Use `letter-spacing: 0`; do not use negative letter-spacing.
- Do not use font weight 500. Use 400 for body and 600 for emphasis.

## Layout

- Top navigation is compact and visually quiet. On mobile, it must wrap or collapse without clipping.
- Use full-width light or parchment page bands rather than stacks of floating cards.
- Max reading width: 980px. Dashboard and comparison grids may use up to 1200px.
- Structural spacing: 8, 12, 16, 24, 32, 48, 80px.
- Desktop grids become a single column at 700px or earlier when text would become cramped.

## Components

### Buttons

- Primary action: Action Blue, white text, 8px radius, minimum 44px height.
- Secondary action: white background, Action Blue text, 1px Action Blue border, 8px radius.
- Use icon buttons for familiar compact actions such as back, close, or settings. Provide a tooltip or accessible label.
- Text buttons are reserved for clear commands such as "혜택 비교하기" and "공식 안내 보기".
- Pressed state: `transform: scale(0.98)`. Focus: 2px Focus Blue outline.

### Cards

- Use cards only for policy results, repeated dashboard metrics, confirmation panels, and modals.
- Maximum card radius: 8px.
- Use a 1px hairline border. Do not use drop shadows on cards, buttons, or text.
- The top-ranked result may use a pale blue or parchment surface and a clear label, not a decorative effect.

### Status and Safety

- `추천`: Action Blue text or border.
- `공식 확인 필요`: neutral parchment surface and clear explanatory copy.
- `마감·오류`: restrained red text with an icon; never use red as decoration.
- Every policy result shows official source, checked date, and official link.

### Forms

- Inputs have a 1px hairline border, 8px radius, 44px minimum height, and visible label above the control.
- Disabled controls use muted surface and retain a short explanation nearby.
- Within one form grid, peer fields use equal column spans and a shared control height. Helper copy uses reserved space below its control; a longer label must not enlarge only that control.
- Error copy appears directly below the field in plain Korean.
- The unauthenticated default screen is the account flow. Start with sign-up, offer Google and email choices at equal visual weight, then show the email-login form only after sign-up submission or when the user explicitly selects it.
- Authentication forms validate each field before submission and show the error directly below that field. Do not put password rules or verification status only in a general toast.
- Do not show comparison navigation, saved benefits, or stakeholder analytics to an unauthenticated user. After a successful login, enter the comparison home. Stakeholder-only analytics must remain unavailable both in the UI and through its API.

## Responsive Rules

| Width | Behavior |
| --- | --- |
| `<= 640px` | Single-column forms, cards, and dashboard panels; 34px max display heading |
| `641–1024px` | Two-column comparison or dashboard grids only when each column remains readable |
| `> 1024px` | Wide comparison and dashboard grids; content remains constrained |

- All interactive targets are at least 44 × 44px.
- No text may overflow, overlap, or rely on hover to be understood.

## Do Not Use

- Decorative gradients, glowing orbs, bokeh, or marketing-style hero cards.
- Apple product photography or Apple branding assets.
- Dense dashboard chrome, excessive pills, or nested cards.
- More than one accent color for ordinary interactive elements.
- Claims such as "무조건 가능", "확정", or "가장 이득" without the qualifier "입력한 조건 기준 예상".

## Current Visual Direction (2026-07-19)

Bridge Youth uses a Notion-inspired, information-first interface. This replaces the previous Apple-direction override.

- Use a warm off-white workspace, restrained 1px dividers, compact 8px corners, and no decorative gradients or shadows.
- Keep one Action Blue (#0066cc) for primary actions and links. Use neutral ink, gray, and parchment for hierarchy; do not introduce a second accent color.
- Use a compact white navigation bar with a hairline bottom border. Keep the product name on the left and plain-text navigation on the right; collapse to an accessible menu or wrapped rows on small screens.
- The home screen presents 교통비 비교 and 자산형성 비교 as equal primary service panels in a two-column layout on desktop and one column on small screens.
- Comparison screens prioritize a readable summary table: policy/product, input-condition estimated benefit, key conditions, recommendation reason, and official source. Cards are only for the selected recommendation, cautions, and secondary actions.
- Use system UI typography with 17px body text, 24–28px section headings, and 34–40px page headings. Do not use negative letter spacing or product-marketing headline treatments.
- Preserve all safety language, official-source metadata, minimum 44px targets, and mobile accessibility. Long Korean, numeric values, URLs, table cells, and button labels must wrap without overflow or overlap.
- Wrap UI copy at word boundaries only. Use word-break: keep-all; do not force character-by-character wrapping.
