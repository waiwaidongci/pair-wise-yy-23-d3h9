// 本地模拟数据：盲文点字学习训练器
// 点字 cell_pattern 采用六点制点位编号（如 "12" 表示 1、2 点凸起）
export const mockData = {
  "brailleSymbol": [
    { id: 1, cell_pattern: "1", letter: "a", pinyin: "a", category: "LETTER", difficulty: "1", audio_hint_key: "a" },
    { id: 2, cell_pattern: "12", letter: "b", pinyin: "b", category: "LETTER", difficulty: "1", audio_hint_key: "b" },
    { id: 3, cell_pattern: "14", letter: "c", pinyin: "c", category: "LETTER", difficulty: "2", audio_hint_key: "c" },
    { id: 4, cell_pattern: "145", letter: "d", pinyin: "d", category: "LETTER", difficulty: "2", audio_hint_key: "d" },
    { id: 5, cell_pattern: "15", letter: "e", pinyin: "e", category: "LETTER", difficulty: "1", audio_hint_key: "e" },
    { id: 6, cell_pattern: "124", letter: "f", pinyin: "f", category: "LETTER", difficulty: "2", audio_hint_key: "f" },
    { id: 7, cell_pattern: "1245", letter: "g", pinyin: "g", category: "LETTER", difficulty: "2", audio_hint_key: "g" },
    { id: 8, cell_pattern: "125", letter: "h", pinyin: "h", category: "LETTER", difficulty: "2", audio_hint_key: "h" },
    { id: 9, cell_pattern: "24", letter: "i", pinyin: "i", category: "LETTER", difficulty: "1", audio_hint_key: "i" },
    { id: 10, cell_pattern: "245", letter: "j", pinyin: "j", category: "LETTER", difficulty: "2", audio_hint_key: "j" },
    { id: 11, cell_pattern: "13", letter: "k", pinyin: "k", category: "LETTER", difficulty: "2", audio_hint_key: "k" },
    { id: 12, cell_pattern: "123", letter: "l", pinyin: "l", category: "LETTER", difficulty: "2", audio_hint_key: "l" },
    { id: 13, cell_pattern: "134", letter: "m", pinyin: "m", category: "LETTER", difficulty: "3", audio_hint_key: "m" },
    { id: 14, cell_pattern: "1345", letter: "n", pinyin: "n", category: "LETTER", difficulty: "3", audio_hint_key: "n" },
    { id: 15, cell_pattern: "135", letter: "o", pinyin: "o", category: "LETTER", difficulty: "2", audio_hint_key: "o" },
    { id: 16, cell_pattern: "1234", letter: "p", pinyin: "p", category: "LETTER", difficulty: "3", audio_hint_key: "p" },
    { id: 17, cell_pattern: "12345", letter: "q", pinyin: "q", category: "LETTER", difficulty: "3", audio_hint_key: "q" },
    { id: 18, cell_pattern: "1235", letter: "r", pinyin: "r", category: "LETTER", difficulty: "3", audio_hint_key: "r" },
    { id: 19, cell_pattern: "234", letter: "s", pinyin: "s", category: "LETTER", difficulty: "2", audio_hint_key: "s" },
    { id: 20, cell_pattern: "2345", letter: "t", pinyin: "t", category: "LETTER", difficulty: "3", audio_hint_key: "t" },
    // 重复卡片：与 id 1 同点字字符（cell_pattern "1"），老师整理时发现需归并
    { id: 21, cell_pattern: "1", letter: "a", pinyin: "a", category: "LETTER", difficulty: "1", audio_hint_key: "a-dup" }
  ],
  "lesson": [
    { id: 1, title: "第一课 a-e", symbol_ids: [1, 2, 3, 4, 5], stage: "入门", estimated_minutes: 15, unlock_rule: "无" },
    { id: 2, title: "第二课 f-j", symbol_ids: [6, 7, 8, 9, 10], stage: "入门", estimated_minutes: 20, unlock_rule: "完成第一课" },
    { id: 3, title: "第三课 k-o", symbol_ids: [11, 12, 13, 14, 15], stage: "进阶", estimated_minutes: 25, unlock_rule: "完成第二课" },
    { id: 4, title: "第四课 p-t", symbol_ids: [16, 17, 18, 19, 20], stage: "进阶", estimated_minutes: 30, unlock_rule: "完成第三课" },
    // 引用了重复卡片 id 21 的课程，归并时需迁到保留卡片
    { id: 5, title: "复习课 a", symbol_ids: [21, 1], stage: "复习", estimated_minutes: 10, unlock_rule: "完成第一课" }
  ],
  "practiceSession": [
    { id: 1, lesson_id: 1, mode: "CELL_TO_TEXT", started_at: "2026-06-11T09:00:00Z", finished_at: "2026-06-11T09:20:00Z", score: 85, mistake_count: 1 },
    { id: 2, lesson_id: 2, mode: "TEXT_TO_CELL", started_at: "2026-06-12T09:00:00Z", finished_at: "2026-06-12T09:25:00Z", score: 70, mistake_count: 2 },
    { id: 3, lesson_id: 5, mode: "LISTENING", started_at: "2026-06-13T09:00:00Z", finished_at: "2026-06-13T09:15:00Z", score: 60, mistake_count: 3 },
    { id: 4, lesson_id: 5, mode: "MIXED", started_at: "2026-06-14T09:00:00Z", finished_at: "2026-06-14T09:30:00Z", score: 90, mistake_count: 1 }
  ],
  "answerRecord": [
    { id: 1, session_id: 1, symbol_id: 1, user_answer: "a", correct: "true", latency_ms: 1200, mistake_reason: "" },
    { id: 2, session_id: 1, symbol_id: 2, user_answer: "b", correct: "true", latency_ms: 1500, mistake_reason: "" },
    { id: 3, session_id: 2, symbol_id: 6, user_answer: "f", correct: "true", latency_ms: 1800, mistake_reason: "" },
    { id: 4, session_id: 2, symbol_id: 9, user_answer: "i", correct: "false", latency_ms: 2200, mistake_reason: "点位遗漏" },
    // 引用了重复卡片 id 21 的答题记录，归并时需迁到保留卡片
    { id: 5, session_id: 3, symbol_id: 21, user_answer: "a", correct: "false", latency_ms: 2000, mistake_reason: "点位遗漏" },
    { id: 6, session_id: 3, symbol_id: 21, user_answer: "a", correct: "true", latency_ms: 1600, mistake_reason: "" },
    { id: 7, session_id: 4, symbol_id: 1, user_answer: "a", correct: "true", latency_ms: 1100, mistake_reason: "" }
  ]
} as const;
