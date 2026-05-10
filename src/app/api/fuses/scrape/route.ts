import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const make = request.nextUrl.searchParams.get("make");
  const model = request.nextUrl.searchParams.get("model");
  const year = request.nextUrl.searchParams.get("year");

  if (!make || !model) {
    return NextResponse.json({ error: "make and model required" }, { status: 400 });
  }

  const makeSlug = make.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
  const modelSlug = model.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
  const yearSlug = year || "";

  const urls = [
    `https://www.opinautos.com/${makeSlug}/${modelSlug}/info/fusibles/${yearSlug}`,
    `https://www.opinautos.com/${makeSlug}/${modelSlug}/info/fusibles`,
  ];

  for (const pageUrl of urls) {
    try {
      const res = await fetch(pageUrl, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          Accept: "text/html",
        },
        redirect: "follow",
        signal: AbortSignal.timeout(10000),
      });

      if (!res.ok) continue;

      const html = await res.text();

      const imageUrls: string[] = [];
      const imgRegex = /images\.opinautos\.com\/legos\/fusebox-thumbnails\/[^\s"']+/g;
      let match;
      while ((match = imgRegex.exec(html)) !== null) {
        const url = match[0];
        if (!imageUrls.includes(url)) imageUrls.push(url);
      }

      const fullImgRegex = /images\.opinautos\.com\/legos\/fusebox\/[^\s"']+/g;
      while ((match = fullImgRegex.exec(html)) !== null) {
        const url = match[0];
        if (!imageUrls.includes(url)) imageUrls.push(url);
      }

      const boxNames: string[] = [];
      const nameRegex = /Fusiblera[^<]*|Caja de fusibles[^<]*/gi;
      while ((match = nameRegex.exec(html)) !== null) {
        boxNames.push(match[0].trim());
      }

      if (imageUrls.length > 0) {
        return NextResponse.json({
          source: "opinautos.com",
          page_url: pageUrl,
          images: imageUrls,
          box_names: boxNames,
        }, {
          headers: { "Cache-Control": "public, max-age=86400" },
        });
      }
    } catch {
      continue;
    }
  }

  return NextResponse.json({ source: null, images: [], box_names: [] });
}
