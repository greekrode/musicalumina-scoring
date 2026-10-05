import { useState } from 'react';
import { X } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { supabase } from '../../lib/supabase';
import { ParticipantWithScores } from '../../types/results';
import { Eyebrow } from '../shared/StateCard';

interface EditScoresModalProps {
  participant: ParticipantWithScores;
  onClose: () => void;
  onSaved: () => void;
  onError: (message: string) => void;
}

const REJECT: Record<string, string> = {
  forbidden: 'Only admins can adjust scores.',
  invalid_score: 'Each score must be between 0.1 and 100 with at most one decimal.',
  invalid_request: 'Could not save these changes. Please try again.',
};

// Same rule as the jury form: one decimal, clamped to 0-100.
const normalize = (value: string) => {
  const num = parseFloat(value);
  return isNaN(num) ? undefined : Math.max(0, Math.min(100, Math.round(num * 10) / 10));
};

export default function EditScoresModal({
  participant,
  onClose,
  onSaved,
  onError,
}: EditScoresModalProps) {
  const { state } = useApp();
  const [editedScores, setEditedScores] = useState<Array<{ id: string; juryId: string; name: string; score: number | undefined }>>(
    participant.juryScores.map((s) => ({ ...s }))
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleScoreChange = (scoreId: string, value: string) => {
    setError(null);
    setEditedScores((prev) =>
      prev.map((score) => (score.id === scoreId ? { ...score, score: value === '' ? undefined : normalize(value) } : score))
    );
  };

  const handleSave = async () => {
    if (editedScores.some((s) => s.score === undefined || s.score <= 0)) {
      setError('Enter a score between 0.1 and 100 for every jury.');
      return;
    }
    const originalMap = new Map(participant.juryScores.map((s) => [s.id, s.score]));
    const updates = editedScores.filter((s) => originalMap.get(s.id) !== s.score);

    if (updates.length === 0) {
      onClose();
      return;
    }

    setSaving(true);
    setError(null);

    try {
      // One transaction: validates, updates and writes the History entries.
      const { data, error } = await supabase.rpc('admin_update_scores', {
        p_updates: updates.map((s) => ({ id: s.id, final_score: s.score })),
        p_admin_name: state.user?.name ?? 'Admin',
      });
      if (error) throw error;
      const code = (data as { error?: string } | null)?.error;
      if (code) throw new Error(REJECT[code] ?? code);

      onSaved();
      onClose();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update jury scores.';
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
                    inputMode="decimal"
                    aria-label={`Score from ${juryScore.name}`}
                    value={juryScore.score ?? ''}
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
          <p className="text-xs text-ink-muted">One decimal place, e.g. 85.5. Every change is recorded in History under your name.</p>
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
