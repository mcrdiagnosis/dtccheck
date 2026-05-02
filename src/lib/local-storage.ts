import type { Diagnostic } from "@/types/diagnostic";

const STORAGE_KEY = "dtccheck_diagnostics";

export function saveDiagnosticLocal(diagnostic: Diagnostic): void {
  const existing = getAllLocal();
  existing.unshift(diagnostic);
  if (existing.length > 50) existing.length = 50;
  if (typeof window !== "undefined") {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(existing));
  }
}

export function getDiagnosticLocal(id: string): Diagnostic | null {
  const all = getAllLocal();
  return all.find((d) => d.id === id) || null;
}

export function getAllLocal(): Diagnostic[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function deleteDiagnosticLocal(id: string): void {
  const all = getAllLocal().filter((d) => d.id !== id);
  if (typeof window !== "undefined") {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  }
}
