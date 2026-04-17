import { GoogleGenAI } from "@google/genai";

const API_KEY = import.meta.env.VITE_GEMINI_API_KEY?.trim() ?? "";

/** Имя модели: см. https://ai.google.dev/gemini-api/docs/models */
const GEMINI_MODEL =
  import.meta.env.VITE_GEMINI_MODEL?.trim() || "gemini-2.5-flash";

export interface EvaluationResult {
  score: number;
  feedback: string;
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
      feedback:
        "Не задан ключ API. Создайте файл .env.local в корне проекта с переменной VITE_GEMINI_API_KEY=ваш_ключ и перезапустите dev-сервер.",
      details: {
        role: { success: false, comment: "Ключ не настроен" },
        context: { success: false, comment: "Ключ не настроен" },
        task: { success: false, comment: "Ключ не настроен" },
        format: { success: false, comment: "Ключ не настроен" },
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
    // Fallback if key is invalid (as expected for this specific key)
    return {
      score: 10,
      feedback:
        "Ошибка API: проверьте ключ в Google AI Studio (ключ для Gemini API) и что в .env.local указан VITE_GEMINI_API_KEY.",
      details: {
        role: { success: false, comment: "Не удалось проверить" },
        context: { success: false, comment: "Не удалось проверить" },
        task: { success: false, comment: "Не удалось проверить" },
        format: { success: false, comment: "Не удалось проверить" },
      }
    };
  }
};
