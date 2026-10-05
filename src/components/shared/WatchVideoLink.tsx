import { PlayCircle } from 'lucide-react';

interface WatchVideoLinkProps {
  /** Normalized (protocol-prefixed) video URL, or undefined when none is set. */
  videoUrl?: string;
}

/**
 * Renders a "Watch Video" link that opens a participant's performance recording
 * in a new tab, or a muted "--" placeholder when no video URL is available.
 * Shared by the jury scoring table and the admin results table so both stay
 * visually in sync.
 */
export default function WatchVideoLink({ videoUrl }: WatchVideoLinkProps) {
  if (!videoUrl) {
    return <span className="text-sm text-ink-subtle">—</span>;
  }

  return (
    <a
      href={videoUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="type-label inline-flex items-center gap-1.5 border border-rule-subtle px-2.5 py-1.5 text-ink-primary transition-colors hover:border-marigold hover:bg-marigold-50"
      title="Open performance video in a new tab"
    >
      <PlayCircle className="h-3.5 w-3.5" aria-hidden />
      Watch
    </a>
  );
}
