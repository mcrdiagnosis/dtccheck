import { GoogleGenerativeAI } from "@google/generative-ai";
import type { AIAnalysis, VehicleInfo, VideoResource } from "@/types/diagnostic";
import { Part } from "@google/generative-ai";

const SYSTEM_PROMPT = `Eres un técnico automotriz experto. Analiza los códigos DTC proporcionados para el vehículo.

Busca en foros y YouTube usando la herramienta de búsqueda de Google.

Responde SOLO JSON válido (sin markdown, sin texto extra):
{
  "summary": "Resumen ejecutivo en 2-3 oraciones.",
  "video_resources": [
    {"title": "Titulo", "url": "https://www.youtube.com/watch?v=ID_REAL", "channel": "Canal", "description": "Desc"}
  ],
  "dtc_codes": [{"code": "P0301", "description": "Desc", "severity": "high"}],
  "vehicle_context": {"affected_systems": ["sistema"]},
  "probable_causes": [
    {"cause": "Causa", "probability": 85, "sources": ["url"]}
  ],
  "solutions": [
    {"description": "Solucion", "difficulty": "easy", "estimated_cost": "$30", "steps": ["Paso1", "Paso2"], "sources": ["url"]}
  ],
  "interactive_tests": [
    {"id": "t1", "name": "Prueba", "description": "Desc", "tools_needed": ["Tool"], "steps": ["P1", "P2"], "expected_result": "Esperado", "pass_implication": "Si pasa", "fail_implication": "Si falla"}
  ],
  "forum_insights": [
    {"forum": "Foro", "summary": "Resumen", "url": "url"}
  ]
}

Reglas:
- severity: "low", "medium", "high", "critical"
- difficulty: "easy", "medium", "hard"
- Max 3 causas, 2 soluciones con max 4 pasos, 2 pruebas con max 4 pasos
- video_resources: busca videos REALES de YouTube. SOLO IDs reales (11 chars). Si no encontraste, array vacio []
- URLs completas con https://
- Sé CONCISO`;

let genAI: GoogleGenerativeAI | null = null;

export function safeJsonParse(raw: string): any {
  let text = raw;
  const mdMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (mdMatch) text = mdMatch[1].trim();
  text = text.replace(/```/g, "");
  let jsonStr = text.trim();
  if (!jsonStr.startsWith("{")) {
    const m = jsonStr.match(/\{[\s\S]*/);
    if (m) jsonStr = m[0];
  }

  const findBalanced = (s: string): string | null => {
    const first = s.indexOf("{");
    if (first === -1) return null;
    let depth = 0, inStr = false, esc = false;
    for (let i = first; i < s.length; i++) {
      const c = s[i];
      if (esc) { esc = false; continue; }
      if (c === "\\") { esc = true; continue; }
      if (c === '"') { inStr = !inStr; continue; }
      if (inStr) continue;
      if (c === "{") depth++;
      else if (c === "}") { depth--; if (depth === 0) return s.substring(first, i + 1); }
    }
    return null;
  };

  const balanced = findBalanced(jsonStr);
  if (balanced) {
    try { return JSON.parse(balanced); } catch {}
    const cleaned = balanced.replace(/,\s*([}\]])/g, "$1");
    try { return JSON.parse(cleaned); } catch {}
  }

  console.log("Attempting truncation recovery, raw length:", raw.length);
  let s = jsonStr.trimEnd();
  const stack: string[] = [];
  let inStr = false, esc = false;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (esc) { esc = false; continue; }
    if (c === "\\") { esc = true; continue; }
    if (c === '"') { inStr = !inStr; continue; }
    if (inStr) continue;
    if (c === "{" || c === "[") stack.push(c);
    else if (c === "}" && stack[stack.length - 1] === "{") stack.pop();
    else if (c === "]" && stack[stack.length - 1] === "[") stack.pop();
  }
  if (inStr) s += '"';
  s = s.trimEnd();
  if (s.endsWith(",")) s = s.slice(0, -1).trimEnd();
  if (/"[^"]*"\s*:\s*$/.test(s)) s += "null";
  if (s.endsWith(":")) s = s.slice(0, -1).trimEnd();
  if (s.endsWith(",")) s = s.slice(0, -1).trimEnd();
  for (let i = stack.length - 1; i >= 0; i--) {
    s += stack[i] === "{" ? "}" : "]";
  }
  s = s.replace(/,\s*([}\]])/g, "$1");
  try {
    const result = JSON.parse(s);
    console.log("Truncation recovery succeeded");
    return result;
  } catch (e) {
    console.error("Truncation recovery failed:", (e as Error).message);
  }

  console.error("safeJsonParse FAILED. Raw length:", raw.length);
  console.error("Raw first 3000:", raw.substring(0, 3000));
  return null;
}

function getGenAI() {
  if (!genAI) {
    const apiKey = process.env.GOOGLE_GEMINI_API_KEY;
    if (!apiKey) throw new Error("GOOGLE_GEMINI_API_KEY is not configured");
    genAI = new GoogleGenerativeAI(apiKey);
  }
  return genAI;
}

function getModel() {
  const ai = getGenAI();
  return ai.getGenerativeModel({
    model: "gemini-2.5-flash",
    systemInstruction: SYSTEM_PROMPT,
    tools: [{ googleSearch: {} } as any],
    generationConfig: { maxOutputTokens: 65536 },
  });
}

function getVisionModel() {
  const ai = getGenAI();
  return ai.getGenerativeModel({
    model: "gemini-2.5-flash",
    generationConfig: { maxOutputTokens: 65536 },
  });
}

export async function extractDTCsFromPDF(
  pdfBuffer: Buffer,
  locale?: string
): Promise<{ codes: string[]; modules: { module: string; codes: string[] }[]; rawText: string }> {
  const model = getVisionModel();

  const localeLangMap: Record<string, string> = {
    es: "español", en: "English", pt: "português",
  };
  const lang = localeLangMap[locale || "es"] || "español";

  const pdfPart: Part = {
    inlineData: {
      mimeType: "application/pdf",
      data: pdfBuffer.toString("base64"),
    },
  };

  const prompt = `Lee este documento PDF de un escáner de diagnóstico vehicular con MÁXIMO DETALLE.

Extrae TODA la información posible de CADA sección, página y módulo del documento.

INFORMACIÓN A EXTRAER:
1. Nombre EXACTO de cada módulo/sistema tal como aparece en el informe (ej: "Antiblocaque de rueda (ABS) o control dinámico de estabilidad (ESP) -- ESPMK60_0", "Caja de servicio inteligente -- BSI", "Caja de servicio motor -- BSM")
2. TODOS los códigos DTC con su descripción EXACTA tal como aparece
3. Estado de cada código si aparece (presente/permanente, intermitente, memorizado, etc.)
4. Cualquier dato del vehículo: VIN, número de escáner, fecha, versión de software
5. Cualquier valor, medición o dato técnico que aparezca

Los códigos DTC siguen estos formatos:
- Letra (P, C, B o U) + 2 a 4 dígitos + opcionalmente una letra (A-F)
- Ejemplos: P0301, P0420:00, C0035, C98A, C98B, C1389, C1391

Responde en ${lang}. Responde SOLO en JSON con este formato:
{
  "codes": ["C98A", "C98B", "C1389", "C1391"],
  "modules": [
    {
      "module": "Nombre EXACTO del módulo como aparece en el PDF",
      "codes": ["C98A", "C98B"],
      "descriptions": {
        "C98A": "Descripción exacta del código C98A como aparece en el informe",
        "C98B": "Descripción exacta del código C98B como aparece en el informe"
      },
      "details": "Información adicional de este módulo (estado, versiones, etc.)"
    }
  ],
  "vehicleInfo": {
    "vin": "VIN si aparece",
    "scannerInfo": "Modelo/version del escáner si aparece",
    "date": "Fecha del diagnóstico si aparece"
  },
  "rawText": "TEXTO COMPLETO y detallado de todo el documento, sección por sección, manteniendo el formato original"
}

Es CRUCIAL:
- No omitas NINGÚN código de NINGÚN módulo
- Copia los nombres de módulos EXACTAMENTE como aparecen
- Incluye TODAS las descripciones de cada código
- En rawText incluye TODO el texto legible del documento completo`;

  const result = await model.generateContent([prompt, pdfPart]);
  const text = result.response.text();
  console.log("Gemini vision raw response:", text.substring(0, 500));

  const parsed = safeJsonParse(text);
  if (!parsed) {
    return { codes: [], modules: [], rawText: text };
  }

  const isValidCode = (c: string) => /^[PCBU][0-9A-F]{2,4}$/i.test(c) || /^[PCBU]\d{2,4}[A-F]$/i.test(c);
  const allCodes = (parsed.codes || []).filter(isValidCode).map((c: string) => c.toUpperCase());
  return {
    codes: allCodes,
    modules: (parsed.modules || []).map((m: any) => ({
      module: m.module,
      codes: (m.codes || []).filter(isValidCode).map((c: string) => c.toUpperCase()),
    })),
    rawText: parsed.rawText || "",
  };
}

export async function analyzeDTCs(
  dtcCodes: string[],
  vehicleInfo: VehicleInfo,
  rawText?: string,
  locale?: string
): Promise<AIAnalysis> {
  const model = getModel();

  const vehicleStr = `${vehicleInfo.year} ${vehicleInfo.make} ${vehicleInfo.model} ${vehicleInfo.engine || ""}`.trim();
  const codesStr = dtcCodes.join(", ");

  const moduleMap: Record<string, string> = {
    engine: "Motor / Tren de potencia",
    transmission: "Transmisión",
    abs: "ABS / Sistema de frenos",
    airbag: "Airbag / SRS / Seguridad pasiva",
    body: "Carrocería / Body",
    chassis: "Chasis / Suspensión / Dirección",
    network: "Comunicación / CAN bus / Red del vehículo",
    emissions: "Emisiones / Sistema EVAP",
    fuel: "Sistema de combustible / Inyección",
    ignition: "Sistema de encendido",
  };

  let userPrompt = `Analiza los siguientes códigos DTC para un vehículo ${vehicleStr}:

Códigos DTC: ${codesStr}`;

  if (vehicleInfo.module && vehicleInfo.module !== "other") {
    const moduleLabel = moduleMap[vehicleInfo.module] || vehicleInfo.module;
    userPrompt += `\n\nSistema/Módulo de referencia: ${moduleLabel}
Enfoca el análisis específicamente en este sistema. Las pruebas interactivas deben ser relevantes para ${moduleLabel}.`;
  }

  if (rawText) {
    userPrompt += `\n\nTexto adicional del escáner:\n${rawText.substring(0, 3000)}`;
  }

  const localeLangMap: Record<string, string> = {
    es: "español",
    en: "English",
    pt: "português",
  };
  const responseLang = localeLangMap[locale || "es"] || "español";

  userPrompt += `\n\nIMPORTANTISIMO:
1. TODA tu respuesta (descripciones, causas, soluciones, pruebas, resumen, etc.) DEBE estar en ${responseLang}.
2. Los campos del JSON permanecen en inglés como nombres de clave, pero los VALORES deben estar en ${responseLang}.
3. EXCEPCIÓN: Los campos "severity" y "difficulty" DEBEN usar SIEMPRE estos valores exactos en inglés:
   - severity: "low", "medium", "high", "critical" (NUNCA usar traducciones)
   - difficulty: "easy", "medium", "hard" (NUNCA usar traducciones)
4. Para sources y urls: usa SOLO URLs reales y completas (con path completo) que hayas encontrado en tu búsqueda. Si no tienes una URL real, pon un string vacío "". NUNCA inventes URLs.
5. Para video_resources: incluye SOLO videos de YouTube que hayas encontrado realmente en tu búsqueda. Si no encontraste videos reales, devuelve un array vacío. NUNCA inventes video IDs.
6. Los campos "sources" en probable_causes y solutions deben contener URLs completas (https://dominio.com/path/to/thread), NO solo dominios.
Proporciona un análisis completo con búsqueda en foros reales.
CRÍTICO: Tu respuesta DEBE ser ÚNICAMENTE JSON válido. NO incluyas texto antes ni después del JSON. NO uses markdown code blocks. Responde SOLO el objeto JSON.`;

  for (let attempt = 0; attempt < 3; attempt++) {
    const result = await model.generateContent(userPrompt);
    const response = result.response;
    const text = response.text();
    console.log("analyzeDTCs attempt", attempt + 1, "response length:", text.length, "first 200:", text.substring(0, 200));

    const analysis: AIAnalysis = safeJsonParse(text);
    if (analysis && analysis.dtc_codes?.length > 0) {
      try {
        const candidate = response.candidates?.[0];
        const groundingMeta = (candidate?.groundingMetadata as any);
        const groundingChunks = groundingMeta?.groundingChunks || groundingMeta?.searchEntryPoint?.renderedContent;

        if (groundingChunks && Array.isArray(groundingChunks)) {
          const realUrls: { title: string; url: string }[] = [];
          for (const chunk of groundingChunks) {
            if (chunk.web?.uri) {
              realUrls.push({ title: chunk.web?.title || "", url: chunk.web.uri });
            }
          }

          if (realUrls.length > 0) {
            for (const cause of analysis.probable_causes || []) {
              if (!cause.sources || cause.sources.length === 0 || cause.sources.every((s: string) => !s.startsWith("http") || s.split("/").length < 4)) {
                const relevant = realUrls
                  .filter(u => u.title.toLowerCase().includes(cause.cause.toLowerCase().split(" ").slice(0, 3).join(" ")) || cause.cause.toLowerCase().split(" ").some(w => u.title.toLowerCase().includes(w)))
                  .slice(0, 2);
                cause.sources = relevant.length > 0 ? relevant.map(u => u.url) : realUrls.slice(0, 2).map(u => u.url);
              } else {
                cause.sources = cause.sources.map((s: string) => {
                  if (!s.startsWith("http") || s.split("/").length < 4) {
                    const match = realUrls.find(u => u.title.toLowerCase().includes(s.toLowerCase()) || s.toLowerCase().includes(u.title.toLowerCase()));
                    return match ? match.url : s;
                  }
                  return s;
                });
              }
            }

            for (const insight of analysis.forum_insights || []) {
              if (!insight.url || !insight.url.startsWith("http") || insight.url.split("/").length < 4) {
                const match = realUrls.find(u =>
                  u.title.toLowerCase().includes(insight.forum.toLowerCase().split(" ")[0]) ||
                  insight.summary.toLowerCase().split(" ").some(w => w.length > 4 && u.title.toLowerCase().includes(w))
                );
                if (match) insight.url = match.url;
              }
            }

            for (const sol of analysis.solutions || []) {
              if (!sol.sources || sol.sources.length === 0) {
                sol.sources = realUrls.slice(0, 1).map(u => u.url);
              }
            }
          }
        }
      } catch (e) {
        console.error("Grounding metadata extraction error:", e);
      }

      return analysis;
    }

    console.warn("analyzeDTCs attempt", attempt + 1, "failed, parsed:", !!analysis, "dtc_codes:", analysis?.dtc_codes?.length || 0);
  }

  throw new Error("AI response is not valid JSON after 3 attempts");
}

export async function reanalyzeWithTestResults(
  originalAnalysis: AIAnalysis,
  vehicleInfo: VehicleInfo,
  testResults: { test_id: string; test_name: string; status: string; user_notes: string }[],
  locale?: string
): Promise<AIAnalysis> {
  const model = getModel();

  const vehicleStr = `${vehicleInfo.year} ${vehicleInfo.make} ${vehicleInfo.model}`.trim();

  const testSummary = testResults
    .map((t) => `- ${t.test_name}: ${t.status}${t.user_notes ? ` (${t.user_notes})` : ""}`)
    .join("\n");

  const localeLangMap: Record<string, string> = {
    es: "español",
    en: "English",
    pt: "português",
  };
  const responseLang = localeLangMap[locale || "es"] || "español";

  const userPrompt = `Re-analiza el diagnóstico para un ${vehicleStr} con los siguientes resultados de pruebas:

Códigos originales: ${originalAnalysis.dtc_codes.map((c) => c.code).join(", ")}

Resultados de pruebas:
${testSummary}

IMPORTANTISIMO: TODA tu respuesta DEBE estar en ${responseLang}. Los campos del JSON permanecen en inglés como nombres de clave, pero los VALORES deben estar en ${responseLang}.

Basándote en estos resultados, actualiza las causas probables y soluciones. Responde SOLO en JSON válido con la misma estructura.`;

  const result = await model.generateContent(userPrompt);

  const response = result.response;
  const text = response.text();

  const parsed = safeJsonParse(text);
  if (!parsed) {
    throw new Error("AI response is not valid JSON");
  }

  return parsed;
}

export async function searchYouTubeVideos(
  dtcCodes: string[],
  vehicleInfo: VehicleInfo,
  locale?: string
): Promise<VideoResource[]> {
  const ai = getGenAI();
  const vehicleStr = `${vehicleInfo.year} ${vehicleInfo.make} ${vehicleInfo.model} ${vehicleInfo.engine || ""}`.trim();
  const codesStr = dtcCodes.join(", ");

  const prompt = `Busca videos de YouTube reales sobre diagnosticar o reparar codigos ${codesStr} en ${vehicleStr}.

Usa la herramienta de busqueda para encontrar videos reales en YouTube.

Responde SOLO un array JSON (sin markdown, sin texto extra):
[
  {"title": "Titulo del video", "url": "https://www.youtube.com/watch?v=XXXXXXXXXXX", "channel": "Canal", "description": "Descripcion"}
]

REGLAS:
- Los IDs de video (XXXXXXXXXXX) deben ser reales, de 11 caracteres
- Si no encontraste videos reales, responde: []
- NUNCA inventes IDs`;

  const models = [
    { model: "gemini-2.5-flash" as const, tools: true },
    { model: "gemini-2.5-flash" as const, tools: false },
    { model: "gemini-3.1-pro-preview" as const, tools: true },
    { model: "gemini-3.1-pro-preview" as const, tools: false },
  ];

  for (let i = 0; i < models.length; i++) {
    try {
      const m = models[i];
      const model = ai.getGenerativeModel({
        model: m.model,
        tools: m.tools ? [{ googleSearch: {} } as any] : undefined,
        generationConfig: { maxOutputTokens: 8192 },
      });

      const result = await model.generateContent(prompt);
      const text = result.response.text();
      const reason = result.response.candidates?.[0]?.finishReason;

      console.log("YT search", m.model, "tools:", m.tools, "reason:", reason, "len:", text.length);

      if (!text || text.length < 5) continue;

      const parsed = safeJsonParse(text);
      let videos: any[] = [];
      if (Array.isArray(parsed)) videos = parsed;
      else if (parsed?.video_resources) videos = parsed.video_resources;

      const withUrl = videos.filter((v: any) => v.url?.includes("youtube.com/watch") && v.title);
      if (withUrl.length > 0) {
        console.log("YT search found", withUrl.length, "videos with", m.model);
        return withUrl;
      }
    } catch (e) {
      console.error("YT search error:", e);
    }
  }

  console.log("YT search: no videos found after all attempts");
  return [];
}

async function validateYouTubeId(videoId: string): Promise<boolean> {
  try {
    const res = await fetch(`https://img.youtube.com/vi/${videoId}/mqdefault.jpg`, {
      method: "HEAD",
      signal: AbortSignal.timeout(3000),
    });
    return res.ok && (res.headers.get("content-type")?.startsWith("image/") ?? false);
  } catch {
    return false;
  }
}

export async function validateVideoResources(
  videos: VideoResource[],
  dtcCodes?: string[],
  vehicleInfo?: VehicleInfo,
  locale?: string
): Promise<VideoResource[]> {
  if (!videos || videos.length === 0) return [];

  const validated = await Promise.all(
    videos.map(async (v) => {
      const match = v.url?.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]+)/);
      if (!match) return null;
      const videoId = match[1];
      const valid = await validateYouTubeId(videoId);
      if (valid) return v;
      console.log("Invalid YT ID:", videoId, "- will search for replacement");
      return { ...v, _invalid: true as const, _videoId: videoId };
    })
  );

  const hasInvalid = validated.some((v: any) => v?._invalid);
  if (hasInvalid && dtcCodes && vehicleInfo) {
    console.log("Searching replacement videos for", dtcCodes.join(","));
    const replacements = await searchYouTubeVideos(dtcCodes, vehicleInfo, locale);

    if (replacements.length > 0) {
      const replacementValidated = await Promise.all(
        replacements.map(async (r) => {
          const m = r.url?.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]+)/);
          if (!m) return null;
          const ok = await validateYouTubeId(m[1]);
          return ok ? r : null;
        })
      );
      const good = replacementValidated.filter(Boolean) as VideoResource[];
      if (good.length > 0) {
        console.log("Found", good.length, "valid replacement videos");
        return good;
      }
    }
  }

  return validated
    .filter(Boolean)
    .map((v: any) => {
      if (v._invalid) {
        const searchQuery = encodeURIComponent(`${v.title} ${v.channel || ""}`);
        return { ...v, url: `https://www.youtube.com/results?search_query=${searchQuery}` };
      }
      return v;
    }) as VideoResource[];
}
