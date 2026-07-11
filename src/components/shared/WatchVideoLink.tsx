import { PlayCircle } from 'lucide-react';
import TableLinkButton from './TableLinkButton';

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
  return (
    <TableLinkButton
      href={videoUrl}
      icon={PlayCircle}
      label="Watch Video"
      title="Open performance video in a new tab"
    />
  );
}
