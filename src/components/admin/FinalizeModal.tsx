import { X } from 'lucide-react';
import { Eyebrow } from '../shared/StateCard';

interface FinalizeModalProps {
  finalizing: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

export default function FinalizeModal({
  finalizing,
  onConfirm,
  onClose,
}: FinalizeModalProps) {
  return (
    <div className="overlay">
      <div className="sheet" role="dialog" aria-modal="true">
        <div className="flex items-start justify-between px-6 pt-6">
          <div>
            <Eyebrow>Confirm</Eyebrow>
            <h2 className="mt-3 text-[1.5rem]">Finalize Scores</h2>
          </div>
          <button onClick={onClose} className="icon-btn" aria-label="Close" title="Close">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="space-y-4 px-6 pb-6 pt-6">
          <p className="text-sm text-ink-body">
            Finalizing will lock all jury scores for this category. Juries will
            no longer be able to edit their submissions and winners will be
            recorded.
          </p>
          <ul className="list-inside list-disc space-y-1 text-sm text-ink-muted">
            <li>All participant scores will be marked as finalized.</li>
            <li>Winners will be stored in the event winners table.</li>
            <li>This action cannot be undone.</li>
          </ul>
        </div>
        <div className="flex flex-wrap justify-end gap-3 border-t border-rule-hairline bg-surface-warm px-6 py-4">
          <button onClick={onClose} className="btn-ghost" disabled={finalizing}>
            Cancel
          </button>
          <button onClick={onConfirm} disabled={finalizing} className="btn-primary">
            {finalizing ? 'Finalizing...' : 'Confirm Finalize'}
          </button>
        </div>
      </div>
    </div>
  );
}
