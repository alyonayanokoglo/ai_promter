import { GoogleGenAI } from "@google/genai";

const API_KEY = import.meta.env.VITE_GEMINI_API_KEY?.trim() ?? "";

/** Имя модели: см. https://ai.google.dev/gemini-api/docs/models */
const GEMINI_MODEL =
  import.meta.env.VITE_GEMINI_MODEL?.trim() || "gemini-2.5-flash";

export interface EvaluationResult {
  score: number;
  feedback: string;
  /** Если проверка не выполнена из‑за ключа/сети — не показывать как «плохой промпт». */
  evaluationFailed?: boolean;
  details: {
    role: { success: boolean; comment: string };
    context: { success: boolean; comment: string };
    task: { success: boolean; comment: string };
    format: { success: boolean; comment: string };
  };
}

export const evaluatePromptWithGemini = async (
  prompt: string,
  levelTitle: string,
  levelScenario: string
): Promise<EvaluationResult> => {
  if (!API_KEY) {
    return {
      score: 0,
      evaluationFailed: true,
      feedback:
        "Проверка сейчас недоступна: не настроен доступ к сервису оценки. Если вы разработчик — задайте ключ в переменных окружения и перезапустите приложение.",
      details: {
        role: { success: false, comment: "Проверка не запускалась" },
        context: { success: false, comment: "Проверка не запускалась" },
        task: { success: false, comment: "Проверка не запускалась" },
        format: { success: false, comment: "Проверка не запускалась" },
      },
    };
  }

  try {
    const ai = new GoogleGenAI({ apiKey: API_KEY });

    const systemPrompt = `
      Ты — эксперт по промпт-инжинирингу и преподаватель курса по ИИ.
      Твоя задача — оценить промпт студента для конкретной бизнес-ситуации.
      
      СИТУАЦИЯ: ${levelTitle}
      ЗАДАНИЕ: ${levelScenario}
      ПРОМПТ СТУДЕНТА: "${prompt}"

      ОЦЕНИВАЙ ПО КРИТЕРИЯМ (0-25 баллов за каждый):
      1. Role (Роль): Задана ли четкая роль ИИ (например, "Ты — эксперт по продажам")?
      2. Context (Контекст): Есть ли детали ситуации (кто клиент, какой продукт)?
      3. Task (Задача): Понятно ли, что именно нужно сделать (глагол действия)?
      4. Format (Формат): Указан ли формат вывода (таблица, список, тон письма)?

      ВАЖНО: Если студент написал бессмыслицу ("абырвалг", "привет", "околесица"), ставь 0 баллов по всем пунктам.

      ОТВЕТЬ СТРОГО В JSON ФОРМАТЕ:
      {
        "score": (общее число 0-100),
        "feedback": "Общий вывод на 1-2 предложения",
        "details": {
          "role": { "success": boolean, "comment": "почему так?" },
          "context": { "success": boolean, "comment": "почему так?" },
          "task": { "success": boolean, "comment": "почему так?" },
          "format": { "success": boolean, "comment": "почему так?" }
        }
      }
    `;

    const response = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: systemPrompt,
    });

    const text = response.text;
    if (!text) {
      throw new Error("Пустой ответ модели");
    }

    const cleanJson = text.replace(/```json|```/gi, "").trim();
    return JSON.parse(cleanJson);
  } catch (error) {
    console.error("Gemini API Error:", error);
    return {
      score: 0,
      evaluationFailed: true,
      feedback:
        "Не удалось связаться с сервисом оценки. Попробуйте ещё раз через минуту. Если ошибка повторяется — обратитесь к организатору или проверьте настройки доступа в консоли разработчика.",
      details: {
        role: { success: false, comment: "Сервис недоступен" },
        context: { success: false, comment: "Сервис недоступен" },
        task: { success: false, comment: "Сервис недоступен" },
        format: { success: false, comment: "Сервис недоступен" },
      },
    };
  }
};
