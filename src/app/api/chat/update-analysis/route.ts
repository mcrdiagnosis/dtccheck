import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

let genAI: GoogleGenerativeAI | null = null;

function getGenAI() {
  if (!genAI) {
    const apiKey = process.env.GOOGLE_GEMINI_API_KEY;
    if (!apiKey) throw new Error("GOOGLE_GEMINI_API_KEY is not configured");
    genAI = new GoogleGenerativeAI(apiKey);
  }
  return genAI;
}

export async function POST(request: NextRequest) {
  try {
    const { vehicle_info, current_analysis, chat_history, dtc_code, locale } = await request.json();

    if (!current_analysis || !chat_history || chat_history.length === 0) {
      return NextResponse.json({ error: "Missing required data" }, { status: 400 });
    }

    const ai = getGenAI();
    const model = ai.getGenerativeModel({
      model: "gemini-2.5-flash",
      tools: [{ googleSearch: {} } as any],
    });

    const localeLangMap: Record<string, string> = {
      es: "español", en: "English", pt: "português",
    };
    const lang = localeLangMap[locale || "es"] || "español";

    const vehicleStr = vehicle_info
      ? `${vehicle_info.year} ${vehicle_info.make} ${vehicle_info.model} ${vehicle_info.engine || ""}`.trim()
      : "Unknown vehicle";

    const chatSummary = chat_history
      .map((m: any) => `${m.role === "user" ? "Usuario" : "Mecánico IA"}: ${m.content}`)
      .join("\n");

    const userPrompt = `Eres un técnico automotriz experto. Tienes un diagnóstico existente para un ${vehicleStr} y has estado conversando con el dueño del vehículo. Basándote en la información NUEVA proporcionada por el usuario en el chat, actualiza el análisis.

    Códigos DTC: ${current_analysis.dtc_codes?.map((c: any) => `${c.code}: ${c.description}`).join(", ") || "N/A"}

    ANÁLISIS ACTUAL:
${JSON.stringify(current_analysis, null, 2)}

    CONVERSACIÓN CON EL USUARIO (usa la info nueva que el usuario aporta):
${chatSummary}

    ${dtc_code ? `Enfoque especial en el código: ${dtc_code}` : ""}

    INSTRUCCIONES:
    1. Incorpora la información nueva del usuario al análisis (causas confirmadas, síntomas observados, reparaciones ya intentadas, etc.)
    2. Ajusta las probabilidades de las causas según la nueva información
    3. Actualiza o agrega soluciones relevantes
    4. Actualiza las pruebas interactivas si la nueva información lo requiere
    5. Si el usuario confirmó la causa raíz, pon esa causa al 100% y ajusta el resto
    6. Mantén la misma estructura JSON exacta

    IMPORTANTISIMO:
    1. TODA tu respuesta DEBE estar en ${lang}.
    2. severity: "low", "medium", "high", "critical" (SIEMPRE en inglés)
    3. difficulty: "easy", "medium", "hard" (SIEMPRE en inglés)
    4. Los campos "sources" y urls deben ser URLs reales y completas. Si no tienes una URL real, pon string vacío "".
    5. video_resources: SOLO videos reales encontrados. Si no hay, array vacío [].

    Responde SOLO en JSON válido con la misma estructura exacta del análisis actual.`;

    const result = await model.generateContent(userPrompt);
    const response = result.response;
    const text = response.text();

    let analysis = null;
    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        let jsonStr = jsonMatch[0];
        jsonStr = jsonStr.replace(/,\s*([}\]])/g, "$1");
        jsonStr = jsonStr.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
        analysis = JSON.parse(jsonStr);
      }
    } catch {}
    if (!analysis) {
      return NextResponse.json({ error: "AI response is not valid JSON" }, { status: 500 });
    }

    try {
      const candidate = response.candidates?.[0];
      const groundingMeta = candidate?.groundingMetadata as any;
      const groundingChunks = groundingMeta?.groundingChunks || [];

      if (Array.isArray(groundingChunks) && groundingChunks.length > 0) {
        const realUrls: { title: string; url: string }[] = [];
        for (const chunk of groundingChunks) {
          if (chunk.web?.uri) {
            realUrls.push({ title: chunk.web?.title || "", url: chunk.web.uri });
          }
        }
        if (realUrls.length > 0) {
          for (const cause of analysis.probable_causes || []) {
            if (!cause.sources || cause.sources.length === 0) {
              cause.sources = realUrls.slice(0, 2).map((u: any) => u.url);
            }
          }
        }
      }
    } catch {}

    return NextResponse.json({ analysis });
  } catch (error: any) {
    console.error("Update analysis error:", error);
    return NextResponse.json(
      { error: error.message || "Error updating analysis" },
      { status: 500 }
    );
  }
}
