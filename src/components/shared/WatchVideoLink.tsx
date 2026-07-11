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
    return <span className="text-sm text-gray-400">--</span>;
  }

  return (
    <a
      href={videoUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-medium bg-piano-gold/10 text-piano-wine border border-piano-gold/30 hover:bg-piano-gold/20 focus:ring-2 focus:ring-piano-gold focus:ring-offset-2 transition-colors"
      title="Open performance video in a new tab"
    >
      <PlayCircle className="w-4 h-4 mr-1" />
      Watch Video
    </a>
  );
}
