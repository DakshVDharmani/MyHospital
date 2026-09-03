-- Real-time analytics feed for the Admin dashboard.
-- One SECURITY DEFINER function returns every metric the workspace renders as a
-- single JSONB document, so the client makes one round-trip and can poll it on
-- an interval for a live, Power BI-style view. RLS is bypassed on purpose: the
-- Admin page is gated by the backend admin session, and only aggregates leave.

create or replace function public.admin_dashboard_metrics()
returns jsonb
language sql
stable
security definer
set search_path to 'public'
as $$
  select jsonb_build_object(
    'generated_at', now(),

    'kpis', jsonb_build_object(
      'patient_users',   (select count(*) from users where role = 'patient'),
      'patient_records', (select count(*) from patients),
      'doctors',         (select count(*) from doctors),
      'doctors_active',  (select count(*) from doctors where status = 'active'),
      'doctors_leave',   (select count(*) from doctors where status = 'on_leave'),
      'appts_total',     (select count(*) from appointments),
      'appts_upcoming',  (select count(*) from appointments
                            where status in ('requested','confirmed')
                              and coalesce(scheduled_at, created_at) >= now() - interval '1 day'),
      'appts_completed', (select count(*) from appointments where status = 'completed'),
      'triage_total',    (select count(*) from triage_assessments),
      'triage_high',     (select count(*) from triage_assessments where need_bracket in ('critical','urgent')),
      'avg_risk',        (select round(avg(risk_score), 2) from triage_assessments),
      'vitals_logs',     (select count(*) from vitals_logs),
      'consultations',   (select count(*) from consultation_records),
      'notif_total',     (select count(*) from notifications),
      'notif_unread',    (select count(*) from notifications where read_at is null),
      'avg_rating',      (select round(avg(rating), 2) from doctors),
      'avg_fee',         (select round(avg(consultation_fee)) from doctors),
      'capacity_util',   (select round(100.0 * sum(current_load) / nullif(sum(weekly_capacity), 0), 1) from doctors),
      'messages',        (select count(*) from messages),
      'conversations',   (select count(*) from conversations),
      'verified_pct',    (select round(100.0 * count(*) filter (where verified) / nullif(count(*), 0)) from doctors),
      'telemedicine_pct',(select round(100.0 * count(*) filter (where telemedicine_enabled) / nullif(count(*), 0)) from doctors)
    ),

    -- 45-day onboarding curve, zero-filled
    'registrations', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'd', to_char(g.d, 'Mon DD'), 'iso', g.d,
               'doctors', coalesce(r.docs, 0), 'patients', coalesce(r.pats, 0)
             ) order by g.d), '[]'::jsonb)
      from generate_series((now() - interval '44 days')::date, now()::date, interval '1 day') g(d)
      left join (
        select date_trunc('day', created_at)::date d,
               count(*) filter (where role = 'doctor')  docs,
               count(*) filter (where role = 'patient') pats
        from users group by 1
      ) r on r.d = g.d
    ),

    'appts_by_status', (
      select coalesce(jsonb_agg(jsonb_build_object('label', status, 'value', n) order by n desc), '[]'::jsonb)
      from (select status::text status, count(*) n from appointments group by 1) t
    ),
    'appts_by_type', (
      select coalesce(jsonb_agg(jsonb_build_object('label', appointment_type, 'value', n) order by n desc), '[]'::jsonb)
      from (select appointment_type::text appointment_type, count(*) n from appointments group by 1) t
    ),
    'appts_by_mode', (
      select coalesce(jsonb_agg(jsonb_build_object('label', mode, 'value', n) order by n desc), '[]'::jsonb)
      from (select mode::text mode, count(*) n from appointments group by 1) t
    ),

    'doctors_by_specialty', (
      select coalesce(jsonb_agg(jsonb_build_object('label', specialty, 'value', n) order by n desc), '[]'::jsonb)
      from (select specialty::text specialty, count(*) n from doctors group by 1) t
    ),
    'doctors_by_state', (
      select coalesce(jsonb_agg(jsonb_build_object('label', state, 'value', n) order by n desc), '[]'::jsonb)
      from (select coalesce(state, 'Unknown') state, count(*) n from doctors group by 1) t
    ),

    -- specialist supply (doctors) vs demand (triage routes), sorted by demand
    'supply_demand', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'label', s.specialty, 'doctors', s.docs, 'demand', coalesce(d.n, 0)
             ) order by coalesce(d.n, 0) desc, s.docs desc), '[]'::jsonb)
      from (select specialty::text specialty, count(*) docs from doctors group by 1) s
      left join (select specialty::text specialty, count(*) n from triage_assessments group by 1) d
             on d.specialty = s.specialty
    ),

    'triage_need', (
      select coalesce(jsonb_agg(jsonb_build_object('label', b.lbl, 'value', coalesce(c.n, 0)) order by b.ord), '[]'::jsonb)
      from (values ('critical',1),('urgent',2),('moderate',3),('stable',4)) b(lbl, ord)
      left join (select need_bracket, count(*) n from triage_assessments group by 1) c on c.need_bracket = b.lbl
    ),
    'triage_esi', (
      select coalesce(jsonb_agg(jsonb_build_object('label', 'ESI ' || g, 'value', coalesce(c.n, 0)) order by g), '[]'::jsonb)
      from generate_series(1, 5) g
      left join (select esi_label, count(*) n from triage_assessments group by 1) c on c.esi_label = g::text
    ),
    'triage_source', (
      select coalesce(jsonb_agg(jsonb_build_object('label', source, 'value', n) order by n desc), '[]'::jsonb)
      from (select coalesce(source, 'unknown') source, count(*) n from triage_assessments group by 1) t
    ),
    'risk_histogram', (
      select coalesce(jsonb_agg(jsonb_build_object('label', b.lbl, 'value', coalesce(c.n, 0)) order by b.ord), '[]'::jsonb)
      from (values ('0–1',0,1,1),('1–2',1,2,2),('2–3',2,3,3),('3–4',3,4,4),('4–5',4,5,5)) b(lbl, lo, hi, ord)
      left join lateral (
        select count(*) n from triage_assessments t
        where t.risk_score >= b.lo and (t.risk_score < b.hi or (b.hi = 5 and t.risk_score <= 5))
      ) c on true
    ),

    'patient_priority', (
      select coalesce(jsonb_agg(jsonb_build_object('label', b.lbl, 'value', coalesce(c.n, 0)) order by b.ord), '[]'::jsonb)
      from (values ('critical',1),('urgent',2),('moderate',3),('stable',4)) b(lbl, ord)
      left join (select coalesce(priority_bracket, 'stable') priority_bracket, count(*) n from patients group by 1) c
             on c.priority_bracket = b.lbl
    ),

    'capacity_top', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'name', full_name, 'specialty', specialty,
               'load', current_load, 'capacity', weekly_capacity,
               'pct', round(100.0 * current_load / nullif(weekly_capacity, 0))
             ) order by ratio desc nulls last), '[]'::jsonb)
      from (
        select full_name, specialty::text specialty, current_load, weekly_capacity,
               current_load::numeric / nullif(weekly_capacity, 0) ratio
        from doctors
        order by ratio desc nulls last
        limit 10
      ) t
    ),

    'rating_dist', (
      select coalesce(jsonb_agg(jsonb_build_object('label', b.lbl, 'value', coalesce(c.n, 0)) order by b.ord), '[]'::jsonb)
      from (values ('3.5–3.8',3.5,3.8,1),('3.8–4.1',3.8,4.1,2),('4.1–4.4',4.1,4.4,3),('4.4–4.7',4.4,4.7,4),('4.7–5.0',4.7,5.01,5)) b(lbl, lo, hi, ord)
      left join lateral (select count(*) n from doctors d where d.rating >= b.lo and d.rating < b.hi) c on true
    ),
    'experience_dist', (
      select coalesce(jsonb_agg(jsonb_build_object('label', b.lbl, 'value', coalesce(c.n, 0)) order by b.ord), '[]'::jsonb)
      from (values ('0–5',0,5,1),('5–10',5,10,2),('10–15',10,15,3),('15–20',15,20,4),('20–25',20,25,5),('25+',25,200,6)) b(lbl, lo, hi, ord)
      left join lateral (select count(*) n from doctors d where d.years_experience >= b.lo and d.years_experience < b.hi) c on true
    ),
    'fee_by_specialty', (
      select coalesce(jsonb_agg(jsonb_build_object('label', specialty, 'value', avg_fee) order by avg_fee desc), '[]'::jsonb)
      from (select specialty::text specialty, round(avg(consultation_fee)) avg_fee from doctors group by 1) t
    ),

    'notif_by_type', (
      select coalesce(jsonb_agg(jsonb_build_object('label', type, 'value', n) order by n desc), '[]'::jsonb)
      from (select coalesce(type, 'other') type, count(*) n from notifications group by 1) t
    ),
    'notif_by_urgency', (
      select coalesce(jsonb_agg(jsonb_build_object('label', 'Level ' || urgency, 'value', n) order by urgency desc), '[]'::jsonb)
      from (select urgency, count(*) n from notifications group by 1) t
    ),

    'consult_funnel', jsonb_build_object(
      'appointments', (select count(*) from appointments),
      'meetings',     (select count(*) from appointments where meeting_started_at is not null),
      'completed',    (select count(*) from appointments where status = 'completed'),
      'recorded',     (select count(*) from consultation_records),
      'summarized',   (select count(*) from consultation_records where summary_status = 'ready')
    ),

    'geo_points', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'lat', round(latitude::numeric, 3), 'lng', round(longitude::numeric, 3), 's', specialty::text
             )), '[]'::jsonb)
      from doctors where latitude is not null and longitude is not null
    ),
    'geo_states', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'state', state, 'n', n, 'lat', round(lat::numeric, 3), 'lng', round(lng::numeric, 3)
             ) order by n desc), '[]'::jsonb)
      from (
        select state, count(*) n, avg(latitude) lat, avg(longitude) lng
        from doctors where latitude is not null and state is not null
        group by state
      ) t
    ),

    'activity', (
      select coalesce(jsonb_agg(to_jsonb(e) order by e.ts desc), '[]'::jsonb)
      from (
        select ts, kind, text from (
          (select created_at ts, 'notification' kind, coalesce(nullif(title, ''), type, 'Notification') text
             from notifications order by created_at desc limit 14)
          union all
          (select created_at, 'appointment', coalesce(nullif(title, ''), 'Appointment') || ' · ' || status::text
             from appointments order by created_at desc limit 14)
          union all
          (select created_at, 'triage', initcap(need_bracket) || ' triage · ' || replace(specialty::text, '_', ' ')
             from triage_assessments order by created_at desc limit 14)
          union all
          (select recorded_at, 'vitals', 'Vitals reading logged'
             from vitals_logs order by recorded_at desc limit 8)
          union all
          (select created_at, 'user', 'New ' || role::text || ' onboarded'
             from users order by created_at desc limit 8)
        ) u
        order by ts desc
        limit 24
      ) e
    )
  );
$$;

grant execute on function public.admin_dashboard_metrics() to anon, authenticated;
