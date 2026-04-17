import React, { useState } from "react";
import { 
  Lock, 
  CheckCircle2, 
  AlertCircle, 
  Send, 
  ChevronRight,
  Info,
  RotateCcw,
  ArrowRight
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { evaluatePromptWithGemini, EvaluationResult } from "./lib/ai";
import logoLong from "./img/Logo Long NEW.svg";
import spinBg from "./img/spin.svg";

interface Level {
  id: number;
  title: string;
  category: string;
  scenario: string;
  difficulty: "Easy" | "Medium" | "Hard";
}

const levels: Level[] = [
  {
    id: 1,
    title: "Разминка: Ответ преподавателю",
    category: "Учеба",
    scenario: "Напишите промпт для ИИ, чтобы он составил вежливое письмо преподавателю. Нужно объяснить, что вы опоздали со сдачей курсовой по маркетингу на 2 дня из-за болезни, и попросить принять работу без снижения балла.",
    difficulty: "Easy"
  },
  {
    id: 2,
    title: "Отработка возражения «Дорого»",
    category: "Продажи",
    scenario: "Клиент говорит: «Ваш продукт слишком дорогой». Напишите промпт, чтобы ИИ подготовил 3 варианта отработки этого возражения, используя метод сравнения ценности и цены.",
    difficulty: "Medium"
  },
  {
    id: 3,
    title: "Скрипт холодного звонка",
    category: "Продажи",
    scenario: "Ваша компания продает CRM для малого бизнеса. Напишите промпт, чтобы ИИ составил сценарий (скрипт) для звонка руководителю рекламного агентства. Цель: назначить встречу-демонстрацию.",
    difficulty: "Medium"
  },
  {
    id: 4,
    title: "Анализ потребностей (SPIN)",
    category: "Продажи",
    scenario: "Напишите промпт для ИИ, чтобы он сгенерировал список из 5 открытых вопросов по технике SPIN (Ситуационные, Проблемные, Извлекающие, Направляющие) для встречи с директором логистической компании.",
    difficulty: "Hard"
  },
  {
    id: 5,
    title: "Деловое письмо: Предложение",
    category: "Бизнес",
    scenario: "Напишите промпт, чтобы ИИ составил коммерческое предложение для крупного ритейлера об интеграции вашей системы автозаказа товаров. Тон: официально-деловой, фокус на экономии 15% бюджета.",
    difficulty: "Hard"
  },
  {
    id: 6,
    title: "Анализ конкурентов (SWOT)",
    category: "Стратегия",
    scenario: "Напишите промпт, чтобы ИИ провел SWOT-анализ конкурента (любого известного сервиса доставки еды). Ответ должен быть в виде таблицы.",
    difficulty: "Hard"
  }
];

const CRITERION_LABELS: Record<string, string> = {
  role: "Роль",
  context: "Контекст",
  task: "Задача",
  format: "Формат",
};

/** Балл 0–100 → оценка по 5-балльной шкале (как в школе: пороги по процентам). */
function percentToGrade5(percent: number): number {
  if (percent >= 86) return 5;
  if (percent >= 70) return 4;
  if (percent >= 55) return 3;
  if (percent >= 40) return 2;
  return 1;
}

const App: React.FC = () => {
  const [currentLevelIndex, setCurrentLevelIndex] = useState(0);
  const [unlockedLevels, setUnlockedLevels] = useState<number[]>([1]);
  const [userInput, setUserInput] = useState("");
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [evaluation, setEvaluation] = useState<EvaluationResult | null>(null);
  const [scores, setScores] = useState<Record<number, number>>({});
  const [gameState, setGameState] = useState<"lobby" | "playing" | "finish">("lobby");

  const currentLevel = levels[currentLevelIndex];

  const handleStart = () => {
    setGameState("playing");
    setUserInput("");
    setEvaluation(null);
  };

  const handleCheckPrompt = async () => {
    if (!userInput.trim()) return;

    setIsEvaluating(true);
    const result = await evaluatePromptWithGemini(
      userInput,
      currentLevel.title,
      currentLevel.scenario
    );
    
    setEvaluation(result);
    setIsEvaluating(false);

    // Update scores for this level
    setScores(prev => ({
      ...prev,
      [currentLevel.id]: Math.max(prev[currentLevel.id] || 0, result.score)
    }));

  };

  const goToNextLevel = () => {
    const nextId = currentLevel.id + 1;
    if (nextId <= levels.length && !unlockedLevels.includes(nextId)) {
      setUnlockedLevels((prev) => [...prev, nextId]);
    }

    if (currentLevelIndex < levels.length - 1) {
      setCurrentLevelIndex((prev) => prev + 1);
      setUserInput("");
      setEvaluation(null);
    } else {
      setGameState("finish");
    }
  };

  const resetGame = () => {
    setCurrentLevelIndex(0);
    setUnlockedLevels([1]);
    setScores({});
    setGameState("lobby");
    setEvaluation(null);
  };

  const perLevelGrades = levels.map((lvl) => percentToGrade5(scores[lvl.id] ?? 0));
  const averageGrade5 =
    levels.length > 0
      ? perLevelGrades.reduce((acc, g) => acc + g, 0) / levels.length
      : 0;

  /** Уровень по средней оценке за все задания (1–5). */
  const getRank = (avgGrade: number): { title: string; description: string } => {
    if (avgGrade >= 4.5) {
      return {
        title: "Мастер промптов",
        description:
          "Очень высокая средняя оценка: вы стабильно задаёте роль, контекст, задачу и формат — модель получает чёткие инструкции.",
      };
    }
    if (avgGrade >= 3.5) {
      return {
        title: "Уверенный практик",
        description:
          "Сильный средний результат: промпты в целом структурированы и ведут ИИ к нужному ответу, остаётся полировать детали.",
      };
    }
    if (avgGrade >= 2.5) {
      return {
        title: "Практикант",
        description:
          "База заложена: добавляйте конкретики по ситуации и явно просите нужный формат ответа (список, таблица, тон).",
      };
    }
    return {
      title: "Начальный уровень",
      description:
        "Средняя оценка пока низкая — имеет смысл вернуться к заданиям и усилить формулировку роли, контекста и шага за шагом задачи.",
    };
  };

  const finalRank = getRank(averageGrade5);

  return (
    <div className="relative min-h-screen font-sans text-brand-text selection:bg-brand-primary/20 selection:text-brand-text">
      {/* Фоновый паттерн (spin.svg) */}
      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
        <img
          src={spinBg}
          alt=""
          aria-hidden
          className="absolute inset-0 h-full w-full scale-110 object-cover object-center opacity-[0.55]"
        />
        <div className="absolute left-[-10%] top-[-10%] h-[40%] w-[40%] rounded-full bg-brand-sky/20 blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] h-[40%] w-[40%] rounded-full bg-brand-primary/15 blur-[120px]" />
      </div>

      <div className="relative z-10 flex min-h-screen flex-col">
        {/* Header */}
        <header className="sticky top-0 z-50 border-b border-black/[0.06] bg-white/90 shadow-sm shadow-black/[0.03] backdrop-blur-md">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
            <div className="flex min-w-0 items-center">
              <img
                src={logoLong}
                alt="Prompt.Lab EDU — ИИ тренажёр продаж"
                className="h-6 w-auto max-w-[min(100%,220px)] object-contain object-left sm:h-7 sm:max-w-none"
              />
            </div>

            <div className="flex items-center gap-6">
              <div className="hidden flex-col items-end sm:flex">
                <span className="text-[10px] font-bold uppercase text-brand-text/45">Средняя оценка</span>
                <span className="font-mono text-lg font-bold text-brand-primary">
                  {Object.keys(scores).length > 0 ? `${averageGrade5.toFixed(1)} из 5` : "—"}
                </span>
              </div>
              <div className="hidden h-8 w-px bg-black/10 sm:block" />
              <div className="flex gap-1.5">
                {levels.map((lvl) => {
                  const isCurrent =
                    gameState === "lobby"
                      ? lvl.id === 1
                      : gameState === "finish"
                        ? lvl.id === levels.length
                        : currentLevelIndex + 1 === lvl.id;
                  const passed =
                    unlockedLevels.includes(lvl.id) && percentToGrade5(scores[lvl.id] ?? 0) >= 3;
                  return (
                    <div
                      key={lvl.id}
                      className={`h-7 w-10 rounded-lg border-2 transition-all duration-300 ${
                        isCurrent
                          ? "border-brand-primary bg-brand-sky/30 shadow-sm shadow-brand-primary/10"
                          : passed
                            ? "border-transparent bg-emerald-500/25"
                            : unlockedLevels.includes(lvl.id)
                              ? "border-transparent bg-brand-sky/20"
                              : "border-transparent bg-black/[0.08]"
                      }`}
                    />
                  );
                })}
              </div>
            </div>
          </div>
        </header>

        <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-6 pb-8 pt-0">
        <AnimatePresence mode="wait">
          {gameState === "lobby" && (
            <motion.div
              key="lobby"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="flex flex-1 flex-col items-center justify-center px-4 py-10 text-center"
            >
              <div className="mx-auto w-full max-w-3xl">
                <h2 className="font-display mb-6 text-5xl font-bold uppercase leading-[1.05] tracking-tight sm:text-6xl md:text-7xl">
                  <span className="text-brand-text">Промпт-</span>
                  <br />
                  <span className="text-brand-primary">Тренажер</span>
                </h2>
                <p className="mx-auto mb-10 max-w-2xl text-lg leading-[1.18] text-brand-text/80 sm:text-xl">
                  Пройди 6 уровней обучения от простого студента до эксперта по продажам. Напиши
                  эффективные запросы для ИИ и получи оценку в реальном времени.
                </p>
                <button
                  onClick={handleStart}
                  type="button"
                  className="group inline-flex items-center gap-3 rounded-2xl bg-brand-primary px-10 py-4 text-lg font-bold text-white shadow-lg shadow-brand-primary/30 transition-all hover:bg-brand-sky"
                >
                  Начать обучение
                  <ChevronRight className="transition-transform group-hover:translate-x-1" />
                </button>
              </div>
            </motion.div>
          )}

          {gameState === "playing" && (
            <motion.div 
              key="playing"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="grid gap-8 pt-8 lg:grid-cols-12"
            >
              {/* Task Sidebar */}
              <div className="space-y-6 lg:col-span-4">
                <div className="rounded-3xl border border-black/8 bg-white p-8 shadow-sm">
                  <div className="mb-6 flex items-center gap-3">
                    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-primary font-bold text-white">
                      {currentLevel.id}
                    </span>
                    <h2 className="text-2xl font-bold text-brand-text">{currentLevel.title}</h2>
                  </div>

                  <div className="space-y-6">
                    <div>
                      <h3 className="mb-2 text-xs font-bold uppercase tracking-widest text-brand-primary">
                        Ситуация
                      </h3>
                      <p className="rounded-xl border border-black/6 bg-brand-surface p-4 leading-[1.18] text-brand-text/85">
                        {currentLevel.scenario}
                      </p>
                    </div>

                    <div className="flex items-center gap-3 rounded-xl border border-brand-primary/20 bg-brand-primary/8 px-4 py-3.5">
                      <Info
                        className="h-5 w-5 shrink-0 text-brand-primary"
                        strokeWidth={2}
                        aria-hidden
                      />
                      <p className="min-w-0 flex-1 text-sm font-medium leading-snug text-brand-text/90">
                        Совет: Хороший промпт должен содержать Роль, Контекст и четкое Задание.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Level list in sidebar */}
                <div className="hidden space-y-2 lg:block">
                  <h3 className="mb-2 ml-4 text-xs font-bold uppercase tracking-widest text-brand-text/45">
                    Прогресс обучения
                  </h3>
                  {levels.map((lvl) => (
                    <div
                      key={lvl.id}
                      className={`flex items-center justify-between rounded-xl p-4 transition-all ${
                        currentLevel.id === lvl.id
                          ? "border border-brand-primary/35 bg-brand-primary/10 text-brand-text"
                          : unlockedLevels.includes(lvl.id)
                            ? "border border-black/6 bg-white text-brand-text/65 shadow-sm"
                            : "border border-transparent bg-transparent text-brand-text/30"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        {unlockedLevels.includes(lvl.id) ? (
                          percentToGrade5(scores[lvl.id] ?? 0) >= 3 ? (
                            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                          ) : (
                            <div className="h-4 w-4 rounded-full border border-current" />
                          )
                        ) : (
                          <Lock className="h-4 w-4" />
                        )}
                        <span className="text-sm font-medium">{lvl.title}</span>
                      </div>
                      {scores[lvl.id] != null && scores[lvl.id] > 0 && (
                        <span className="font-mono text-xs">{percentToGrade5(scores[lvl.id])}/5</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Main Workspace */}
              <div className="flex h-full flex-col lg:col-span-8">
                <div className="mb-6 flex flex-grow flex-col rounded-3xl border border-black/8 bg-white p-8 shadow-sm">
                  <div className="mb-6 flex items-center justify-between">
                    <h3 className="text-xl font-bold text-brand-text">Редактор промпта</h3>
                    <div className="text-xs text-brand-text/45">Символов: {userInput.length}</div>
                  </div>

                  <div className="group relative min-h-[300px] flex-grow">
                    <textarea
                      value={userInput}
                      onChange={(e) => setUserInput(e.target.value)}
                      placeholder="Введите ваш промпт здесь..."
                      disabled={isEvaluating}
                      className="h-full w-full resize-none rounded-2xl border border-black/10 bg-brand-surface p-6 font-mono text-lg text-brand-text placeholder:text-brand-text/35 focus:outline-none focus:ring-2 focus:ring-brand-primary/35"
                    />
                    <div className="absolute bottom-4 right-4 flex gap-2">
                      <button
                        onClick={() => setUserInput("")}
                        className="rounded-xl border border-black/8 bg-white p-3 transition-all hover:bg-brand-surface"
                        title="Очистить"
                        type="button"
                      >
                        <RotateCcw className="h-5 w-5 text-brand-text/50" />
                      </button>
                      <button
                        onClick={handleCheckPrompt}
                        disabled={isEvaluating || !userInput.trim()}
                        className="flex items-center gap-2 rounded-xl bg-brand-primary px-8 py-3 font-bold text-white shadow-md shadow-brand-primary/25 transition-all hover:bg-brand-sky disabled:cursor-not-allowed disabled:opacity-50"
                        type="button"
                      >
                        {isEvaluating ? (
                          <>
                            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            Судья анализирует...
                          </>
                        ) : (
                          <>
                            <Send className="w-5 h-5" />
                            Проверить промпт
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>

                <AnimatePresence>
                  {evaluation && (
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="rounded-3xl border border-black/8 bg-white p-8 shadow-sm"
                    >
                      <div className="mb-8 flex flex-col gap-5">
                        <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:gap-8">
                          <div className="flex shrink-0 flex-col items-start sm:pt-0.5">
                            <motion.span
                              className={`font-mono text-3xl font-black tabular-nums leading-none ${
                                percentToGrade5(evaluation.score) >= 3
                                  ? "text-emerald-600"
                                  : "text-brand-primary"
                              }`}
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              transition={{ duration: 0.3 }}
                            >
                              {percentToGrade5(evaluation.score)}
                            </motion.span>
                            <span className="mt-1 text-[10px] font-bold uppercase tracking-widest text-brand-text/45">
                              Из 5
                            </span>
                          </div>

                          <div className="min-w-0 flex-1 space-y-3">
                            <div>
                              {percentToGrade5(evaluation.score) >= 3 ? (
                                <span className="inline-flex rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-bold uppercase tracking-wider text-emerald-700">
                                  Уровень пройден!
                                </span>
                              ) : (
                                <span className="inline-flex rounded-full bg-brand-coral/12 px-3 py-1 text-xs font-bold uppercase tracking-wider text-brand-coral">
                                  Нужно доработать
                                </span>
                              )}
                            </div>
                            <p className="text-base font-medium leading-[1.18] text-brand-text sm:text-lg">
                              «{evaluation.feedback}»
                            </p>
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-3 border-t border-black/8 pt-5">
                          <button
                            type="button"
                            onClick={goToNextLevel}
                            className={`inline-flex max-w-full shrink-0 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition-all sm:px-5 sm:py-3 ${
                              percentToGrade5(evaluation.score) >= 3
                                ? "bg-brand-primary text-white shadow-md shadow-brand-primary/25 hover:bg-brand-sky"
                                : "border border-black/12 bg-brand-surface text-brand-text hover:bg-black/[0.04]"
                            }`}
                          >
                            {currentLevel.id === levels.length
                              ? "Завершить курс"
                              : percentToGrade5(evaluation.score) >= 3
                                ? "Следующий уровень"
                                : "Дальше без зачёта"}
                            <ArrowRight className="h-4 w-4 shrink-0 sm:h-5 sm:w-5" />
                          </button>
                          {percentToGrade5(evaluation.score) < 3 && currentLevel.id < levels.length && (
                            <span className="text-xs text-brand-text/45">
                              Можно перейти к следующему заданию без прохождения порога.
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-4">
                        {Object.entries(evaluation.details).map(([key, data]) => (
                          <div
                            key={key}
                            className="rounded-2xl border border-black/6 bg-brand-surface p-4"
                          >
                            <div className="mb-2 flex items-center gap-2">
                              {data.success ? (
                                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                              ) : (
                                <AlertCircle className="h-4 w-4 text-brand-coral" />
                              )}
                              <span className="text-[10px] font-bold uppercase tracking-widest text-brand-text/45">
                                {CRITERION_LABELS[key] ?? key}
                              </span>
                            </div>
                            <p className="text-xs leading-tight text-brand-text/70">{data.comment}</p>
                          </div>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          )}

          {gameState === "finish" && (
            <motion.div
              key="finish"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="mx-auto max-w-3xl px-4 py-16 sm:py-20"
            >
              <div className="relative mb-10 overflow-hidden rounded-3xl border border-black/8 bg-white p-8 shadow-sm sm:p-12">
                <div className="mb-8 rounded-2xl border border-black/6 bg-brand-surface p-6 text-left">
                  <div className="font-display mb-2 text-2xl font-bold tracking-tight text-brand-text sm:text-3xl">
                    {finalRank.title}
                  </div>
                  <p className="text-sm leading-relaxed text-brand-text/75">{finalRank.description}</p>
                </div>

                <div className="mb-8 space-y-3 text-left">
                  <h3 className="text-xs font-bold uppercase tracking-widest text-brand-text/45">
                    Оценки по уровням
                  </h3>
                  <ul className="space-y-2">
                    {levels.map((lvl) => (
                      <li
                        key={lvl.id}
                        className="flex items-center justify-between gap-3 rounded-xl border border-black/6 bg-brand-surface/80 px-4 py-3"
                      >
                        <span className="min-w-0 flex-1 text-sm font-medium text-brand-text/90">
                          {lvl.title}
                        </span>
                        <span className="shrink-0 font-mono text-sm font-bold text-brand-primary">
                          {percentToGrade5(scores[lvl.id] ?? 0)}/5
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="mx-auto grid max-w-md grid-cols-2 gap-3 sm:gap-4">
                  <div className="rounded-2xl border border-black/6 bg-brand-surface p-3 sm:p-4">
                    <div className="mb-1 text-[10px] font-bold uppercase leading-tight text-brand-text/45 sm:text-xs">
                      Уровней пройдено
                    </div>
                    <div className="text-lg font-bold text-brand-text sm:text-xl">6/6</div>
                  </div>
                  <div className="rounded-2xl border border-black/6 bg-brand-surface p-3 sm:p-4">
                    <div className="mb-1 text-[10px] font-bold uppercase leading-tight text-brand-text/45 sm:text-xs">
                      Средняя оценка
                    </div>
                    <div className="text-lg font-bold text-brand-text sm:text-xl">
                      {averageGrade5.toFixed(1)} из 5
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex justify-center">
                <button
                  onClick={resetGame}
                  className="flex items-center gap-3 rounded-2xl bg-brand-primary px-10 py-4 font-bold text-white shadow-lg shadow-brand-primary/25 transition-all hover:bg-brand-sky"
                  type="button"
                >
                  <RotateCcw className="h-5 w-5" />
                  Пройти заново
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        </main>
      </div>
    </div>
  );
};

export default App;
