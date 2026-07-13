// Декларативное описание сценария переговоров. Всё, что оппонент "знает",
// но игрок не видит напрямую, живёт в OpponentConfig — оно передаётся только
// в системный промпт LLM. Игрок видит лишь briefingText.

export type Difficulty = "easy" | "medium" | "hard";

export type OpponentPersonality =
  | "cooperative" // склонен к компромиссу, ищет win-win
  | "competitive" // жёсткий, давит, использует тактики позиционного торга
  | "avoidant" // уклоняется, тянет время, неохотно раскрывает информацию
  | "emotional"; // реагирует эмоционально, важен тон и эмпатия

export type OpponentConfig = {
  personality: OpponentPersonality;
  /** Скрытые интересы оппонента — то, что реально важно, а не то, что декларируется. */
  hiddenInterests: string[];
  /** BATNA оппонента — его лучшая альтернатива, если переговоры провалятся. */
  batna: string;
  /** Нижняя/верхняя граница, которую оппонент не пересечёт без веских аргументов. */
  walkAwayCondition: string;
  /** Что заставляет оппонента уступить (конкретные типы аргументов/техник). */
  persuadedBy: string[];
  /** Что вызывает сопротивление или срыв переговоров. */
  triggersResistance: string[];
  openingLine: string;
};

export type EvaluationCriterion = {
  key: string;
  label: string;
  weight: number; // сумма весов по сценарию = 100
  description: string; // что именно оценивается — часть промпта для LLM-оценщика
};

export type Scenario = {
  slug: string;
  title: string;
  shortDescription: string;
  difficulty: Difficulty;
  playerRole: string;
  opponentRole: string;
  opponentName: string;
  opponentAvatarKey: "boss" | "supplier" | "client" | "tough";
  briefingText: string; // видимая игроку часть — контекст, его цель, что известно
  opponent: OpponentConfig;
  evaluationCriteria: EvaluationCriterion[];
  /** Модель OpenRouter для диалога в этом сценарии — переопределяет глобальную модель по умолчанию. */
  model?: string;
  /** Разрешает оппоненту грубую лексику и мат в системном промпте (по умолчанию запрещено). */
  allowProfanity?: boolean;
  /** Предупреждение о контенте, показываемое перед стартом (например, ненормативная лексика). */
  contentWarning?: string;
};
