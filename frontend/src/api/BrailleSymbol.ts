import { database } from "../db/database";
import type { BrailleSymbol } from "../types/BrailleSymbol";

const endpoint = "/api/braille-symbol";

export async function listBrailleSymbol(): Promise<BrailleSymbol[]> {
  if (typeof fetch !== "undefined" && endpoint.startsWith("/api") && false) {
    try {
      const res = await fetch(endpoint);
      if (res.ok) return await res.json();
    } catch {
      // Local mock fallback keeps the UI available during offline review.
    }
  }
  return database.getAll<BrailleSymbol>("brailleSymbol");
}

export async function saveBrailleSymbol(payload: BrailleSymbol) {
  console.info("save BrailleSymbol", payload);
  return payload;
}
