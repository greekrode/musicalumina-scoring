import { FileText } from 'lucide-react';
import TableLinkButton from './TableLinkButton';

interface ViewRepertoireLinkProps {
  /** Normalized (protocol-prefixed) repertoire PDF URL, or undefined when none is set. */
  repertoireUrl?: string;
}

/**
 * Renders a "Repertoire" link that opens a participant's submitted repertoire
 * PDF in a new tab, or a muted "--" placeholder when none is available. Shared
 * by the jury scoring table and the admin results table.
 */
export default function ViewRepertoireLink({
  repertoireUrl,
}: ViewRepertoireLinkProps) {
  return (
    <TableLinkButton
      href={repertoireUrl}
      icon={FileText}
      label="Repertoire"
      title="Open repertoire PDF in a new tab"
    />
  );
}
