import { NextRequest, NextResponse } from "next/server";
import { safeJsonParse } from "@/lib/gemini";

export async function POST(request: NextRequest) {
  try {
    const { vehicle_info, current_analysis, chat_history, dtc_code, locale } = await request.json();

    if (!current_analysis || !chat_history || chat_history.length === 0) {
      return NextResponse.json({ error: "Missing required data" }, { status: 400 });
    }

    const apiKey = process.env.GOOGLE_GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "API key not configured" }, { status: 500 });
    }

    const { GoogleGenerativeAI } = await import("@google/generative-ai");
    const ai = new GoogleGenerativeAI(apiKey);

    const localeLangMap: Record<string, string> = {
      es: "español", en: "English", pt: "português",
    };
    const lang = localeLangMap[locale || "es"] || "español";

    const vehicleStr = vehicle_info
      ? `${vehicle_info.year} ${vehicle_info.make} ${vehicle_info.model} ${vehicle_info.engine || ""}`.trim()
      : "Unknown vehicle";

    const lastUserMsgs = chat_history
      .filter((m: any) => m.role === "user")
      .slice(-6)
      .map((m: any) => m.content);
    const lastAiMsgs = chat_history
      .filter((m: any) => m.role === "assistant")
      .slice(-6)
      .map((m: any) => m.content);

    const chatSummary = chat_history
      .slice(-12)
      .map((m: any) => `${m.role === "user" ? "Usuario" : "Mecánico IA"}: ${m.content}`)
      .join("\n");

    const slimAnalysis = { ...current_analysis };
    delete (slimAnalysis as any).video_resources;

    const userPrompt = `Eres un técnico automotriz experto. Actualiza el diagnóstico de un ${vehicleStr} con la información NUEVA del chat.

Códigos DTC: ${current_analysis.dtc_codes?.map((c: any) => `${c.code}: ${c.description}`).join(", ") || "N/A"}

ANÁLISIS ACTUAL:
${JSON.stringify(slimAnalysis)}

CHAT RECIENTE:
${chatSummary}

${dtc_code ? `Enfoque especial en: ${dtc_code}` : ""}

INSTRUCCIONES:
1. Incorpora la info nueva del usuario (causas confirmadas, síntomas, reparaciones intentadas)
2. Ajusta probabilidades según la nueva info
3. Si el usuario confirmó la causa raíz, ponla al 100%
4. Mantén la misma estructura JSON

REGLAS:
- Responde SOLO JSON válido, sin markdown
- Todo en ${lang}
- severity: "low", "medium", "high", "critical" (inglés)
- difficulty: "easy", "medium", "hard" (inglés)
- sources: URLs reales o string vacío ""
- video_resources: [] (no incluyas videos)`;

    let analysis: any = null;

    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const useSearch = attempt === 0;
        const model = ai.getGenerativeModel({
          model: "gemini-2.5-flash",
          tools: useSearch ? [{ googleSearch: {} } as any] : undefined,
          generationConfig: { maxOutputTokens: 65536 },
        });

        const result = await model.generateContent(userPrompt);
        const text = result.response.text();
        const reason = result.response.candidates?.[0]?.finishReason;

        console.log("Update analysis attempt", attempt + 1, "reason:", reason, "len:", text.length);

        if (!text || text.length < 5) continue;

        const parsed = safeJsonParse(text);
        if (parsed && typeof parsed === "object") {
          analysis = parsed;
          break;
        }
      } catch (e) {
        console.error("Update analysis attempt", attempt + 1, "error:", e);
      }
    }

    if (!analysis) {
      return NextResponse.json({ error: "Could not parse AI response after 3 attempts" }, { status: 500 });
    }

    if (current_analysis.video_resources) {
      analysis.video_resources = current_analysis.video_resources;
    }

    return NextResponse.json({ analysis });
  } catch (error: any) {
    console.error("Update analysis error:", error);
    return NextResponse.json(
      { error: error.message || "Error updating analysis" },
      { status: 500 }
    );
  }
}
