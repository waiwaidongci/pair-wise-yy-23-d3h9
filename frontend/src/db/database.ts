import { mockData } from "../mocks/seedData";

/**
 * 数据库表层定义。
 *
 * 归并功能新增两张表：
 * - mergeRecord: 字符归并记录（含快照，用于拆回与幂等恢复）
 * - symbolIdMapping: 旧编号 → 保留编号 的映射（旧编号保留来源）
 */
export type TableName =
  | "brailleSymbol"
  | "lesson"
  | "practiceSession"
  | "answerRecord"
  | "mergeRecord"
  | "symbolIdMapping";

export type DbShape = Record<TableName, any[]>;

const STORAGE_KEY = "braille-trainer-db-v1";
const VERSION_KEY = "braille-trainer-db-version";
const SCHEMA_VERSION_KEY = "braille-trainer-schema-version";
const CURRENT_SCHEMA_VERSION = 2;

function emptyDb(): DbShape {
  return {
    brailleSymbol: [],
    lesson: [],
    practiceSession: [],
    answerRecord: [],
    mergeRecord: [],
    symbolIdMapping: []
  };
}

function seedDb(): DbShape {
  return {
    brailleSymbol: [...(mockData.brailleSymbol as unknown as any[])],
    lesson: [...(mockData.lesson as unknown as any[])],
    practiceSession: [...(mockData.practiceSession as unknown as any[])],
    answerRecord: [...(mockData.answerRecord as unknown as any[])],
    mergeRecord: [],
    symbolIdMapping: []
  };
}

function deepClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

/**
 * 内存数据库，localStorage 持久化。
 *
 * 并发控制：
 * - version 字段作为乐观锁版本号。
 * - cas() 仅在 version 与读取时一致时提交，否则返回 false（冲突）。
 * - 多标签页（两台设备）通过 storage 事件感知版本变化。
 *
 * 原子性：
 * - cas() / mutate() 在内存中先改草稿，再整体写回，
 *   保证归并事务要么全部生效、要么全部回滚，不留下半套引用。
 */
class Database {
  private tables: DbShape;
  private version: number;
  private listeners: Set<() => void> = new Set();

  constructor() {
    const loaded = this.load();
    this.tables = loaded.tables;
    this.version = loaded.version;
    if (typeof window !== "undefined") {
      window.addEventListener("storage", (event) => {
        if (event.key === VERSION_KEY || event.key === STORAGE_KEY) {
          this.reload();
          this.notify();
        }
      });
    }
  }

  private load(): { tables: DbShape; version: number } {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const versionRaw = localStorage.getItem(VERSION_KEY);
      const schemaRaw = localStorage.getItem(SCHEMA_VERSION_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<DbShape>;
        // 与种子合并，确保新增表存在（已有数据升级兼容原编号）
        const seeded = seedDb();
        const tables: DbShape = { ...seeded, ...parsed };
        // 迁移：旧 schema 数据补齐新表
        if (Number(schemaRaw ?? 0) < CURRENT_SCHEMA_VERSION) {
          this.runMigrations(tables, Number(schemaRaw ?? 0));
        }
        return { tables, version: versionRaw ? Number(versionRaw) : 0 };
      }
    } catch {
      // 解析失败时回退到种子数据
    }
    return { tables: seedDb(), version: 0 };
  }

  /**
   * 已有数据升级：补齐归并功能所需的新表与字段，
   * 保留原有编号不变（旧编号保留来源）。
   */
  private runMigrations(tables: DbShape, fromVersion: number): void {
    if (fromVersion < 2) {
      if (!Array.isArray(tables.mergeRecord)) tables.mergeRecord = [];
      if (!Array.isArray(tables.symbolIdMapping)) tables.symbolIdMapping = [];
      // 课程 symbol_ids 去重，避免归并后出现重复引用
      for (const lesson of tables.lesson) {
        if (Array.isArray(lesson.symbol_ids)) {
          lesson.symbol_ids = [...new Set(lesson.symbol_ids)];
        }
      }
    }
    try {
      localStorage.setItem(SCHEMA_VERSION_KEY, String(CURRENT_SCHEMA_VERSION));
    } catch {
      // 忽略持久化失败
    }
  }

  private reload(): void {
    const loaded = this.load();
    this.tables = loaded.tables;
    this.version = loaded.version;
  }

  private persist(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.tables));
      localStorage.setItem(VERSION_KEY, String(this.version));
    } catch {
      // 存储不可用时仅保留内存态
    }
  }

  getVersion(): number {
    return this.version;
  }

  getAll<T>(table: TableName): T[] {
    return [...(this.tables[table] as T[])];
  }

  getById<T>(table: TableName, id: number): T | undefined {
    return (this.tables[table] as any[]).find((row) => row.id === id);
  }

  /**
   * 比较并交换（乐观锁）。
   * 仅当当前版本等于 expectedVersion 时才应用变更并提交。
   * 返回 true 表示提交成功，false 表示版本冲突（另一台设备已提交）。
   */
  cas(mutator: (draft: DbShape) => void, expectedVersion: number): boolean {
    if (this.version !== expectedVersion) {
      return false;
    }
    const draft = deepClone(this.tables);
    mutator(draft);
    this.tables = draft;
    this.version += 1;
    this.persist();
    this.notify();
    return true;
  }

  /**
   * 无条件变更（用于不涉及并发冲突的写操作）。
   */
  mutate(mutator: (draft: DbShape) => void): void {
    const draft = deepClone(this.tables);
    mutator(draft);
    this.tables = draft;
    this.version += 1;
    this.persist();
    this.notify();
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(): void {
    this.listeners.forEach((listener) => listener());
  }
}

export const database = new Database();
export { deepClone };
