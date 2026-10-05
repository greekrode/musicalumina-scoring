import { AlertCircle, ChevronDown, CloudOff, Lock, Pen, Search, X } from 'lucide-react';
import React, { useEffect, useMemo, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { useEventCategories } from '../../hooks/useEventCategories';
import { useParticipants } from '../../hooks/useParticipants';
import { useRealtimeScoring } from '../../hooks/useRealtimeScoring';
import { useSongs } from '../../hooks/useSongs';
import { useSupabaseQuery } from '../../hooks/useSupabaseQuery';
import { dismissRejected, useOutbox } from '../../lib/scoreOutbox';
import { readCache, writeCache } from '../../lib/offlineCache';
import { supabase } from '../../lib/supabase';
import { Registration } from '../../types';
import { normalizeExternalUrl } from '../../utils/url';
import { Eyebrow } from '../shared/StateCard';
import WatchVideoLink from '../shared/WatchVideoLink';
import ScoringModal from './ScoringModal';

interface ParticipantScoreData {
  hasScore: boolean;
  finalized: boolean;
  finalScore: number;
  /** Saved on this device, not yet on the server. */
  pending?: boolean;
}

type StatusFilter = 'all' | 'pending' | 'completed';

function StatusPill({ score }: { score: ParticipantScoreData | undefined }) {
  if (score?.finalized) return <span className="pill-muted"><Lock className="h-3 w-3" aria-hidden /> Finalized</span>;
  if (score?.pending) return <span className="pill-wait"><CloudOff className="h-3 w-3" aria-hidden /> Saved offline</span>;
  if (score?.hasScore) return <span className="pill-ok">Scored</span>;
  return <span className="pill-muted">To score</span>;
}

interface ParticipantRowProps {
  participant: Registration;
  index: number;
  scoreData: ParticipantScoreData | undefined;
  getSongWithIndex: (title: string) => string;
  onScore: (participant: Registration) => void;
}

const ParticipantRow = React.memo(function ParticipantRow({
  participant,
  index,
  scoreData,
  getSongWithIndex,
  onScore,
}: ParticipantRowProps) {
  const duration =
    participant.song_duration && !['0', '0:00'].includes(participant.song_duration) ? participant.song_duration : null;
  const finalized = Boolean(scoreData?.finalized);

  return (
    <tr className="border-b border-rule-hairline transition-colors hover:bg-surface-warm/60">
      <td className="table-cell w-12 font-serif text-ink-subtle">{String(index + 1).padStart(2, '0')}</td>
      <td className="table-cell">
        <div className="font-semibold text-ink-primary">{participant.participant_name}</div>
        <div className="mt-0.5 text-[0.8125rem] text-ink-muted md:hidden">
          {participant.song_title ? getSongWithIndex(participant.song_title) : 'Piece not specified'}
        </div>
      </td>
      <td className="table-cell hidden text-ink-body md:table-cell">
        {participant.song_title ? getSongWithIndex(participant.song_title) : <span className="text-ink-subtle">Not specified</span>}
      </td>
      <td className="table-cell hidden whitespace-nowrap text-ink-muted lg:table-cell">{duration ?? '—'}</td>
      <td className="table-cell hidden whitespace-nowrap sm:table-cell">
        <WatchVideoLink videoUrl={normalizeExternalUrl(participant.video_url)} />
      </td>
      <td className="table-cell whitespace-nowrap">
        <StatusPill score={scoreData} />
      </td>
      <td className="table-cell whitespace-nowrap text-right font-serif text-[1.125rem] text-ink-primary">
        {scoreData?.hasScore ? scoreData.finalScore.toFixed(1) : <span className="text-ink-subtle">—</span>}
      </td>
      <td className="table-cell w-14 text-right">
        <button
          onClick={() => onScore(participant)}
          disabled={finalized}
          className="icon-btn border border-rule-subtle text-ink-primary hover:border-marigold hover:bg-marigold"
          aria-label={finalized ? `Score for ${participant.participant_name} is finalized` : `Score ${participant.participant_name}`}
          title={finalized ? 'Finalized: can no longer be edited' : 'Score participant'}
        >
          <Pen className="h-4 w-4" />
        </button>
      </td>
    </tr>
  );
});

export default function JuryInterface() {
  const { state } = useApp();
  const outbox = useOutbox();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [selectedCategoryCombo, setSelectedCategoryCombo] = useState(() => readCache<string>(`combo:${state.user?.id}`) ?? '');
  const [scoringParticipant, setScoringParticipant] = useState<Registration | null>(null);

  useEffect(() => writeCache(`combo:${state.user?.id}`, selectedCategoryCombo), [selectedCategoryCombo, state.user?.id]);

  const { categories, loading: categoriesLoading } = useEventCategories(undefined, 'jury-categories');
  const { getSongWithIndex } = useSongs('songs');

  const [categoryId, subcategoryId] = selectedCategoryCombo ? selectedCategoryCombo.split('|') : ['', ''];
  const selectedCategory = categories.find((c) => c.categoryId === categoryId && c.subcategoryId === subcategoryId);
  const { participants, loading: participantsLoading } = useParticipants(categoryId, subcategoryId, { jury: true });

  // This jury's own scores for the category, in one query.
  const { data: serverScores, refetch: refetchScores } = useSupabaseQuery<Record<string, ParticipantScoreData>>(
    async () => {
      const { data, error } = await supabase
        .from('event_scoring')
        .select('registration_id, final_score, finalized')
        .in('registration_id', participants.map((p) => p.id))
        .eq('jury_id', state.user!.id);
      if (error) throw error;

      const scores: Record<string, ParticipantScoreData> = {};
      data?.forEach((row) => {
        scores[row.registration_id] = { hasScore: true, finalized: Boolean(row.finalized), finalScore: Number(row.final_score) || 0 };
      });
      return scores;
    },
    [participants, state.user?.id],
    {},
    {
      enabled: participants.length > 0 && !!state.user?.id,
      cacheKey: selectedCategoryCombo ? `myscores:${state.user?.id}:${selectedCategoryCombo}` : undefined,
    }
  );

  // Live updates (e.g. an admin finalizing) and a refetch after offline scores sync.
  useRealtimeScoring({
    eventId: selectedCategory?.eventId,
    categoryId,
    subcategoryId,
    onScoringChange: refetchScores,
    enabled: !!selectedCategory,
  });
  useEffect(() => {
    if (outbox.syncedVersion > 0 && participants.length > 0) refetchScores();
  }, [outbox.syncedVersion, participants.length, refetchScores]);

  // Queued scores are newer than the server copy until they sync.
  const participantScores = useMemo(() => {
    const merged = { ...serverScores };
    for (const item of Object.values(outbox.queued)) {
      merged[item.registrationId] = {
        hasScore: true,
        finalized: Boolean(serverScores[item.registrationId]?.finalized),
        finalScore: item.finalScore,
        pending: true,
      };
    }
    return merged;
  }, [serverScores, outbox.queued]);

  const filteredParticipants = useMemo(() => {
    if (!categoryId || !subcategoryId) return [];
    const term = searchTerm.trim().toLowerCase();
    return participants.filter((p) => {
      if (term && !p.participant_name.toLowerCase().includes(term) && !(p.song_title || '').toLowerCase().includes(term)) {
        return false;
      }
      if (statusFilter === 'all') return true;
      const hasScore = participantScores[p.id]?.hasScore || false;
      return statusFilter === 'completed' ? hasScore : !hasScore;
    });
  }, [participants, categoryId, subcategoryId, searchTerm, statusFilter, participantScores]);

  const scoredCount = participants.filter((p) => participantScores[p.id]?.hasScore).length;
  const pendingCount = Object.keys(outbox.queued).length;

  if (categoriesLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="spinner h-8 w-8" aria-label="Loading" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-12 lg:px-8">
      <div className="mb-8">
        <Eyebrow>Jury scoresheet</Eyebrow>
        <h1 className="mt-3 text-[clamp(1.75rem,1.3rem+1.6vw,2.5rem)]">Score performances</h1>
        <p className="mt-2 max-w-prose text-[0.9375rem] text-ink-muted">
          Pick a category, then score each participant. Scores save on this device first, so a dropped connection never
          loses your work.
        </p>
      </div>

      {outbox.rejected.map((item) => (
        <div
          key={item.registrationId + item.queuedAt}
          role="alert"
          className="mb-3 flex items-start gap-3 border border-rule-hairline border-l-2 border-l-[var(--status-error)] bg-status-error-bg px-4 py-3 text-[0.875rem] text-status-error-fg"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <p className="flex-1">
            <strong className="font-semibold">{item.participantName}</strong> ({item.finalScore.toFixed(1)}) was not saved:{' '}
            {item.reason}
          </p>
          <button onClick={() => dismissRejected(item.registrationId)} className="icon-btn -my-1.5 h-7 w-7" aria-label="Dismiss">
            <X className="h-4 w-4" />
          </button>
        </div>
      ))}

      {pendingCount > 0 && (
        <div
          role="status"
          className="mb-6 flex items-start gap-3 border border-rule-hairline border-l-2 border-l-marigold bg-status-upcoming-bg px-4 py-3 text-[0.875rem] text-status-upcoming-fg"
        >
          <CloudOff className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <p>
            {state.offline
              ? `${pendingCount} score${pendingCount > 1 ? 's are' : ' is'} saved on this device. They sync after you reconnect and sign in.`
              : outbox.online
              ? `Syncing ${pendingCount} saved score${pendingCount > 1 ? 's' : ''}…`
              : `You're offline. ${pendingCount} score${pendingCount > 1 ? 's are' : ' is'} saved on this device and will sync automatically when the connection is back.`}
          </p>
        </div>
      )}

      <div className="card border-t-2 border-t-marigold p-5 sm:p-6">
        <label htmlFor="category" className="field-label">
          Competition category
        </label>
        <div className="relative">
          <select
            id="category"
            value={selectedCategoryCombo}
            onChange={(e) => setSelectedCategoryCombo(e.target.value)}
            className="field"
          >
            <option value="">Select a category…</option>
            {categories.map((c) => (
              <option key={`${c.categoryId}|${c.subcategoryId}`} value={`${c.categoryId}|${c.subcategoryId}`}>
                {c.displayName}
              </option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" aria-hidden />
        </div>
      </div>

      {selectedCategoryCombo && (
        <section className="mt-8" aria-labelledby="participants-title">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2 id="participants-title" className="text-[1.375rem]">Participants</h2>
              <p className="mt-1 text-[0.875rem] text-ink-muted">
                {scoredCount} of {participants.length} scored
              </p>
            </div>
            <div className="flex w-full flex-wrap gap-3 sm:w-auto">
              <div className="relative min-w-0 flex-1 sm:w-72 sm:flex-none">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" aria-hidden />
                <input
                  type="search"
                  aria-label="Search by name or piece"
                  placeholder="Search name or piece"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="field pl-9"
                />
              </div>
              <div className="relative w-40">
                <select
                  aria-label="Filter by status"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
                  className="field"
                >
                  <option value="all">All</option>
                  <option value="pending">To score</option>
                  <option value="completed">Scored</option>
                </select>
                <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" aria-hidden />
              </div>
            </div>
          </div>

          {participantsLoading ? (
            <div className="card flex h-48 items-center justify-center">
              <div className="spinner h-8 w-8" aria-label="Loading" />
            </div>
          ) : (
            <div className="card overflow-x-auto">
              <table className="min-w-full">
                <thead className="border-b border-rule-hairline bg-surface-warm">
                  <tr>
                    <th className="table-head">#</th>
                    <th className="table-head">Participant</th>
                    <th className="table-head hidden md:table-cell">Piece</th>
                    <th className="table-head hidden lg:table-cell">Duration</th>
                    <th className="table-head hidden sm:table-cell">Video</th>
                    <th className="table-head">Status</th>
                    <th className="table-head text-right">Score</th>
                    <th className="table-head">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredParticipants.map((participant, index) => (
                    <ParticipantRow
                      key={participant.id}
                      participant={participant}
                      index={index}
                      scoreData={participantScores[participant.id]}
                      getSongWithIndex={getSongWithIndex}
                      onScore={setScoringParticipant}
                    />
                  ))}
                </tbody>
              </table>

              {filteredParticipants.length === 0 && (
                <div className="px-6 py-14 text-center">
                  <Search className="mx-auto h-8 w-8 text-ink-subtle" aria-hidden />
                  <h3 className="mt-3 text-[1.125rem]">No participants found</h3>
                  <p className="mt-1 text-[0.875rem] text-ink-muted">
                    {searchTerm || statusFilter !== 'all'
                      ? 'Try a different search or filter.'
                      : 'No one is registered in this category yet.'}
                  </p>
                </div>
              )}
            </div>
          )}
        </section>
      )}

      {scoringParticipant && (
        <ScoringModal
          participant={scoringParticipant}
          eventId={selectedCategory?.eventId}
          onClose={() => {
            setScoringParticipant(null);
            refetchScores();
          }}
        />
      )}
    </div>
  );
}
