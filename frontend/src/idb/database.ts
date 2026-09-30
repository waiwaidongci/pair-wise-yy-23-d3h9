import { BRAILLE_DB_NAME, BRAILLE_DB_VERSION, DB_STORE_NAMES, MERGE_LOCK_KEY } from "./config";
import { seedAnswerRecords, seedBrailleSymbols, seedLessons, seedPracticeSessions } from "../mocks/seedData";
import type { MergeLockRow } from "./types";

let dbPromise: Promise<IDBDatabase> | null = null;

/**
 * 打开/升级本地库。
 * v1 -> v2：已有数据原样保留（升级后兼容原编号），
 * 只新增 symbolMerge 台账与 mergeLock 单例锁两张表；
 * 全新库则灌入带重复卡片的种子数据，便于直接演示归并。
 */
export function openDatabase(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("当前环境不支持 IndexedDB"));
      return;
    }
    const request = indexedDB.open(BRAILLE_DB_NAME, BRAILLE_DB_VERSION);

    request.onupgradeneeded = (event: IDBVersionChangeEvent) => {
      const db = request.result;
      const fromVersion = event.oldVersion;

      if (!db.objectStoreNames.contains(DB_STORE_NAMES.brailleSymbol)) {
        db.createObjectStore(DB_STORE_NAMES.brailleSymbol, { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains(DB_STORE_NAMES.lesson)) {
        db.createObjectStore(DB_STORE_NAMES.lesson, { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains(DB_STORE_NAMES.practiceSession)) {
        db.createObjectStore(DB_STORE_NAMES.practiceSession, { keyPath: "id" });
      }
      const answerStore = db.objectStoreNames.contains(DB_STORE_NAMES.answerRecord)
        ? request.transaction!.objectStore(DB_STORE_NAMES.answerRecord)
        : db.createObjectStore(DB_STORE_NAMES.answerRecord, { keyPath: "id" });
      if (!answerStore.indexNames.contains("by_symbol")) answerStore.createIndex("by_symbol", "symbol_id");
      if (!answerStore.indexNames.contains("by_session")) answerStore.createIndex("by_session", "session_id");

      // v2 新增：归并台账（旧编号保留来源、误合可按快照拆回）
      if (!db.objectStoreNames.contains(DB_STORE_NAMES.symbolMerge)) {
        const mergeStore = db.createObjectStore(DB_STORE_NAMES.symbolMerge, { keyPath: "id", autoIncrement: true });
        mergeStore.createIndex("by_request", "request_id", { unique: true });
        mergeStore.createIndex("by_status", "status");
        mergeStore.createIndex("by_merged", "merged_symbol_id");
        mergeStore.createIndex("by_kept", "kept_symbol_id");
      }
      if (!db.objectStoreNames.contains(DB_STORE_NAMES.mergeLock)) {
        db.createObjectStore(DB_STORE_NAMES.mergeLock, { keyPath: "key" });
      }

      if (fromVersion < 1) {
        seedFreshDatabase(request.transaction!);
      } else {
        // 旧版库升级到 v2：补齐归并锁单例行，已有业务数据原样保留（兼容原编号）
        ensureIdleLock(request.transaction!, fromVersion);
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error("本地库被其他标签页占用，请关闭旧页面后重试"));
  });
  return dbPromise;
}

function seedFreshDatabase(transaction: IDBTransaction) {
  const symbolStore = transaction.objectStore(DB_STORE_NAMES.brailleSymbol);
  const lessonStore = transaction.objectStore(DB_STORE_NAMES.lesson);
  const sessionStore = transaction.objectStore(DB_STORE_NAMES.practiceSession);
  const answerStore = transaction.objectStore(DB_STORE_NAMES.answerRecord);
  seedBrailleSymbols.forEach((row) => symbolStore.add(row));
  seedLessons.forEach((row) => lessonStore.add(row));
  seedPracticeSessions.forEach((row) => sessionStore.add(row));
  seedAnswerRecords.forEach((row) => answerStore.add(row));
  ensureIdleLock(transaction, 0);
}

/** 升级场景：mergeLock 是 v2 新表，补一个空闲单例行，后续 CAS 在此行上推进 version */
function ensureIdleLock(transaction: IDBTransaction, _fromVersion: number) {
  const lockStore = transaction.objectStore(DB_STORE_NAMES.mergeLock);
  const idleLock: MergeLockRow = {
    key: MERGE_LOCK_KEY,
    held_by: "",
    request_id: "",
    kept_symbol_id: 0,
    merged_symbol_id: 0,
    acquired_at: "",
    expires_at: "",
    version: 0
  };
  lockStore.add(idleLock);
}

/** 仅测试使用：删库重建，保证每个用例从同一份种子数据开始 */
export async function resetDatabaseForTest(): Promise<void> {
  if (dbPromise) {
    const db = await dbPromise.catch(() => null);
    db?.close();
    dbPromise = null;
  }
  await new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase(BRAILLE_DB_NAME);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error("测试删库被阻塞"));
  });
}
