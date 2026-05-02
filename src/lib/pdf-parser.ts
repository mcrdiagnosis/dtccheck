type PDFParseResult = { text: string; numpages: number; info: any };

export async function extractTextFromPDF(buffer: Buffer): Promise<string> {
  const pdfModule: any = await import("pdf-parse");
  const pdf = pdfModule.default || pdfModule;
  const data: PDFParseResult = await pdf(buffer);
  return data.text;
}

export function extractDTCCodes(text: string): string[] {
  const dtcPattern = /\b([PCBU]\d{4})\b/gi;
  const matches = text.match(dtcPattern);
  if (!matches) return [];

  const uniqueCodes = [...new Set(matches.map((c) => c.toUpperCase()))];
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
