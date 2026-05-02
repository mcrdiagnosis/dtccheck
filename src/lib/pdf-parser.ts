type PDFParseResult = { text: string; numpages: number; info: any };

export async function extractTextFromPDF(buffer: Buffer): Promise<string> {
  const errors: string[] = [];

  try {
    const text = await extractWithPdfJs(buffer);
    if (text && text.trim().length > 20) return text;
    errors.push("pdfjs-dist: insufficient text");
  } catch (err: any) {
    errors.push(`pdfjs-dist: ${err.message}`);
  }

  try {
    const pdfModule: any = await import("pdf-parse");
    const pdf = pdfModule.default || pdfModule;
    const data: PDFParseResult = await pdf(buffer);
    if (data.text && data.text.trim().length > 20) return data.text;
    errors.push("pdf-parse: insufficient text");
  } catch (err: any) {
    errors.push(`pdf-parse: ${err.message}`);
  }

  try {
    const text = extractFromRawStreams(buffer);
    if (text && text.trim().length > 20) return text;
    errors.push("raw-streams: insufficient text");
  } catch (err: any) {
    errors.push(`raw-streams: ${err.message}`);
  }

  console.error("All PDF extraction methods failed:", errors);
  return "";
}

async function extractWithPdfJs(buffer: Buffer): Promise<string> {
  const pdfjsLib = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const doc = await pdfjsLib.getDocument({ data: new Uint8Array(buffer) }).promise;
  const parts: string[] = [];

  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    const pageText = content.items
      .map((item: any) => item.str)
      .filter(Boolean)
      .join(" ");
    if (pageText) parts.push(pageText);
  }

  return parts.join("\n");
}

function extractFromRawStreams(buffer: Buffer): string {
  const raw = buffer.toString("latin1");
  const textParts: string[] = [];

  const streamRegex = /stream\r?\n([\s\S]*?)\r?\nendstream/g;
  let match;
  while ((match = streamRegex.exec(raw)) !== null) {
    const content = match[1];
    const textMatches = content.match(/\(([^)]*)\)/g);
    if (textMatches) {
      textParts.push(
        ...textMatches.map((t) =>
          t
            .slice(1, -1)
            .replace(/\\n/g, "\n")
            .replace(/\\r/g, "\r")
            .replace(/\\t/g, "\t")
            .replace(/\\\(/g, "(")
            .replace(/\\\)/g, ")")
        )
      );
    }

    const tjMatches = content.match(/\[([^\]]*)\]\s*TJ/g);
    if (tjMatches) {
      for (const tj of tjMatches) {
        const parts = tj.match(/\(([^)]*)\)/g);
        if (parts) {
          textParts.push(...parts.map((p) => p.slice(1, -1)));
        }
      }
    }
  }

  return textParts.join(" ").replace(/\s+/g, " ").trim();
}

export function extractDTCCodes(text: string): string[] {
  const patterns = [
    /\b([PCBU]\d{4}[A-F]?)\b/gi,
    /\b([PCBU]\d{2,3}[A-F]?\d?[A-F]?)\b/gi,
  ];
  const matches: string[] = [];
  for (const pattern of patterns) {
    let m;
    while ((m = pattern.exec(text)) !== null) {
      const code = m[1].toUpperCase();
      if (/^[PCBU]\d{2,4}[A-F]?$/.test(code)) {
        matches.push(code);
      }
    }
  }

  const uniqueCodes = [...new Set(matches)];
  return uniqueCodes;
}

export function extractVehicleInfo(text: string): {
  make?: string;
  model?: string;
  year?: number;
  engine?: string;
} {
  const info: { make?: string; model?: string; year?: number; engine?: string } = {};

  const yearMatch = text.match(/\b(19|20)\d{2}\b/);
  if (yearMatch) info.year = parseInt(yearMatch[0]);

  const makes = [
    "Toyota", "Honda", "Ford", "Chevrolet", "Nissan", "Volkswagen",
    "BMW", "Mercedes", "Audi", "Hyundai", "Kia", "Mazda", "Subaru",
    "Mitsubishi", "Suzuki", "Renault", "Peugeot", "Fiat", "Jeep",
    "Dodge", "Chrysler", "Lexus", "Acura", "Infiniti", "Volvo",
    "Seat", "Skoda", "Ssangyong", "Daewoo", "Mini", "Saab",
  ];

  for (const make of makes) {
    if (text.toLowerCase().includes(make.toLowerCase())) {
      info.make = make;
      break;
    }
  }

  const engineMatch = text.match(/\b(\d\.\d[LlHh]?\s*[Vv]?[\d]*)\b/);
  if (engineMatch) info.engine = engineMatch[1];

  return info;
}
