import { X } from 'lucide-react';
import { Eyebrow } from './shared/StateCard';

interface UnauthorizedModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function UnauthorizedModal({ isOpen, onClose }: UnauthorizedModalProps) {
  if (!isOpen) return null;

  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-labelledby="unauthorized-title">
      <div className="sheet sm:max-w-md">
        <div className="flex items-start justify-between gap-4 px-6 pt-6">
          <div>
            <Eyebrow>Access denied</Eyebrow>
            <h2 id="unauthorized-title" className="mt-3 text-[1.5rem]">Not authorised.</h2>
          </div>
          <button onClick={onClose} className="icon-btn" aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="px-6 pb-6 pt-3 text-[0.9375rem] text-ink-muted">
          <p>This app needs one of these roles on your account:</p>
          <dl className="mt-4 divide-y divide-rule-hairline border-y border-rule-hairline">
            {[
              ['admin', 'Manage events and finalize results'],
              ['jury', 'Score performances'],
              ['score_staff', 'View results'],
            ].map(([role, what]) => (
              <div key={role} className="flex items-center justify-between gap-4 py-2.5">
                <dt className="font-mono text-[0.8125rem] text-ink-primary">{role}</dt>
                <dd className="text-right text-[0.875rem]">{what}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-4">If you should have access, ask an admin to grant the role.</p>
          <button onClick={onClose} className="btn-secondary mt-6 w-full">
            Understood
          </button>
        </div>
      </div>
    </div>
  );
}
