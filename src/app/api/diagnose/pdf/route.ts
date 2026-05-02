import { NextRequest, NextResponse } from "next/server";
import { extractTextFromPDF, extractDTCCodes, extractVehicleInfo } from "@/lib/pdf-parser";
import { analyzeDTCs } from "@/lib/gemini";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const pdfFile = formData.get("pdf") as File;
    const vehicleInfoStr = formData.get("vehicle_info") as string;

    if (!pdfFile) {
      return NextResponse.json({ error: "No PDF file" }, { status: 400 });
    }

    const vehicleInfo = JSON.parse(vehicleInfoStr);

    const buffer = Buffer.from(await pdfFile.arrayBuffer());
    const rawText = await extractTextFromPDF(buffer);
    const dtcCodes = extractDTCCodes(rawText);
    const extractedVehicle = extractVehicleInfo(rawText);

    if (dtcCodes.length === 0) {
      return NextResponse.json(
        { error: "No se encontraron códigos DTC en el PDF" },
        { status: 400 }
      );
    }

    const mergedVehicle = {
      ...vehicleInfo,
      ...Object.fromEntries(Object.entries(extractedVehicle).filter(([, v]) => v)),
    };

    const aiAnalysis = await analyzeDTCs(dtcCodes, mergedVehicle, rawText);

    const id = crypto.randomUUID();
    const diagnostic = {
      id,
      user_id: "anonymous",
      source: "pdf" as const,
      raw_text: rawText.substring(0, 5000),
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
