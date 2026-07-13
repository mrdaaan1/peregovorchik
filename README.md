# Арена переговоров (peregovorchik)

Симулятор развития навыков деловых переговоров. Три сценария (зарплата,
поставщик, недовольный клиент), голосовой диалог с анимированным оппонентом,
LLM-оценка итога по критериям (аргументация, активное слушание, работа с
возражениями, BATNA).

Полностью независимый проект: свой git-репозиторий, своя база Supabase,
свой деплой на Vercel — не связан с другими проектами.

## Стек

- Next.js 16 (App Router) + TypeScript + Tailwind
- Supabase (Postgres + Auth magic link + RLS)
- OpenRouter (бесплатная модель nemotron) — диалог с оппонентом и оценка
- Web Speech API — распознавание речи в браузере, бесплатно, без сервера
- msedge-tts — озвучка ответов, бесплатные нейроголоса Microsoft Edge

## Настройка

1. Создай проект в [Supabase](https://supabase.com), выполни миграцию
   `supabase/migrations/0001_init.sql` в SQL Editor.
2. Скопируй `.env.local.example` в `.env.local`, заполни ключи Supabase
   (Project Settings → API) и `OPENROUTER_API_KEY`.
3. `npm install && npm run dev`

## Структура

```
src/
  app/
    page.tsx                  — список сценариев
    login/                    — вход по magic link
    scenarios/[slug]/         — брифинг сценария
    session/[id]/             — экран переговоров (голос + текст)
    result/[id]/               — экран итогов с оценкой
    api/
      sessions/start          — создать сессию, вернуть открывающую реплику
      sessions/message        — ход диалога (LLM отвечает за оппонента)
      sessions/finish         — завершить сессию, получить LLM-оценку
      tts                     — озвучка текста (msedge-tts)
  lib/
    scenarios/                — декларативные конфиги трёх сценариев
    negotiation/              — сборка промптов + логика оценки
    voice/                    — хук распознавания речи (Web Speech API)
    supabase/                 — клиенты для браузера/сервера/proxy
```

## Добавление нового сценария

Сценарии — декларативные TS-объекты (`src/lib/scenarios/*.ts`), не строки в
БД. Чтобы добавить сценарий: скопировать один из существующих файлов,
заполнить `briefingText` (видимое игроку) и `opponent` (скрытые интересы,
BATNA, что убеждает/раздражает — уходит только в системный промпт LLM),
добавить в список `SCENARIOS` в `src/lib/scenarios/index.ts`.
