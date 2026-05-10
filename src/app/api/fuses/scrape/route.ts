import { NextRequest, NextResponse } from "next/server";

const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

interface ScrapedImage {
  url: string;
  type: "diagram" | "location" | "thumbnail" | "vehicle";
  source: string;
}

async function scrapeOpinautos(makeSlug: string, modelSlug: string, yearSlug: string): Promise<ScrapedImage[]> {
  const urls = [
    `https://www.opinautos.com/${makeSlug}/${modelSlug}/info/fusibles/${yearSlug}`,
    `https://www.opinautos.com/${makeSlug}/${modelSlug}/info/fusibles`,
  ];

  for (const pageUrl of urls) {
    try {
      const res = await fetch(pageUrl, {
        headers: { "User-Agent": UA, Accept: "text/html" },
        redirect: "follow",
        signal: AbortSignal.timeout(10000),
      });
      if (!res.ok) continue;
      const html = await res.text();

      const images: ScrapedImage[] = [];
      const seen = new Set<string>();

      const extract = (regex: RegExp, type: ScrapedImage["type"]) => {
        let m;
        while ((m = regex.exec(html)) !== null) {
          const url = m[0].replace(/["'>]/g, "");
          if (!seen.has(url)) {
            seen.add(url);
            images.push({ url, type, source: "opinautos.com" });
          }
        }
      };

      extract(/images\.opinautos\.com\/legos\/fusebox-thumbnails\/[^\s"'?]+/g, "thumbnail");
      extract(/images\.opinautos\.com\/legos\/fusebox\/[^\s"'?]+/g, "diagram");

      if (images.length > 0) return images;
    } catch { continue; }
  }
  return [];
}

async function scrapeFuseBoxInfo(makeSlug: string, modelSlug: string): Promise<ScrapedImage[]> {
  const urls = [
    `https://fuse-box.info/${makeSlug}/${makeSlug}-${modelSlug}-fuses`,
    `https://fuse-box.info/${makeSlug}/${makeSlug}-${modelSlug}`,
  ];

  for (const pageUrl of urls) {
    try {
      const res = await fetch(pageUrl, {
        headers: { "User-Agent": UA, Accept: "text/html" },
        redirect: "follow",
        signal: AbortSignal.timeout(10000),
      });
      if (!res.ok) continue;
      const html = await res.text();

      const images: ScrapedImage[] = [];
      const seen = new Set<string>();

      const allImgRegex = /https:\/\/fuse-box\.info\/wp-content\/uploads\/[^"'\s>)]+\.jpg/gi;
      let m;
      while ((m = allImgRegex.exec(html)) !== null) {
        const url = m[0];
        if (seen.has(url)) continue;
        if (url.includes("favicon") || url.includes("header") || url.includes("logo") || url.includes("icon")) continue;

        const fullUrl = url;
        const thumbUrl = url.replace(/\.jpg/, (s) => {
          const thumbMatch = html.match(new RegExp(url.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\.jpg$/, "") + "-\\d+x\\d+\\.jpg"));
          return thumbMatch ? fullUrl : s;
        });

        seen.add(fullUrl);

        const lower = url.toLowerCase();
        if (lower.includes("_loc") || lower.includes("location") || lower.includes("_en_loc") || lower.includes("_in_loc")) {
          images.push({ url: fullUrl, type: "location", source: "fuse-box.info" });
        } else if (lower.includes("-1.jpg") && !lower.includes("_loc")) {
          if (lower.includes("_in_loc") || lower.includes("_en_loc")) {
            images.push({ url: fullUrl, type: "location", source: "fuse-box.info" });
          } else {
            images.push({ url: fullUrl, type: "diagram", source: "fuse-box.info" });
          }
        } else if (lower.includes("-1-")) {
          // thumbnail, skip - we have the full size
        } else {
          images.push({ url: fullUrl, type: "diagram", source: "fuse-box.info" });
        }
      }

      if (images.length > 0) return images;
    } catch { continue; }
  }
  return [];
}

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

  const [opinautos, fuseBox] = await Promise.allSettled([
    scrapeOpinautos(makeSlug, modelSlug, yearSlug),
    scrapeFuseBoxInfo(makeSlug, modelSlug),
  ]);

  const allImages: ScrapedImage[] = [
    ...(opinautos.status === "fulfilled" ? opinautos.value : []),
    ...(fuseBox.status === "fulfilled" ? fuseBox.value : []),
  ];

  const diagrams = allImages.filter((i) => i.type === "diagram" || i.type === "thumbnail");
  const locations = allImages.filter((i) => i.type === "location");

  return NextResponse.json({
    total: allImages.length,
    diagrams: diagrams,
    locations: locations,
    sources: [...new Set(allImages.map((i) => i.source))],
  }, {
    headers: { "Cache-Control": "public, max-age=86400" },
  });
}
