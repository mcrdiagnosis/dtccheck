import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get("url");
  if (!url) return NextResponse.json({ error: "url required" }, { status: 400 });

  const headersList: Record<string, string> = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    Accept: "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
    "Sec-Fetch-Dest": "image",
    "Sec-Fetch-Mode": "no-cors",
    "Sec-Fetch-Site": "cross-site",
  };

  try {
    const origin = new URL(url).origin;
    headersList.Referer = origin + "/";

    const res = await fetch(url, { headers: headersList, redirect: "follow", signal: AbortSignal.timeout(10000) });
    if (res.ok) {
      const contentType = res.headers.get("content-type") || "image/jpeg";
      const isImage = contentType.startsWith("image/") || contentType.includes("image") || contentType === "application/octet-stream";
      if (isImage) {
        const buffer = Buffer.from(await res.arrayBuffer());
        return new NextResponse(buffer, {
          headers: {
            "Content-Type": contentType.startsWith("image/") ? contentType : "image/jpeg",
            "Cache-Control": "public, max-age=86400, s-maxage=86400",
            "Access-Control-Allow-Origin": "*",
          },
        });
      }
    }

    const res2 = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)", Accept: "*/*" },
      redirect: "follow",
      signal: AbortSignal.timeout(10000),
    });
    if (res2.ok) {
      const contentType = res2.headers.get("content-type") || "image/jpeg";
      const buffer = Buffer.from(await res2.arrayBuffer());
      return new NextResponse(buffer, {
        headers: {
          "Content-Type": contentType.startsWith("image/") ? contentType : "image/jpeg",
          "Cache-Control": "public, max-age=86400, s-maxage=86400",
          "Access-Control-Allow-Origin": "*",
        },
      });
    }

    return NextResponse.json({ error: "fetch failed", status: res.status }, { status: 502 });
  } catch {
    return NextResponse.json({ error: "fetch timeout" }, { status: 504 });
  }
}
