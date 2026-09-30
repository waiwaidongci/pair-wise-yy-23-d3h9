import type {
  BrailleSymbolMerge,
  MergeRequest,
  MergeSnapshot,
  AffectedRecordSnapshot
} from "../types/BrailleSymbolMerge";
import { createDefaultBrailleSymbol } from "./BrailleSymbolConstructor";

export const createDefaultMergeRequest = (overrides: Partial<MergeRequest> = {}): MergeRequest => ({
  request_id: "",
  source_symbol_id: 0,
  target_symbol_id: 0,
  ...overrides
});

export const createMergeRequestForm = createDefaultMergeRequest;

export const createDefaultAffectedRecordSnapshot = (
  overrides: Partial<AffectedRecordSnapshot> = {}
): AffectedRecordSnapshot => ({
  table: "lesson",
  record_id: 0,
  before: {},
  after: {},
  ...overrides
});

export const createDefaultMergeSnapshot = (overrides: Partial<MergeSnapshot> = {}): MergeSnapshot => ({
  source_symbol: createDefaultBrailleSymbol(),
  affected_lessons: [],
  affected_answer_records: [],
  impacted_session_ids: [],
  ...overrides
});

export const createDefaultBrailleSymbolMerge = (
  overrides: Partial<BrailleSymbolMerge> = {}
): BrailleSymbolMerge => ({
  id: 0,
  request_id: "",
  source_symbol_id: 0,
  target_symbol_id: 0,
  status: "PENDING",
  snapshot: null,
  affected_lesson_ids: [],
  affected_session_ids: [],
  affected_answer_record_ids: [],
  conflict_version: null,
  error_code: null,
  error_message: null,
  created_at: "",
  updated_at: "",
  committed_at: null,
  ...overrides
});

export const createBrailleSymbolMergeForm = createDefaultBrailleSymbolMerge;
export const createBrailleSymbolMergeResponse = createDefaultBrailleSymbolMerge;
