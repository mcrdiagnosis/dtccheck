import { NextRequest, NextResponse } from "next/server";

interface ScrapeResult {
  source: string;
  page_url: string;
  images: { url: string; alt?: string; context?: string }[];
  box_names: string[];
  location_images: { url: string; alt?: string }[];
}

const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

async function scrapeOpinautos(makeSlug: string, modelSlug: string, yearSlug: string): Promise<ScrapeResult | null> {
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
      const images: { url: string; alt?: string; context?: string }[] = [];
      const seen = new Set<string>();

      const thumbRegex = /images\.opinautos\.com\/legos\/fusebox-thumbnails\/[^\s"'?]+/g;
      let match;
      while ((match = thumbRegex.exec(html)) !== null) {
        const url = match[0];
        if (!seen.has(url)) { seen.add(url); images.push({ url, context: "thumbnail" }); }
      }

      const fullRegex = /images\.opinautos\.com\/legos\/fusebox\/[^\s"'?]+/g;
      while ((match = fullRegex.exec(html)) !== null) {
        const url = match[0];
        if (!seen.has(url)) { seen.add(url); images.push({ url, context: "diagram" }); }
      }

      const boxNames: string[] = [];
      const nameRegex = /Fusiblera[^<]*|Caja de fusibles[^<]*/gi;
      while ((match = nameRegex.exec(html)) !== null) {
        boxNames.push(match[0].trim());
      }

      if (images.length > 0) {
        return { source: "opinautos.com", page_url: pageUrl, images, box_names: boxNames, location_images: [] };
      }
    } catch { continue; }
  }
  return null;
}

async function scrapeFuseBoxInfo(makeSlug: string, modelSlug: string): Promise<ScrapeResult | null> {
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
      const images: { url: string; alt?: string; context?: string }[] = [];
      const locationImages: { url: string; alt?: string }[] = [];
      const seen = new Set<string>();

      const imgRegex = /(?:src|data-src|data-lazy-src)=["']?(https:\/\/fuse-box\.info\/wp-content\/uploads\/[^\s"'?>]+)/gi;
      let match;
      while ((match = imgRegex.exec(html)) !== null) {
        const url = match[1];
        if (seen.has(url)) continue;
        seen.add(url);

        const isDiagram = /20\d{6,}/.test(url) && !url.includes("logo") && !url.includes("icon");
        const isLocation = url.toLowerCase().includes("location") || url.toLowerCase().includes("box-") || url.toLowerCase().includes("engine") || url.toLowerCase().includes("interior") || url.toLowerCase().includes("fuse-box") || url.toLowerCase().includes("compartment");

        if (isDiagram) {
          images.push({ url, context: isLocation ? "location" : "diagram" });
          if (isLocation) locationImages.push({ url });
        }
      }

      const altRegex = /(?:src|data-src)=["']?(https:\/\/fuse-box\.info\/wp-content\/uploads\/[^"'\s>]+)["']?\s*(?:alt=["']?([^"'>]+))?/gi;
      while ((match = altRegex.exec(html)) !== null) {
        const url = match[1];
        const alt = match[2]?.trim();
        if (seen.has(url) || !url.includes("uploads")) continue;
        seen.add(url);
        if (/\.(jpg|jpeg|png|webp|gif)/i.test(url) && !url.includes("logo")) {
          images.push({ url, alt, context: "diagram" });
        }
      }

      const boxNames: string[] = [];
      const headingRegex = /<h[23][^>]*>([^<]*(?:fuse|fusibl|caja|box|compartment|engine|interior|cabin|trunk|battery)[^<]*)<\/h[23]>/gi;
      while ((match = headingRegex.exec(html)) !== null) {
        boxNames.push(match[1].trim().replace(/&amp;/g, "&").replace(/&nbsp;/g, " "));
      }

      if (images.length > 0) {
        return { source: "fuse-box.info", page_url: pageUrl, images, box_names: boxNames, location_images: locationImages };
      }
    } catch { continue; }
  }
  return null;
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

  const results: ScrapeResult[] = [];

  const [opinautos, fuseBox] = await Promise.allSettled([
    scrapeOpinautos(makeSlug, modelSlug, yearSlug),
    scrapeFuseBoxInfo(makeSlug, modelSlug),
  ]);

  if (opinautos.status === "fulfilled" && opinautos.value) results.push(opinautos.value);
  if (fuseBox.status === "fulfilled" && fuseBox.value) results.push(fuseBox.value);

  const allImages = results.flatMap((r) => r.images.map((img) => ({ ...img, source: r.source })));
  const allLocationImages = results.flatMap((r) => r.location_images.map((img) => ({ ...img, source: r.source })));
  const allBoxNames = [...new Set(results.flatMap((r) => r.box_names))];
  const sources = results.map((r) => r.source);
  const pageUrls = results.map((r) => r.page_url);

  return NextResponse.json({
    sources,
    page_urls: pageUrls,
    images: allImages,
    box_names: allBoxNames,
    location_images: allLocationImages,
  }, {
    headers: { "Cache-Control": "public, max-age=86400" },
  });
}
