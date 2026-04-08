import { X } from 'lucide-react';

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
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4">
        <div className="bg-piano-wine p-4 text-white">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">Finalize Scores</h3>
            <button
              onClick={onClose}
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
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-800"
            disabled={finalizing}
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={finalizing}
            className={`inline-flex items-center px-4 py-2 rounded-lg text-sm font-medium text-white ${
              finalizing
                ? 'bg-gray-400 cursor-not-allowed'
                : 'bg-piano-wine hover:bg-piano-wine/90'
            }`}
          >
            {finalizing ? 'Finalizing...' : 'Confirm Finalize'}
          </button>
        </div>
      </div>
    </div>
  );
}
