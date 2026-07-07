-- Esquema RCT para los datos offline de "Eligiendo Mi Camino".
-- Córrelo UNA vez en Supabase → SQL Editor (pega y "Run").
-- Las claves primarias (message_id / insert_id / user_id) hacen la sincronización idempotente:
-- si un lote se reenvía, no se duplica.

create table if not exists students (
  user_id        text primary key,          -- <campus>-<seccion>-<n_lista>
  name           text,
  list_number    text,
  campus_id      text,
  campus_name    text,
  section        text,
  teacher        text,
  institution_id int,
  device_id      text,
  first_seen     timestamptz default now(),
  last_seen      timestamptz
);

create table if not exists voc_chat (
  message_id     text primary key,
  user_id        text,
  conversation_id text,
  step           text,
  message_type   text,                       -- 'student' | 'ai'
  is_student     int,                         -- 1 | 0
  message_text   text,
  msg_length     int,
  ts_created     timestamptz,
  date_created   date,
  campus_id      text,
  received_at    timestamptz
);
create index if not exists voc_chat_user_idx on voc_chat(user_id);
create index if not exists voc_chat_step_idx on voc_chat(step);

create table if not exists voc_events (
  insert_id      text primary key,
  event          text,                        -- step_opened, riasec_result, myth_answer, guard_*, checkin, reflection, ...
  user_id        text,
  campus_id      text,
  props          jsonb,                        -- payload del evento (respuestas, puntajes, notas, etc.)
  ts             timestamptz,
  date           date,
  received_at    timestamptz
);
create index if not exists voc_events_user_idx on voc_events(user_id);
create index if not exists voc_events_event_idx on voc_events(event);

create table if not exists voc_steps (
  user_id               text primary key,     -- una fila por estudiante (se actualiza)
  institution_id        int,
  campus_id             text,
  section               text,
  current_step          text,
  completed_steps_count int,
  completed_steps       jsonb,
  journey_status        text,                  -- active | completed
  updated_at            timestamptz,
  received_at           timestamptz
);
