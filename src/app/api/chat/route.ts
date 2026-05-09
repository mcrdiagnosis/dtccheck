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
    const { message, vehicle_info, analysis, dtc_code, history, locale, image_base64 } = await request.json();

    if (!message && !image_base64) {
      return NextResponse.json({ error: "Message required" }, { status: 400 });
    }

    const ai = getGenAI();
    const model = ai.getGenerativeModel({ model: "gemini-2.5-flash" });

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

    if (image_base64) {
      context += `\n\nEl usuario ha adjuntado una imagen. Analízala en el contexto del diagnóstico automotriz. Puede ser un diagrama eléctrico, una foto de un componente, un conector, etc. Describe lo que ves y cómo se relaciona con el problema.`;
    }

    context += `\n\nResponde de forma clara y práctica. Usa bullets o pasos numerados cuando sea útil.`;

    const contents = [
      { role: "user" as const, parts: [{ text: context }] },
      { role: "model" as const, parts: [{ text: `Entendido. Soy tu mecánico experto para el ${vehicleStr}. ¿En qué puedo ayudarte?` }] },
      ...(history || []).map((h: any) => ({
        role: h.role === "assistant" ? "model" as const : "user" as const,
        parts: [{ text: h.content }],
      })),
    ];

    const userParts: any[] = [];
    if (image_base64) {
      userParts.push({ inlineData: { mimeType: "image/jpeg", data: image_base64 } });
    }
    if (message) {
      userParts.push({ text: message });
    }
    contents.push({ role: "user" as const, parts: userParts });

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
