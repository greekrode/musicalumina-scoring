import { Camera, Check } from 'lucide-react';
import { toBlob } from 'html-to-image';
import { useRef, useState } from 'react';

export interface CaptureRow {
  name: string;
  piece?: string;
  score: number;
  scoreCount: number;
  prizeLevel?: string;
  prizeOrder?: number;
}

interface ResultsCaptureProps {
  eventTitle: string;
  categoryName: string;
  rows: CaptureRow[];
  /** Leave scores off the image (e.g. for public announcements). */
  hideScores: boolean;
  onDone: (message: string, type?: 'success' | 'error') => void;
}

const MEDAL: Record<string, string> = { gold: '#E2A225', silver: '#9AA0A6', bronze: '#B0713A' };

function groupRows(rows: CaptureRow[]) {
  const groups = new Map<string, { order: number; rows: CaptureRow[] }>();
  for (const row of rows) {
    if (row.scoreCount === 0) continue; // not scored yet: not a result
    const level = row.prizeLevel || 'Participants';
    const group = groups.get(level) ?? { order: row.prizeLevel ? row.prizeOrder ?? 99 : 1000, rows: [] };
    group.rows.push(row);
    groups.set(level, group);
  }
  return [...groups.entries()].sort((a, b) => a[1].order - b[1].order);
}

/** The image itself: a Musica Lumina results sheet, 1080px wide. */
function ResultsSheet({ eventTitle, categoryName, rows, hideScores }: Omit<ResultsCaptureProps, 'onDone'>) {
  const groups = groupRows(rows);
  return (
    <div
      style={{ width: 1080, fontFamily: 'Manrope, system-ui, sans-serif', background: '#FFFBEF', color: '#2D2D2D' }}
      className="border-t-[6px] border-marigold px-[72px] pb-[64px] pt-[56px]"
    >
      <div className="flex items-center justify-between">
        <img src="/logo.png" alt="" style={{ height: 34 }} />
        <span className="type-label text-ink-accent" style={{ fontSize: 14 }}>Official results</span>
      </div>

      <div className="mt-[48px]">
        <span className="type-label inline-flex items-center gap-3 text-ink-accent" style={{ fontSize: 14 }}>
          <span className="h-px w-8 bg-marigold" />
          {eventTitle}
        </span>
        <h1 className="mt-4 font-serif text-burgundy" style={{ fontSize: 56, lineHeight: 1.08, fontWeight: 500 }}>
          {categoryName}
        </h1>
      </div>

      <div className="mt-[44px] space-y-[36px]">
        {groups.map(([level, group]) => (
          <section key={level}>
            <div className="flex items-center gap-4 border-b border-rule-subtle pb-3">
              <span
                className="inline-block h-4 w-4 rotate-45"
                style={{ background: MEDAL[level.toLowerCase()] ?? '#491822' }}
              />
              <h2 className="font-serif text-burgundy" style={{ fontSize: 32, fontWeight: 500 }}>
                {level}
              </h2>
              <span className="ml-auto text-ink-muted" style={{ fontSize: 18 }}>
                {group.rows.length} {group.rows.length === 1 ? 'participant' : 'participants'}
              </span>
            </div>
            <ol>
              {group.rows.map((row, i) => (
                <li key={row.name + i} className="flex items-baseline gap-6 border-b border-rule-hairline py-[14px]">
                  <span className="w-8 font-serif text-ink-subtle" style={{ fontSize: 20 }}>
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <span className="flex-1">
                    <span className="block font-semibold text-burgundy" style={{ fontSize: 24 }}>{row.name}</span>
                    {row.piece && row.piece !== 'Not specified' && (
                      <span className="block text-ink-muted" style={{ fontSize: 17 }}>{row.piece}</span>
                    )}
                  </span>
                  {!hideScores && (
                    <span className="font-serif text-burgundy" style={{ fontSize: 26 }}>{row.score.toFixed(2)}</span>
                  )}
                </li>
              ))}
            </ol>
          </section>
        ))}
        {groups.length === 0 && <p className="text-ink-muted" style={{ fontSize: 22 }}>No scores yet.</p>}
      </div>

      <div className="mt-[56px] flex items-center justify-between text-ink-muted" style={{ fontSize: 16 }}>
        <span>musicalumina.com</span>
        <span>
          {new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Jakarta' })}
        </span>
      </div>
    </div>
  );
}

/**
 * "Capture" button: renders the results sheet offscreen, turns it into a PNG
 * and copies it to the clipboard (download as fallback where the browser
 * can't put images on the clipboard).
 */
export default function ResultsCapture(props: ResultsCaptureProps) {
  const sheetRef = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  const render = async () => {
    await document.fonts.ready;
    const blob = await toBlob(sheetRef.current!, { pixelRatio: 2, backgroundColor: '#FFFBEF', cacheBust: true });
    if (!blob) throw new Error('Could not render the image');
    return blob;
  };

  const capture = async () => {
    setBusy(true);
    const fileName = `${props.categoryName} - results.png`.replace(/[\\/:*?"<>|]/g, '');
    try {
      if (typeof ClipboardItem !== 'undefined' && navigator.clipboard?.write) {
        // Safari needs the ClipboardItem created inside the click, with the image as a promise.
        const pending = render();
        try {
          await navigator.clipboard.write([new ClipboardItem({ 'image/png': pending })]);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
          props.onDone('Results image copied. Paste it anywhere.');
          return;
        } catch {
          download(await pending, fileName); // clipboard refused: still give them the image
          props.onDone('Clipboard unavailable here, so the image was downloaded instead.');
          return;
        }
      }
      download(await render(), fileName);
      props.onDone('Results image downloaded.');
    } catch (err) {
      props.onDone(err instanceof Error ? err.message : 'Capture failed', 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <button onClick={capture} disabled={busy || props.rows.length === 0} className="btn-outline">
        {copied ? <Check className="h-4 w-4" /> : <Camera className="h-4 w-4" />}
        {busy ? 'Capturing…' : copied ? 'Copied' : 'Capture'}
      </button>
      {/* Offscreen render target; not visible, not announced. */}
      <div aria-hidden style={{ position: 'fixed', left: -10000, top: 0, pointerEvents: 'none' }}>
        <div ref={sheetRef}>
          <ResultsSheet {...props} />
        </div>
      </div>
    </>
  );
}

function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement('a'), { href: url, download: name });
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
