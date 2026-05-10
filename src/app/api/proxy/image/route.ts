import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get("url");
  if (!url) return NextResponse.json({ error: "url required" }, { status: 400 });

  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        Accept: "image/*",
      },
      signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) return NextResponse.json({ error: "fetch failed" }, { status: 502 });

    const contentType = res.headers.get("content-type") || "image/jpeg";
    if (!contentType.startsWith("image/")) return NextResponse.json({ error: "not an image" }, { status: 400 });

    const buffer = Buffer.from(await res.arrayBuffer());

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=86400",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch {
    return NextResponse.json({ error: "fetch timeout" }, { status: 504 });
  }
}
