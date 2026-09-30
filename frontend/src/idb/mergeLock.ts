import { MERGE_LOCK_KEY, MERGE_LOCK_TTL_MS } from "./config";
import { runTransaction, idbRequest } from "./repository";
import type { MergeLockRow } from "./types";

export interface MergeLease extends MergeLockRow {
  /** 读锁时看到的 version，释放时做 CAS 校验 */
  base_version: number;
}

export type AcquireLockResult =
  | { outcome: "ACQUIRED"; lease: MergeLease }
  | { outcome: "STOLEN"; lease: MergeLease }
  | { outcome: "BUSY"; holder: MergeLockRow };

function isExpired(lock: MergeLockRow, now: number): boolean {
  if (!lock.held_by) return true;
  const expiresAt = Date.parse(lock.expires_at);
  return Number.isFinite(expiresAt) && expiresAt <= now;
}

/**
 * 跨标签页（“两台设备”）的归并互斥锁。
 * 全部竞争方先在同一事务里读出锁状态，再用各自的 expectedVersion 做 CAS：
 * 第一笔把 version 推进一步并提交，其余 CAS 失败 -> 只有一笔生效。
 * 持锁者崩溃时锁按 TTL 过期，后来者可接管（STOLEN）。
 */
export async function acquireMergeLock(input: {
  deviceId: string;
  requestId: string;
  keptSymbolId: number;
  mergedSymbolId: number;
}): Promise<AcquireLockResult> {
  const now = Date.now();
  return runTransaction(["mergeLock"], "readwrite", async (stores) => {
    const lockStore = stores.mergeLock;
    const current = (await idbRequest(lockStore.get(MERGE_LOCK_KEY))) as MergeLockRow | undefined;
    const base = current ?? {
      key: MERGE_LOCK_KEY,
      held_by: "",
      request_id: "",
      kept_symbol_id: 0,
      merged_symbol_id: 0,
      acquired_at: "",
      expires_at: "",
      version: 0
    };

    if (base.held_by && !isExpired(base, now) && base.held_by !== input.deviceId) {
      return { outcome: "BUSY", holder: base };
    }

    const stolen = Boolean(base.held_by) && isExpired(base, now);
    const next: MergeLockRow = {
      key: MERGE_LOCK_KEY,
      held_by: input.deviceId,
      request_id: input.requestId,
      kept_symbol_id: input.keptSymbolId,
      merged_symbol_id: input.mergedSymbolId,
      acquired_at: new Date(now).toISOString(),
      expires_at: new Date(now + MERGE_LOCK_TTL_MS).toISOString(),
      version: base.version + 1
    };
    await idbRequest(lockStore.put(next));
    return {
      outcome: stolen ? "STOLEN" : "ACQUIRED",
      lease: { ...next, base_version: base.version }
    };
  });
}

/**
 * 仅测试使用：直接写入一把未过期、属于指定设备的锁，
 * 模拟两台设备并发归并时“另一台已抢先持锁”的现场。
 */
export async function forceLockForTest(holder: Omit<MergeLockRow, "key" | "version">, version = 1): Promise<void> {
  await runTransaction(["mergeLock"], "readwrite", async (stores) => {
    await idbRequest(stores.mergeLock.put({ key: MERGE_LOCK_KEY, version, ...holder }));
  });
}

/**
 * 释放锁。仅当锁仍属于本次请求、且未被别的设备接管时才清空，
 * 避免误删另一台设备接管后的锁。
 */
export async function releaseMergeLock(lease: MergeLease): Promise<void> {
  await runTransaction(["mergeLock"], "readwrite", async (stores) => {
    const lockStore = stores.mergeLock;
    const current = (await idbRequest(lockStore.get(MERGE_LOCK_KEY))) as MergeLockRow | undefined;
    if (!current || current.request_id !== lease.request_id || current.held_by !== lease.held_by) {
      return;
    }
    const idle: MergeLockRow = {
      key: MERGE_LOCK_KEY,
      held_by: "",
      request_id: "",
      kept_symbol_id: 0,
      merged_symbol_id: 0,
      acquired_at: "",
      expires_at: "",
      version: current.version + 1
    };
    await idbRequest(lockStore.put(idle));
  });
}
