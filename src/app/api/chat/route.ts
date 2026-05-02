import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import type { AIAnalysis, VehicleInfo } from "@/types/diagnostic";

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

    let systemPrompt = `Eres un mecánico automotriz experto. Respondes SIEMPRE en ${lang}.
Estás ayudando a diagnosticar un ${vehicleStr}.`;

    if (analysis) {
      systemPrompt += `\n\nDiagnóstico actual:
- Códigos DTC: ${analysis.dtc_codes?.map((c: any) => `${c.code}: ${c.description}`).join("; ") || "N/A"}
- Causas probables: ${analysis.probable_causes?.map((c: any) => `${c.cause} (${c.probability}%)`).join("; ") || "N/A"}
- Soluciones: ${analysis.solutions?.map((s: any) => s.description).join("; ") || "N/A"}
- Resumen: ${analysis.summary || "N/A"}`;
    }

    if (dtc_code) {
      systemPrompt += `\n\nEl usuario pregunta específicamente sobre el código DTC: ${dtc_code}.
Danza información detallada sobre este código: qué significa, causas comunes, cómo diagnosticarlo, cómo repararlo, costo estimado, y si es urgente.`;
    }

    systemPrompt += `\n\nResponde de forma clara y práctica. Usa bullets o pasos numerados cuando sea útil. Si el usuario pregunta sobre algo no relacionado con mecánica, redirige la conversación al diagnóstico.`;

    const chatHistory = (history || []).map((h: any) => ({
      role: h.role,
      parts: [{ text: h.content }],
    }));

    const chat = model.startChat({
      history: [
        { role: "user", parts: [{ text: systemPrompt }] },
        { role: "model", parts: [{ text: `Entendido. Soy tu mecánico experto. Estoy listo para ayudarte con el diagnóstico del ${vehicleStr}. ¿En qué puedo ayudarte?` }] },
        ...chatHistory,
      ],
    });

    const result = await chat.sendMessage(message);
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
