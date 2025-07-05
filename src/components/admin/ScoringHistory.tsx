import React, { useState, useEffect } from "react";
import {
  Clock,
  User,
  Music,
  FileText,
  Search,
  Filter,
  History,
  Calendar,
} from "lucide-react";
import { useApp } from "../../context/AppContext";
import { EventScoringHistory } from "../../types";
import {
  getScoringHistory,
  formatHistoryEntry,
} from "../../lib/scoringHistory";
import { useEventCategories } from "../../hooks/useEventCategories";
import { useEvents } from "../../hooks/useEvents";
import { useRealtimeScoring } from "../../hooks/useRealtimeScoring";

export default function ScoringHistory() {
  const { state } = useApp();
  const [selectedEventId, setSelectedEventId] = useState<string>("");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedOperation, setSelectedOperation] = useState<string>("all");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [selectedJury, setSelectedJury] = useState<string>("all");
  const [historyEntries, setHistoryEntries] = useState<EventScoringHistory[]>(
    []
  );
  const [loading, setLoading] = useState(true);

  const { events, loading: eventsLoading } = useEvents();
  const { categories } = useEventCategories(selectedEventId);

  // Auto-select the most recent active event when events are loaded
  useEffect(() => {
    if (!eventsLoading && events.length > 0 && !selectedEventId) {
      setSelectedEventId(events[0].id);
    }
  }, [events, eventsLoading, selectedEventId]);

  // Reset other filters when event changes
  useEffect(() => {
    setSelectedCategory("all");
    setSelectedJury("all");
    setHistoryEntries([]);
  }, [selectedEventId]);

  // Fetch history data when filters change (but only if event is selected)
  useEffect(() => {
    if (selectedEventId) {
      fetchHistory();
    } else {
      setHistoryEntries([]);
      setLoading(false);
    }
  }, [selectedEventId, selectedOperation, selectedCategory, selectedJury]);

  // Set up realtime subscriptions for history changes
  useRealtimeScoring({
    eventId: selectedEventId,
    categoryId: selectedCategory !== 'all' ? selectedCategory.split('|')[0] : undefined,
    subcategoryId: selectedCategory !== 'all' ? selectedCategory.split('|')[1] : undefined,
    onScoringChange: () => {
      // Don't refresh on scoring changes in history view - we only care about history changes
    },
    onHistoryChange: () => {
      // Refresh history when new history entries are added
      if (selectedEventId) {
        fetchHistory();
      }
    },
    enabled: !!selectedEventId
  });

  const fetchHistory = async () => {
    setLoading(true);
    try {
      const filters: any = { eventId: selectedEventId };
      if (selectedJury !== "all") {
        filters.changedBy = selectedJury;
      }

      let history = await getScoringHistory(filters);

      // Filter by operation type
      if (selectedOperation !== "all") {
        history = history.filter(
          (entry) => entry.operation === selectedOperation
        );
      }

      // Filter by category
      if (selectedCategory !== "all") {
        const [categoryId, subcategoryId] = selectedCategory.split("|");
        history = history.filter(
          (entry) =>
            entry.category_id === categoryId &&
            entry.subcategory_id === subcategoryId
        );
      }

      setHistoryEntries(history);
    } catch (err) {
      console.error("Error fetching history:", err);
    } finally {
      setLoading(false);
    }
  };

  // Filter entries based on search
  const filteredEntries = historyEntries.filter((entry) => {
    if (!searchTerm) return true;

    const { title, description } = formatHistoryEntry(entry);
    return (
      title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (entry.participant_name || "")
        .toLowerCase()
        .includes(searchTerm.toLowerCase()) ||
      (entry.jury_name || "").toLowerCase().includes(searchTerm.toLowerCase())
    );
  });

  // Get unique jury members from history
  const uniqueJury = Array.from(
    new Set(historyEntries.map((entry) => entry.changed_by))
  );

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const getOperationIcon = (operation: string) => {
    switch (operation) {
      case "INSERT":
        return <FileText className="w-4 h-4 text-green-600" />;
      case "UPDATE":
        return <History className="w-4 h-4 text-blue-600" />;
      case "DELETE":
        return <FileText className="w-4 h-4 text-red-600" />;
      default:
        return <FileText className="w-4 h-4 text-gray-600" />;
    }
  };

  const getOperationColor = (operation: string) => {
    switch (operation) {
      case "INSERT":
        return "bg-green-100 text-green-800";
      case "UPDATE":
        return "bg-blue-100 text-blue-800";
      case "DELETE":
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  if (eventsLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-piano-wine"></div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
        <div>
          <h2 className="text-2xl font-bold text-piano-wine">
            Scoring History
          </h2>
          <p className="text-gray-600">
            Complete audit trail of all scoring activities
          </p>
        </div>
      </div>

      {/* Event Selection - Required First Step */}
      <div className="bg-white rounded-xl shadow-sm border border-piano-gold/20 p-6 mb-6">
        <div className="flex items-center">
          <div className="flex-1">
            <label className="block text-sm font-medium text-piano-wine mb-2">
              Select Event
            </label>
            <select
              value={selectedEventId}
              onChange={(e) => setSelectedEventId(e.target.value)}
              className="w-full px-3 py-2 border border-piano-gold/30 rounded-lg focus:ring-2 focus:ring-piano-gold focus:border-transparent"
            >
              <option value="">Select an event...</option>
              {events.map((event) => (
                <option key={event.id} value={event.id}>
                  {event.title}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {!selectedEventId ? (
        <div className="bg-piano-cream rounded-xl p-8 text-center">
          <Calendar className="mx-auto h-12 w-12 text-piano-wine/40 mb-4" />
          <h3 className="text-lg font-medium text-piano-wine mb-2">
            Select an Event
          </h3>
          <p className="text-gray-600">
            Please select an event to view scoring history
          </p>
        </div>
      ) : (
        <>
          {/* Search and Filter Controls */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
            <div className="flex items-center space-x-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-piano-wine/60" />
                <input
                  type="text"
                  placeholder="Search participants, jury, or activities..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 pr-4 py-2 border border-piano-gold/30 rounded-lg focus:ring-2 focus:ring-piano-gold focus:border-transparent"
                />
              </div>
              <select
                value={selectedOperation}
                onChange={(e) => setSelectedOperation(e.target.value)}
                className="px-3 py-2 border border-piano-gold/30 rounded-lg focus:ring-2 focus:ring-piano-gold focus:border-transparent"
              >
                <option value="all">All Operations</option>
                <option value="INSERT">New Scores</option>
                <option value="UPDATE">Score Updates</option>
              </select>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="px-3 py-2 border border-piano-gold/30 rounded-lg focus:ring-2 focus:ring-piano-gold focus:border-transparent"
              >
                <option value="all">All Categories</option>
                {categories.map((category) => (
                  <option
                    key={`${category.categoryId}|${category.subcategoryId}`}
                    value={`${category.categoryId}|${category.subcategoryId}`}
                  >
                    {category.displayName}
                  </option>
                ))}
              </select>
              <select
                value={selectedJury}
                onChange={(e) => setSelectedJury(e.target.value)}
                className="px-3 py-2 border border-piano-gold/30 rounded-lg focus:ring-2 focus:ring-piano-gold focus:border-transparent"
              >
                <option value="all">All Jury</option>
                {uniqueJury.map((juryId) => (
                  <option key={juryId} value={juryId}>
                    {historyEntries.find((e) => e.changed_by === juryId)
                      ?.jury_name || juryId}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {loading ? (
            <div className="flex justify-center items-center h-64">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-piano-wine"></div>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredEntries.map((entry) => {
                const { title, description, changes } =
                  formatHistoryEntry(entry);

                return (
                  <div
                    key={entry.id}
                    className="bg-white rounded-xl shadow-sm border border-piano-gold/20 p-6"
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center space-x-4">
                        <div className="w-12 h-12 bg-piano-cream rounded-full flex items-center justify-center">
                          {getOperationIcon(entry.operation)}
                        </div>
                        <div>
                          <div className="flex items-center space-x-2 mb-1">
                            <h3 className="text-lg font-semibold text-piano-wine">
                              {title}
                            </h3>
                            <span
                              className={`px-2 py-1 text-xs font-medium rounded-full ${getOperationColor(
                                entry.operation
                              )}`}
                            >
                              {entry.operation}
                            </span>
                          </div>
                          <p className="text-sm text-gray-600">{description}</p>
                          <div className="flex items-center space-x-4 mt-2 text-xs text-gray-500">
                            <div className="flex items-center">
                              <User className="w-3 h-3 mr-1" />
                              {entry.jury_name || entry.changed_by}
                            </div>
                            <div className="flex items-center">
                              <Clock className="w-3 h-3 mr-1" />
                              {formatDate(entry.changed_at)}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {changes.length > 0 && (
                      <div className="mt-4 pt-4 border-t border-piano-gold/20">
                        <h4 className="text-sm font-medium text-piano-wine mb-3">
                          Changes
                        </h4>
                        <div className="space-y-2">
                          {changes.map((change, index) => (
                            <div
                              key={index}
                              className="flex items-center justify-between p-3 bg-piano-cream/50 rounded-lg"
                            >
                              <span className="text-sm font-medium text-gray-700 capitalize">
                                {change.field.replace("_", " ")}
                              </span>
                              <div className="flex items-center space-x-2 text-sm">
                                {change.before !== null && (
                                  <>
                                    <span className="text-red-600">
                                      {typeof change.before === "boolean"
                                        ? change.before
                                          ? "true"
                                          : "false"
                                        : change.before}
                                    </span>
                                    <span className="text-gray-400">→</span>
                                  </>
                                )}
                                <span className="text-green-600 font-medium">
                                  {typeof change.after === "boolean"
                                    ? change.after
                                      ? "true"
                                      : "false"
                                    : change.after}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {filteredEntries.length === 0 && !loading && (
            <div className="text-center py-12">
              <History className="mx-auto h-12 w-12 text-piano-wine/40" />
              <h3 className="mt-2 text-sm font-medium text-piano-wine">
                No scoring history found
              </h3>
              <p className="mt-1 text-sm text-gray-500">
                {historyEntries.length === 0
                  ? "No scoring activities have been recorded for this event yet."
                  : "Try adjusting your search criteria or filters."}
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
