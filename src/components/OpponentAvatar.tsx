"use client";

export type OpponentState = "idle" | "listening" | "thinking" | "talking";
export type OpponentAvatarKey = "boss" | "supplier" | "client" | "tough";

const AVATAR_STYLE: Record<OpponentAvatarKey, { skin: string; hair: string; outfit: string; accessory: string }> = {
  boss: { skin: "#e0ac85", hair: "#3a3a3a", outfit: "#2a4f6f", accessory: "#c9a13b" }, // тёмный пиджак, галстук
  supplier: { skin: "#f0c9a0", hair: "#6b3e26", outfit: "#5a3d5c", accessory: "#e8749a" }, // деловой блейзер, брошь
  client: { skin: "#d9a876", hair: "#222222", outfit: "#8a2f2f", accessory: "#e0e0e0" }, // раздражённый клиент, красный оттенок
  tough: { skin: "#c98f6a", hair: "#111111", outfit: "#1a1a1a", accessory: "#b3202c" }, // жёсткий переговорщик, чёрный костюм
};

export function OpponentAvatar({
  avatarKey,
  state = "idle",
  size = 120,
  className,
}: {
  avatarKey: OpponentAvatarKey;
  state?: OpponentState;
  size?: number;
  className?: string;
}) {
  const style = AVATAR_STYLE[avatarKey];
  const listening = state === "listening";
  const thinking = state === "thinking";
  const talking = state === "talking";

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      role="img"
      aria-label={`Оппонент: ${state}`}
    >
      <style>
        {`
          @keyframes opp-blink {
            0%, 90%, 100% { transform: scaleY(1); }
            94% { transform: scaleY(0.1); }
          }
          @keyframes opp-breathe {
            0%, 100% { transform: translateY(0); }
            50% { transform: translateY(-1.5px); }
          }
          @keyframes opp-talk-mouth {
            0%, 100% { transform: scaleY(0.4); }
            50% { transform: scaleY(1); }
          }
          @keyframes opp-pulse-ring {
            0% { transform: scale(0.75); opacity: 0.5; }
            100% { transform: scale(1.25); opacity: 0; }
          }
          @keyframes opp-think-dot {
            0%, 100% { opacity: 0.25; transform: translateY(0); }
            50% { opacity: 1; transform: translateY(-2px); }
          }
          .opp-eye { transform-box: fill-box; transform-origin: center; animation: opp-blink 4.2s ease-in-out infinite; }
          .opp-body { transform-box: fill-box; transform-origin: 50% 90%; animation: opp-breathe 3.6s ease-in-out infinite; }
          .opp-talk-mouth { transform-box: fill-box; transform-origin: center; animation: opp-talk-mouth 0.26s ease-in-out infinite; }
          .opp-pulse { transform-box: fill-box; transform-origin: center; animation: opp-pulse-ring 1.4s ease-out infinite; }
          .opp-pulse-2 { animation-delay: 0.7s; }
          .opp-think-dot { animation: opp-think-dot 1.2s ease-in-out infinite; }
        `}
      </style>

      {listening && (
        <>
          <circle className="opp-pulse" cx="50" cy="52" r="44" stroke={style.accessory} strokeWidth="2" fill="none" />
          <circle className="opp-pulse opp-pulse-2" cx="50" cy="52" r="44" stroke={style.accessory} strokeWidth="2" fill="none" />
        </>
      )}

      <g className="opp-body">
        {/* Плечи/пиджак */}
        <path d="M14 96 Q20 68 50 66 Q80 68 86 96 Z" fill={style.outfit} />
        {/* Воротник/аксессуар (галстук/брошь) */}
        <path d="M45 66 L50 78 L55 66 Z" fill={style.accessory} />

        {/* Шея */}
        <rect x="42" y="56" width="16" height="14" rx="4" fill={style.skin} />

        {/* Голова */}
        <ellipse cx="50" cy="42" rx="24" ry="26" fill={style.skin} />

        {/* Волосы */}
        <path d="M26 38 Q24 14 50 14 Q76 14 74 38 Q74 24 50 24 Q26 24 26 38 Z" fill={style.hair} />

        {/* Глаза */}
        <g className="opp-eye" transform="translate(40, 42)">
          <ellipse cx="0" cy="0" rx="3" ry="3.6" fill="#2b2b2b" />
        </g>
        <g className="opp-eye" transform="translate(60, 42)">
          <ellipse cx="0" cy="0" rx="3" ry="3.6" fill="#2b2b2b" />
        </g>

        {/* Брови — чуть хмурые для competitive/emotional характера считываются позой, не меняем по стейту */}
        <path d="M35 36 L45 34" stroke="#2b2b2b" strokeWidth="2" strokeLinecap="round" />
        <path d="M65 36 L55 34" stroke="#2b2b2b" strokeWidth="2" strokeLinecap="round" />

        {/* Рот */}
        {talking ? (
          <ellipse className="opp-talk-mouth" cx="50" cy="56" rx="6" ry="4.5" fill="#5c2a2a" />
        ) : (
          <path d="M42 56 Q50 60 58 56" stroke="#5c2a2a" strokeWidth="2.5" strokeLinecap="round" fill="none" />
        )}
      </g>

      {thinking && (
        <g fill={style.accessory}>
          <circle className="opp-think-dot" cx="80" cy="18" r="3" />
          <circle className="opp-think-dot" cx="88" cy="12" r="4" style={{ animationDelay: "0.2s" }} />
          <circle className="opp-think-dot" cx="95" cy="5" r="5" style={{ animationDelay: "0.4s" }} />
        </g>
      )}
    </svg>
  );
}
