import React, { useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { routes } from "./router/routes";
import { database, type TableName } from "./db/database";
import { useDatabaseTable } from "./hooks/useDatabase";
import { MergePage } from "./pages/MergePage";
import { StatusBadge } from "./components/common/StatusBadge";
import { StatCard } from "./components/common/StatCard";
import "./styles.css";

const ENTITY_TABLES: { key: TableName; label: string }[] = [
  { key: "brailleSymbol", label: "点字字符" },
  { key: "lesson", label: "课程" },
  { key: "practiceSession", label: "练习会话" },
  { key: "answerRecord", label: "答题记录" },
  { key: "mergeRecord", label: "归并记录" }
];

function Page({ name }: { name: string }) {
  // 订阅数据库变更，归并后实体计数自动刷新
  const symbols = useDatabaseTable<{ id: number }>("brailleSymbol");
  const lessons = useDatabaseTable<{ id: number }>("lesson");
  const sessions = useDatabaseTable<{ id: number }>("practiceSession");
  const records = useDatabaseTable<{ id: number }>("answerRecord");
  const merges = useDatabaseTable<{ id: number }>("mergeRecord");

  const counts: Record<TableName, number> = {
    brailleSymbol: symbols.length,
    lesson: lessons.length,
    practiceSession: sessions.length,
    answerRecord: records.length,
    mergeRecord: merges.length,
    symbolIdMapping: database.getAll("symbolIdMapping").length
  };
  const total = useMemo(
    () => Object.values(counts).reduce((sum, n) => sum + n, 0),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [symbols.length, lessons.length, sessions.length, records.length, merges.length]
  );

  return (
    <main className="page">
      <section className="page-head">
        <div>
          <p className="eyebrow">braille-trainer</p>
          <h1>{name}</h1>
        </div>
        <StatusBadge value="LOCAL_DATA" />
      </section>
      <section className="metrics">
        <StatCard label="核心模型" value={ENTITY_TABLES.length} />
        <StatCard label="本地记录" value={total} />
        <StatCard label="共享枚举" value={3} />
      </section>
      <section className="workbench">
        <div className="panel wide">
          <h2>业务数据</h2>
          <div className="table">
            {ENTITY_TABLES.map(({ key, label }) => (
              <article key={key} className="row">
                <strong>{label}</strong>
                <span>{counts[key]} 条</span>
                <StatusBadge value={counts[key] > 0 ? "READY" : "EMPTY"} />
              </article>
            ))}
          </div>
        </div>
        <div className="panel">
          <h2>联动检查</h2>
          <p>
            字符归并支持保留卡片选择、影响预览、乐观锁并发控制、幂等恢复、快照拆回，
            归并后错题本与学习进度按保留卡片重算。
          </p>
        </div>
      </section>
    </main>
  );
}

function App() {
  const [active, setActive] = useState<string>(routes[0]?.route ?? "/dashboard");
  const current = routes.find((route) => route.route === active) ?? routes[0];
  return (
    <div className="shell">
      <aside>
        <div className="brand">盲文点字学习训练器</div>
        <nav>
          {routes.map((route) => (
            <button
              key={route.route}
              className={active === route.route ? "active" : ""}
              onClick={() => setActive(route.route)}
            >
              {route.name}
            </button>
          ))}
        </nav>
      </aside>
      {active === "/merge" ? <MergePage /> : <Page name={current?.name ?? "工作台"} />}
    </div>
  );
}

createRoot(document.getElementById("root")!).render(<App />);
