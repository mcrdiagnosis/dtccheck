import { NextRequest, NextResponse } from "next/server";
import { extractVehicleInfo } from "@/lib/pdf-parser";
import { analyzeDTCs, extractDTCsFromPDF, searchYouTubeVideos, validateVideoResources, searchVehicleReferences, generateVehicleTechnicalData, fetchExternalFuseDiagrams } from "@/lib/gemini";
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

    console.log("Extracting DTC codes from PDF via Gemini vision...");
    const visionResult = await extractDTCsFromPDF(buffer, locale);
    const dtcCodes = visionResult.codes;
    const rawText = visionResult.rawText || "";
    const visionModules = visionResult.modules || [];

    console.log("Extracted codes:", dtcCodes, "modules:", visionModules.map(m => m.module).join(", "));

    if (dtcCodes.length === 0) {
      return NextResponse.json(
        { error: "No se encontraron códigos DTC en el PDF. Intenta ingresar los códigos manualmente." },
        { status: 400 }
      );
    }

    const extractedVehicle = extractVehicleInfo(rawText);
    const mergedVehicle = {
      ...vehicleInfo,
      ...Object.fromEntries(Object.entries(extractedVehicle).filter(([, v]) => v)),
    };

    const moduleContext = visionModules.length > 0
      ? `\n\nEl escáner reportó códigos agrupados por módulo: ${visionModules.map(m => `${m.module}: ${m.codes.join(", ")}`).join("; ")}.\nAnaliza TODOS los módulos.`
      : "";

    const aiAnalysis = await analyzeDTCs(dtcCodes, mergedVehicle, rawText + moduleContext, locale);

    if (!aiAnalysis.video_resources || aiAnalysis.video_resources.length === 0) {
      console.log("No videos in analysis, searching YouTube...");
      const videos = await searchYouTubeVideos(dtcCodes, mergedVehicle, locale);
      aiAnalysis.video_resources = videos;
    } else {
      console.log("Videos found in analysis:", aiAnalysis.video_resources.length);
    }

    if (aiAnalysis.video_resources && aiAnalysis.video_resources.length > 0) {
      aiAnalysis.video_resources = await validateVideoResources(
        aiAnalysis.video_resources, dtcCodes, mergedVehicle, locale
      );
    }

    console.log("Searching vehicle references & technical data...");
    try {
      const [refs, techData] = await Promise.all([
        searchVehicleReferences(dtcCodes, mergedVehicle, locale),
        generateVehicleTechnicalData(dtcCodes, mergedVehicle, locale),
      ]);
      if (refs.length > 0) aiAnalysis.vehicle_references = refs;
      if (techData.fuse_boxes.length > 0) aiAnalysis.fuse_boxes = techData.fuse_boxes;
      if (techData.relays.length > 0) aiAnalysis.relays = techData.relays;
      if (techData.component_locations.length > 0) aiAnalysis.component_locations = techData.component_locations;

      if (aiAnalysis.fuse_boxes && aiAnalysis.fuse_boxes.length > 0) {
        try {
          const enhanced = await fetchExternalFuseDiagrams(mergedVehicle, aiAnalysis.fuse_boxes);
          aiAnalysis.fuse_boxes = enhanced;
        } catch (e) {
          console.error("External fuse diagram fetch failed (non-blocking):", e);
        }
      }
    } catch (e) {
      console.error("Vehicle data search failed (non-blocking):", e);
    }

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

    try {
      const supabase = await createClient();
      if (supabase) {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          diagnostic.user_id = user.id;
          const { error } = await supabase.from("diagnostics").insert(diagnostic);
          if (error && error.code !== "PGRST205") console.error("DB error:", error);
        }
      }
    } catch {}

    return NextResponse.json(diagnostic);
  } catch (error: any) {
    console.error("PDF diagnosis error:", error);
    return NextResponse.json(
      { error: error.message || "Error procesando el PDF" },
      { status: 500 }
    );
  }
}
