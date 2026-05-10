const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

export interface ScrapedImage {
  url: string;
  type: "diagram" | "location" | "thumbnail";
  source: string;
}

export async function scrapeFuseImages(make: string, model: string, year?: string): Promise<{
  diagrams: ScrapedImage[];
  locations: ScrapedImage[];
}> {
  const makeSlug = make.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
  const modelSlug = model.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
  const yearSlug = year || "";

  const [opinautos, fuseBox] = await Promise.allSettled([
    scrapeOpinautos(makeSlug, modelSlug, yearSlug),
    scrapeFuseBoxInfo(makeSlug, modelSlug),
  ]);

  const all: ScrapedImage[] = [
    ...(opinautos.status === "fulfilled" && opinautos.value ? opinautos.value : []),
    ...(fuseBox.status === "fulfilled" && fuseBox.value ? fuseBox.value : []),
  ];

  return {
    diagrams: all.filter((i) => i.type === "diagram" || i.type === "thumbnail"),
    locations: all.filter((i) => i.type === "location"),
  };
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
        if (url.match(/-\d+x\d+\./)) continue;

        seen.add(url);

        const lower = url.toLowerCase();
        if (lower.includes("_loc") || lower.includes("_en_loc") || lower.includes("_in_loc")) {
          images.push({ url, type: "location", source: "fuse-box.info" });
        } else {
          images.push({ url, type: "diagram", source: "fuse-box.info" });
        }
      }

      if (images.length > 0) return images;
    } catch { continue; }
  }
  return [];
}
