import React, { useState } from "react";
import { Calendar, BarChart3, Users, Trophy, FileText } from "lucide-react";
import { useApp } from "../../context/AppContext";
import EventsManager from "./EventsManager";
import ResultsOverview from "./ResultsOverview";
import ScoringHistory from "./ScoringHistory";

type TabType = "events" | "results" | "history";

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState<TabType>("events");
  const { state } = useApp();

  const tabs = [
    { id: "events" as TabType, name: "Events", icon: Calendar },
    { id: "results" as TabType, name: "Results", icon: BarChart3 },
    { id: "history" as TabType, name: "History", icon: FileText },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-piano-wine mb-2">
          Admin Dashboard
        </h1>
        <p className="text-gray-600">
          Manage competition events, scoring criteria, and view results
        </p>
      </div>

      {/* Tab Navigation */}
      <div className="bg-white rounded-xl shadow-sm border border-piano-gold/20 overflow-hidden">
        <div className="border-b border-piano-gold/20">
          <nav className="-mb-px flex">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`${
                  activeTab === tab.id
                    ? "border-piano-wine text-piano-wine bg-piano-cream"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                } whitespace-nowrap py-4 px-6 border-b-2 font-medium text-sm flex items-center transition-colors duration-200`}
              >
                <tab.icon className="w-5 h-5 mr-2" />
                {tab.name}
              </button>
            ))}
          </nav>
        </div>

        <div className="p-6 bg-piano-cream/30">
          {activeTab === "events" && <EventsManager />}
          {activeTab === "results" && <ResultsOverview />}
          {activeTab === "history" && <ScoringHistory />}
        </div>
      </div>
    </div>
  );
}
