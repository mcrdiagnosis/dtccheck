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
    const { message, vehicle_info, analysis, dtc_code, history, locale } = await request.json();

    if (!message) {
      return NextResponse.json({ error: "Message required" }, { status: 400 });
    }

    const ai = getGenAI();
    const model = ai.getGenerativeModel({ model: "gemini-3.1-pro-preview" });

    const localeLangMap: Record<string, string> = {
      es: "español", en: "English", pt: "português",
    };
    const lang = localeLangMap[locale || "es"] || "español";

    const vehicleStr = vehicle_info
      ? `${vehicle_info.year} ${vehicle_info.make} ${vehicle_info.model} ${vehicle_info.engine || ""}`.trim()
      : "Unknown vehicle";

    let context = `Eres un mecánico automotriz experto. Respondes SIEMPRE en ${lang}.
Estás ayudando a diagnosticar un ${vehicleStr}.`;

    if (analysis) {
      context += `\n\nDiagnóstico actual:
- Códigos DTC: ${analysis.dtc_codes?.map((c: any) => `${c.code}: ${c.description}`).join("; ") || "N/A"}
- Causas probables: ${analysis.probable_causes?.map((c: any) => `${c.cause} (${c.probability}%)`).join("; ") || "N/A"}
- Soluciones: ${analysis.solutions?.map((s: any) => s.description).join("; ") || "N/A"}
- Resumen: ${analysis.summary || "N/A"}`;
    }

    if (dtc_code) {
      context += `\n\nEl usuario pregunta específicamente sobre el código DTC: ${dtc_code}.
Da información detallada sobre este código: qué significa, causas comunes, cómo diagnosticarlo, cómo repararlo, costo estimado, y si es urgente.`;
    }

    context += `\n\nResponde de forma clara y práctica. Usa bullets o pasos numerados cuando sea útil.`;

    const contents = [
      { role: "user" as const, parts: [{ text: context }] },
      { role: "model" as const, parts: [{ text: `Entendido. Soy tu mecánico experto para el ${vehicleStr}. ¿En qué puedo ayudarte?` }] },
      ...(history || []).map((h: any) => ({
        role: h.role === "assistant" ? "model" as const : "user" as const,
        parts: [{ text: h.content }],
      })),
      { role: "user" as const, parts: [{ text: message }] },
    ];

    const result = await model.generateContent({ contents });
    const response = result.response.text();

    return NextResponse.json({ response });
  } catch (error: any) {
    console.error("Chat error:", error);
    return NextResponse.json(
      { error: error.message || "Error en el chat" },
      { status: 500 }
    );
  }
}
