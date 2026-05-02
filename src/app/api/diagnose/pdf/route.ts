import { NextRequest, NextResponse } from "next/server";
import { extractTextFromPDF, extractDTCCodes, extractVehicleInfo } from "@/lib/pdf-parser";
import { analyzeDTCs, extractDTCsFromPDF } from "@/lib/gemini";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const pdfFile = formData.get("pdf") as File;
    const vehicleInfoStr = formData.get("vehicle_info") as string;

    if (!pdfFile) {
      return NextResponse.json({ error: "No PDF file" }, { status: 400 });
    }

    const vehicleInfo = vehicleInfoStr ? JSON.parse(vehicleInfoStr) : {};
    const locale = (formData.get("locale") as string) || "es";

    const buffer = Buffer.from(await pdfFile.arrayBuffer());

    let rawText = "";
    let dtcCodes: string[] = [];

    try {
      rawText = await extractTextFromPDF(buffer);
      dtcCodes = extractDTCCodes(rawText);
    } catch (err) {
      console.error("PDF text extraction error:", err);
    }

    let visionModules: { module: string; codes: string[] }[] = [];

    if (dtcCodes.length === 0 && rawText.trim().length > 10) {
      dtcCodes = extractDTCCodesLoose(rawText);
    }

    if (dtcCodes.length === 0) {
      console.log("Local extraction found no DTC codes, using Gemini vision...");
      try {
        const visionResult = await extractDTCsFromPDF(buffer, locale);
        if (visionResult.codes.length > 0) {
          dtcCodes = visionResult.codes;
          visionModules = visionResult.modules || [];
          if (!rawText || rawText.trim().length < 20) {
            rawText = visionResult.rawText;
          }
          console.log("Gemini vision extracted codes:", dtcCodes, "modules:", visionModules.map(m => m.module));
        } else if (visionResult.rawText) {
          rawText = visionResult.rawText;
          dtcCodes = extractDTCCodes(rawText);
          if (dtcCodes.length === 0) {
            dtcCodes = extractDTCCodesLoose(rawText);
          }
          visionModules = visionResult.modules || [];
        }
      } catch (visionErr) {
        console.error("Gemini vision extraction failed:", visionErr);
      }
    }

    if (dtcCodes.length === 0) {
      return NextResponse.json(
        { error: "No se encontraron códigos DTC en el PDF. El documento puede no contener códigos DTC o estar en un formato no legible. Intenta ingresar los códigos manualmente." },
        { status: 400 }
      );
    }

    const extractedVehicle = extractVehicleInfo(rawText);
    const mergedVehicle = {
      ...vehicleInfo,
      ...Object.fromEntries(Object.entries(extractedVehicle).filter(([, v]) => v)),
    };

    const moduleContext = visionModules.length > 0
      ? `\n\nEl escáner reportó códigos en estos módulos: ${visionModules.map(m => `${m.module} (${m.codes.join(", ")})`).join("; ")}.\nAnaliza TODOS los módulos, no solo los códigos OBD2 estándar.`
      : "";

    const aiAnalysis = await analyzeDTCs(dtcCodes, mergedVehicle, rawText + moduleContext, locale);

    const id = crypto.randomUUID();
    const diagnostic = {
      id,
      user_id: "anonymous",
      source: "pdf" as const,
      raw_text: rawText.substring(0, 5000),
      modules: visionModules,
      dtc_codes: aiAnalysis.dtc_codes,
      vehicle_info: mergedVehicle,
      ai_analysis: aiAnalysis,
      status: "completed" as const,
    };

    const supabase = await createClient();
    if (supabase) {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        diagnostic.user_id = user.id;
        const { error } = await supabase.from("diagnostics").insert(diagnostic);
        if (error) console.error("DB error:", error);
      }
    }

    return NextResponse.json(diagnostic);
  } catch (error: any) {
    console.error("PDF diagnosis error:", error);
    return NextResponse.json(
      { error: error.message || "Error procesando el PDF" },
      { status: 500 }
    );
  }
}

function extractDTCCodesLoose(text: string): string[] {
  const codes: Set<string> = new Set();

  const patterns = [
    /\b([PCBU]\d{2,4}[A-F]?)(?::\d{2})?\b/gi,
    /DTC[:\s]*([PCBU]\d{2,4}[A-F]?)/gi,
    /[Cc]odigo[:\s]*([PCBU]\d{2,4}[A-F]?)/gi,
    /[Ee]rror[:\s]*([PCBU]\d{2,4}[A-F]?)/gi,
    /[Ff]ault[:\s]*([PCBU]\d{2,4}[A-F]?)/gi,
    /[Dd]efecto[:\s]*([PCBU]\d{2,4}[A-F]?)/gi,
  ];

  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      const raw = match[1].toUpperCase();
      if (/^[PCBU]\d{2,4}[A-F]?$/.test(raw)) {
        codes.add(raw);
      }
    }
  }

  return [...codes];
}
