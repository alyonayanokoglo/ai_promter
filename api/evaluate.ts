type Criterion = { success: boolean; comment: string };

interface EvaluationResult {
  score: number;
  feedback: string;
  details: {
    role: Criterion;
    context: Criterion;
    task: Criterion;
    format: Criterion;
  };
}

interface IncomingBody {
  prompt?: string;
  levelTitle?: string;
  levelScenario?: string;
}

const DEFAULT_MODEL =
  process.env.CORP_AI_MODEL?.trim() ||
  process.env.DEEPSEEK_MODEL?.trim() ||
  "deepseek-chat";
const DEFAULT_BASE_URL =
  process.env.CORP_AI_BASE_URL?.trim() || "https://api.deepseek.com";
const DEFAULT_API_PATH =
  process.env.CORP_AI_API_PATH?.trim() || "/chat/completions";
const API_KEY =
  process.env.CORP_AI_API_KEY?.trim() || process.env.DEEPSEEK_API_KEY?.trim();

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}

function parseModelJson(text: string): EvaluationResult | null {
  try {
    const clean = text.replace(/```json|```/gi, "").trim();
    const parsed = JSON.parse(clean) as Partial<EvaluationResult>;
    if (
      typeof parsed.score === "number" &&
      typeof parsed.feedback === "string" &&
      parsed.details
    ) {
      return {
        score: Math.min(100, Math.max(0, parsed.score)),
        feedback: parsed.feedback,
        details: {
          role: parsed.details.role ?? { success: false, comment: "Нет данных" },
          context: parsed.details.context ?? { success: false, comment: "Нет данных" },
          task: parsed.details.task ?? { success: false, comment: "Нет данных" },
          format: parsed.details.format ?? { success: false, comment: "Нет данных" },
        },
      };
    }
  } catch {
    return null;
  }

  return null;
}

export default async function handler(request: Request): Promise<Response> {
  if (request.method !== "POST") {
    return jsonResponse(405, { error: "Method Not Allowed" });
  }

  if (!API_KEY) {
    return jsonResponse(500, {
      error:
        "Server API key is not configured. Set CORP_AI_API_KEY (or DEEPSEEK_API_KEY) in Vercel.",
    });
  }

  let body: IncomingBody;
  try {
    body = (await request.json()) as IncomingBody;
  } catch {
    return jsonResponse(400, { error: "Invalid JSON body." });
  }

  const prompt = body.prompt?.trim();
  const levelTitle = body.levelTitle?.trim();
  const levelScenario = body.levelScenario?.trim();

  if (!prompt || !levelTitle || !levelScenario) {
    return jsonResponse(400, {
      error: "prompt, levelTitle and levelScenario are required.",
    });
  }

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
`.trim();

  const baseUrl = DEFAULT_BASE_URL.endsWith("/")
    ? DEFAULT_BASE_URL.slice(0, -1)
    : DEFAULT_BASE_URL;
  const apiPath = DEFAULT_API_PATH.startsWith("/")
    ? DEFAULT_API_PATH
    : `/${DEFAULT_API_PATH}`;

  const modelResponse = await fetch(`${baseUrl}${apiPath}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: DEFAULT_MODEL,
      messages: [{ role: "user", content: systemPrompt }],
      temperature: 0.1,
    }),
  });

  const raw = (await modelResponse.json()) as {
    error?: { message?: string } | string;
    choices?: Array<{ message?: { content?: string } }>;
  };

  if (!modelResponse.ok) {
    const errorMessage =
      typeof raw.error === "string"
        ? raw.error
        : raw.error?.message || "LLM API request failed.";
    return jsonResponse(modelResponse.status, { error: errorMessage });
  }

  const content = raw.choices?.[0]?.message?.content?.trim();
  if (!content) {
    return jsonResponse(502, { error: "LLM API returned an empty response." });
  }

  const parsed = parseModelJson(content);
  if (!parsed) {
    return jsonResponse(502, {
      error: "Could not parse model output as evaluation JSON.",
    });
  }

  return jsonResponse(200, parsed);
}
