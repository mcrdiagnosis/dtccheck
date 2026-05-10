import { NextRequest, NextResponse } from "next/server";
import { analyzeDTCs, searchYouTubeVideos, validateVideoResources, analyzeDiagramImage, searchVehicleReferences, generateVehicleTechnicalData, fetchExternalFuseDiagrams } from "@/lib/gemini";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  try {
    const contentType = request.headers.get("content-type") || "";
    let dtc_codes: string[], vehicle_info: any, locale: string, diagramFile: File | null = null;

    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      dtc_codes = JSON.parse(formData.get("dtc_codes") as string || "[]");
      vehicle_info = JSON.parse(formData.get("vehicle_info") as string || "{}");
      locale = (formData.get("locale") as string) || "es";
      diagramFile = formData.get("diagram") as File | null;
    } else {
      const body = await request.json();
      dtc_codes = body.dtc_codes;
      vehicle_info = body.vehicle_info;
      locale = body.locale;
    }

    if (!dtc_codes?.length || !vehicle_info?.make || !vehicle_info?.model) {
      return NextResponse.json(
        { error: "Códigos DTC e información del vehículo son requeridos" },
        { status: 400 }
      );
    }

    const dtcArray: string[] = Array.isArray(dtc_codes)
      ? dtc_codes
      : (dtc_codes as unknown as string).split(",").map((c: string) => c.trim().toUpperCase());

    const aiAnalysis = await analyzeDTCs(dtcArray, vehicle_info, undefined, locale);

    if (!aiAnalysis.video_resources || aiAnalysis.video_resources.length === 0) {
      console.log("No videos in analysis, searching YouTube...");
      const videos = await searchYouTubeVideos(dtcArray, vehicle_info, locale);
      aiAnalysis.video_resources = videos;
    } else {
      console.log("Videos found in analysis:", aiAnalysis.video_resources.length);
    }

    if (aiAnalysis.video_resources && aiAnalysis.video_resources.length > 0) {
      aiAnalysis.video_resources = await validateVideoResources(
        aiAnalysis.video_resources, dtcArray, vehicle_info, locale
      );
    }

    if (diagramFile) {
      console.log("Diagram image provided, analyzing...");
      const mimeType = diagramFile.type || "image/jpeg";
      const buffer = Buffer.from(await diagramFile.arrayBuffer());
      const base64 = buffer.toString("base64");
      const diagramAnalysis = await analyzeDiagramImage(base64, mimeType, dtcArray, vehicle_info, locale);
      if (diagramAnalysis) {
        diagramAnalysis.image_base64 = base64;
        aiAnalysis.diagram_analysis = diagramAnalysis;
      }
    }

    console.log("Searching vehicle references & technical data...");
    try {
      const [refs, techData] = await Promise.all([
        searchVehicleReferences(dtcArray, vehicle_info, locale),
        generateVehicleTechnicalData(dtcArray, vehicle_info, locale),
      ]);
      if (refs.length > 0) aiAnalysis.vehicle_references = refs;
      if (techData.fuse_boxes.length > 0) aiAnalysis.fuse_boxes = techData.fuse_boxes;
      if (techData.relays.length > 0) aiAnalysis.relays = techData.relays;
      if (techData.component_locations.length > 0) aiAnalysis.component_locations = techData.component_locations;

      if (aiAnalysis.fuse_boxes && aiAnalysis.fuse_boxes.length > 0) {
        try {
          const enhanced = await fetchExternalFuseDiagrams(vehicle_info, aiAnalysis.fuse_boxes);
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
      source: "manual" as const,
      raw_text: "",
      dtc_codes: aiAnalysis.dtc_codes,
      vehicle_info,
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
    console.error("DTC diagnosis error:", error);
    return NextResponse.json(
      { error: error.message || "Error en el análisis" },
      { status: 500 }
    );
  }
}
