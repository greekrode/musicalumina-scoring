import { Calendar, ChevronDown, Clock, FileText, History, Search, User } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useEventCategories } from '../../hooks/useEventCategories';
import { useEvents } from '../../hooks/useEvents';
import { useRealtimeScoring } from '../../hooks/useRealtimeScoring';
import { useSupabaseQuery } from '../../hooks/useSupabaseQuery';
import {
  formatHistoryEntry,
  getScoringHistory,
} from '../../lib/scoringHistory';
import { EventScoringHistory } from '../../types';
import { Eyebrow } from '../shared/StateCard';

export default function ScoringHistory() {
  const [selectedEventId, setSelectedEventId] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedOperation, setSelectedOperation] = useState('all');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedJury, setSelectedJury] = useState('all');

  const { events, loading: eventsLoading } = useEvents();
  const { categories } = useEventCategories(selectedEventId);

  // Auto-select the most recent active event
  useEffect(() => {
    if (!eventsLoading && events.length > 0 && !selectedEventId) {
      setSelectedEventId(events[0].id);
    }
  }, [events, eventsLoading, selectedEventId]);

  // Reset filters when event changes
  useEffect(() => {
    setSelectedCategory('all');
    setSelectedJury('all');
  }, [selectedEventId]);

  // Fetch history with useSupabaseQuery
  const { data: historyEntries, isLoading: loading, refetch: refetchHistory } =
    useSupabaseQuery<EventScoringHistory[]>(
      async () => {
        const filters: { eventId: string; changedBy?: string } = {
          eventId: selectedEventId,
        };
        if (selectedJury !== 'all') {
          filters.changedBy = selectedJury;
        }

        let history = await getScoringHistory(filters);

        // Filter by operation type
        if (selectedOperation !== 'all') {
          history = history.filter(
            (entry) => entry.operation === selectedOperation
          );
        }

        // Filter by category
        if (selectedCategory !== 'all') {
          const [catId, subId] = selectedCategory.split('|');
          history = history.filter(
            (entry) =>
              entry.category_id === catId && entry.subcategory_id === subId
          );
        }

        return history;
      },
      [selectedEventId, selectedOperation, selectedCategory, selectedJury],
      [],
      { enabled: !!selectedEventId }
    );

  // Set up realtime subscriptions
  useRealtimeScoring({
    eventId: selectedEventId,
    categoryId:
      selectedCategory !== 'all' ? selectedCategory.split('|')[0] : undefined,
    subcategoryId:
      selectedCategory !== 'all' ? selectedCategory.split('|')[1] : undefined,
    onScoringChange: () => {},
    onHistoryChange: () => {
      if (selectedEventId) refetchHistory();
    },
    enabled: !!selectedEventId,
  });

  // Filter by search term
  const filteredEntries = useMemo(() => {
    if (!searchTerm) return historyEntries;

    const term = searchTerm.toLowerCase();
    return historyEntries.filter((entry) => {
      const { title, description } = formatHistoryEntry(entry);
      return (
        title.toLowerCase().includes(term) ||
        description.toLowerCase().includes(term) ||
        (entry.participant_name || '').toLowerCase().includes(term) ||
        (entry.jury_name || '').toLowerCase().includes(term)
      );
    });
  }, [historyEntries, searchTerm]);

  // Unique jury members
  const uniqueJury = useMemo(
    () => Array.from(new Set(historyEntries.map((entry) => entry.changed_by))),
    [historyEntries]
  );

  const formatDate = (dateString: string) =>
    new Date(dateString).toLocaleString();

  const getOperationIcon = (operation: string) => {
    switch (operation) {
      case 'INSERT':
        return <FileText className="h-4 w-4 text-status-open-fg" />;
      case 'UPDATE':
        return <History className="h-4 w-4 text-ink-accent" />;
      case 'DELETE':
        return <FileText className="h-4 w-4 text-status-error-fg" />;
      default:
        return <FileText className="h-4 w-4 text-ink-muted" />;
    }
  };

  const getOperationColor = (operation: string) => {
    switch (operation) {
      case 'INSERT':
        return 'pill-ok';
      case 'UPDATE':
        return 'pill-wait';
      case 'DELETE':
        return 'pill-error';
      default:
        return 'pill-muted';
    }
  };

  if (eventsLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="spinner" />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <Eyebrow>Audit</Eyebrow>
        <h2 className="mt-3 text-[1.5rem]">Scoring History</h2>
        <p className="mt-1 text-ink-muted">
          Complete audit trail of all scoring activities
        </p>
      </div>

      {/* Event Selection */}
      <div className="card mb-6 p-6">
        <div className="flex items-center">
          <div className="flex-1">
            <label className="field-label">Select Event</label>
            <div className="relative">
              <select
                value={selectedEventId}
                onChange={(e) => setSelectedEventId(e.target.value)}
                className="field"
              >
                <option value="">Select an event...</option>
                {events.map((event) => (
                  <option key={event.id} value={event.id}>
                    {event.title}
                  </option>
                ))}
              </select>
              <ChevronDown aria-hidden className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" />
            </div>
          </div>
        </div>
      </div>

      {!selectedEventId ? (
        <div className="border border-rule-hairline bg-surface-warm p-8 text-center">
          <Calendar className="mx-auto mb-4 h-12 w-12 text-ink-subtle" />
          <h3 className="mb-2 text-[1.25rem]">Select an Event</h3>
          <p className="text-ink-muted">
            Please select an event to view scoring history
          </p>
        </div>
      ) : (
        <>
          {/* Search and Filter Controls */}
          <div className="mb-6 flex flex-wrap items-center gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" />
              <input
                type="text"
                placeholder="Search participants, jury, or activities..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="field pl-10 sm:w-80"
              />
            </div>
            <div className="relative">
              <select
                value={selectedOperation}
                onChange={(e) => setSelectedOperation(e.target.value)}
                className="field"
              >
                <option value="all">All Operations</option>
                <option value="INSERT">New Scores</option>
                <option value="UPDATE">Score Updates</option>
              </select>
              <ChevronDown aria-hidden className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" />
            </div>
            <div className="relative">
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="field"
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
              <ChevronDown aria-hidden className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" />
            </div>
            <div className="relative">
              <select
                value={selectedJury}
                onChange={(e) => setSelectedJury(e.target.value)}
                className="field"
              >
                <option value="all">All Jury</option>
                {uniqueJury.map((juryId) => (
                  <option key={juryId} value={juryId}>
                    {historyEntries.find((e) => e.changed_by === juryId)
                      ?.jury_name || juryId}
                  </option>
                ))}
              </select>
              <ChevronDown aria-hidden className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" />
            </div>
          </div>

          {loading ? (
            <div className="flex h-64 items-center justify-center">
              <div className="spinner" />
            </div>
          ) : (
            <div className="space-y-4">
              {filteredEntries.map((entry) => {
                const { title, description, changes } =
                  formatHistoryEntry(entry);

                return (
                  <div key={entry.id} className="card p-6">
                    <div className="mb-4 flex items-start justify-between">
                      <div className="flex items-center gap-4">
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center bg-surface-warm">
                          {getOperationIcon(entry.operation)}
                        </div>
                        <div>
                          <div className="mb-1 flex flex-wrap items-center gap-2">
                            <h3 className="text-[1.25rem]">{title}</h3>
                            <span className={getOperationColor(entry.operation)}>
                              {entry.operation}
                            </span>
                          </div>
                          <p className="text-sm text-ink-muted">{description}</p>
                          <div className="mt-2 flex flex-wrap items-center gap-4 text-xs text-ink-muted">
                            <div className="flex items-center">
                              <User className="mr-1 h-3 w-3" />
                              {entry.jury_name || entry.changed_by}
                            </div>
                            <div className="flex items-center">
                              <Clock className="mr-1 h-3 w-3" />
                              {formatDate(entry.changed_at)}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {changes.length > 0 && (
                      <div className="mt-4 border-t border-rule-hairline pt-4">
                        <h4 className="type-label mb-3 text-ink-muted">Changes</h4>
                        <div className="space-y-2">
                          {changes.map((change, index) => (
                            <div
                              key={index}
                              className="flex items-center justify-between bg-surface-warm p-3"
                            >
                              <span className="text-sm font-medium capitalize text-ink-body">
                                {change.field.replace('_', ' ')}
                              </span>
                              <div className="flex items-center gap-2 text-sm">
                                {change.before !== null && (
                                  <>
                                    <span className="text-status-error-fg">
                                      {typeof change.before === 'boolean'
                                        ? change.before
                                          ? 'true'
                                          : 'false'
                                        : change.before}
                                    </span>
                                    <span className="text-ink-subtle">→</span>
                                  </>
                                )}
                                <span className="font-medium text-status-open-fg">
                                  {typeof change.after === 'boolean'
                                    ? change.after
                                      ? 'true'
                                      : 'false'
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
            <div className="py-12 text-center">
              <History className="mx-auto h-12 w-12 text-ink-subtle" />
              <h3 className="mt-2 text-[1.25rem]">No scoring history found</h3>
              <p className="mt-1 text-sm text-ink-muted">
                {historyEntries.length === 0
                  ? 'No scoring activities have been recorded for this event yet.'
                  : 'Try adjusting your search criteria or filters.'}
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
