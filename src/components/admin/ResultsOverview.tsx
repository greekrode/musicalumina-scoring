import {
  Award,
  Calendar,
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
import EditScoresModal from './EditScoresModal';
import RemarksModal from './RemarksModal';
import FinalizeModal from './FinalizeModal';

// --- Memoized row component ---
interface ResultRowProps {
  participant: ParticipantWithScores | ParticipantWithPrize;
  index: number;
  showAllCategories: boolean;
  hasPrizeConfigs: boolean;
  hideScores: boolean;
  onEditScores: (id: string) => void;
  onViewRemarks: (id: string) => void;
}

const ResultRow = React.memo(function ResultRow({
  participant,
  index,
  showAllCategories,
  hasPrizeConfigs,
  hideScores,
  onEditScores,
  onViewRemarks,
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
  const category = isPrizeTableRow
    ? ''
    : (participant as ParticipantWithScores).category;

  const getPrizeIcon = (level?: string, order?: number) => {
    if (!level) return <Star className="w-5 h-5 text-gray-300" />;
    if (order === 1) return <Trophy className="w-5 h-5 text-yellow-500" />;
    if (order === 2) return <Medal className="w-5 h-5 text-gray-400" />;
    if (order === 3) return <Medal className="w-5 h-5 text-amber-600" />;
    return <Award className="w-5 h-5 text-piano-gold" />;
  };

  const getPrizeRowClass = (order?: number) => {
    if (!order) return '';
    if (order <= 3) return 'bg-piano-gold/10';
    return 'bg-piano-cream/30';
  };

  return (
    <tr className={showAllCategories ? '' : getPrizeRowClass(displayOrder)}>
      {!showAllCategories && (
        <td className="px-6 py-4 whitespace-nowrap">
          <div className="flex items-center">
            {getPrizeIcon(prizeLevel, displayOrder)}
            <span className="ml-2 text-sm font-medium text-piano-wine">
              {prizeLevel || `#${index + 1}`}
            </span>
          </div>
        </td>
      )}
      <td className="px-6 py-4 whitespace-nowrap">
        <div className="text-sm font-medium text-piano-wine">
          {participantName}
        </div>
      </td>
      {showAllCategories && (
        <td className="px-6 py-4 whitespace-nowrap">
          <div className="text-sm text-gray-900">{category}</div>
        </td>
      )}
      <td className="px-6 py-4">
        <div className="text-sm text-gray-900">{piece}</div>
        <div className="text-sm text-gray-500 flex items-center">
          <Clock className="w-3 h-3 mr-1" />
          {duration !== 'Not specified' ? duration : '--'}
        </div>
      </td>
      <td className="px-6 py-4 whitespace-nowrap">
        <div className="text-lg font-bold text-piano-wine">
          {hideScores ? '•••' : scoreCount > 0 ? score.toFixed(2) : '--'}
        </div>
      </td>
      <td className="px-6 py-4 whitespace-nowrap">
        <div className="flex items-center text-sm text-gray-500 mb-1">
          <Users className="w-4 h-4 mr-1" />
          {scoreCount} jury
        </div>
        <div className="text-xs text-gray-500 space-y-0.5">
          {hideScores
            ? 'Hidden'
            : juryScores.map((jury, idx) => (
                <div key={idx}>
                  {jury.name}: {jury.score.toFixed(1)}
                </div>
              ))}
        </div>
      </td>
      <td className="px-6 py-4 whitespace-nowrap">
        <div className="flex flex-col sm:flex-row gap-2">
          {juryScores.length > 0 && (
            <button
              onClick={() => onEditScores(participantId)}
              className="inline-flex items-center px-3 py-1 text-xs font-medium rounded-lg border border-piano-gold/30 text-piano-wine hover:bg-piano-gold/10 focus:ring-2 focus:ring-piano-gold focus:ring-offset-2 transition-colors"
            >
              Edit Scores
            </button>
          )}
          <button
            onClick={() => onViewRemarks(participantId)}
            className="inline-flex items-center px-3 py-1 text-xs font-medium rounded-lg border border-piano-gold/30 text-piano-wine hover:bg-piano-gold/10 focus:ring-2 focus:ring-piano-gold focus:ring-offset-2 transition-colors"
          >
            <MessageSquare className="w-3 h-3 mr-1" />
            Remarks
          </button>
        </div>
      </td>
    </tr>
  );
});

// --- Main component ---
export default function ResultsOverview() {
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
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-piano-wine"></div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
        <div>
          <div className="flex items-center space-x-3">
            <h2 className="text-2xl font-bold text-piano-wine">
              Competition Results
            </h2>
            {realtimeActive && (
              <div className="flex items-center px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm font-medium animate-pulse">
                <div className="w-2 h-2 bg-green-500 rounded-full mr-2 animate-ping"></div>
                Live Update
              </div>
            )}
          </div>
          <p className="text-gray-600">
            {showAllCategories
              ? 'View high scorers across all categories (sorted by score)'
              : 'View prize assignments and participant scores'}
          </p>
          {selectedEventId && selectedCategoryCombo && (
            <div className="flex flex-col sm:flex-row sm:items-center sm:space-x-4 mt-2 gap-2">
              <div className="flex items-center space-x-2">
                {realtimeStatus.connected ? (
                  <p className="text-xs text-green-600 flex items-center">
                    <span className="w-2 h-2 bg-green-500 rounded-full mr-2 animate-pulse"></span>
                    Real-time sync active - updates automatically when juries
                    submit scores
                  </p>
                ) : realtimeStatus.error ? (
                  <p className="text-xs text-red-600 flex items-center">
                    <span className="w-2 h-2 bg-red-500 rounded-full mr-2"></span>
                    Real-time sync failed: {realtimeStatus.error}
                  </p>
                ) : (
                  <p className="text-xs text-yellow-600 flex items-center">
                    <span className="w-2 h-2 bg-yellow-500 rounded-full mr-2 animate-pulse"></span>
                    Connecting to real-time sync...
                  </p>
                )}
              </div>
              <button
                onClick={handleRefreshRealtime}
                disabled={!selectedCategoryCombo || realtimeRefreshInProgress}
                className={`inline-flex items-center px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                  realtimeRefreshInProgress
                    ? 'border-gray-300 text-gray-500 cursor-wait'
                    : 'border-piano-gold/40 text-piano-wine hover:bg-piano-gold/10'
                }`}
              >
                <RefreshCw
                  className={`w-3.5 h-3.5 mr-1 ${
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
      </div>

      {/* Event Selection */}
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
            Please select an event to view competition results
          </p>
        </div>
      ) : (
        <>
          {/* Category Selection and Controls */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
            <div className="flex items-center space-x-4">
              <select
                value={selectedCategoryCombo}
                onChange={(e) => setSelectedCategoryCombo(e.target.value)}
                className="px-3 py-2 border border-piano-gold/30 rounded-lg focus:ring-2 focus:ring-piano-gold focus:border-transparent"
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
              {!showAllCategories && (
                <>
                  <button
                    onClick={handleExportResults}
                    disabled={
                      !selectedCategoryCombo ||
                      participantsWithScores.length === 0 ||
                      exporting
                    }
                    className={`inline-flex items-center px-4 py-2 rounded-lg focus:ring-2 focus:ring-offset-2 transition-colors duration-200 ${
                      selectedCategoryCombo &&
                      participantsWithScores.length > 0 &&
                      !exporting
                        ? 'bg-piano-gold text-white hover:bg-piano-gold/90 focus:ring-piano-gold'
                        : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    }`}
                  >
                    <Download className="w-4 h-4 mr-2" />
                    {exporting ? 'Exporting...' : 'Export CSV'}
                  </button>
                  <button
                    onClick={() => setFinalizeModalOpen(true)}
                    disabled={
                      !selectedCategoryCombo ||
                      participantsWithScores.length === 0 ||
                      participantsWithScores.some((p) => p.isFinalized) ||
                      finalizing
                    }
                    className={`inline-flex items-center px-4 py-2 rounded-lg focus:ring-2 focus:ring-offset-2 transition-colors duration-200 ${
                      selectedCategoryCombo &&
                      participantsWithScores.length > 0 &&
                      !participantsWithScores.some((p) => p.isFinalized) &&
                      !finalizing
                        ? 'bg-piano-wine text-white hover:bg-piano-wine/90 focus:ring-piano-wine'
                        : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    }`}
                  >
                    <Lock className="w-4 h-4 mr-2" />
                    {finalizing ? 'Finalizing...' : 'Finalize Scores'}
                  </button>
                </>
              )}
            </div>
          </div>

          {!selectedCategoryCombo ? (
            <div className="bg-piano-cream rounded-xl p-8 text-center">
              <Trophy className="mx-auto h-12 w-12 text-piano-wine/40 mb-4" />
              <h3 className="text-lg font-medium text-piano-wine mb-2">
                Select a Category
              </h3>
              <p className="text-gray-600">
                Please select a category to view competition results
              </p>
            </div>
          ) : loading ? (
            <div className="flex justify-center items-center h-64">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-piano-wine"></div>
            </div>
          ) : (
            <>
              {/* Prize Configuration Status */}
              {!showAllCategories && prizeConfigurations.length === 0 && (
                <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-lg">
                  <div className="flex items-center">
                    <Award className="w-5 h-5 text-amber-600 mr-2" />
                    <div>
                      <h3 className="text-sm font-medium text-amber-800">
                        No Prize Configuration
                      </h3>
                      <p className="text-sm text-amber-600">
                        No prize levels have been configured for this category.
                        Participants will be displayed by rank order.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <div className="bg-white rounded-xl shadow-sm border border-piano-gold/20 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-piano-gold/20">
                    <thead className="bg-piano-cream/50">
                      <tr>
                        {!showAllCategories && (
                          <th className="px-6 py-3 text-left text-xs font-medium text-piano-wine uppercase tracking-wider">
                            {prizeConfigurations.length > 0
                              ? 'Prize Level'
                              : 'Rank'}
                          </th>
                        )}
                        <th className="px-6 py-3 text-left text-xs font-medium text-piano-wine uppercase tracking-wider">
                          Participant
                        </th>
                        {showAllCategories && (
                          <th className="px-6 py-3 text-left text-xs font-medium text-piano-wine uppercase tracking-wider">
                            Category
                          </th>
                        )}
                        <th className="px-6 py-3 text-left text-xs font-medium text-piano-wine uppercase tracking-wider">
                          Performance Piece
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-piano-wine uppercase tracking-wider">
                          <div className="flex items-center space-x-2">
                            <span>Final Score</span>
                            <button
                              type="button"
                              onClick={() => setHideScores((prev) => !prev)}
                              className="p-1 rounded-full border border-piano-gold/30 text-piano-wine hover:bg-piano-gold/10"
                              title={
                                hideScores ? 'Show scores' : 'Hide scores'
                              }
                            >
                              {hideScores ? (
                                <EyeOff className="w-4 h-4" />
                              ) : (
                                <Eye className="w-4 h-4" />
                              )}
                            </button>
                          </div>
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-piano-wine uppercase tracking-wider">
                          Jury Count
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-piano-wine uppercase tracking-wider">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-piano-gold/20">
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
                        />
                      ))}
                    </tbody>
                  </table>
                </div>

                {participantsWithScores.length === 0 && (
                  <div className="text-center py-12">
                    <Trophy className="mx-auto h-12 w-12 text-piano-wine/40" />
                    <h3 className="mt-2 text-sm font-medium text-piano-wine">
                      No results yet
                    </h3>
                    <p className="mt-1 text-sm text-gray-500">
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
                  <div className="mt-6 bg-white rounded-xl shadow-sm border border-piano-gold/20 p-6">
                    <h3 className="text-lg font-semibold text-piano-wine mb-4">
                      Prize Summary
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {prizeAssignments.map((assignment) => (
                        <div
                          key={assignment.prizeLevel}
                          className="border border-piano-gold/30 rounded-lg p-4"
                        >
                          <div className="flex items-center mb-2">
                            <Award className="w-5 h-5 text-piano-gold" />
                            <h4 className="ml-2 font-medium text-piano-wine">
                              {assignment.prizeLevel}
                            </h4>
                          </div>
                          <p className="text-sm text-gray-600 mb-2">
                            {assignment.winners.length} of{' '}
                            {assignment.maxWinners} winners
                            {assignment.winners.length >
                              assignment.maxWinners && ' (tied)'}
                          </p>
                          {assignment.winners.length > 0 && (
                            <div className="text-xs text-gray-500">
                              Score range:{' '}
                              {Math.min(
                                ...assignment.winners.map((w) => w.averageScore)
                              ).toFixed(1)}{' '}
                              -{' '}
                              {Math.max(
                                ...assignment.winners.map((w) => w.averageScore)
                              ).toFixed(1)}
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
        <div className="fixed bottom-4 right-4 z-50">
          <div
            className={`flex items-center space-x-2 px-4 py-3 rounded-lg shadow-lg text-sm text-white ${
              toast.type === 'success' ? 'bg-green-600' : 'bg-red-600'
            }`}
          >
            <span>{toast.message}</span>
            <button
              onClick={() => setToast(null)}
              className="text-white/80 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
