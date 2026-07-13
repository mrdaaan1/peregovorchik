// Каталог книг по переговорам с привязкой к критериям оценки — используется
// для персонализированных рекомендаций на странице результата: если
// пользователь слаб в конкретном критерии, ему предлагается книга,
// прицельно закрывающая этот пробел.

export type BookRecommendation = {
  title: string;
  author: string;
  emoji: string;
  pitch: string;
  /** Ключи критериев оценки (см. Scenario.evaluationCriteria), которые эта книга усиливает. */
  relatedCriteria: string[];
};

export const BOOKS: BookRecommendation[] = [
  {
    title: "Переговоры без поражения",
    author: "Роджер Фишер, Уильям Юри",
    emoji: "🎓",
    pitch: "Классика Гарвардского метода — как отделять людей от проблемы и искать интересы, а не спорить о позициях.",
    relatedCriteria: ["argumentation", "objection_handling", "outcome_vs_batna", "boundary_setting"],
  },
  {
    title: "Договориться можно обо всём",
    author: "Гэвин Кеннеди",
    emoji: "🤝",
    pitch: "Практичная система уступок и торга — как не отдавать позицию бесплатно и правильно предлагать компромиссы.",
    relatedCriteria: ["objection_handling", "outcome_vs_batna"],
  },
  {
    title: "СПИН-продажи",
    author: "Нил Рекхэм",
    emoji: "❓",
    pitch: "Методика вопросов, которая подводит собеседника к решению его же словами, а не через давление.",
    relatedCriteria: ["active_listening", "argumentation"],
  },
  {
    title: "Никогда не идите на компромисс",
    author: "Крис Восс",
    emoji: "🕊️",
    pitch: "Техники переговорщика ФБР по заложникам — активное слушание, эмпатия и деэскалация в самых напряжённых ситуациях.",
    relatedCriteria: ["empathy", "active_listening", "composure"],
  },
  {
    title: "Сначала скажите нет",
    author: "Джим Кэмп",
    emoji: "🛡️",
    pitch: "Как не бояться отказа и не соглашаться на невыгодные условия под давлением дедлайна или эмоций.",
    relatedCriteria: ["composure", "boundary_setting"],
  },
  {
    title: "Психология влияния",
    author: "Роберт Чалдини",
    emoji: "🧠",
    pitch: "Шесть универсальных принципов убеждения — полезно понимать, чтобы применять их и распознавать, когда их применяют на тебе.",
    relatedCriteria: ["argumentation", "empathy"],
  },
];

export function recommendBooks(weakCriteriaKeys: string[], limit = 3): BookRecommendation[] {
  const scored = BOOKS.map((book) => ({
    book,
    score: book.relatedCriteria.filter((c) => weakCriteriaKeys.includes(c)).length,
  }));
  scored.sort((a, b) => b.score - a.score);
  const withMatches = scored.filter((s) => s.score > 0).map((s) => s.book);
  if (withMatches.length >= limit) return withMatches.slice(0, limit);
  // Не хватает точных совпадений — добираем любыми книгами, чтобы всегда что-то показать.
  const rest = BOOKS.filter((b) => !withMatches.includes(b));
  return [...withMatches, ...rest].slice(0, limit);
}
