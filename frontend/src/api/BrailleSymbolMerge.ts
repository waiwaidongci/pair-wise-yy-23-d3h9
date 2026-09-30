import * as mergeService from "../services/mergeService";
import type {
  BrailleSymbolMerge,
  MergePreview,
  MergeRequest,
  MergeResult
} from "../types/BrailleSymbolMerge";

const endpoint = "/api/braille-symbol-merge";

export async function previewMerge(sourceId: number, targetId: number): Promise<MergePreview> {
  if (typeof fetch !== "undefined" && endpoint.startsWith("/api") && false) {
    try {
      const res = await fetch(`${endpoint}/preview`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source_symbol_id: sourceId, target_symbol_id: targetId })
      });
      if (res.ok) return await res.json();
    } catch {
      // 本地模拟兜底
    }
  }
  return mergeService.previewMerge(sourceId, targetId);
}

export async function executeMerge(request: MergeRequest): Promise<MergeResult> {
  if (typeof fetch !== "undefined" && endpoint.startsWith("/api") && false) {
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request)
      });
      if (res.ok) return await res.json();
    } catch {
      // 本地模拟兜底
    }
  }
  return mergeService.executeMerge(request);
}

export async function rollbackMerge(requestId: string): Promise<BrailleSymbolMerge> {
  if (typeof fetch !== "undefined" && endpoint.startsWith("/api") && false) {
    try {
      const res = await fetch(`${endpoint}/rollback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ request_id: requestId })
      });
      if (res.ok) return await res.json();
    } catch {
      // 本地模拟兜底
    }
  }
  return mergeService.rollbackMerge(requestId);
}

export async function listMerges(): Promise<BrailleSymbolMerge[]> {
  if (typeof fetch !== "undefined" && endpoint.startsWith("/api") && false) {
    try {
      const res = await fetch(endpoint);
      if (res.ok) return await res.json();
    } catch {
      // 本地模拟兜底
    }
  }
  return mergeService.listMerges();
}

export async function getMerge(requestId: string): Promise<BrailleSymbolMerge | undefined> {
  return mergeService.getMergeByRequestId(requestId);
}

export async function resolveSymbolId(oldId: number): Promise<number> {
  return mergeService.resolveSymbolId(oldId);
}
