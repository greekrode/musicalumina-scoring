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
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useEventCategories } from "../../hooks/useEventCategories";
import { useEvents } from "../../hooks/useEvents";
import { useParticipants } from "../../hooks/useParticipants";
import { usePrizeConfigurations } from "../../hooks/usePrizeConfigurations";
import { useRealtimeScoring } from "../../hooks/useRealtimeScoring";
import { useFinalizeScores } from "../../hooks/useFinalizeScores";
import { usePrizeAssignmentCalculation } from "../../hooks/usePrizeAssignmentCalculation";
import { useResultsExport } from "../../hooks/useResultsExport";
import { supabase } from "../../lib/supabase";
import { ParticipantWithPrize } from "../../types";
import { ParticipantWithScores } from "../../types/results";

export default function ResultsOverview() {
  const isInitialEventRef = useRef(true);
  const [selectedEventId, setSelectedEventId] = useState<string>(() => {
    if (typeof window === "undefined") return "";
    return localStorage.getItem("resultsOverviewEventId") || "";
  });
  const [selectedCategoryCombo, setSelectedCategoryCombo] = useState<string>(() => {
    if (typeof window === "undefined") return "";
    return localStorage.getItem("resultsOverviewCategoryCombo") || "";
  });
  const [participantsWithScores, setParticipantsWithScores] = useState<
    ParticipantWithScores[]
  >([]);
  const [loading, setLoading] = useState(false);
  const [remarksModalOpen, setRemarksModalOpen] = useState(false);
  const [selectedParticipantRemarks, setSelectedParticipantRemarks] = useState<
    Array<{ jury_name: string; remarks: string }>
  >([]);
  const [realtimeActive, setRealtimeActive] = useState(false);
  const [realtimeRefreshKey, setRealtimeRefreshKey] = useState(0);
  const [realtimeRefreshInProgress, setRealtimeRefreshInProgress] =
    useState(false);
  const [hideScores, setHideScores] = useState(false);
  const fetchRequestIdRef = useRef(0);
  const [editScoresModalOpen, setEditScoresModalOpen] = useState(false);
  const [editTargetParticipant, setEditTargetParticipant] =
    useState<ParticipantWithScores | null>(null);
  const [editedJuryScores, setEditedJuryScores] = useState<
    Array<{ id: string; juryId: string; name: string; score: number }>
  >([]);
  const [editScoresSaving, setEditScoresSaving] = useState(false);
  const [editScoresError, setEditScoresError] = useState<string | null>(null);
  const [toast, setToast] = useState<
    { message: string; type: "success" | "error" } | null
  >(null);
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

  // Parse the selected category combo to get category and subcategory IDs
  const [categoryId, subcategoryId] =
    selectedCategoryCombo && selectedCategoryCombo !== "all"
      ? selectedCategoryCombo.split("|")
      : ["", ""];
  const { participants, loading: participantsLoading } = useParticipants(
    categoryId,
    subcategoryId
  );

  // Get event ID from selected category
  const eventId = categories.find(
    (c) => c.categoryId === categoryId && c.subcategoryId === subcategoryId
  )?.eventId;
  const { prizeConfigurations, loading: prizeConfigsLoading } =
    usePrizeConfigurations(eventId, categoryId, subcategoryId);

  useEffect(() => {
    if (finalizeError) {
      console.error("Finalize scores error:", finalizeError);
      setToast({ message: finalizeError, type: "error" });
    }
  }, [finalizeError]);

  // Clear any previous results whenever the category selection changes
  useEffect(() => {
    setParticipantsWithScores([]);
    if (typeof window !== "undefined") {
      if (selectedCategoryCombo) {
        localStorage.setItem("resultsOverviewCategoryCombo", selectedCategoryCombo);
      } else {
        localStorage.removeItem("resultsOverviewCategoryCombo");
      }
    }
  }, [selectedCategoryCombo]);

  useEffect(() => {
    if (!toast) return;
    const timeout = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(timeout);
  }, [toast]);

  // Auto-select the most recent active event when events are loaded
  useEffect(() => {
    if (!eventsLoading && events.length > 0 && !selectedEventId) {
      setSelectedEventId(events[0].id);
    }
  }, [events, eventsLoading, selectedEventId]);

  // Reset category selection when event changes
  useEffect(() => {
    if (typeof window !== "undefined") {
      if (selectedEventId) {
        localStorage.setItem("resultsOverviewEventId", selectedEventId);
      } else {
        localStorage.removeItem("resultsOverviewEventId");
      }
    }
    if (typeof window !== "undefined") {
      if (selectedEventId) {
        localStorage.setItem("resultsOverviewEventId", selectedEventId);
      } else {
        localStorage.removeItem("resultsOverviewEventId");
      }
    }
    if (isInitialEventRef.current) {
      isInitialEventRef.current = false;
      return;
    }
    setSelectedCategoryCombo("");
    if (typeof window !== "undefined") {
      localStorage.removeItem("resultsOverviewCategoryCombo");
    }
  }, [selectedEventId]);

  const fetchParticipantScores = useCallback(async () => {
    const requestId = ++fetchRequestIdRef.current;
    setLoading(true);
    try {
      let participantsToProcess = participants;

      // If "all categories" is selected, fetch participants from all categories in the event
      if (selectedCategoryCombo === "all" && selectedEventId) {
        const { data: allParticipants, error: participantsError } =
          await supabase
            .from("registrations")
            .select("*")
            .eq("event_id", selectedEventId)
            .order("created_at", { ascending: true });

        if (participantsError) {
          console.error("Error fetching all participants:", participantsError);
          return;
        }

        participantsToProcess = allParticipants || [];
      }

      if (participantsToProcess.length === 0) {
        if (requestId === fetchRequestIdRef.current) {
          setParticipantsWithScores([]);
        }
        return;
      }

      // Get all participant IDs for batch querying
      const participantIds = participantsToProcess.map((p) => p.id);

      // Fetch all scoring data for these participants in ONE query
      const { data: allScoringData, error: scoringError } = await supabase
        .from("event_scoring")
        .select(
          "id, registration_id, jury_id, jury_name, final_score, finalized"
        )
        .in("registration_id", participantIds);

      if (scoringError) {
        console.error("Error fetching scores:", scoringError);
        return;
      }

      // Create a map of participant ID to their scoring data
      const scoringMap = new Map<
        string,
        Array<{
          id: string;
          jury_id: string;
          jury_name: string;
          final_score: number;
          finalized: boolean;
        }>
      >();

      allScoringData?.forEach((scoring) => {
        if (!scoringMap.has(scoring.registration_id)) {
          scoringMap.set(scoring.registration_id, []);
        }
        scoringMap.get(scoring.registration_id)!.push({
          id: scoring.id,
          jury_id: scoring.jury_id,
          jury_name: scoring.jury_name || "Unknown Jury",
          final_score: scoring.final_score,
          finalized: scoring.finalized,
        });
      });

      // Process participants with their mapped scoring data
      const results: ParticipantWithScores[] = participantsToProcess.map(
        (participant, index) => {
          const participantScoring = scoringMap.get(participant.id) || [];

          // Calculate scores from mapped data
          const juryScores: Array<{
            id: string;
            juryId: string;
            name: string;
            score: number;
          }> = [];
          let totalScore = 0;
          let scoreCount = 0;
          let isFinalized = false;

          participantScoring.forEach((scoring) => {
            if (
              scoring.final_score !== null &&
              scoring.final_score !== undefined
            ) {
              juryScores.push({
                id: scoring.id,
                juryId: scoring.jury_id,
                name: scoring.jury_name,
                score: scoring.final_score,
              });
              totalScore += scoring.final_score;
              scoreCount++;
            }
            if (scoring.finalized) isFinalized = true;
          });

          const finalScore = scoreCount > 0 ? totalScore / scoreCount : 0;

          // Find the category display name for this participant
          let categoryDisplayName = "Unknown Category";
          if (selectedCategoryCombo === "all") {
            // For all categories view, find the category name from the participant's category/subcategory
            const participantCategory = categories.find(
              (c) =>
                c.categoryId === participant.category_id &&
                c.subcategoryId === participant.subcategory_id
            );
            categoryDisplayName =
              participantCategory?.displayName || "Unknown Category";
          } else {
            // For specific category view
            const selectedCategory = categories.find(
              (c) =>
                c.categoryId === categoryId && c.subcategoryId === subcategoryId
            );
            categoryDisplayName =
              selectedCategory?.displayName || "Unknown Category";
          }

          return {
            id: participant.id,
            number: index + 1,
            fullName: participant.participant_name,
            averageScore: finalScore,
            scoreCount,
            category: categoryDisplayName,
            piece: participant.song_title || "Not specified",
            duration: participant.song_duration || "Not specified",
            aspectScores: {}, // No longer using aspect scores
            isFinalized,
            juryScores,
          };
        }
      );

      // Sort by score (highest first)
      results.sort((a, b) => b.averageScore - a.averageScore);
      if (requestId === fetchRequestIdRef.current) {
        setParticipantsWithScores(results);
      }
    } catch (err) {
      console.error("Error fetching participant scores:", err);
    } finally {
      if (requestId === fetchRequestIdRef.current) {
        setLoading(false);
      }
    }
  }, [
    participants,
    selectedCategoryCombo,
    selectedEventId,
    categories,
    categoryId,
    subcategoryId,
  ]);

  // Set up realtime subscriptions for scoring changes
  const handleScoringChange = useCallback(() => {
    // Refresh participant scores when scoring changes in real-time
    if (selectedCategoryCombo && participants.length >= 0) {
      setRealtimeActive(true);
      fetchParticipantScores();
      // Hide the indicator after a short delay
      setTimeout(() => setRealtimeActive(false), 2000);
    }
  }, [selectedCategoryCombo, participants.length, fetchParticipantScores]);

  const { status: realtimeStatus } = useRealtimeScoring({
    eventId: selectedEventId,
    categoryId: categoryId,
    subcategoryId: subcategoryId,
    onScoringChange: handleScoringChange,
    enabled: !!selectedEventId && !!selectedCategoryCombo,
    refreshKey: realtimeRefreshKey,
  });

  const handleRefreshRealtime = useCallback(() => {
    if (!selectedCategoryCombo) return;
    setRealtimeRefreshInProgress(true);
    setRealtimeRefreshKey((prev) => prev + 1);
  }, [selectedCategoryCombo]);

  const showToast = useCallback(
    (message: string, type: "success" | "error" = "success") => {
      setToast({ message, type });
    },
    []
  );

  const openEditScoresModal = useCallback(
    (participantId: string) => {
      const participantRecord = participantsWithScores.find(
        (participant) => participant.id === participantId
      );

      if (!participantRecord) return;

      setEditTargetParticipant(participantRecord);
      setEditedJuryScores(
        participantRecord.juryScores.map((score) => ({ ...score }))
      );
      setEditScoresError(null);
      setEditScoresModalOpen(true);
    },
    [participantsWithScores]
  );

  const closeEditScoresModal = () => {
    setEditScoresModalOpen(false);
    setEditTargetParticipant(null);
    setEditedJuryScores([]);
    setEditScoresError(null);
  };

  const handleJuryScoreChange = (scoreId: string, value: string) => {
    setEditedJuryScores((prev) =>
      prev.map((score) => {
        if (score.id !== scoreId) return score;
        let parsedValue = parseFloat(value);
        if (isNaN(parsedValue)) {
          parsedValue = 0;
        }
        const clampedValue = Math.max(0, Math.min(100, parsedValue));
        return { ...score, score: clampedValue };
      })
    );
  };

  const handleSaveEditedScores = async () => {
    if (!editTargetParticipant) return;

    const originalScoresMap = new Map(
      editTargetParticipant.juryScores.map((score) => [score.id, score.score])
    );

    const updates = editedJuryScores.filter(
      (score) => originalScoresMap.get(score.id) !== score.score
    );

    if (updates.length === 0) {
      closeEditScoresModal();
      return;
    }

    setEditScoresSaving(true);
    setEditScoresError(null);

    try {
      const timestamp = new Date().toISOString();

      const updatePromises = updates.map((score) =>
        supabase
          .from("event_scoring")
          .update({ final_score: score.score, updated_at: timestamp })
          .eq("id", score.id)
      );

      const results = await Promise.all(updatePromises);
      const updateError = results.find((result) => result.error)?.error;

      if (updateError) throw updateError;

      closeEditScoresModal();
      fetchParticipantScores();
      showToast("Jury scores updated successfully.");
    } catch (err) {
      console.error("Error updating jury scores:", err);
      const message =
        err instanceof Error ? err.message : "Failed to update jury scores.";
      setEditScoresError(message);
      showToast(message, "error");
    } finally {
      setEditScoresSaving(false);
    }
  };

  const handleExportResults = async () => {
    if (!categoryId || !subcategoryId) {
      showToast("Please select a category before exporting.", "error");
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
      showToast("Results exported successfully.");
    } catch (err) {
      console.error("Error exporting results:", err);
      const message =
        err instanceof Error
          ? err.message
          : "Failed to export CSV. Please try again.";
      showToast(message, "error");
    }
  };

  useEffect(() => {
    if (!realtimeRefreshInProgress) return;
    if (realtimeStatus.connected || realtimeStatus.error) {
      setRealtimeRefreshInProgress(false);
    }
  }, [
    realtimeRefreshInProgress,
    realtimeStatus.connected,
    realtimeStatus.error,
  ]);

  useEffect(() => {
    if (!selectedEventId || !selectedCategoryCombo) return;
    if (!realtimeStatus.error || realtimeRefreshInProgress) return;
    const timeout = setTimeout(() => {
      setRealtimeRefreshInProgress(true);
      setRealtimeRefreshKey((prev) => prev + 1);
    }, 4000);
    return () => clearTimeout(timeout);
  }, [
    realtimeStatus.error,
    selectedEventId,
    selectedCategoryCombo,
    realtimeRefreshInProgress,
  ]);

  useEffect(() => {
    if (selectedCategoryCombo && participants.length >= 0) {
      fetchParticipantScores();
    }
  }, [fetchParticipantScores, selectedCategoryCombo, participants.length]);

  const { prizeAssignments, assignedParticipants } = usePrizeAssignmentCalculation(
    participantsWithScores,
    prizeConfigurations
  );

  const viewRemarks = async (participantId: string) => {
    try {
      const { data: remarks, error } = await supabase
        .from("event_scoring")
        .select("jury_name, remarks")
        .eq("registration_id", participantId)
        .not("remarks", "is", null)
        .not("remarks", "eq", "");

      if (error) throw error;

      setSelectedParticipantRemarks(remarks || []);
      setRemarksModalOpen(true);
    } catch (err) {
      console.error("Error fetching remarks:", err);
      showToast("Failed to fetch remarks. Please try again.", "error");
    }
  };

  const handleFinalizeScores = async () => {
    if (
      !categoryId ||
      !subcategoryId ||
      !selectedEventId ||
      selectedCategoryCombo === "all"
    ) {
      showToast(
        "Please select a specific category before finalizing scores.",
        "error"
      );
      return;
    }

    const winners = assignedParticipants.filter(
      (participant) => !!participant.prizeLevel
    );

    try {
      await finalizeScoresMutation({
        eventId: selectedEventId,
        categoryId,
        subcategoryId,
        winners,
      });
      fetchParticipantScores();
      showToast("Scores have been finalized successfully!");
      setFinalizeModalOpen(false);
    } catch (err) {
      console.error("Error finalizing scores:", err);
      showToast("Failed to finalize scores. Please try again.", "error");
    }
  };

  const getPrizeIcon = (prizeLevel?: string, displayOrder?: number) => {
    if (!prizeLevel) {
      return <Star className="w-5 h-5 text-gray-300" />;
    }

    if (displayOrder === 1)
      return <Trophy className="w-5 h-5 text-yellow-500" />;
    if (displayOrder === 2) return <Medal className="w-5 h-5 text-gray-400" />;
    if (displayOrder === 3) return <Medal className="w-5 h-5 text-amber-600" />;
    return <Award className="w-5 h-5 text-piano-gold" />;
  };

  const getPrizeRowClass = (displayOrder?: number) => {
    if (!displayOrder) return "";
    if (displayOrder <= 3) return "bg-piano-gold/10";
    return "bg-piano-cream/30";
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
            {selectedCategoryCombo === "all"
              ? "View high scorers across all categories (sorted by score)"
              : "View prize assignments and participant scores"}
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
                    ? "border-gray-300 text-gray-500 cursor-wait"
                    : "border-piano-gold/40 text-piano-wine hover:bg-piano-gold/10"
                }`}
              >
                <RefreshCw
                  className={`w-3.5 h-3.5 mr-1 ${
                    realtimeRefreshInProgress ? "animate-spin" : ""
                  }`}
                />
                {realtimeRefreshInProgress
                  ? "Refreshing..."
                  : "Refresh Live Sync"}
              </button>
            </div>
          )}
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
              {selectedCategoryCombo !== "all" && (
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
                        ? "bg-piano-gold text-white hover:bg-piano-gold/90 focus:ring-piano-gold"
                        : "bg-gray-300 text-gray-500 cursor-not-allowed"
                    }`}
                  >
                    <Download className="w-4 h-4 mr-2" />
                    {exporting ? "Exporting..." : "Export CSV"}
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
                        ? "bg-piano-wine text-white hover:bg-piano-wine/90 focus:ring-piano-wine"
                        : "bg-gray-300 text-gray-500 cursor-not-allowed"
                    }`}
                  >
                    <Lock className="w-4 h-4 mr-2" />
                    {finalizing ? "Finalizing..." : "Finalize Scores"}
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
          ) : categoriesLoading ||
            participantsLoading ||
            loading ||
            prizeConfigsLoading ? (
            <div className="flex justify-center items-center h-64">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-piano-wine"></div>
            </div>
          ) : (
            <>
              {/* Prize Configuration Status */}
              {selectedCategoryCombo !== "all" &&
                prizeConfigurations.length === 0 && (
                  <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-lg">
                    <div className="flex items-center">
                      <Award className="w-5 h-5 text-amber-600 mr-2" />
                      <div>
                        <h3 className="text-sm font-medium text-amber-800">
                          No Prize Configuration
                        </h3>
                        <p className="text-sm text-amber-600">
                          No prize levels have been configured for this
                          category. Participants will be displayed by rank
                          order.
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
                        {selectedCategoryCombo !== "all" && (
                          <th className="px-6 py-3 text-left text-xs font-medium text-piano-wine uppercase tracking-wider">
                            {prizeConfigurations.length > 0
                              ? "Prize Level"
                              : "Rank"}
                          </th>
                        )}
                        <th className="px-6 py-3 text-left text-xs font-medium text-piano-wine uppercase tracking-wider">
                          Participant
                        </th>
                        {selectedCategoryCombo === "all" && (
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
                              title={hideScores ? "Show scores" : "Hide scores"}
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
                      {(selectedCategoryCombo === "all"
                        ? participantsWithScores
                        : prizeConfigurations.length > 0
                        ? assignedParticipants
                        : participantsWithScores
                      ).map((participant, index) => {
                        const isAssignedParticipant =
                          "prizeLevel" in participant;
                        const prizeLevel = isAssignedParticipant
                          ? participant.prizeLevel
                          : undefined;
                        const displayOrder = isAssignedParticipant
                          ? participant.prizeDisplayOrder
                          : undefined;
                        const participantName = isAssignedParticipant
                          ? participant.participant_name
                          : (participant as ParticipantWithScores).fullName;
                        const score = participant.averageScore;
                        const scoreCount = participant.scoreCount;
                        const piece = participant.piece;
                        const duration = participant.duration;
                        const juryScores = participant.juryScores;
                        const participantId = participant.id;
                        const category = isAssignedParticipant
                          ? ""
                          : (participant as ParticipantWithScores).category;

                        return (
                          <tr
                            key={participantId}
                            className={
                              selectedCategoryCombo === "all"
                                ? ""
                                : getPrizeRowClass(displayOrder)
                            }
                          >
                            {selectedCategoryCombo !== "all" && (
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
                              <div>
                                <div className="text-sm font-medium text-piano-wine">
                                  {participantName}
                                </div>
                              </div>
                            </td>
                            {selectedCategoryCombo === "all" && (
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className="text-sm text-gray-900">
                                  {category}
                                </div>
                              </td>
                            )}
                            <td className="px-6 py-4">
                              <div className="text-sm text-gray-900">
                                {piece}
                              </div>
                              <div className="text-sm text-gray-500 flex items-center">
                                <Clock className="w-3 h-3 mr-1" />
                                {duration !== "Not specified" ? duration : "--"}
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="text-lg font-bold text-piano-wine">
                                {hideScores
                                  ? "•••"
                                  : scoreCount > 0
                                  ? score.toFixed(2)
                                  : "--"}
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="flex items-center text-sm text-gray-500 mb-1">
                                <Users className="w-4 h-4 mr-1" />
                                {scoreCount} jury
                              </div>
                              <div className="text-xs text-gray-500 space-y-0.5">
                                {hideScores
                                  ? "Hidden"
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
                                    onClick={() =>
                                      openEditScoresModal(participantId)
                                    }
                                    className="inline-flex items-center px-3 py-1 text-xs font-medium rounded-lg border border-piano-gold/30 text-piano-wine hover:bg-piano-gold/10 focus:ring-2 focus:ring-piano-gold focus:ring-offset-2 transition-colors"
                                  >
                                    Edit Scores
                                  </button>
                                )}
                                <button
                                  onClick={() => viewRemarks(participantId)}
                                  className="inline-flex items-center px-3 py-1 text-xs font-medium rounded-lg border border-piano-gold/30 text-piano-wine hover:bg-piano-gold/10 focus:ring-2 focus:ring-piano-gold focus:ring-offset-2 transition-colors"
                                >
                                  <MessageSquare className="w-3 h-3 mr-1" />
                                  Remarks
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
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
              {selectedCategoryCombo !== "all" &&
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
                            {getPrizeIcon(
                              assignment.prizeLevel,
                              assignment.displayOrder
                            )}
                            <h4 className="ml-2 font-medium text-piano-wine">
                              {assignment.prizeLevel}
                            </h4>
                          </div>
                          <p className="text-sm text-gray-600 mb-2">
                            {assignment.winners.length} of{" "}
                            {assignment.maxWinners} winners
                            {assignment.winners.length >
                              assignment.maxWinners && " (tied)"}
                          </p>
                          {assignment.winners.length > 0 && (
                            <div className="text-xs text-gray-500">
                              Score range:{" "}
                              {Math.min(
                                ...assignment.winners.map((w) => w.averageScore)
                              ).toFixed(1)}{" "}
                              -{" "}
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

      {/* Edit Jury Scores Modal */}
      {editScoresModalOpen && editTargetParticipant && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl mx-4 max-h-[80vh] overflow-hidden">
            <div className="bg-piano-wine p-4 text-white">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold">Edit Jury Scores</h3>
                  <p className="text-sm text-white/80">
                    {editTargetParticipant.fullName}
                  </p>
                </div>
                <button
                  onClick={closeEditScoresModal}
                  className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center hover:bg-white/30 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            <div className="p-4 space-y-4 overflow-y-auto max-h-[60vh]">
              {editedJuryScores.length === 0 ? (
                <p className="text-sm text-gray-500">
                  No jury scores available for editing.
                </p>
              ) : (
                editedJuryScores.map((juryScore) => (
                  <div
                    key={juryScore.id}
                    className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border border-piano-gold/30 rounded-lg p-3"
                  >
                    <div>
                      <p className="text-sm font-medium text-piano-wine">
                        {juryScore.name}
                      </p>
                      <p className="text-xs text-gray-500">
                        Jury ID: {juryScore.juryId}
                      </p>
                    </div>
                    <div className="flex items-center space-x-2">
                      <input
                        type="number"
                        min="0"
                        max="100"
                        step="0.1"
                        value={juryScore.score}
                        onChange={(e) =>
                          handleJuryScoreChange(juryScore.id, e.target.value)
                        }
                        className="w-24 px-2 py-1 border border-piano-gold/30 rounded-lg focus:ring-2 focus:ring-piano-gold focus:border-transparent text-sm"
                      />
                      <span className="text-xs text-gray-500">/ 100</span>
                    </div>
                  </div>
                ))
              )}
              {editScoresError && (
                <p className="text-sm text-red-600">{editScoresError}</p>
              )}
            </div>
            <div className="bg-gray-50 p-4 flex justify-end space-x-3">
              <button
                onClick={closeEditScoresModal}
                className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-800"
                disabled={editScoresSaving}
              >
                Cancel
              </button>
              <button
                onClick={handleSaveEditedScores}
                disabled={editScoresSaving || editedJuryScores.length === 0}
                className={`inline-flex items-center px-4 py-2 rounded-lg text-sm font-medium text-white ${
                  editScoresSaving
                    ? "bg-gray-400 cursor-not-allowed"
                    : "bg-piano-wine hover:bg-piano-wine/90"
                }`}
              >
                {editScoresSaving ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Remarks Modal */}
      {remarksModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl mx-4 max-h-[80vh] overflow-hidden">
            <div className="bg-piano-wine p-4 text-white">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">Jury Remarks</h3>
                <button
                  onClick={() => setRemarksModalOpen(false)}
                  className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center hover:bg-white/30 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            <div className="p-6 max-h-[60vh] overflow-y-auto">
              {selectedParticipantRemarks.length > 0 ? (
                <div className="space-y-4">
                  {selectedParticipantRemarks.map((remark, index) => (
                    <div
                      key={index}
                      className="p-4 bg-gray-50 rounded-lg border"
                    >
                      <div className="flex items-center mb-2">
                        <MessageSquare className="w-4 h-4 text-piano-wine mr-2" />
                        <h4 className="font-medium text-piano-wine">
                          {remark.jury_name || "Unknown Jury"}
                        </h4>
                      </div>
                      <p className="text-gray-700 text-sm leading-relaxed">
                        {remark.remarks}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <MessageSquare className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">
                    No Remarks
                  </h3>
                  <p className="text-gray-500">
                    No jury members have provided remarks for this participant
                    yet.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {finalizeModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4">
            <div className="bg-piano-wine p-4 text-white">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">Finalize Scores</h3>
                <button
                  onClick={() => setFinalizeModalOpen(false)}
                  className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center hover:bg-white/30 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-sm text-gray-700">
                Finalizing will lock all jury scores for this category. Juries will
                no longer be able to edit their submissions and winners will be
                recorded.
              </p>
              <ul className="text-sm text-gray-600 list-disc list-inside space-y-1">
                <li>All participant scores will be marked as finalized.</li>
                <li>Winners will be stored in the event winners table.</li>
                <li>This action cannot be undone.</li>
              </ul>
            </div>
            <div className="bg-gray-50 p-4 flex justify-end space-x-3">
              <button
                onClick={() => setFinalizeModalOpen(false)}
                className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-800"
                disabled={finalizing}
              >
                Cancel
              </button>
              <button
                onClick={handleFinalizeScores}
                disabled={finalizing}
                className={`inline-flex items-center px-4 py-2 rounded-lg text-sm font-medium text-white ${
                  finalizing
                    ? "bg-gray-400 cursor-not-allowed"
                    : "bg-piano-wine hover:bg-piano-wine/90"
                }`}
              >
                {finalizing ? "Finalizing..." : "Confirm Finalize"}
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className="fixed bottom-4 right-4 z-50">
          <div
            className={`flex items-center space-x-2 px-4 py-3 rounded-lg shadow-lg text-sm text-white ${
              toast.type === "success" ? "bg-green-600" : "bg-red-600"
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
