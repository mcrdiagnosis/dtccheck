import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get("url");
  if (!url) return NextResponse.json({ error: "url required" }, { status: 400 });

  try {
    const controllers = [
      new AbortController(),
      new AbortController(),
    ];

    const timeout1 = setTimeout(() => controllers[0].abort(), 8000);
    const timeout2 = setTimeout(() => controllers[1].abort(), 15000);

    const headers: Record<string, string> = {
      "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      Accept: "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.9",
      "Accept-Encoding": "gzip, deflate, br",
      "Cache-Control": "no-cache",
      "Sec-Fetch-Dest": "image",
      "Sec-Fetch-Mode": "no-cors",
      "Sec-Fetch-Site": "cross-site",
      Referer: new URL(url).origin + "/",
    };

    try {
      const res = await fetch(url, { headers, signal: controllers[0].signal, redirect: "follow" });
      clearTimeout(timeout1);

      if (res.ok) {
        const contentType = res.headers.get("content-type") || "image/jpeg";
        if (contentType.startsWith("image/") || contentType.includes("image") || contentType === "application/octet-stream") {
          const buffer = Buffer.from(await res.arrayBuffer());
          clearTimeout(timeout2);
          return new NextResponse(buffer, {
            headers: {
              "Content-Type": contentType.startsWith("image/") ? contentType : "image/jpeg",
              "Cache-Control": "public, max-age=86400, s-maxage=86400",
              "Access-Control-Allow-Origin": "*",
            },
          });
        }
      }
    } catch {}

    try {
      const res2 = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
          Accept: "*/*",
        },
        signal: controllers[1].signal,
        redirect: "follow",
      });
      clearTimeout(timeout2);

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
    } catch {}

    clearTimeout(timeout1);
    clearTimeout(timeout2);
    return NextResponse.json({ error: "fetch failed", url }, { status: 502 });
  } catch {
    return NextResponse.json({ error: "fetch timeout" }, { status: 504 });
  }
}
