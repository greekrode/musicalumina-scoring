import React, { useState, useEffect } from "react";
import { X, Save, Music, AlertCircle, Clock } from "lucide-react";
import { useApp } from "../../context/AppContext";
import { Participant, Registration } from "../../types";
import { supabase } from "../../lib/supabase";
import { useScoringAspects } from "../../hooks/useScoringAspects";
import { logScoringHistory } from "../../lib/scoringHistory";

interface ScoringModalProps {
  participant: Participant | Registration;
  category: {
    id: string;
    name: string;
    eventId?: string;
  };
  subcategoryId: string;
  onClose: () => void;
}

export default function ScoringModal({
  participant,
  category,
  subcategoryId,
  onClose,
}: ScoringModalProps) {
  const { state } = useApp();
  const [finalScore, setFinalScore] = useState<number | undefined>(undefined);
  const [remarks, setRemarks] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string>("");
  const [existingScoringId, setExistingScoringId] = useState<string | null>(
    null
  );
  const [isFinalized, setIsFinalized] = useState(false);

  const registrationId = "id" in participant ? participant.id : "";
  const participantName =
    "participant_name" in participant
      ? participant.participant_name
      : participant.fullName;
  const piece =
    "participant_name" in participant
      ? participant.song_title || "Not specified"
      : "piece" in participant
      ? participant.piece || "Not specified"
      : "Not specified";
  const duration =
    "participant_name" in participant
      ? participant.song_duration || "Not specified"
      : "duration" in participant
      ? `${participant.duration} min`
      : "Not specified";

  const { aspects, loading: aspectsLoading } = useScoringAspects(
    category.eventId
  );

  // Load existing score if any
  useEffect(() => {
    if (registrationId && state.user?.id) {
      loadExistingScore();
    }
  }, [registrationId, state.user?.id]);

  const loadExistingScore = async () => {
    try {
      const { data: scoringData, error: scoringError } = await supabase
        .from("event_scoring")
        .select("id, final_score, remarks, finalized")
        .eq("registration_id", registrationId)
        .eq("jury_id", state.user?.id)
        .maybeSingle();

      if (scoringError) {
        console.error("Error loading existing score:", scoringError);
      }

      if (scoringData) {
        setExistingScoringId(scoringData.id);
        setIsFinalized(scoringData.finalized);
        setFinalScore(scoringData.final_score);
        setRemarks(scoringData.remarks || "");
      }
    } catch (err) {
      console.error("Error loading existing score:", err);
    }
  };

  const handleScoreChange = (value: string) => {
    if (value === "") {
      setFinalScore(undefined);
      setError("");
      return;
    }
    const numValue = parseFloat(value);
    if (isNaN(numValue)) {
      return;
    }
    // Round to 1 decimal place
    const roundedValue = Math.round(numValue * 10) / 10;
    const clampedValue = Math.max(0, Math.min(100, roundedValue));
    setFinalScore(clampedValue);
    setError("");
  };

  const validateScore = () => {
    if (finalScore === undefined || finalScore === null) {
      setError("Please enter a score");
      return false;
    }
    if (finalScore < 0 || finalScore > 100) {
      setError("Score must be between 0 and 100");
      return false;
    }
    if (finalScore === 0) {
      setError("Please enter a score greater than 0");
      return false;
    }
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateScore() || isFinalized) {
      return;
    }

    setIsSubmitting(true);

    try {
      if (existingScoringId) {
        // Get existing data for history logging
        const { data: existingScoring } = await supabase
          .from("event_scoring")
          .select("*")
          .eq("id", existingScoringId)
          .single();

        // Update existing score
        const updatedData = {
          final_score: finalScore,
          remarks: remarks,
          updated_at: new Date().toISOString(),
        };

        const { error } = await supabase
          .from("event_scoring")
          .update(updatedData)
          .eq("id", existingScoringId);

        if (error) throw error;

        // Log history for scoring update
        await logScoringHistory({
          tableName: "event_scoring",
          recordId: existingScoringId,
          operation: "UPDATE",
          beforeData: existingScoring,
          afterData: { ...existingScoring, ...updatedData },
          changedBy: state.user?.id || "",
          juryName: state.user?.name,
          eventId: category.eventId,
          registrationId: registrationId,
          participantName: participantName,
        });
      } else {
        // Create new scoring
        const newScoringData = {
          registration_id: registrationId,
          category_id: category.id,
          subcategory_id: subcategoryId,
          jury_id: state.user?.id,
          jury_name: state.user?.name,
          final_score: finalScore,
          remarks: remarks,
          finalized: false,
        };

        const { data: scoringData, error: scoringError } = await supabase
          .from("event_scoring")
          .insert(newScoringData)
          .select()
          .single();

        if (scoringError) throw scoringError;

        // Log history for new scoring record
        await logScoringHistory({
          tableName: "event_scoring",
          recordId: scoringData.id,
          operation: "INSERT",
          afterData: scoringData,
          changedBy: state.user?.id || "",
          juryName: state.user?.name,
          eventId: category.eventId,
          registrationId: registrationId,
          participantName: participantName,
        });
      }

      onClose();
    } catch (err) {
      console.error("Error saving score:", err);
      setError("Failed to save score. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (aspectsLoading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl mx-4">
          <div className="p-8 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-piano-wine mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading scoring criteria...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="bg-piano-wine p-6 text-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center">
                <Music className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-xl font-bold">Score Participant</h2>
                <p className="text-piano-cream/80">{participantName}</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center hover:bg-white/30 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="mt-4 p-4 bg-white/10 rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-piano-cream/80">
                Performance Piece
              </span>
              <div className="flex items-center text-sm text-piano-cream/80">
                <Clock className="w-4 h-4 mr-1" />
                {duration}
              </div>
            </div>
            <p className="text-white font-medium">{piece}</p>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          {isFinalized && (
            <div className="mb-6 p-4 bg-orange-50 border border-orange-200 rounded-lg">
              <div className="flex items-center">
                <AlertCircle className="w-5 h-5 text-orange-600 mr-2" />
                <div>
                  <h3 className="text-sm font-medium text-orange-800">
                    Score Finalized
                  </h3>
                  <p className="text-sm text-orange-600">
                    This score has been finalized and cannot be modified.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Scoring Aspects (Reference Only) */}
          {aspects.length > 0 && (
            <div className="mb-4">
              <h3 className="text-sm font-medium text-gray-700 mb-2">
                Scoring Criteria (Reference)
              </h3>
              <div className="space-y-2">
                {aspects.map((aspect) => (
                  <div
                    key={aspect.id}
                    className="p-2 bg-gray-50 rounded border"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <h4 className="text-xs font-medium text-gray-800">
                        {aspect.name}
                      </h4>
                      <span className="text-xs text-gray-500">
                        {aspect.weight}%
                      </span>
                    </div>
                    <p className="text-xs text-gray-600 leading-relaxed">
                      {aspect.description}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Final Score Input */}
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-lg font-semibold text-piano-wine mb-1">
                Final Score (0-100)
              </label>
              <p className="text-sm text-gray-600 mb-3">
                Maximum one decimal place allowed (e.g., 85.5)
              </p>
              <div className="relative">
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  value={finalScore ?? ""}
                  onChange={(e) => handleScoreChange(e.target.value)}
                  disabled={isFinalized}
                  className="w-full px-4 py-3 text-xl font-bold text-center border-2 border-piano-gold/30 rounded-lg focus:ring-2 focus:ring-piano-gold focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
                  placeholder="Enter score..."
                />
                <div className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 text-lg">
                  / 100
                </div>
              </div>
              {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
            </div>

            {/* Remarks Field */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Remarks (Optional)
              </label>
              <textarea
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                disabled={isFinalized}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-piano-gold focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed resize-none"
                placeholder="Add any comments or feedback for this performance..."
              />
            </div>

            {/* Submit Button */}
            {!isFinalized && (
              <div className="flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-6 py-3 bg-piano-wine text-white rounded-lg hover:bg-piano-wine/90 focus:ring-2 focus:ring-piano-wine focus:ring-offset-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                >
                  {isSubmitting ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4 mr-2" />
                      {existingScoringId ? "Update Score" : "Submit Score"}
                    </>
                  )}
                </button>
              </div>
            )}
          </form>
        </div>
      </div>
    </div>
  );
}
