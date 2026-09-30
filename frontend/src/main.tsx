import { useState } from "react";
import { createRoot } from "react-dom/client";
import { routes } from "./router/routes";
import { LearnPage } from "./pages/LearnPage";
import { PracticePage } from "./pages/PracticePage";
import { MistakesPage } from "./pages/MistakesPage";
import { ProgressPage } from "./pages/ProgressPage";
import { MergePage } from "./pages/MergePage";
import "./styles.css";

function App() {
  const [active, setActive] = useState<string>(routes[0]?.route ?? "/learn");
  // 归并/拆回后递增，错题本与学习进度据此重新按保留卡片重算
  const [revision, setRevision] = useState(0);

  const navigate = (route: string) => {
    setActive(route);
    setRevision((value) => value + 1);
  };

  return (
    <div className="shell">
      <aside>
        <div className="brand">盲文点字学习训练器</div>
        <nav>
          {routes.map((route) => (
            <button key={route.route} className={active === route.route ? "active" : ""} onClick={() => navigate(route.route)}>
              {route.name}
            </button>
          ))}
        </nav>
      </aside>
      <div className="page">
        {active === "/learn" && <LearnPage onNavigateMerge={() => navigate("/merge")} />}
        {active === "/practice" && <PracticePage />}
        {active === "/mistakes" && <MistakesPage revision={revision} />}
        {active === "/progress" && <ProgressPage revision={revision} />}
        {active === "/merge" && <MergePage />}
      </div>
    </div>
  );
}

createRoot(document.getElementById("root")!).render(<App />);
