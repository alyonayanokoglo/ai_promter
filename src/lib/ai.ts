const EVALUATION_API_URL =
  import.meta.env.VITE_EVALUATION_API_URL?.trim() || "/api/evaluate";

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
  try {
    const response = await fetch(EVALUATION_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        prompt,
        levelTitle,
        levelScenario,
      }),
    });

    const data = (await response.json()) as Partial<EvaluationResult> & {
      error?: string;
    };

    if (!response.ok) {
      if (response.status === 429) {
        return {
          score: 0,
          evaluationFailed: true,
          feedback:
            "Лимит запросов временно исчерпан. Попробуйте ещё раз позже или смените модель в настройках сервера.",
          details: {
            role: { success: false, comment: "Лимит запросов исчерпан" },
            context: { success: false, comment: "Лимит запросов исчерпан" },
            task: { success: false, comment: "Лимит запросов исчерпан" },
            format: { success: false, comment: "Лимит запросов исчерпан" },
          },
        };
      }

      return {
        score: 0,
        evaluationFailed: true,
        feedback:
          data.error ??
          "Сервис проверки недоступен. Проверьте настройки серверного API и ключа.",
        details: {
          role: { success: false, comment: "Проверка не выполнена" },
          context: { success: false, comment: "Проверка не выполнена" },
          task: { success: false, comment: "Проверка не выполнена" },
          format: { success: false, comment: "Проверка не выполнена" },
        },
      };
    }

    if (
      typeof data.score === "number" &&
      typeof data.feedback === "string" &&
      data.details
    ) {
      return {
        score: data.score,
        feedback: data.feedback,
        evaluationFailed: Boolean(data.evaluationFailed),
        details: data.details,
      };
    }

    return {
      score: 0,
      evaluationFailed: true,
      feedback:
        "Сервис вернул некорректный ответ. Проверьте конфигурацию backend API.",
      details: {
        role: { success: false, comment: "Ответ API не распознан" },
        context: { success: false, comment: "Ответ API не распознан" },
        task: { success: false, comment: "Ответ API не распознан" },
        format: { success: false, comment: "Ответ API не распознан" },
      },
    };
  } catch (error) {
    console.error("Evaluation API Error:", error);
    return {
      score: 0,
      evaluationFailed: true,
      feedback:
        "Не удалось связаться с сервисом оценки. Проверьте, что backend API развернут и доступен.",
      details: {
        role: { success: false, comment: "Ошибка соединения" },
        context: { success: false, comment: "Ошибка соединения" },
        task: { success: false, comment: "Ошибка соединения" },
        format: { success: false, comment: "Ошибка соединения" },
      },
    };
  }
};
