import { GoogleGenerativeAI } from "@google/generative-ai";
import type { AIAnalysis, VehicleInfo } from "@/types/diagnostic";

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
- Los videos sean específicos para el vehículo y código DTC mencionado`;

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

  userPrompt += `\n\nIMPORTANTISIMO: TODA tu respuesta (descripciones, causas, soluciones, pruebas, resumen, etc.) DEBE estar en ${responseLang}. Los campos del JSON permanecen en inglés como nombres de clave, pero los VALORES deben estar en ${responseLang}. Proporciona un análisis completo con búsqueda en foros reales. Responde SOLO en JSON válido.`;

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
  testResults: { test_id: string; test_name: string; status: string; user_notes: string }[]
): Promise<AIAnalysis> {
  const model = getModel();

  const vehicleStr = `${vehicleInfo.year} ${vehicleInfo.make} ${vehicleInfo.model}`.trim();

  const testSummary = testResults
    .map((t) => `- ${t.test_name}: ${t.status}${t.user_notes ? ` (${t.user_notes})` : ""}`)
    .join("\n");

  const userPrompt = `Re-analiza el diagnóstico para un ${vehicleStr} con los siguientes resultados de pruebas:

Códigos originales: ${originalAnalysis.dtc_codes.map((c) => c.code).join(", ")}

Resultados de pruebas:
${testSummary}

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
