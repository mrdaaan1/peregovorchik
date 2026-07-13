"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { AuthGate } from "@/components/AuthGate";
import { getTheoryModuleBySlug } from "@/lib/theory";

function TheoryModuleContent() {
  const params = useParams<{ slug: string }>();
  const module_ = getTheoryModuleBySlug(params.slug);

  if (!module_) {
    return (
      <main className="flex-1 flex items-center justify-center px-4">
        <p className="text-muted">Материал не найден.</p>
      </main>
    );
  }

  return (
    <main className="flex-1 px-4 py-8 max-w-5xl mx-auto w-full">
      <Link href="/theory" className="text-muted text-sm w-fit">
        ← Все материалы
      </Link>

      <div className="flex items-center gap-3 animate-fade-in-up mt-4 mb-6">
        <span className="text-4xl">{module_.emoji}</span>
        <h1 className="font-display text-2xl lg:text-3xl font-extrabold">{module_.title}</h1>
      </div>

      <div className="grid lg:grid-cols-[1fr_22rem] gap-6 items-start">
        <div className="flex flex-col gap-6 min-w-0">
          <div className="flex flex-col gap-4">
            {module_.sections.map((s) => (
              <div key={s.heading} className="card-elevated rounded-2xl p-5">
                <p className="font-semibold mb-2">{s.heading}</p>
                <p className="text-sm leading-relaxed">{s.body}</p>
              </div>
            ))}
          </div>

          <div className="rounded-2xl bg-accent-soft border border-accent/20 p-5">
            <p className="font-semibold mb-2 text-accent-dark">Главное</p>
            <ul className="flex flex-col gap-2 text-sm">
              {module_.keyTakeaways.map((t) => (
                <li key={t} className="flex gap-2">
                  <span className="text-accent">✓</span>
                  <span>{t}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* На мобильном видео показываем в общем потоке, на desktop — в правой колонке (см. ниже). */}
          <div className="lg:hidden flex flex-col gap-4">
            {module_.videos?.map((v) => (
              <VideoCard key={v.youtubeId} video={v} />
            ))}
          </div>

          <Link
            href="/dashboard"
            className="rounded-xl bg-accent hover:bg-accent-dark transition-colors text-white py-3 font-semibold text-center shadow-lg shadow-accent/20"
          >
            Применить на практике
          </Link>
        </div>

        {module_.videos && module_.videos.length > 0 && (
          <div className="hidden lg:flex flex-col gap-4 sticky top-8">
            <p className="text-xs uppercase tracking-wide text-muted font-semibold">Сцена из кино</p>
            {module_.videos.map((v) => (
              <VideoCard key={v.youtubeId} video={v} />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}

function VideoCard({
  video,
}: {
  video: { youtubeId: string; title: string; movie: string; lesson: string };
}) {
  return (
    <div className="card-elevated rounded-2xl overflow-hidden">
      <div className="aspect-video bg-black">
        <iframe
          className="w-full h-full"
          src={`https://www.youtube-nocookie.com/embed/${video.youtubeId}`}
          title={video.title}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          loading="lazy"
        />
      </div>
      <div className="p-4">
        <p className="font-medium text-sm">{video.title}</p>
        <p className="text-muted text-xs mt-0.5">{video.movie}</p>
        <p className="text-sm mt-2 leading-relaxed">{video.lesson}</p>
      </div>
    </div>
  );
}

export default function TheoryModulePage() {
  return (
    <AuthGate>
      <TheoryModuleContent />
    </AuthGate>
  );
}
