import { NextRequest, NextResponse } from "next/server";
import { analyzeDTCs } from "@/lib/gemini";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { dtc_codes, vehicle_info, locale } = body;

    if (!dtc_codes?.length || !vehicle_info?.make || !vehicle_info?.model) {
      return NextResponse.json(
        { error: "Códigos DTC e información del vehículo son requeridos" },
        { status: 400 }
      );
    }

    const dtcArray = Array.isArray(dtc_codes)
      ? dtc_codes
      : dtc_codes.split(",").map((c: string) => c.trim().toUpperCase());

    const aiAnalysis = await analyzeDTCs(dtcArray, vehicle_info, undefined, locale);

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
    console.error("DTC diagnosis error:", error);
    return NextResponse.json(
      { error: error.message || "Error en el análisis" },
      { status: 500 }
    );
  }
}
