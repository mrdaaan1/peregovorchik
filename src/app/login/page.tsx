"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;

    setSending(true);
    setError(null);
    const supabase = createClient();

    const { error: signInError } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    setSending(false);
    if (signInError) {
      setError("Не удалось отправить ссылку. Проверь адрес и попробуй ещё раз.");
      return;
    }
    setSent(true);
  }

  return (
    <main className="flex-1 flex flex-col items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm flex flex-col gap-6">
        <div className="text-center">
          <p className="text-3xl mb-2">🤝</p>
          <h1 className="text-2xl font-bold">Арена переговоров</h1>
          <p className="text-muted text-sm mt-1">Симулятор навыков деловых переговоров</p>
        </div>

        {sent ? (
          <div className="rounded-2xl bg-card border border-card-border p-5 text-center">
            <p className="font-semibold mb-1">Проверь почту</p>
            <p className="text-muted text-sm">
              Мы отправили ссылку для входа на <b>{email}</b>. Перейди по ней, чтобы попасть в приложение.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            <input
              type="email"
              required
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="rounded-xl border border-card-border bg-card px-4 py-3 text-base outline-none focus:border-accent"
            />
            <button
              type="submit"
              disabled={sending || !email.trim()}
              className="rounded-xl bg-accent text-white py-3 font-semibold disabled:opacity-50"
            >
              {sending ? "Отправляю…" : "Получить ссылку для входа"}
            </button>
            {error && <p className="text-red-500 text-sm text-center">{error}</p>}
          </form>
        )}
      </div>
    </main>
  );
}
