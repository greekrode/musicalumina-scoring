import { MessageSquare, X } from 'lucide-react';
import { Eyebrow } from '../shared/StateCard';

interface RemarksModalProps {
  remarks: Array<{ jury_name: string; remarks: string }>;
  onClose: () => void;
}

export default function RemarksModal({ remarks, onClose }: RemarksModalProps) {
  return (
    <div className="overlay">
      <div className="sheet" role="dialog" aria-modal="true">
        <div className="flex items-start justify-between px-6 pt-6">
          <div>
            <Eyebrow>Feedback</Eyebrow>
            <h2 className="mt-3 text-[1.5rem]">Jury Remarks</h2>
          </div>
          <button onClick={onClose} className="icon-btn" aria-label="Close" title="Close">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="px-6 pb-6 pt-6">
          {remarks.length > 0 ? (
            <div className="space-y-4">
              {remarks.map((remark, index) => (
                <div key={index} className="border border-rule-hairline bg-surface-warm p-4">
                  <div className="mb-2 flex items-center">
                    <MessageSquare className="mr-2 h-4 w-4 text-ink-accent" />
                    <h4 className="font-medium text-ink-primary">
                      {remark.jury_name || 'Unknown Jury'}
                    </h4>
                  </div>
                  <p className="text-sm leading-relaxed text-ink-body">
                    {remark.remarks}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-8 text-center">
              <MessageSquare className="mx-auto mb-4 h-12 w-12 text-ink-subtle" />
              <h3 className="mb-2 text-[1.25rem]">No Remarks</h3>
              <p className="text-ink-muted">
                No jury members have provided remarks for this participant yet.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
