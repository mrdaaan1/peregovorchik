-- Детальный разбор сессии: конкретные цитаты игрока с вердиктом "сработало/
-- не сработало" и привязкой к технике. Достижения/streak/roadmap намеренно
-- НЕ хранятся в БД — они вычисляются на лету из sessions/session_results
-- (см. src/lib/achievements), поэтому единственное реально нужное изменение
-- схемы — новое поле для разбора диалога по конкретным репликам.

alter table public.session_results
  add column if not exists key_moments jsonb not null default '[]'::jsonb;
