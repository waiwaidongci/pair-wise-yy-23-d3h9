import { useEffect, useState } from "react";
import { database, type TableName } from "../db/database";

/**
 * 订阅数据库变更，返回指定表的最新行。
 * 归并、拆回后自动刷新，无需手动重新拉取。
 */
export function useDatabaseTable<T>(table: TableName): T[] {
  const [rows, setRows] = useState<T[]>(() => database.getAll<T>(table));

  useEffect(() => {
    const sync = () => setRows(database.getAll<T>(table));
    sync();
    return database.subscribe(sync);
  }, [table]);

  return rows;
}

/**
 * 订阅数据库版本号，用于判断是否有其他设备提交。
 */
export function useDatabaseVersion(): number {
  const [version, setVersion] = useState(() => database.getVersion());
  useEffect(() => {
    const sync = () => setVersion(database.getVersion());
    return database.subscribe(sync);
  }, []);
  return version;
}
