import type { StoreNames } from "./types";

/** IndexedDB 名称与版本：v2 引入字符归并台账与归并锁 */
export const BRAILLE_DB_NAME = "braille-trainer-db";
export const BRAILLE_DB_VERSION = 2;

export const DB_STORE_NAMES = {
  brailleSymbol: "brailleSymbol",
  lesson: "lesson",
  practiceSession: "practiceSession",
  answerRecord: "answerRecord",
  symbolMerge: "symbolMerge",
  mergeLock: "mergeLock"
} as const satisfies Record<StoreNames, string>;

/** 归并锁单例行键。两台设备（标签页）同时归并时，CAS 抢占只有一笔成功 */
export const MERGE_LOCK_KEY = "symbol-merge" as const;
/** 锁租约（毫秒）：持锁页崩溃后，锁可被接管，避免永久卡死 */
export const MERGE_LOCK_TTL_MS = 15_000;
/** 归并链最大长度：旧编号只允许线性并入保留卡片，防止循环归并 */
export const MERGE_CHAIN_LIMIT = 16;
