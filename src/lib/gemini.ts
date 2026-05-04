import { GoogleGenerativeAI } from "@google/generative-ai";
import type { AIAnalysis, VehicleInfo } from "@/types/diagnostic";
import { Part } from "@google/generative-ai";

const SYSTEM_PROMPT = `Eres un técnico automotriz experto. Analiza los códigos DTC proporcionados para el vehículo especificado.

Busca información en foros especializados usando la herramienta de búsqueda de Google.

Responde SIEMPRE en JSON válido con esta estructura exacta:
{
  "dtc_codes": [{"code": "P0301", "description": "Misfire en cilindro 1", "severity": "high"}],
  "vehicle_context": {"affected_systems": ["ignicion"]},
  "probable_causes": [
    {"cause": "Bobina defectuosa", "probability": 85, "sources": ["url"]}
  ],
  "solutions": [
    {
      "description": "Reemplazar bobina",
      "difficulty": "easy",
      "estimated_cost": "$30-80 USD",
      "steps": ["Paso 1...", "Paso 2..."],
      "sources": ["url"]
    }
  ],
      "sources": ["url"]
    }
  ],
  "interactive_tests": [
    {
      "id": "t1",
      "name": "Prueba de bobina de encendido",
      "description": "Verificar el funcionamiento de la bobina",
      "tools_needed": ["Multímetro", "Llave de bujías"],
      "steps": ["Retirar la bobina del cilindro 1", "Medir resistencia primaria (debe ser 0.3-1.0 ohm)", "Medir resistencia secundaria (debe ser 5000-15000 ohm)", "Comparar con especificaciones del fabricante"],
      "expected_result": "Resistencia dentro del rango especificado",
      "pass_implication": "La bobina está bien, investigar inyector o compresión",
      "fail_implication": "Reemplazar la bobina de encendido"
    }
  ],
  "forum_insights": [
    {"forum": "Reddit r/MechanicAdvice", "summary": "Usuarios reportan que este código comúnmente se resuelve cambiando la bobina", "url": "url"}
  ],
  "video_resources": [
    {"title": "Cómo diagnosticar código P0301 - Misfire cilindro 1", "url": "https://www.youtube.com/watch?v=xxx", "channel": "Canal Mecánico", "description": "Video que muestra paso a paso cómo diagnosticar y reparar el misfire en cilindro 1"}
  ],
  "summary": "Resumen ejecutivo del diagnóstico en 2-3 oraciones."
}

Asegúrate de que:
- Las causas estén ordenadas por probabilidad (mayor a menor)
- Cada solución tenga pasos detallados y específicos para el vehículo
- Las pruebas interactivas sean prácticas y seguras de realizar
- Incluyas fuentes reales de foros cuando sea posible
- Los costs sean estimaciones realistas
- Las URLs deben ser completas (con https://)
- Máximo 4 soluciones con máximo 4 pasos cada una
- Máximo 3 pruebas interactivas con máximo 4 pasos cada una
- video_resources: SOLO videos reales encontrados. Si no hay, array vacío []
- NUNCA inventes video IDs de YouTube
- CRÍTICO: Responde SOLO JSON válido, sin texto adicional. Sé conciso para no truncar la respuesta.`;

let genAI: GoogleGenerativeAI | null = null;

function safeJsonParse(raw: string): any {
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
    model: "gemini-3.1-pro-preview",
    systemInstruction: SYSTEM_PROMPT,
    tools: [{ googleSearch: {} } as any],
    generationConfig: { maxOutputTokens: 65536 },
  });
}

function getVisionModel() {
  const ai = getGenAI();
  return ai.getGenerativeModel({
    model: "gemini-3.1-pro-preview",
    generationConfig: { maxOutputTokens: 65536 },
  });
  return ai.getGenerativeModel({
    model: "gemini-3.1-pro-preview",
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
