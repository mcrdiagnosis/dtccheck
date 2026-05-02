import { GoogleGenerativeAI } from "@google/generative-ai";
import type { AIAnalysis, VehicleInfo } from "@/types/diagnostic";
import { Part } from "@google/generative-ai";

const SYSTEM_PROMPT = `Eres un técnico automotriz experto con más de 20 años de experiencia. Analiza los códigos DTC proporcionados para el vehículo especificado.

DEBES buscar información usando la herramienta de búsqueda de Google en:
1. Foros especializados: automotive-forums.com, mechanicadvice reddit, bimmerfest, toyota-nation, honda-tech, etc.
2. Videos de YouTube: busca videos que expliquen y muestren cómo diagnosticar y reparar el problema específico para este vehículo.

IMPORTANTE: Responde SIEMPRE en JSON válido con esta estructura exacta:
{
  "dtc_codes": [{"code": "P0301", "description": "Misfire en cilindro 1", "severity": "high"}],
  "vehicle_context": {"affected_systems": ["ignicion", "combustible"]},
  "probable_causes": [
    {"cause": "Bobina de encendido defectuosa", "probability": 85, "sources": ["url_del_foro"]},
    {"cause": "Bujía desgastada", "probability": 70, "sources": ["url"]}
  ],
  "solutions": [
    {
      "description": "Reemplazar bobina de encendido del cilindro 1",
      "difficulty": "easy",
      "estimated_cost": "$30-80 USD",
      "steps": ["Paso 1...", "Paso 2..."],
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
- INCLUYAS AL MENOS 3 videos de YouTube relevantes con URLs reales de búsqueda
- Los costs sean estimaciones realistas
- Los videos sean específicos para el vehículo y código DTC mencionado
- TODAS las URLs en sources, forum_insights.url, y video_resources.url sean URLs COMPLETAS (incluyendo https:// y la ruta completa), NO solo dominios
- Los campos "forum" en forum_insights deben ser el nombre del foro/hilo, y "url" debe ser la URL completa al hilo o post específico`;

let genAI: GoogleGenerativeAI | null = null;

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
    model: "gemini-2.0-flash",
    systemInstruction: SYSTEM_PROMPT,
    tools: [{ googleSearch: {} } as any],
  });
}

function getVisionModel() {
  const ai = getGenAI();
  return ai.getGenerativeModel({
    model: "gemini-2.5-flash",
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

  const prompt = `Lee este documento PDF de un escáner de diagnóstico vehicular.

EXTRAE TODOS los códigos de falla/diagnóstico que aparezcan en TODAS las secciones del documento.

Los códigos DTC SIEMPRE siguen estos formatos:
- Letra (P, C, B o U) + dígitos + opcionalmente una letra hexadecimal (A-F) al final
- Ejemplos válidos: P0301, P0420:00, C0035, C98A, C98B, B0001, U0100
- El formato es SIEMPRE: una letra P/C/B/U seguida de 2 a 4 dígitos, con una letra opcional (A-F) al final
- NO son códigos válidos: PBNS7, PJBU, BSXO, PQBB (tienen letras no hexadecimales mezcladas)

Organiza los códigos POR MÓDULO/SISTEMA si el documento los agrupa así (ej: ABS, Airbag, BSI, BSM, Motor, Transmisión, etc.).

Responde en ${lang}. Responde SOLO en JSON con este formato exacto:
{
  "codes": ["P0301", "C98A"],
  "modules": [
    { "module": "ABS", "codes": ["C0035"] },
    { "module": "BSI", "codes": ["C98A", "C98B"] }
  ],
  "rawText": "texto completo extraído del PDF"
}

Incluye TODO el texto que puedas leer del documento en rawText.
Es CRUCIAL que no omitas NINGÚN código. Solo incluye códigos que realmente aparezcan en el documento.`;

  const result = await model.generateContent([prompt, pdfPart]);
  const text = result.response.text();
  console.log("Gemini vision raw response:", text.substring(0, 500));

  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    return { codes: [], modules: [], rawText: text };
  }

  try {
    const parsed = JSON.parse(jsonMatch[0]);
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
  } catch {
    return { codes: [], modules: [], rawText: text };
  }
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
4. Para URLs de video_resources, usa SOLO URLs reales de YouTube. NO inventes video IDs.
Proporciona un análisis completo con búsqueda en foros reales. Responde SOLO en JSON válido.`;

  const result = await model.generateContent(userPrompt);

  const response = result.response;
  const text = response.text();

  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error("AI response is not valid JSON");
  }

  const analysis: AIAnalysis = JSON.parse(jsonMatch[0]);
  return analysis;
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

  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error("AI response is not valid JSON");
  }

  return JSON.parse(jsonMatch[0]);
}
