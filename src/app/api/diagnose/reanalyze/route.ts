import { NextRequest, NextResponse } from "next/server";
import { reanalyzeWithTestResults } from "@/lib/gemini";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  try {
    const { diagnostic_id, test_results } = await request.json();

    const supabase = await createClient();
    if (!supabase) {
      return NextResponse.json(
        { error: "Base de datos no configurada" },
        { status: 503 }
      );
    }

    const { data: diagnostic } = await supabase
      .from("diagnostics")
      .select("*")
      .eq("id", diagnostic_id)
      .single();

    if (!diagnostic?.ai_analysis) {
      return NextResponse.json(
        { error: "Diagnóstico no encontrado" },
        { status: 404 }
      );
    }

    const updatedAnalysis = await reanalyzeWithTestResults(
      diagnostic.ai_analysis,
      diagnostic.vehicle_info,
      test_results
    );

    await supabase
      .from("diagnostics")
      .update({
        ai_analysis: updatedAnalysis,
        status: "tests_in_progress",
      })
      .eq("id", diagnostic_id);

    return NextResponse.json({
      ...diagnostic,
      ai_analysis: updatedAnalysis,
      status: "tests_in_progress",
    });
  } catch (error: any) {
    console.error("Reanalyze error:", error);
    return NextResponse.json(
      { error: error.message || "Error re-analizando" },
      { status: 500 }
    );
  }
}
