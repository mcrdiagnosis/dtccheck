import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getDiagnosticLocal } from "@/lib/local-storage";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    try {
      const supabase = await createClient();
      if (supabase) {
        const { data, error } = await supabase
          .from("diagnostics")
          .select("*")
          .eq("id", id)
          .single();

        if (data) return NextResponse.json(data);
      }
    } catch {}

    const local = getDiagnosticLocal(id);
    if (local) return NextResponse.json(local);

    return NextResponse.json({ error: "Not found" }, { status: 404 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    try {
      const supabase = await createClient();
      if (supabase) {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }
        await supabase
          .from("diagnostics")
          .delete()
          .eq("id", id)
          .eq("user_id", user.id);
      }
    } catch {}

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
