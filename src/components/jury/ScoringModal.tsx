import React, { useEffect, useState } from "react";
import { AlertCircle, Clapperboard, CloudOff, FileText, Lock, Save, X } from "lucide-react";
import { useApp } from "../../context/AppContext";
import { Registration } from "../../types";
import { supabase } from "../../lib/supabase";
import { useScoringAspects } from "../../hooks/useScoringAspects";
import { submitScore, useOutbox } from "../../lib/scoreOutbox";
import { normalizeExternalUrl } from "../../utils/url";
import { Eyebrow } from "../shared/StateCard";

interface ScoringModalProps {
  participant: Registration;
  eventId?: string;
  onClose: () => void;
}

export default function ScoringModal({ participant, eventId, onClose }: ScoringModalProps) {
  const { state } = useApp();
  const outbox = useOutbox();
  const queued = outbox.queued[participant.id];

  const [finalScore, setFinalScore] = useState<number | undefined>(queued?.finalScore);
  const [remarks, setRemarks] = useState<string>(queued?.remarks ?? "");
  const [hasExisting, setHasExisting] = useState(Boolean(queued));
  const [isFinalized, setIsFinalized] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  const piece = participant.song_title || "Not specified";
  const duration =
    participant.song_duration && !["0", "0:00"].includes(participant.song_duration) ? participant.song_duration : null;
  const videoUrl = normalizeExternalUrl(participant.video_url);
  const rawPdf = participant.song_pdf_url as string | string[] | undefined;
  const pdfUrl = normalizeExternalUrl(Array.isArray(rawPdf) ? rawPdf[0] : rawPdf);

  const { aspects } = useScoringAspects(eventId);

  // Server copy. A score still waiting in the outbox is newer, so it wins.
  useEffect(() => {
    if (!state.user?.id) return;
    let cancelled = false;
    (async () => {
      try {
        const { data, error } = await supabase
          .from("event_scoring")
          .select("final_score, remarks, finalized")
          .eq("registration_id", participant.id)
          .eq("jury_id", state.user!.id)
          .maybeSingle();
        if (cancelled) return;
        if (error) throw error;
        if (!data) return;
        setHasExisting(true);
        setIsFinalized(Boolean(data.finalized));
        if (!queued) {
          setFinalScore(Number(data.final_score));
          setRemarks(data.remarks || "");
        }
      } catch {
        if (!cancelled) setLoadFailed(true);
      }
    })();
    return () => {
      cancelled = true;
    };
    // Load once per participant; later outbox changes must not overwrite edits.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [participant.id, state.user?.id]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && !isSubmitting && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isSubmitting, onClose]);

  const handleScoreChange = (value: string) => {
    setError("");
    if (value === "") return setFinalScore(undefined);
    const num = parseFloat(value);
    if (isNaN(num)) return;
    setFinalScore(Math.max(0, Math.min(100, Math.round(num * 10) / 10)));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isFinalized || isSubmitting) return;
    if (finalScore === undefined || finalScore <= 0 || finalScore > 100) {
      setError("Enter a score between 0.1 and 100.");
      return;
    }

    setIsSubmitting(true);
    const outcome = await submitScore({
      registrationId: participant.id,
      participantName: participant.participant_name,
      finalScore,
      remarks,
      juryName: state.user?.name ?? "",
    });
    setIsSubmitting(false);

    if (outcome.status === "rejected") {
      setError(outcome.reason);
      if (outcome.reason.includes("finalized")) setIsFinalized(true);
      return;
    }
    onClose();
  };

  return (
    <div
      className="overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="scoring-title"
      onClick={(e) => e.target === e.currentTarget && !isSubmitting && onClose()}
    >
      <div className="sheet sm:max-w-2xl">
        <div className="flex items-start justify-between gap-4 px-6 pt-6">
          <div className="min-w-0">
            <Eyebrow>{hasExisting ? "Update score" : "Score performance"}</Eyebrow>
            <h2 id="scoring-title" className="mt-3 text-[clamp(1.375rem,1.1rem+1vw,1.875rem)]">
              {participant.participant_name}
            </h2>
          </div>
          <button onClick={onClose} disabled={isSubmitting} className="icon-btn -mr-2" aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mx-6 mt-5 border-y border-rule-hairline py-4">
          <div className="flex items-baseline justify-between gap-4">
            <span className="type-label text-ink-muted">Performance piece</span>
            {duration && <span className="text-[0.8125rem] text-ink-muted">{duration}</span>}
          </div>
          <p className="mt-2 font-serif text-[1.0625rem] text-ink-primary">{piece}</p>
          {(videoUrl || pdfUrl) && (
            <div className="mt-3 flex flex-wrap gap-2">
              {videoUrl && (
                <a href={videoUrl} target="_blank" rel="noopener noreferrer" className="btn-outline btn-sm">
                  <Clapperboard className="h-4 w-4" aria-hidden /> Video recording
                </a>
              )}
              {pdfUrl && (
                <a href={pdfUrl} target="_blank" rel="noopener noreferrer" className="btn-outline btn-sm">
                  <FileText className="h-4 w-4" aria-hidden /> Repertoire
                </a>
              )}
            </div>
          )}
        </div>

        <form onSubmit={handleSubmit} className="space-y-6 px-6 pb-6 pt-6">
          {isFinalized && (
            <div className="flex gap-3 border-l-2 border-marigold bg-status-upcoming-bg px-4 py-3 text-[0.875rem] text-status-upcoming-fg">
              <Lock className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              <p>This score has been finalized and can no longer be changed.</p>
            </div>
          )}
          {loadFailed && !isFinalized && (
            <div className="flex gap-3 border-l-2 border-rule-strong bg-surface-warm px-4 py-3 text-[0.875rem] text-ink-muted">
              <CloudOff className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              <p>
                You're offline, so your earlier score for this participant could not be loaded. A score you save now
                stays on this device and replaces it once the connection is back.
              </p>
            </div>
          )}

          <div>
            <label htmlFor="final-score" className="field-label">
              Final score
            </label>
            <div className="relative">
              <input
                id="final-score"
                type="number"
                inputMode="decimal"
                min="0"
                max="100"
                step="0.1"
                autoFocus={!isFinalized}
                value={finalScore ?? ""}
                onChange={(e) => handleScoreChange(e.target.value)}
                disabled={isFinalized}
                aria-describedby="score-hint"
                className="field h-20 pr-20 text-center font-serif text-[2.5rem] text-ink-primary"
                placeholder="—"
              />
              <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-[0.9375rem] text-ink-subtle">
                / 100
              </span>
            </div>
            <p id="score-hint" className="mt-2 text-[0.8125rem] text-ink-muted">
              One decimal place, e.g. 85.5
            </p>
          </div>

          <div>
            <label htmlFor="remarks" className="field-label">
              Remarks <span className="normal-case tracking-normal text-ink-subtle">(optional)</span>
            </label>
            <textarea
              id="remarks"
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              disabled={isFinalized}
              maxLength={2000}
              rows={3}
              className="field resize-none"
              placeholder="Comments or feedback for this performance"
            />
          </div>

          {aspects.length > 0 && (
            <details className="group border border-rule-hairline">
              <summary className="type-label flex cursor-pointer list-none items-center justify-between px-4 py-3 text-ink-muted hover:text-ink-primary">
                Scoring criteria
                <span className="text-ink-subtle group-open:hidden">Show</span>
                <span className="hidden text-ink-subtle group-open:inline">Hide</span>
              </summary>
              <ul className="divide-y divide-rule-hairline border-t border-rule-hairline">
                {aspects.map((aspect) => (
                  <li key={aspect.id} className="px-4 py-3">
                    <div className="flex items-baseline justify-between gap-4">
                      <span className="text-[0.9375rem] font-semibold text-ink-primary">{aspect.name}</span>
                      <span className="text-[0.8125rem] text-ink-accent">{aspect.weight}%</span>
                    </div>
                    {aspect.description && (
                      <p className="mt-1 text-[0.8125rem] leading-relaxed text-ink-muted">{aspect.description}</p>
                    )}
                  </li>
                ))}
              </ul>
            </details>
          )}

          {error && (
            <p role="alert" className="flex items-center gap-2 text-[0.875rem] text-status-error-fg">
              <AlertCircle className="h-4 w-4 shrink-0" aria-hidden /> {error}
            </p>
          )}

          {!isFinalized && (
            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button type="button" onClick={onClose} disabled={isSubmitting} className="btn-ghost">
                Cancel
              </button>
              <button type="submit" disabled={isSubmitting} className="btn-secondary">
                {isSubmitting ? <span className="spinner h-4 w-4 border-offWhite border-t-transparent" /> : <Save className="h-4 w-4" />}
                {isSubmitting ? "Saving…" : hasExisting ? "Update score" : "Submit score"}
              </button>
            </div>
          )}
        </form>
      </div>
    </div>
  );
}
