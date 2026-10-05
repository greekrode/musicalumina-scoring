import { useState } from 'react';
import { X } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { ParticipantWithScores } from '../../types/results';
import { Eyebrow } from '../shared/StateCard';

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
    <div className="overlay">
      <div className="sheet" role="dialog" aria-modal="true">
        <div className="flex items-start justify-between px-6 pt-6">
          <div>
            <Eyebrow>Jury Scores</Eyebrow>
            <h2 className="mt-3 text-[1.5rem]">Edit Jury Scores</h2>
            <p className="mt-1 text-sm text-ink-muted">{participant.fullName}</p>
          </div>
          <button onClick={onClose} className="icon-btn" aria-label="Close" title="Close">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="space-y-3 px-6 pb-6 pt-6">
          {editedScores.length === 0 ? (
            <p className="text-sm text-ink-muted">
              No jury scores available for editing.
            </p>
          ) : (
            editedScores.map((juryScore) => (
              <div
                key={juryScore.id}
                className="flex flex-col gap-3 border border-rule-hairline p-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="text-sm font-medium text-ink-primary">
                    {juryScore.name}
                  </p>
                  <p className="text-xs text-ink-muted">
                    Jury ID: {juryScore.juryId}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.1"
                    value={juryScore.score}
                    onChange={(e) =>
                      handleScoreChange(juryScore.id, e.target.value)
                    }
                    className="field w-24"
                  />
                  <span className="text-xs text-ink-muted">/ 100</span>
                </div>
              </div>
            ))
          )}
          {error && <p className="text-sm text-status-error-fg">{error}</p>}
        </div>
        <div className="flex flex-wrap justify-end gap-3 border-t border-rule-hairline bg-surface-warm px-6 py-4">
          <button onClick={onClose} className="btn-ghost" disabled={saving}>
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || editedScores.length === 0}
            className="btn-primary"
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}
