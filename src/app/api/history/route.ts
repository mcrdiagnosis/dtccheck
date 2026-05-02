import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAllLocal } from "@/lib/local-storage";

export async function GET() {
  try {
    const supabase = await createClient();
    let dbDiagnostics: any[] = [];

    if (supabase) {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data } = await supabase
          .from("diagnostics")
          .select("*")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false });
        dbDiagnostics = data || [];
      }
    }

    const localDiagnostics = getAllLocal();

    const merged = [...dbDiagnostics];
    for (const local of localDiagnostics) {
      if (!merged.find((d) => d.id === local.id)) {
        merged.push(local);
      }
    }

    merged.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    return NextResponse.json(merged);
  } catch (error: any) {
    console.error("History error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
