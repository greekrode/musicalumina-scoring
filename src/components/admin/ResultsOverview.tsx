import {
  Award,
  Calendar,
  ChevronDown,
  Clock,
  Download,
  Eye,
  EyeOff,
  Lock,
  Medal,
  MessageSquare,
  RefreshCw,
  Star,
  Trophy,
  Users,
  X,
} from 'lucide-react';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useEventCategories } from '../../hooks/useEventCategories';
import { useEvents } from '../../hooks/useEvents';
import { useParticipants } from '../../hooks/useParticipants';
import { usePrizeConfigurations } from '../../hooks/usePrizeConfigurations';
import { useRealtimeScoring } from '../../hooks/useRealtimeScoring';
import { useFinalizeScores } from '../../hooks/useFinalizeScores';
import { usePrizeAssignmentCalculation } from '../../hooks/usePrizeAssignmentCalculation';
import { useResultsExport } from '../../hooks/useResultsExport';
import { useParticipantScores } from '../../hooks/useParticipantScores';
import { supabase } from '../../lib/supabase';
import { ParticipantWithPrize } from '../../types';
import { ParticipantWithScores } from '../../types/results';
import WatchVideoLink from '../shared/WatchVideoLink';
import { Eyebrow } from '../shared/StateCard';
import EditScoresModal from './EditScoresModal';
import RemarksModal from './RemarksModal';
import FinalizeModal from './FinalizeModal';
import ResultsCapture from './ResultsCapture';

// --- Memoized row component ---
interface ResultRowProps {
  participant: ParticipantWithScores | ParticipantWithPrize;
  index: number;
  showAllCategories: boolean;
  hasPrizeConfigs: boolean;
  hideScores: boolean;
  onEditScores: (id: string) => void;
  onViewRemarks: (id: string) => void;
  readOnly: boolean;
}

const ResultRow = React.memo(function ResultRow({
  participant,
  index,
  showAllCategories,
  hasPrizeConfigs,
  hideScores,
  onEditScores,
  onViewRemarks,
  readOnly,
}: ResultRowProps) {
  // ParticipantWithPrize uses participant_name; ParticipantWithScores uses fullName.
  // Do not use `'prizeLevel' in participant` — prize rows may omit that key (e.g. no
  // scores yet while prize configs exist), which incorrectly picked fullName and showed blank names.
  const isPrizeTableRow = 'participant_name' in participant;
  const prizeLevel = isPrizeTableRow ? participant.prizeLevel : undefined;
  const displayOrder = isPrizeTableRow ? participant.prizeDisplayOrder : undefined;
  const participantName =
    'fullName' in participant && participant.fullName
      ? participant.fullName
      : 'participant_name' in participant
        ? participant.participant_name
        : '';
  const score = participant.averageScore;
  const scoreCount = participant.scoreCount;
  const piece = participant.piece;
  const duration = participant.duration;
  const juryScores = participant.juryScores;
  const participantId = participant.id;
  const videoUrl = participant.videoUrl;
  const category = isPrizeTableRow
    ? ''
    : (participant as ParticipantWithScores).category;

  const getPrizeIcon = (level?: string, order?: number) => {
    if (!level) return <Star className="h-5 w-5 text-ink-subtle" />;
    if (order === 1) return <Trophy className="h-5 w-5 text-marigold" />;
    if (order === 2) return <Medal className="h-5 w-5 text-ink-muted" />;
    if (order === 3) return <Medal className="h-5 w-5 text-marigold-700" />;
    return <Award className="h-5 w-5 text-marigold" />;
  };

  const getPrizeRowClass = (order?: number) => {
    if (!order) return '';
    if (order <= 3) return 'bg-marigold-50';
    return 'bg-surface-warm';
  };

  return (
    <tr
      className={`border-b border-rule-hairline hover:bg-surface-warm/60 ${
        showAllCategories ? '' : getPrizeRowClass(displayOrder)
      }`}
    >
      {!showAllCategories && (
        <td className="table-cell whitespace-nowrap">
          <div className="flex items-center">
            {getPrizeIcon(prizeLevel, displayOrder)}
            <span className="ml-2 text-sm font-medium text-ink-primary">
              {prizeLevel || `#${index + 1}`}
            </span>
          </div>
        </td>
      )}
      <td className="table-cell whitespace-nowrap">
        <div className="text-sm font-medium text-ink-primary">
          {participantName}
        </div>
      </td>
      {showAllCategories && (
        <td className="table-cell whitespace-nowrap">
          <div className="text-sm text-ink-body">{category}</div>
        </td>
      )}
      <td className="table-cell">
        <div className="text-sm text-ink-body">{piece}</div>
        <div className="flex items-center text-sm text-ink-muted">
          <Clock className="mr-1 h-3 w-3" />
          {duration !== 'Not specified' ? duration : '--'}
        </div>
      </td>
      <td className="table-cell whitespace-nowrap">
        <WatchVideoLink videoUrl={videoUrl} />
      </td>
      <td className="table-cell whitespace-nowrap">
        <div className="text-[1.125rem] font-semibold text-ink-primary">
          {hideScores ? '•••' : scoreCount > 0 ? score.toFixed(2) : '--'}
        </div>
      </td>
      <td className="table-cell whitespace-nowrap">
        <div className="mb-1 flex items-center text-sm text-ink-muted">
          <Users className="mr-1 h-4 w-4" />
          {scoreCount} jury
        </div>
        <div className="space-y-0.5 text-xs text-ink-muted">
          {hideScores
            ? 'Hidden'
            : juryScores.map((jury, idx) => (
                <div key={idx}>
                  {jury.name}: {jury.score.toFixed(1)}
                </div>
              ))}
        </div>
      </td>
      <td className="table-cell whitespace-nowrap">
        <div className="flex flex-col gap-2 sm:flex-row">
          {!readOnly && juryScores.length > 0 && (
            <button
              onClick={() => onEditScores(participantId)}
              className="btn-outline btn-sm"
            >
              Edit Scores
            </button>
          )}
          <button
            onClick={() => onViewRemarks(participantId)}
            className="btn-outline btn-sm"
          >
            <MessageSquare className="h-3 w-3" />
            Remarks
          </button>
        </div>
      </td>
    </tr>
  );
});

// --- Main component ---
/** readOnly: score_staff view (no editing or finalizing; RLS enforces it too). */
export default function ResultsOverview({ readOnly = false }: { readOnly?: boolean }) {
  const isInitialEventRef = useRef(true);
  const [selectedEventId, setSelectedEventId] = useState<string>(() => {
    if (typeof window === 'undefined') return '';
    return localStorage.getItem('resultsOverviewEventId') || '';
  });
  const [selectedCategoryCombo, setSelectedCategoryCombo] = useState<string>(
    () => {
      if (typeof window === 'undefined') return '';
      return localStorage.getItem('resultsOverviewCategoryCombo') || '';
    }
  );
  const [hideScores, setHideScores] = useState(false);
  const [realtimeActive, setRealtimeActive] = useState(false);
  const [realtimeRefreshKey, setRealtimeRefreshKey] = useState(0);
  const [realtimeRefreshInProgress, setRealtimeRefreshInProgress] =
    useState(false);
  const [toast, setToast] = useState<{
    message: string;
    type: 'success' | 'error';
  } | null>(null);

  // Modal state
  const [editTarget, setEditTarget] = useState<ParticipantWithScores | null>(
    null
  );
  const [remarksData, setRemarksData] = useState<Array<{
    jury_name: string;
    remarks: string;
  }> | null>(null);
  const [finalizeModalOpen, setFinalizeModalOpen] = useState(false);

  const {
    finalizeScores: finalizeScoresMutation,
    finalizing,
    error: finalizeError,
  } = useFinalizeScores();
  const { exportResults, exporting } = useResultsExport();
  const { events, loading: eventsLoading } = useEvents();
  const { categories, loading: categoriesLoading } =
    useEventCategories(selectedEventId);

  const [categoryId, subcategoryId] =
    selectedCategoryCombo && selectedCategoryCombo !== 'all'
      ? selectedCategoryCombo.split('|')
      : ['', ''];
  const { participants, loading: participantsLoading } = useParticipants(
    categoryId,
    subcategoryId
  );

  const eventId = categories.find(
    (c) => c.categoryId === categoryId && c.subcategoryId === subcategoryId
  )?.eventId;
  const { prizeConfigurations, loading: prizeConfigsLoading } =
    usePrizeConfigurations(eventId, categoryId, subcategoryId);

  const {
    data: participantsWithScores,
    isLoading: scoresLoading,
    refetch: refetchScores,
  } = useParticipantScores({
    participants,
    categories,
    selectedEventId,
    selectedCategoryCombo,
    categoryId,
    subcategoryId,
  });

  const { prizeAssignments, assignedParticipants } =
    usePrizeAssignmentCalculation(participantsWithScores, prizeConfigurations);

  // --- Effects ---
  useEffect(() => {
    if (finalizeError) {
      setToast({ message: finalizeError, type: 'error' });
    }
  }, [finalizeError]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      if (selectedCategoryCombo) {
        localStorage.setItem(
          'resultsOverviewCategoryCombo',
          selectedCategoryCombo
        );
      } else {
        localStorage.removeItem('resultsOverviewCategoryCombo');
      }
    }
  }, [selectedCategoryCombo]);

  useEffect(() => {
    if (!toast) return;
    const timeout = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(timeout);
  }, [toast]);

  useEffect(() => {
    if (!eventsLoading && events.length > 0 && !selectedEventId) {
      setSelectedEventId(events[0].id);
    }
  }, [events, eventsLoading, selectedEventId]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      if (selectedEventId) {
        localStorage.setItem('resultsOverviewEventId', selectedEventId);
      } else {
        localStorage.removeItem('resultsOverviewEventId');
      }
    }
    if (isInitialEventRef.current) {
      isInitialEventRef.current = false;
      return;
    }
    setSelectedCategoryCombo('');
    if (typeof window !== 'undefined') {
      localStorage.removeItem('resultsOverviewCategoryCombo');
    }
  }, [selectedEventId]);

  // Realtime
  const handleScoringChange = useCallback(() => {
    if (selectedCategoryCombo) {
      setRealtimeActive(true);
      refetchScores();
      setTimeout(() => setRealtimeActive(false), 2000);
    }
  }, [selectedCategoryCombo, refetchScores]);

  const { status: realtimeStatus } = useRealtimeScoring({
    eventId: selectedEventId,
    categoryId,
    subcategoryId,
    onScoringChange: handleScoringChange,
    enabled: !!selectedEventId && !!selectedCategoryCombo,
    refreshKey: realtimeRefreshKey,
  });

  const handleRefreshRealtime = useCallback(() => {
    if (!selectedCategoryCombo) return;
    setRealtimeRefreshInProgress(true);
    setRealtimeRefreshKey((prev) => prev + 1);
  }, [selectedCategoryCombo]);

  useEffect(() => {
    if (!realtimeRefreshInProgress) return;
    if (realtimeStatus.connected || realtimeStatus.error) {
      setRealtimeRefreshInProgress(false);
    }
  }, [realtimeRefreshInProgress, realtimeStatus.connected, realtimeStatus.error]);

  useEffect(() => {
    if (!selectedEventId || !selectedCategoryCombo) return;
    if (!realtimeStatus.error || realtimeRefreshInProgress) return;
    const timeout = setTimeout(() => {
      setRealtimeRefreshInProgress(true);
      setRealtimeRefreshKey((prev) => prev + 1);
    }, 4000);
    return () => clearTimeout(timeout);
  }, [realtimeStatus.error, selectedEventId, selectedCategoryCombo, realtimeRefreshInProgress]);

  // --- Handlers ---
  const showToast = useCallback(
    (message: string, type: 'success' | 'error' = 'success') => {
      setToast({ message, type });
    },
    []
  );

  const openEditScores = useCallback(
    (participantId: string) => {
      const record = participantsWithScores.find((p) => p.id === participantId);
      if (record) setEditTarget(record);
    },
    [participantsWithScores]
  );

  const viewRemarks = useCallback(
    async (participantId: string) => {
      try {
        const { data: remarks, error } = await supabase
          .from('event_scoring')
          .select('jury_name, remarks')
          .eq('registration_id', participantId)
          .not('remarks', 'is', null)
          .not('remarks', 'eq', '');

        if (error) throw error;
        setRemarksData(remarks || []);
      } catch (err) {
        console.error('Error fetching remarks:', err);
        showToast('Failed to fetch remarks. Please try again.', 'error');
      }
    },
    [showToast]
  );

  const handleExportResults = useCallback(async () => {
    if (!categoryId || !subcategoryId) {
      showToast('Please select a category before exporting.', 'error');
      return;
    }
    try {
      await exportResults({
        events,
        selectedEventId,
        categories,
        categoryId,
        subcategoryId,
        prizeConfigurations,
        assignedParticipants,
        participantsWithScores,
      });
      showToast('Results exported successfully.');
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : 'Failed to export CSV. Please try again.';
      showToast(message, 'error');
    }
  }, [
    categoryId,
    subcategoryId,
    exportResults,
    events,
    selectedEventId,
    categories,
    prizeConfigurations,
    assignedParticipants,
    participantsWithScores,
    showToast,
  ]);

  const handleFinalizeScores = useCallback(async () => {
    if (
      !categoryId ||
      !subcategoryId ||
      !selectedEventId ||
      selectedCategoryCombo === 'all'
    ) {
      showToast(
        'Please select a specific category before finalizing scores.',
        'error'
      );
      return;
    }

    const winners = assignedParticipants.filter((p) => !!p.prizeLevel);

    try {
      await finalizeScoresMutation({
        eventId: selectedEventId,
        categoryId,
        subcategoryId,
        winners,
      });
      refetchScores();
      showToast('Scores have been finalized successfully!');
      setFinalizeModalOpen(false);
    } catch (err) {
      console.error('Error finalizing scores:', err);
      showToast('Failed to finalize scores. Please try again.', 'error');
    }
  }, [
    categoryId,
    subcategoryId,
    selectedEventId,
    selectedCategoryCombo,
    assignedParticipants,
    finalizeScoresMutation,
    refetchScores,
    showToast,
  ]);

  const showAllCategories = selectedCategoryCombo === 'all';
  const loading =
    categoriesLoading || participantsLoading || scoresLoading || prizeConfigsLoading;

  const displayParticipants = showAllCategories
    ? participantsWithScores
    : prizeConfigurations.length > 0
    ? assignedParticipants
    : participantsWithScores;

  // --- Render ---
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
        <Eyebrow>Results</Eyebrow>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <h2 className="text-[1.5rem]">Competition Results</h2>
          {realtimeActive && (
            <div className="pill-ok animate-pulse">
              <span className="h-2 w-2 animate-ping rounded-full bg-status-open-fg"></span>
              Live Update
            </div>
          )}
        </div>
        <p className="mt-1 text-ink-muted">
          {showAllCategories
            ? 'View high scorers across all categories (sorted by score)'
            : 'View prize assignments and participant scores'}
        </p>
        {selectedEventId && selectedCategoryCombo && (
          <div className="mt-3 flex flex-wrap items-center gap-3">
            {realtimeStatus.connected ? (
              <p className="pill-ok">
                <span className="h-2 w-2 animate-pulse rounded-full bg-status-open-fg"></span>
                Real-time sync active - updates automatically when juries
                submit scores
              </p>
            ) : realtimeStatus.error ? (
              <p className="pill-error">
                <span className="h-2 w-2 rounded-full bg-status-error-fg"></span>
                Real-time sync failed: {realtimeStatus.error}
              </p>
            ) : (
              <p className="pill-wait">
                <span className="h-2 w-2 animate-pulse rounded-full bg-status-upcoming-fg"></span>
                Connecting to real-time sync...
              </p>
            )}
            <button
              onClick={handleRefreshRealtime}
              disabled={!selectedCategoryCombo || realtimeRefreshInProgress}
              className="btn-outline btn-sm"
            >
              <RefreshCw
                className={`h-3.5 w-3.5 ${
                  realtimeRefreshInProgress ? 'animate-spin' : ''
                }`}
              />
              {realtimeRefreshInProgress
                ? 'Refreshing...'
                : 'Refresh Live Sync'}
            </button>
          </div>
        )}
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
            Please select an event to view competition results
          </p>
        </div>
      ) : (
        <>
          {/* Category Selection and Controls */}
          <div className="mb-6 flex flex-wrap items-center gap-3">
            <div className="relative">
              <select
                value={selectedCategoryCombo}
                onChange={(e) => setSelectedCategoryCombo(e.target.value)}
                className="field"
                disabled={categoriesLoading}
              >
                <option value="">Select a category</option>
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
            {!showAllCategories && (
              <>
                <button
                  onClick={handleExportResults}
                  disabled={
                    !selectedCategoryCombo ||
                    participantsWithScores.length === 0 ||
                    exporting
                  }
                  className="btn-primary"
                >
                  <Download className="h-4 w-4" />
                  {exporting ? 'Exporting...' : 'Export CSV'}
                </button>
                <ResultsCapture
                  eventTitle={events.find((e) => e.id === selectedEventId)?.title ?? ''}
                  categoryName={
                    categories.find((c) => `${c.categoryId}|${c.subcategoryId}` === selectedCategoryCombo)?.displayName ?? ''
                  }
                  rows={displayParticipants.map((p) => ({
                    name: 'fullName' in p ? p.fullName : p.participant_name,
                    piece: p.piece,
                    score: p.averageScore,
                    scoreCount: p.scoreCount,
                    prizeLevel: 'prizeLevel' in p ? p.prizeLevel : undefined,
                    prizeOrder: 'prizeDisplayOrder' in p ? p.prizeDisplayOrder : undefined,
                  }))}
                  hideScores={hideScores}
                  onDone={showToast}
                />
                {!readOnly && (
                  <button
                    onClick={() => setFinalizeModalOpen(true)}
                    disabled={
                      !selectedCategoryCombo ||
                      participantsWithScores.length === 0 ||
                      participantsWithScores.some((p) => p.isFinalized) ||
                      finalizing
                    }
                    className="btn-secondary"
                  >
                    <Lock className="h-4 w-4" />
                    {finalizing ? 'Finalizing...' : 'Finalize Scores'}
                  </button>
                )}
              </>
            )}
          </div>

          {!selectedCategoryCombo ? (
            <div className="border border-rule-hairline bg-surface-warm p-8 text-center">
              <Trophy className="mx-auto mb-4 h-12 w-12 text-ink-subtle" />
              <h3 className="mb-2 text-[1.25rem]">Select a Category</h3>
              <p className="text-ink-muted">
                Please select a category to view competition results
              </p>
            </div>
          ) : loading ? (
            <div className="flex h-64 items-center justify-center">
              <div className="spinner" />
            </div>
          ) : (
            <>
              {/* Prize Configuration Status */}
              {!showAllCategories && prizeConfigurations.length === 0 && (
                <div className="mb-6 border border-rule-hairline border-l-2 border-l-status-upcoming-fg bg-status-upcoming-bg p-4">
                  <div className="flex items-center">
                    <Award className="mr-2 h-5 w-5 text-status-upcoming-fg" />
                    <div>
                      <h3 className="text-sm font-medium text-ink-primary">
                        No Prize Configuration
                      </h3>
                      <p className="text-sm text-ink-body">
                        No prize levels have been configured for this category.
                        Participants will be displayed by rank order.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <div className="card overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="min-w-full">
                    <thead className="bg-surface-warm">
                      <tr>
                        {!showAllCategories && (
                          <th className="table-head">
                            {prizeConfigurations.length > 0
                              ? 'Prize Level'
                              : 'Rank'}
                          </th>
                        )}
                        <th className="table-head">Participant</th>
                        {showAllCategories && (
                          <th className="table-head">Category</th>
                        )}
                        <th className="table-head">Performance Piece</th>
                        <th className="table-head">Video</th>
                        <th className="table-head">
                          <div className="flex items-center gap-2">
                            <span>Final Score</span>
                            <button
                              type="button"
                              onClick={() => setHideScores((prev) => !prev)}
                              className="icon-btn h-7 w-7"
                              aria-label={
                                hideScores ? 'Show scores' : 'Hide scores'
                              }
                              title={
                                hideScores ? 'Show scores' : 'Hide scores'
                              }
                            >
                              {hideScores ? (
                                <EyeOff className="h-4 w-4" />
                              ) : (
                                <Eye className="h-4 w-4" />
                              )}
                            </button>
                          </div>
                        </th>
                        <th className="table-head">Jury Count</th>
                        <th className="table-head">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {displayParticipants.map((participant, index) => (
                        <ResultRow
                          key={participant.id}
                          participant={participant}
                          index={index}
                          showAllCategories={showAllCategories}
                          hasPrizeConfigs={prizeConfigurations.length > 0}
                          hideScores={hideScores}
                          onEditScores={openEditScores}
                          onViewRemarks={viewRemarks}
                          readOnly={readOnly}
                        />
                      ))}
                    </tbody>
                  </table>
                </div>

                {participantsWithScores.length === 0 && (
                  <div className="py-12 text-center">
                    <Trophy className="mx-auto h-12 w-12 text-ink-subtle" />
                    <h3 className="mt-2 text-[1.25rem]">No results yet</h3>
                    <p className="mt-1 text-sm text-ink-muted">
                      Scores will appear here once jury members begin scoring
                      participants.
                    </p>
                  </div>
                )}
              </div>

              {/* Prize Summary */}
              {!showAllCategories &&
                prizeConfigurations.length > 0 &&
                prizeAssignments.length > 0 && (
                  <div className="card mt-6 p-6">
                    <h3 className="mb-4 text-[1.25rem]">Prize Summary</h3>
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                      {prizeAssignments.map((assignment) => (
                        <div
                          key={assignment.prizeLevel}
                          className="border border-rule-hairline bg-surface-warm p-4"
                        >
                          <div className="mb-2 flex items-center">
                            <Award className="h-5 w-5 text-marigold" />
                            <h4 className="ml-2 font-medium text-ink-primary">
                              {assignment.prizeLevel}
                            </h4>
                          </div>
                          <p className="mb-2 text-sm text-ink-muted">
                            {assignment.winners.length} of{' '}
                            {assignment.maxWinners} winners
                            {assignment.winners.length >
                              assignment.maxWinners && ' (tied)'}
                          </p>
                          {assignment.winners.length > 0 && (
                            <div className="text-xs text-ink-muted">
                              Score range:{' '}
                              {Math.min(
                                ...assignment.winners.map((w) => w.averageScore)
                              ).toFixed(2)}{' '}
                              -{' '}
                              {Math.max(
                                ...assignment.winners.map((w) => w.averageScore)
                              ).toFixed(2)}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
            </>
          )}
        </>
      )}

      {/* Modals */}
      {editTarget && (
        <EditScoresModal
          participant={editTarget}
          onClose={() => setEditTarget(null)}
          onSaved={() => {
            refetchScores();
            showToast('Jury scores updated successfully.');
          }}
          onError={(msg) => showToast(msg, 'error')}
        />
      )}

      {remarksData !== null && (
        <RemarksModal
          remarks={remarksData}
          onClose={() => setRemarksData(null)}
        />
      )}

      {finalizeModalOpen && (
        <FinalizeModal
          finalizing={finalizing}
          onConfirm={handleFinalizeScores}
          onClose={() => setFinalizeModalOpen(false)}
        />
      )}

      {toast && (
        <div className="fixed bottom-4 right-4 z-50 max-w-[calc(100vw-2rem)]">
          <div
            role="status"
            className={`flex items-center gap-3 border border-l-2 border-rule-hairline bg-surface-elevated px-4 py-3 text-sm text-ink-body ${
              toast.type === 'success'
                ? 'border-l-status-open-fg'
                : 'border-l-status-error-fg'
            }`}
          >
            <span>{toast.message}</span>
            <button
              onClick={() => setToast(null)}
              className="icon-btn h-6 w-6"
              aria-label="Dismiss"
              title="Dismiss"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
