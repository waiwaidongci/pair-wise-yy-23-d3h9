import { DB_STORE_NAMES } from "./config";
import { openDatabase } from "./database";
import type { BrailleDatabaseSchema, StoreNames } from "./types";

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * 在一个 IndexedDB 事务内执行一批读写，要么全部提交、要么整体回滚。
 * 字符归并迁移课程/会话/答题记录必须走这里，保证“不留下半套引用”。
 */
export async function runTransaction<Result>(
  storeNames: StoreNames[],
  mode: IDBTransactionMode,
  execute: (stores: { [K in StoreNames]: IDBObjectStore }) => Promise<Result> | Result
): Promise<Result> {
  const db = await openDatabase();
  const names = storeNames.map((name) => DB_STORE_NAMES[name]);
  const transaction = db.transaction(names, mode);
  const stores = Object.fromEntries(
    (Object.keys(DB_STORE_NAMES) as StoreNames[])
      .filter((name) => storeNames.includes(name))
      .map((name) => [name, transaction.objectStore(DB_STORE_NAMES[name])])
  ) as { [K in StoreNames]: IDBObjectStore };

  return new Promise<Result>((resolve, reject) => {
    let settled = false;
    transaction.oncomplete = () => {
      // execute 的结果在 Promise 链中 resolve，这里只确认整笔事务已落盘
    };
    transaction.onerror = () => {
      if (!settled) {
        settled = true;
        reject(transaction.error ?? new Error("IndexedDB 事务失败"));
      }
    };
    transaction.onabort = () => {
      if (!settled) {
        settled = true;
        reject(transaction.error ?? new Error("IndexedDB 事务被中止"));
      }
    };
    Promise.resolve()
      .then(() => execute(stores))
      .then((result) => {
        // 等事务真正 commit 后再向外返回，避免调用方读到旧数据
        transaction.oncomplete = () => {
          if (!settled) {
            settled = true;
            resolve(result);
          }
        };
      })
      .catch((error) => {
        if (!settled) {
          settled = true;
          try {
            transaction.abort();
          } catch {
            // 事务可能已结束，忽略后抛出原始错误
          }
          reject(error);
        }
      });
  });
}

export async function getAllRows<K extends StoreNames>(storeName: K): Promise<BrailleDatabaseSchema[K][]> {
  return runTransaction([storeName], "readonly", (stores) =>
    requestToPromise(stores[storeName].getAll() as IDBRequest<BrailleDatabaseSchema[K][]>)
  );
}

export async function getRowById<K extends StoreNames>(
  storeName: K,
  id: number | string
): Promise<BrailleDatabaseSchema[K] | undefined> {
  return runTransaction([storeName], "readonly", (stores) =>
    requestToPromise(stores[storeName].get(id) as IDBRequest<BrailleDatabaseSchema[K] | undefined>)
  );
}

export async function getAllByIndex<K extends StoreNames>(
  storeName: K,
  indexName: string,
  query: IDBValidKey | IDBKeyRange
): Promise<BrailleDatabaseSchema[K][]> {
  return runTransaction([storeName], "readonly", (stores) => {
    const index = stores[storeName].index(indexName);
    return requestToPromise(index.getAll(query) as IDBRequest<BrailleDatabaseSchema[K][]>);
  });
}

export const idbRequest = requestToPromise;
