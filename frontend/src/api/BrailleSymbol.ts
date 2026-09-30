import { getAllRows, idbRequest, runTransaction } from "../idb/repository";
import { ApiError } from "../utils/errors";
import type { BrailleSymbol } from "../types/BrailleSymbol";

const endpoint = "/api/braille-symbol";

export async function listBrailleSymbol(): Promise<BrailleSymbol[]> {
  try {
    return await getAllRows("brailleSymbol");
  } catch (error) {
    throw new ApiError("SERVICE_ERROR", error, { endpoint });
  }
}

export async function getBrailleSymbol(id: number): Promise<BrailleSymbol | undefined> {
  try {
    const rows = await listBrailleSymbol();
    return rows.find((row) => row.id === id);
  } catch (error) {
    throw new ApiError("SERVICE_ERROR", error, { endpoint });
  }
}

export async function saveBrailleSymbol(payload: BrailleSymbol): Promise<BrailleSymbol> {
  try {
    await runTransaction(["brailleSymbol"], "readwrite", async (stores) => {
      await idbRequest(stores.brailleSymbol.put(payload));
    });
    return payload;
  } catch (error) {
    throw new ApiError("SERVICE_ERROR", error, { endpoint });
  }
}
