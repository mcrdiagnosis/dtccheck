import { NextRequest, NextResponse } from "next/server";
import { analyzeDiagramImage } from "@/lib/gemini";
import type { VehicleInfo } from "@/types/diagnostic";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const image = formData.get("image") as File | null;
    const dtcCodes = JSON.parse(formData.get("dtc_codes") as string || "[]") as string[];
    const vehicleInfo = JSON.parse(formData.get("vehicle_info") as string || "{}") as VehicleInfo;
    const locale = (formData.get("locale") as string) || "es";

    if (!image) {
      return NextResponse.json({ error: "No image provided" }, { status: 400 });
    }

    const mimeType = image.type || "image/jpeg";
    const buffer = Buffer.from(await image.arrayBuffer());
    const base64 = buffer.toString("base64");

    const diagramAnalysis = await analyzeDiagramImage(base64, mimeType, dtcCodes, vehicleInfo, locale);

    if (!diagramAnalysis) {
      return NextResponse.json({ error: "Could not analyze diagram" }, { status: 500 });
    }

    return NextResponse.json({ diagram_analysis: diagramAnalysis });
  } catch (error: any) {
    console.error("Diagram analysis error:", error);
    return NextResponse.json({ error: error.message || "Error analyzing diagram" }, { status: 500 });
  }
}
