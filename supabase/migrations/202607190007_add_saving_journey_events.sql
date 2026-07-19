-- Keep the production event constraint aligned with server.js after adding the asset-building flow.
alter table public.journey_events
  drop constraint if exists journey_events_event_type_check;

alter table public.journey_events
  add constraint journey_events_event_type_check check (event_type in (
    'category_select',
    'transport_form_view',
    'transport_form_exit',
    'saving_form_view',
    'saving_form_exit',
    'profile_save',
    'compare_submit',
    'comparison_results_viewed',
    'comparison_result_view',
    'category_results_viewed',
    'category_official_link_click',
    'benefit_card_click',
    'benefit_detail_view',
    'simple_explanation_view',
    'documents_view',
    'detail_section_dwell',
    'detail_scroll_depth',
    'detail_back_click',
    'detail_exit',
    'benefit_save',
    'reminder_view',
    'apply_link_click',
    'confusion_click',
    'feedback_submit',
    'interest_summary_request'
  ));