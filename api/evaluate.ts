import "dotenv/config";
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

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

let localEnvCache: Record<string, string> | null = null;

function readLocalEnv(): Record<string, string> {
  if (localEnvCache) return localEnvCache;
  try {
    const raw = readFileSync(resolve(process.cwd(), ".env.local"), "utf8");
    const parsed: Record<string, string> = {};
    for (const line of raw.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eqIndex = trimmed.indexOf("=");
      if (eqIndex <= 0) continue;
      const key = trimmed.slice(0, eqIndex).trim();
      const value = trimmed.slice(eqIndex + 1).trim();
      if (key) parsed[key] = value;
    }
    localEnvCache = parsed;
    return parsed;
  } catch {
    localEnvCache = {};
    return localEnvCache;
  }
}

function getEnvVar(name: string): string | undefined {
  const direct = process.env[name]?.trim();
  if (direct) return direct;
  const fallback = readLocalEnv()[name]?.trim();
  return fallback || undefined;
}

function sendJson(res: VercelResponse, status: number, body: unknown): void {
  res.status(status).json(body);
}

function parseModelJson(text: string): EvaluationResult | null {
  function tryParseJson(input: string): EvaluationResult | null {
    try {
      const parsed = JSON.parse(input) as Partial<EvaluationResult>;
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
            context:
              parsed.details.context ?? { success: false, comment: "Нет данных" },
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

  function extractFirstJsonObject(input: string): string | null {
    const start = input.indexOf("{");
    if (start < 0) return null;

    let depth = 0;
    let inString = false;
    let escaped = false;

    for (let i = start; i < input.length; i += 1) {
      const char = input[i];

      if (inString) {
        if (escaped) {
          escaped = false;
        } else if (char === "\\") {
          escaped = true;
        } else if (char === "\"") {
          inString = false;
        }
        continue;
      }

      if (char === "\"") {
        inString = true;
        continue;
      }

      if (char === "{") depth += 1;
      if (char === "}") {
        depth -= 1;
        if (depth === 0) {
          return input.slice(start, i + 1);
        }
      }
    }

    return null;
  }

  try {
    const clean = text.replace(/```json|```/gi, "").trim();
    const direct = tryParseJson(clean);
    if (direct) return direct;

    const extracted = extractFirstJsonObject(clean);
    if (!extracted) return null;

    return tryParseJson(extracted);
  } catch {
    return null;
  }

  return null;
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
): Promise<void> {
  // Groq по умолчанию: для подключения достаточно CORP_AI_API_KEY.
  const defaultModel = getEnvVar("CORP_AI_MODEL") || "openai/gpt-oss-20b";
  const defaultBaseUrl =
    getEnvVar("CORP_AI_BASE_URL") || "https://api.groq.com/openai/v1";
  const defaultApiPath = getEnvVar("CORP_AI_API_PATH") || "/chat/completions";
  const apiKey = getEnvVar("CORP_AI_API_KEY");
  const maxTokens = Number(getEnvVar("CORP_AI_MAX_TOKENS") || 4096);

  if (req.method !== "POST") {
    sendJson(res, 405, { error: "Method Not Allowed" });
    return;
  }

  if (!apiKey) {
    sendJson(res, 500, {
      error:
        "Server API key is not configured. Set CORP_AI_API_KEY in Vercel.",
    });
    return;
  }

  const body = (req.body ?? {}) as IncomingBody;

  const prompt = body.prompt?.trim();
  const levelTitle = body.levelTitle?.trim();
  const levelScenario = body.levelScenario?.trim();

  if (!prompt || !levelTitle || !levelScenario) {
    sendJson(res, 400, {
      error: "prompt, levelTitle and levelScenario are required.",
    });
    return;
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

  const baseUrl = defaultBaseUrl.endsWith("/")
    ? defaultBaseUrl.slice(0, -1)
    : defaultBaseUrl;
  const apiPath = defaultApiPath.startsWith("/")
    ? defaultApiPath
    : `/${defaultApiPath}`;

  const modelResponse = await fetch(`${baseUrl}${apiPath}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: defaultModel,
      messages: [{ role: "user", content: systemPrompt }],
      max_completion_tokens: maxTokens,
      temperature: 0.1,
      top_p: 1,
      stream: false,
    }),
  });

  const raw = (await modelResponse.json()) as {
    error?: { message?: string } | string;
    message?: string;
    choices?: Array<{ message?: { content?: string } }>;
  };

  if (!modelResponse.ok) {
    const errorMessage =
      typeof raw.error === "string"
        ? raw.error
        : raw.error?.message || raw.message || "LLM API request failed.";
    sendJson(res, modelResponse.status, { error: errorMessage });
    return;
  }

  const content = raw.choices?.[0]?.message?.content?.trim();
  if (!content) {
    sendJson(res, 502, { error: "LLM API returned an empty response." });
    return;
  }

  const parsed = parseModelJson(content);
  if (!parsed) {
    sendJson(res, 502, {
      error: "Could not parse model output as evaluation JSON.",
    });
    return;
  }

  sendJson(res, 200, parsed);
}
