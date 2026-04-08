import { useState } from 'react';
import { X } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { ParticipantWithScores } from '../../types/results';

interface EditScoresModalProps {
  participant: ParticipantWithScores;
  onClose: () => void;
  onSaved: () => void;
  onError: (message: string) => void;
}

export default function EditScoresModal({
  participant,
  onClose,
  onSaved,
  onError,
}: EditScoresModalProps) {
  const [editedScores, setEditedScores] = useState(
    participant.juryScores.map((s) => ({ ...s }))
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleScoreChange = (scoreId: string, value: string) => {
    setEditedScores((prev) =>
      prev.map((score) => {
        if (score.id !== scoreId) return score;
        let parsed = parseFloat(value);
        if (isNaN(parsed)) parsed = 0;
        return { ...score, score: Math.max(0, Math.min(100, parsed)) };
      })
    );
  };

  const handleSave = async () => {
    const originalMap = new Map(
      participant.juryScores.map((s) => [s.id, s.score])
    );
    const updates = editedScores.filter(
      (s) => originalMap.get(s.id) !== s.score
    );

    if (updates.length === 0) {
      onClose();
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const timestamp = new Date().toISOString();
      const results = await Promise.all(
        updates.map((score) =>
          supabase
            .from('event_scoring')
            .update({ final_score: score.score, updated_at: timestamp })
            .eq('id', score.id)
        )
      );

      const updateError = results.find((r) => r.error)?.error;
      if (updateError) throw updateError;

      onSaved();
      onClose();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Failed to update jury scores.';
      setError(message);
      onError(message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl mx-4 max-h-[80vh] overflow-hidden">
        <div className="bg-piano-wine p-4 text-white">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold">Edit Jury Scores</h3>
              <p className="text-sm text-white/80">{participant.fullName}</p>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center hover:bg-white/30 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
        <div className="p-4 space-y-4 overflow-y-auto max-h-[60vh]">
          {editedScores.length === 0 ? (
            <p className="text-sm text-gray-500">
              No jury scores available for editing.
            </p>
          ) : (
            editedScores.map((juryScore) => (
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
                      handleScoreChange(juryScore.id, e.target.value)
                    }
                    className="w-24 px-2 py-1 border border-piano-gold/30 rounded-lg focus:ring-2 focus:ring-piano-gold focus:border-transparent text-sm"
                  />
                  <span className="text-xs text-gray-500">/ 100</span>
                </div>
              </div>
            ))
          )}
          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>
        <div className="bg-gray-50 p-4 flex justify-end space-x-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-800"
            disabled={saving}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || editedScores.length === 0}
            className={`inline-flex items-center px-4 py-2 rounded-lg text-sm font-medium text-white ${
              saving
                ? 'bg-gray-400 cursor-not-allowed'
                : 'bg-piano-wine hover:bg-piano-wine/90'
            }`}
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}
