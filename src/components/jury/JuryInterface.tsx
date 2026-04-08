import {
  CheckCircle,
  ChevronDown,
  Clock,
  Filter,
  Pen,
  Search,
} from 'lucide-react';
import React, { useMemo, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { useEventCategories } from '../../hooks/useEventCategories';
import { useParticipants } from '../../hooks/useParticipants';
import { useSongs } from '../../hooks/useSongs';
import { useSupabaseQuery } from '../../hooks/useSupabaseQuery';
import { supabase } from '../../lib/supabase';
import { Registration } from '../../types';
import ScoringModal from './ScoringModal';

interface ParticipantScoreData {
  hasScore: boolean;
  finalized: boolean;
  finalScore: number;
}

// --- Memoized row component ---
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
  const hasScore = scoreData?.hasScore || false;
  const status = hasScore ? 'completed' : 'pending';

  return (
    <tr className="hover:bg-piano-cream/30 transition-colors duration-150">
      <td className="px-6 py-4 whitespace-nowrap">
        <div>
          <div className="text-sm font-medium text-piano-wine">
            {participant.participant_name}
          </div>
          <div className="text-sm text-gray-500">#{index + 1}</div>
        </div>
      </td>
      <td className="px-6 py-4">
        <div className="text-sm text-gray-900">
          {participant.song_title
            ? getSongWithIndex(participant.song_title)
            : 'Not specified'}
        </div>
      </td>
      <td className="px-6 py-4 whitespace-nowrap">
        {participant.song_duration &&
        participant.song_duration !== '0' &&
        participant.song_duration !== '0:00' ? (
          <div className="text-sm text-gray-900">
            {participant.song_duration}
          </div>
        ) : (
          <div className="text-sm text-gray-400">--</div>
        )}
      </td>
      <td className="px-6 py-4 whitespace-nowrap">
        <span
          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
            status === 'completed'
              ? 'bg-green-100 text-green-800'
              : 'bg-amber-100 text-amber-800'
          }`}
        >
          {status === 'completed' ? (
            <>
              <CheckCircle className="w-4 h-4 mr-1" />
              Completed
            </>
          ) : (
            <>
              <Clock className="w-4 h-4 mr-1" />
              Pending
            </>
          )}
        </span>
      </td>
      <td className="px-6 py-4 whitespace-nowrap">
        <div className="text-sm font-medium text-piano-wine">
          {hasScore ? scoreData!.finalScore.toFixed(2) : '--'}
        </div>
      </td>
      <td className="px-6 py-4 whitespace-nowrap">
        <button
          onClick={() => onScore(participant)}
          disabled={scoreData?.finalized}
          className={`inline-flex items-center p-2 rounded-lg focus:ring-2 focus:ring-offset-2 transition-colors duration-200 ${
            scoreData?.finalized
              ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
              : 'bg-piano-wine text-white hover:bg-piano-wine/90 focus:ring-piano-wine'
          }`}
          title={
            scoreData?.finalized
              ? 'Score has been finalized and cannot be edited'
              : 'Score participant'
          }
        >
          <Pen className="w-4 h-4" />
        </button>
      </td>
    </tr>
  );
});

// --- Main component ---
export default function JuryInterface() {
  const { state } = useApp();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<
    'all' | 'pending' | 'completed'
  >('all');
  const [selectedCategoryCombo, setSelectedCategoryCombo] = useState('');
  const [scoringParticipant, setScoringParticipant] =
    useState<Registration | null>(null);

  const { categories, loading: categoriesLoading } = useEventCategories();
  const { getSongWithIndex } = useSongs();

  const [categoryId, subcategoryId] = selectedCategoryCombo
    ? selectedCategoryCombo.split('|')
    : ['', ''];
  const { participants, loading: participantsLoading } = useParticipants(
    categoryId,
    subcategoryId
  );

  // Batch fetch all scores for this jury in ONE query (fixes N+1)
  const { data: participantScores, refetch: refetchScores } = useSupabaseQuery<
    Record<string, ParticipantScoreData>
  >(
    async () => {
      const participantIds = participants.map((p) => p.id);
      const { data, error } = await supabase
        .from('event_scoring')
        .select('registration_id, final_score, finalized')
        .in('registration_id', participantIds)
        .eq('jury_id', state.user!.id);

      if (error) throw error;

      const scores: Record<string, ParticipantScoreData> = {};

      // Initialize all as no-score
      for (const p of participants) {
        scores[p.id] = { hasScore: false, finalized: false, finalScore: 0 };
      }

      // Fill in actual scores
      data?.forEach((row) => {
        scores[row.registration_id] = {
          hasScore: true,
          finalized: row.finalized,
          finalScore: row.final_score || 0,
        };
      });

      return scores;
    },
    [participants, state.user?.id],
    {},
    { enabled: participants.length > 0 && !!state.user?.id }
  );

  // Filter participants with useMemo
  const filteredParticipants = useMemo(() => {
    if (!categoryId || !subcategoryId) return [];

    let filtered = participants;

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (p) =>
          p.participant_name.toLowerCase().includes(term) ||
          (p.song_title || '').toLowerCase().includes(term)
      );
    }

    if (statusFilter !== 'all') {
      filtered = filtered.filter((p) => {
        const hasScore = participantScores[p.id]?.hasScore || false;
        return statusFilter === 'completed' ? hasScore : !hasScore;
      });
    }

    return filtered;
  }, [
    participants,
    categoryId,
    subcategoryId,
    searchTerm,
    statusFilter,
    participantScores,
  ]);

  if (categoriesLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-piano-wine"></div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-piano-wine mb-2">
          Jury Scoring Interface
        </h1>
        <p className="text-gray-600">
          Score participants for the selected competition category
        </p>
      </div>

      {/* Category Selection */}
      <div className="bg-white rounded-xl shadow-sm border border-piano-gold/20 p-6 mb-6">
        <div className="flex items-center">
          <div className="flex-1">
            <label className="block text-sm font-medium text-piano-wine mb-2">
              Select Competition Category
            </label>
            <div className="relative">
              <select
                value={selectedCategoryCombo}
                onChange={(e) => setSelectedCategoryCombo(e.target.value)}
                className="w-full appearance-none bg-white border border-piano-gold/30 rounded-lg px-4 py-3 pr-10 focus:ring-2 focus:ring-piano-gold focus:border-transparent"
              >
                <option value="">Select a category...</option>
                {categories.map((category) => (
                  <option
                    key={`${category.categoryId}|${category.subcategoryId}`}
                    value={`${category.categoryId}|${category.subcategoryId}`}
                  >
                    {category.displayName}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-piano-wine/60 pointer-events-none" />
            </div>
          </div>
        </div>
      </div>

      {selectedCategoryCombo && (
        <>
          {/* Search and Filter Controls */}
          <div className="bg-white rounded-xl shadow-sm border border-piano-gold/20 p-6 mb-6">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-piano-wine/60" />
                  <input
                    type="text"
                    placeholder="Search by name or piece..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 border border-piano-gold/30 rounded-lg focus:ring-2 focus:ring-piano-gold focus:border-transparent"
                  />
                </div>
              </div>
              <div className="sm:w-48">
                <div className="relative">
                  <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-piano-wine/60" />
                  <select
                    value={statusFilter}
                    onChange={(e) =>
                      setStatusFilter(
                        e.target.value as 'all' | 'pending' | 'completed'
                      )
                    }
                    className="w-full appearance-none pl-10 pr-10 py-3 border border-piano-gold/30 rounded-lg focus:ring-2 focus:ring-piano-gold focus:border-transparent"
                  >
                    <option value="all">All Participants</option>
                    <option value="pending">Pending Scores</option>
                    <option value="completed">Completed Scores</option>
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-piano-wine/60 pointer-events-none" />
                </div>
              </div>
            </div>
          </div>

          {/* Participants Table */}
          {participantsLoading ? (
            <div className="flex justify-center items-center h-64">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-piano-wine"></div>
            </div>
          ) : (
            <div className="bg-white rounded-xl shadow-sm border border-piano-gold/20 overflow-hidden">
              <div className="px-6 py-4 border-b border-piano-gold/20 bg-piano-cream">
                <h2 className="text-lg font-semibold text-piano-wine">
                  Participants ({filteredParticipants.length})
                </h2>
              </div>

              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-piano-gold/20">
                  <thead className="bg-piano-cream/50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-piano-wine uppercase tracking-wider">
                        Participant
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-piano-wine uppercase tracking-wider">
                        Performance Piece
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-piano-wine uppercase tracking-wider">
                        Duration
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-piano-wine uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-piano-wine uppercase tracking-wider">
                        Final Score
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-piano-wine uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-piano-gold/20">
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
              </div>

              {filteredParticipants.length === 0 && (
                <div className="text-center py-12 bg-piano-cream/30">
                  <Search className="mx-auto h-12 w-12 text-piano-wine/40" />
                  <h3 className="mt-2 text-sm font-medium text-piano-wine">
                    No participants found
                  </h3>
                  <p className="mt-1 text-sm text-gray-500">
                    {searchTerm || statusFilter !== 'all'
                      ? 'Try adjusting your search or filter criteria.'
                      : 'No participants registered for this category yet.'}
                  </p>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {scoringParticipant && selectedCategoryCombo && (
        <ScoringModal
          participant={scoringParticipant}
          category={{
            id: categoryId,
            name:
              categories.find(
                (c) =>
                  c.categoryId === categoryId &&
                  c.subcategoryId === subcategoryId
              )?.displayName || '',
            eventId: categories.find(
              (c) =>
                c.categoryId === categoryId && c.subcategoryId === subcategoryId
            )?.eventId,
          }}
          subcategoryId={subcategoryId}
          onClose={() => {
            setScoringParticipant(null);
            refetchScores();
          }}
        />
      )}
    </div>
  );
}
