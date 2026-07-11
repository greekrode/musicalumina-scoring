import { LucideIcon } from 'lucide-react';

interface TableLinkButtonProps {
  /** Normalized (protocol-prefixed) URL, or undefined when none is set. */
  href?: string;
  /** Lucide icon rendered before the label. */
  icon: LucideIcon;
  /** Button text. */
  label: string;
  /** Native title/tooltip. */
  title: string;
}

/**
 * A small pill-style link used in scoring tables to open an external resource
 * (video recording, repertoire PDF, ...) in a new tab, or render a muted "--"
 * placeholder when no URL is available. Centralizes the shared styling so every
 * table link stays visually consistent.
 */
export default function TableLinkButton({
  href,
  icon: Icon,
  label,
  title,
}: TableLinkButtonProps) {
  if (!href) {
    return <span className="text-sm text-gray-400">--</span>;
  }

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-medium bg-piano-gold/10 text-piano-wine border border-piano-gold/30 hover:bg-piano-gold/20 focus:ring-2 focus:ring-piano-gold focus:ring-offset-2 transition-colors"
      title={title}
    >
      <Icon className="w-4 h-4 mr-1" />
      {label}
    </a>
  );
}
