import type { AnswerRecord } from "../types/AnswerRecord";
import type { BrailleSymbol } from "../types/BrailleSymbol";
import type { Lesson } from "../types/Lesson";
import type { PracticeSession } from "../types/PracticeSession";
import type { SymbolMerge } from "../types/SymbolMerge";

/** 归并锁单例：CAS 条件 = version 仍等于读取时的值 */
export interface MergeLockRow {
  key: string;
  held_by: string;
  request_id: string;
  kept_symbol_id: number;
  merged_symbol_id: number;
  acquired_at: string;
  expires_at: string;
  version: number;
}

export interface BrailleDatabaseSchema {
  brailleSymbol: BrailleSymbol;
  lesson: Lesson;
  practiceSession: PracticeSession;
  answerRecord: AnswerRecord;
  symbolMerge: SymbolMerge;
  mergeLock: MergeLockRow;
}

export type StoreNames = keyof BrailleDatabaseSchema;
