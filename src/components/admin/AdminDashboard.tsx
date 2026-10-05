import { BarChart3, Calendar, FileText } from "lucide-react";
import { useEffect, useState } from "react";
import { useApp } from "../../context/AppContext";
import EventsManager from "./EventsManager";
import ResultsOverview from "./ResultsOverview";
import ScoringHistory from "./ScoringHistory";
import { Eyebrow } from "../shared/StateCard";

type TabType = "events" | "results" | "history";

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState<TabType>(() => {
    if (typeof window === "undefined") return "events";
    return (localStorage.getItem("adminDashboardActiveTab") as TabType) || "events";
  });
  const { state } = useApp();

  useEffect(() => {
    if (typeof window === "undefined") return;
    localStorage.setItem("adminDashboardActiveTab", activeTab);
  }, [activeTab]);

  const tabs = [
    { id: "events" as TabType, name: "Events", icon: Calendar },
    { id: "results" as TabType, name: "Results", icon: BarChart3 },
    { id: "history" as TabType, name: "History", icon: FileText },
  ];

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
      <div className="mb-8">
        <Eyebrow>Administration</Eyebrow>
        <h1 className="mt-4 text-[clamp(1.75rem,1.3rem+1.6vw,2.5rem)]">
          Admin Dashboard
        </h1>
        <p className="mt-2 text-ink-muted">
          Manage competition events, scoring criteria, and view results
        </p>
      </div>

      {/* Tab Navigation */}
      <div className="overflow-x-auto border-b border-rule-hairline">
        <nav className="-mb-px flex" role="tablist">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              role="tab"
              aria-selected={activeTab === tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`${
                activeTab === tab.id
                  ? "border-b-2 border-marigold text-ink-primary"
                  : "border-b-2 border-transparent text-ink-muted hover:text-ink-primary"
              } type-label flex items-center gap-2 whitespace-nowrap px-5 py-4 transition-colors duration-200`}
            >
              <tab.icon className="h-4 w-4" />
              {tab.name}
            </button>
          ))}
        </nav>
      </div>

      <div className="pt-8" role="tabpanel">
        {activeTab === "events" && <EventsManager />}
        {activeTab === "results" && <ResultsOverview />}
        {activeTab === "history" && <ScoringHistory />}
      </div>
    </div>
  );
}
