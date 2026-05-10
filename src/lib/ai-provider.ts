export type AIProvider = "gemini" | "zai";

export interface AIProviderConfig {
  provider: AIProvider;
  geminiKey: string;
  zaiKey: string;
  zaiBaseUrl: string;
  zaiModel: string;
}

export function getAIConfig(): AIProviderConfig {
  if (typeof window !== "undefined") {
    const stored = localStorage.getItem("ai_provider_config");
    if (stored) {
      try { return JSON.parse(stored); } catch {}
    }
  }
  return {
    provider: (typeof window !== "undefined" ? (localStorage.getItem("ai_provider") as AIProvider) : null) || "gemini",
    geminiKey: "",
    zaiKey: "",
    zaiBaseUrl: "https://open.bigmodel.cn/api/paas/v4",
    zaiModel: "glm-4-flash",
  };
}

export function saveAIConfig(config: Partial<AIProviderConfig>) {
  if (typeof window === "undefined") return;
  const current = getAIConfig();
  const updated = { ...current, ...config };
  localStorage.setItem("ai_provider_config", JSON.stringify(updated));
  localStorage.setItem("ai_provider", updated.provider);
}

export function getServerAIConfig(body?: Record<string, string>): AIProviderConfig {
  return {
    provider: (body?.provider as AIProvider) || "gemini",
    geminiKey: body?.geminiKey || process.env.GOOGLE_GEMINI_API_KEY || "",
    zaiKey: body?.zaiKey || process.env.ZAI_API_KEY || "",
    zaiBaseUrl: body?.zaiBaseUrl || process.env.ZAI_BASE_URL || "https://open.bigmodel.cn/api/paas/v4",
    zaiModel: body?.zaiModel || process.env.ZAI_MODEL || "glm-4-flash",
  };
}

export async function generateWithProvider(
  config: AIProviderConfig,
  options: {
    prompt: string;
    systemPrompt?: string;
    maxTokens?: number;
    temperature?: number;
    imageBase64?: string;
    imageMimeType?: string;
    googleSearch?: boolean;
  }
): Promise<string> {
  if (config.provider === "zai") {
    return generateWithZai(config, options);
  }
  return generateWithGemini(config, options);
}

async function generateWithGemini(
  config: AIProviderConfig,
  options: {
    prompt: string;
    systemPrompt?: string;
    maxTokens?: number;
    imageBase64?: string;
    imageMimeType?: string;
    googleSearch?: boolean;
  }
): Promise<string> {
  const { GoogleGenerativeAI } = await import("@google/generative-ai");
  const apiKey = config.geminiKey || process.env.GOOGLE_GEMINI_API_KEY;
  if (!apiKey) throw new Error("Gemini API key not configured");

  const ai = new GoogleGenerativeAI(apiKey);
  const tools: any[] = [];
  if (options.googleSearch) tools.push({ googleSearch: {} });

  const modelConfig: any = {
    model: "gemini-2.5-flash",
    generationConfig: { maxOutputTokens: options.maxTokens || 65536 },
  };
  if (options.systemPrompt) modelConfig.systemInstruction = options.systemPrompt;
  if (tools.length > 0) modelConfig.tools = tools;

  const model = ai.getGenerativeModel(modelConfig);

  const parts: any[] = [{ text: options.prompt }];
  if (options.imageBase64) {
    parts.push({
      inlineData: {
        mimeType: options.imageMimeType || "image/png",
        data: options.imageBase64,
      },
    });
  }

  const result = await model.generateContent(parts);
  return result.response.text();
}

async function generateWithZai(
  config: AIProviderConfig,
  options: {
    prompt: string;
    systemPrompt?: string;
    maxTokens?: number;
    temperature?: number;
    imageBase64?: string;
    imageMimeType?: string;
  }
): Promise<string> {
  const apiKey = config.zaiKey || process.env.ZAI_API_KEY;
  if (!apiKey) throw new Error("Z.ai API key not configured");

  const messages: any[] = [];

  if (options.systemPrompt) {
    messages.push({ role: "system", content: options.systemPrompt });
  }

  const userContent: any[] = [];
  if (options.imageBase64) {
    userContent.push({
      type: "image_url",
      image_url: { url: `data:${options.imageMimeType || "image/png"};base64,${options.imageBase64}` },
    });
  }
  userContent.push({ type: "text", text: options.prompt });

  messages.push({ role: "user", content: userContent.length === 1 && !options.imageBase64 ? options.prompt : userContent });

  const baseUrl = config.zaiBaseUrl || "https://open.bigmodel.cn/api/paas/v4";
  const model = config.zaiModel || "glm-4-flash";

  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages,
      max_tokens: options.maxTokens || 4096,
      temperature: options.temperature ?? 0.7,
    }),
    signal: AbortSignal.timeout(60000),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Z.ai API error (${res.status}): ${err}`);
  }

  const data = await res.json();
  return data.choices?.[0]?.message?.content || "";
}
