import React, { useState, useEffect, useCallback } from 'react';
import { Trophy, Medal, Star, Users, Lock, Clock, MessageSquare, X, Calendar, Award, Download } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useEventCategories } from '../../hooks/useEventCategories';
import { useParticipants } from '../../hooks/useParticipants';
import { useScoringAspects } from '../../hooks/useScoringAspects';
import { usePrizeConfigurations } from '../../hooks/usePrizeConfigurations';
import { useEvents } from '../../hooks/useEvents';
import { useRealtimeScoring } from '../../hooks/useRealtimeScoring';
import { supabase } from '../../lib/supabase';
import { ParticipantWithPrize, PrizeAssignment } from '../../types';

interface ParticipantWithScores {
  id: string;
  number: number;
  fullName: string;
  averageScore: number;
  scoreCount: number;
  category: string;
  piece: string;
  duration: string;
  aspectScores: Record<string, { score: number; weight: number; name: string }>;
  isFinalized: boolean;
  juryScores: Array<{ name: string; score: number }>;
}

export default function ResultsOverview() {
  const { state } = useApp();
  const [selectedEventId, setSelectedEventId] = useState<string>('');
  const [selectedCategoryCombo, setSelectedCategoryCombo] = useState<string>('');
  const [participantsWithScores, setParticipantsWithScores] = useState<ParticipantWithScores[]>([]);
  const [prizeAssignments, setPrizeAssignments] = useState<PrizeAssignment[]>([]);
  const [assignedParticipants, setAssignedParticipants] = useState<ParticipantWithPrize[]>([]);
  const [loading, setLoading] = useState(false);
  const [remarksModalOpen, setRemarksModalOpen] = useState(false);
  const [selectedParticipantRemarks, setSelectedParticipantRemarks] = useState<Array<{jury_name: string, remarks: string}>>([]);
  const [realtimeActive, setRealtimeActive] = useState(false);
  
  const { events, loading: eventsLoading } = useEvents();
  const { categories, loading: categoriesLoading } = useEventCategories(selectedEventId);
  
  // Parse the selected category combo to get category and subcategory IDs
  const [categoryId, subcategoryId] = selectedCategoryCombo && selectedCategoryCombo !== 'all' ? selectedCategoryCombo.split('|') : ['', ''];
  const { participants, loading: participantsLoading } = useParticipants(categoryId, subcategoryId);
  
  // Get event ID from selected category
  const eventId = categories.find(c => c.categoryId === categoryId && c.subcategoryId === subcategoryId)?.eventId;
  const { aspects } = useScoringAspects(eventId);
  const { prizeConfigurations, loading: prizeConfigsLoading } = usePrizeConfigurations(eventId, categoryId, subcategoryId);

  // Auto-select the most recent active event when events are loaded
  useEffect(() => {
    if (!eventsLoading && events.length > 0 && !selectedEventId) {
      setSelectedEventId(events[0].id);
    }
  }, [events, eventsLoading, selectedEventId]);

  // Reset category selection when event changes
  useEffect(() => {
    setSelectedCategoryCombo('');
  }, [selectedEventId]);

  const fetchParticipantScores = useCallback(async () => {
    setLoading(true);
    try {
      let participantsToProcess = participants;

      // If "all categories" is selected, fetch participants from all categories in the event
      if (selectedCategoryCombo === 'all' && selectedEventId) {
        const { data: allParticipants, error: participantsError } = await supabase
          .from('registrations')
          .select('*')
          .eq('event_id', selectedEventId)
          .order('created_at', { ascending: true });

        if (participantsError) {
          console.error('Error fetching all participants:', participantsError);
          return;
        }

        participantsToProcess = allParticipants || [];
      }

      if (participantsToProcess.length === 0) {
        setParticipantsWithScores([]);
        return;
      }

      // Get all participant IDs for batch querying
      const participantIds = participantsToProcess.map(p => p.id);

      // Fetch all scoring data for these participants in ONE query
      const { data: allScoringData, error: scoringError } = await supabase
        .from('event_scoring')
        .select('registration_id, jury_id, jury_name, final_score, finalized')
        .in('registration_id', participantIds);

      if (scoringError) {
        console.error('Error fetching scores:', scoringError);
        return;
      }

      // Create a map of participant ID to their scoring data
      const scoringMap = new Map<string, Array<{ jury_id: string; jury_name: string; final_score: number; finalized: boolean }>>();
      
      allScoringData?.forEach(scoring => {
        if (!scoringMap.has(scoring.registration_id)) {
          scoringMap.set(scoring.registration_id, []);
        }
        scoringMap.get(scoring.registration_id)!.push({
          jury_id: scoring.jury_id,
          jury_name: scoring.jury_name || 'Unknown Jury',
          final_score: scoring.final_score,
          finalized: scoring.finalized
        });
      });

      // Process participants with their mapped scoring data
      const results: ParticipantWithScores[] = participantsToProcess.map((participant, index) => {
        const participantScoring = scoringMap.get(participant.id) || [];
        
        // Calculate scores from mapped data
        const juryScores: Array<{ name: string; score: number }> = [];
        let totalScore = 0;
        let scoreCount = 0;
        let isFinalized = false;

        participantScoring.forEach(scoring => {
          if (scoring.final_score !== null && scoring.final_score !== undefined) {
            juryScores.push({
              name: scoring.jury_name,
              score: scoring.final_score
            });
            totalScore += scoring.final_score;
            scoreCount++;
          }
          if (scoring.finalized) isFinalized = true;
        });

        const finalScore = scoreCount > 0 ? totalScore / scoreCount : 0;

        // Find the category display name for this participant
        let categoryDisplayName = 'Unknown Category';
        if (selectedCategoryCombo === 'all') {
          // For all categories view, find the category name from the participant's category/subcategory
          const participantCategory = categories.find(c => 
            c.categoryId === participant.category_id && 
            c.subcategoryId === participant.subcategory_id
          );
          categoryDisplayName = participantCategory?.displayName || 'Unknown Category';
        } else {
          // For specific category view
          const selectedCategory = categories.find(c => c.categoryId === categoryId && c.subcategoryId === subcategoryId);
          categoryDisplayName = selectedCategory?.displayName || 'Unknown Category';
        }
        
        return {
          id: participant.id,
          number: index + 1,
          fullName: participant.participant_name,
          averageScore: finalScore,
          scoreCount,
          category: categoryDisplayName,
          piece: participant.song_title || 'Not specified',
          duration: participant.song_duration || 'Not specified',
          aspectScores: {}, // No longer using aspect scores
          isFinalized,
          juryScores
        };
      });

      // Sort by score (highest first)
      results.sort((a, b) => b.averageScore - a.averageScore);
      setParticipantsWithScores(results);
    } catch (err) {
      console.error('Error fetching participant scores:', err);
    } finally {
      setLoading(false);
    }
  }, [participants, selectedCategoryCombo, selectedEventId, categories, categoryId, subcategoryId]);

  // Set up realtime subscriptions for scoring changes
  const handleScoringChange = useCallback(() => {
    // Refresh participant scores when scoring changes in real-time
    if (selectedCategoryCombo && participants.length >= 0) {
      setRealtimeActive(true);
      fetchParticipantScores();
      // Hide the indicator after a short delay
      setTimeout(() => setRealtimeActive(false), 2000);
    }
  }, [selectedCategoryCombo, participants.length, fetchParticipantScores]);

  const { status: realtimeStatus } = useRealtimeScoring({
    eventId: selectedEventId,
    categoryId: categoryId,
    subcategoryId: subcategoryId,
    onScoringChange: handleScoringChange,
    enabled: !!selectedEventId && !!selectedCategoryCombo
  });

  useEffect(() => {
    if (selectedCategoryCombo && participants.length >= 0) {
      fetchParticipantScores();
    }
  }, [fetchParticipantScores, selectedCategoryCombo, participants.length]);

  // Recalculate prize assignments when scores or prize configurations change
  useEffect(() => {
    if (participantsWithScores.length > 0 && prizeConfigurations.length > 0) {
      calculatePrizeAssignments();
    }
  }, [participantsWithScores, prizeConfigurations]);

  const calculatePrizeAssignments = () => {
    // Convert all participants to the prize-compatible format
    const allParticipants: ParticipantWithPrize[] = participantsWithScores
      .map(p => ({
        id: p.id,
        participant_name: p.fullName,
        averageScore: p.averageScore,
        scoreCount: p.scoreCount,
        piece: p.piece,
        duration: p.duration,
        juryScores: p.juryScores,
        isFinalized: p.isFinalized
      }))
      .sort((a, b) => b.averageScore - a.averageScore); // Sort by score descending

    if (allParticipants.length === 0) {
      setPrizeAssignments([]);
      setAssignedParticipants([]);
      return;
    }

    // Separate participants with scores from those without
    const eligibleParticipants = allParticipants.filter(p => p.scoreCount > 0);
    const participantsWithoutScores = allParticipants.filter(p => p.scoreCount === 0);

    // Sort prize configurations by display order
    const sortedPrizes = [...prizeConfigurations].sort((a, b) => a.display_order - b.display_order);
    
    const assignments: PrizeAssignment[] = [];
    const assignedParticipantsList: ParticipantWithPrize[] = [];
    const remainingParticipants = [...eligibleParticipants];

    // Process each prize level in order
    for (const prizeConfig of sortedPrizes) {
      const prizeAssignment: PrizeAssignment = {
        prizeLevel: prizeConfig.prize_level,
        displayOrder: prizeConfig.display_order,
        maxWinners: prizeConfig.max_winners,
        winners: [],
        scoreRange: {
          min: prizeConfig.min_score || 0,
          max: prizeConfig.max_score || 100
        }
      };

      // Find participants eligible for this prize level
      const eligibleForThisPrize = remainingParticipants.filter(participant => {
        const score = participant.averageScore;
        const meetsMinScore = prizeConfig.min_score === null || score >= prizeConfig.min_score;
        const meetsMaxScore = prizeConfig.max_score === null || score <= prizeConfig.max_score;
        return meetsMinScore && meetsMaxScore;
      });

      if (eligibleForThisPrize.length === 0) {
        assignments.push(prizeAssignment);
        continue;
      }

      // Group by score to handle ties
      const scoreGroups = new Map<number, ParticipantWithPrize[]>();
      eligibleForThisPrize.forEach(participant => {
        const score = participant.averageScore;
        if (!scoreGroups.has(score)) {
          scoreGroups.set(score, []);
        }
        scoreGroups.get(score)!.push(participant);
      });

      // Sort scores in descending order
      const sortedScores = Array.from(scoreGroups.keys()).sort((a, b) => b - a);
      
      let winnersAssigned = 0;
      
      for (const score of sortedScores) {
        const participantsWithThisScore = scoreGroups.get(score)!;
        
        // If adding this group would exceed max winners, check if it's a tie situation
        if (winnersAssigned + participantsWithThisScore.length > prizeConfig.max_winners) {
          // If we haven't assigned anyone yet, assign all tied participants (override max)
          if (winnersAssigned === 0) {
            participantsWithThisScore.forEach(participant => {
              participant.prizeLevel = prizeConfig.prize_level;
              participant.prizeDisplayOrder = prizeConfig.display_order;
              prizeAssignment.winners.push(participant);
              assignedParticipantsList.push(participant);
            });
            // Remove these participants from remaining pool
            participantsWithThisScore.forEach(participant => {
              const index = remainingParticipants.findIndex(p => p.id === participant.id);
              if (index > -1) remainingParticipants.splice(index, 1);
            });
            break;
          } else {
            // Skip this group - they'll cascade to next prize level
            break;
          }
        } else {
          // Add all participants with this score
          participantsWithThisScore.forEach(participant => {
            participant.prizeLevel = prizeConfig.prize_level;
            participant.prizeDisplayOrder = prizeConfig.display_order;
            prizeAssignment.winners.push(participant);
            assignedParticipantsList.push(participant);
          });
          winnersAssigned += participantsWithThisScore.length;
          
          // Remove these participants from remaining pool
          participantsWithThisScore.forEach(participant => {
            const index = remainingParticipants.findIndex(p => p.id === participant.id);
            if (index > -1) remainingParticipants.splice(index, 1);
          });
          
          // If we've reached the max, stop
          if (winnersAssigned >= prizeConfig.max_winners) {
            break;
          }
        }
      }

      assignments.push(prizeAssignment);
    }

    // Add unassigned participants (those who didn't win any prize)
    remainingParticipants.forEach(participant => {
      participant.prizeLevel = undefined;
      participant.prizeDisplayOrder = undefined;
      assignedParticipantsList.push(participant);
    });

    // Add participants without scores at the end
    participantsWithoutScores.forEach(participant => {
      participant.prizeLevel = undefined;
      participant.prizeDisplayOrder = undefined;
      assignedParticipantsList.push(participant);
    });

    setPrizeAssignments(assignments);
    setAssignedParticipants(assignedParticipantsList);
  };

  const viewRemarks = async (participantId: string) => {
    try {
      const { data: remarks, error } = await supabase
        .from('event_scoring')
        .select('jury_name, remarks')
        .eq('registration_id', participantId)
        .not('remarks', 'is', null)
        .not('remarks', 'eq', '');

      if (error) throw error;

      setSelectedParticipantRemarks(remarks || []);
      setRemarksModalOpen(true);
    } catch (err) {
      console.error('Error fetching remarks:', err);
      alert('Failed to fetch remarks. Please try again.');
    }
  };

  const finalizeScores = async () => {
    if (!window.confirm('Are you sure you want to finalize all scores for this category? This action cannot be undone and jury members will no longer be able to edit scores.')) {
      return;
    }

    try {
      // Update all event_scoring records for this category/subcategory to finalized
      const { error } = await supabase
        .from('event_scoring')
        .update({ finalized: true })
        .eq('category_id', categoryId)
        .eq('subcategory_id', subcategoryId);

      if (error) throw error;

      // Refresh the data
      fetchParticipantScores();
      alert('Scores have been finalized successfully!');
    } catch (err) {
      console.error('Error finalizing scores:', err);
      alert('Failed to finalize scores. Please try again.');
    }
  };

  const getPrizeIcon = (prizeLevel?: string, displayOrder?: number) => {
    if (!prizeLevel) {
      return <Star className="w-5 h-5 text-gray-300" />;
    }
    
    if (displayOrder === 1) return <Trophy className="w-5 h-5 text-yellow-500" />;
    if (displayOrder === 2) return <Medal className="w-5 h-5 text-gray-400" />;
    if (displayOrder === 3) return <Medal className="w-5 h-5 text-amber-600" />;
    return <Award className="w-5 h-5 text-piano-gold" />;
  };

  const getPrizeRowClass = (displayOrder?: number) => {
    if (!displayOrder) return '';
    if (displayOrder <= 3) return 'bg-piano-gold/10';
    return 'bg-piano-cream/30';
  };

  const exportToCSV = async () => {
    try {
      const selectedCategory = categories.find(c => c.categoryId === categoryId && c.subcategoryId === subcategoryId);
      const categoryName = selectedCategory?.displayName || 'Unknown Category';
      
      // Prepare data for export
      const dataToExport = [];
      const participantsToExport = prizeConfigurations.length > 0 ? assignedParticipants : participantsWithScores;

      for (let index = 0; index < participantsToExport.length; index++) {
        const participant = participantsToExport[index];
        const isAssignedParticipant = 'prizeLevel' in participant;
        const participantName = isAssignedParticipant ? participant.participant_name : (participant as ParticipantWithScores).fullName;
        const participantId = participant.id;
        const score = participant.averageScore;
        const scoreCount = participant.scoreCount;
        const prizeLevel = isAssignedParticipant ? participant.prizeLevel : undefined;

        // Fetch remarks for this participant
        const { data: remarksData, error: remarksError } = await supabase
          .from('event_scoring')
          .select('jury_name, remarks')
          .eq('registration_id', participantId)
          .not('remarks', 'is', null)
          .not('remarks', 'eq', '');

        if (remarksError) {
          console.error('Error fetching remarks for export:', remarksError);
        }

        // Format remarks as JSON object with jury names as keys
        const remarksObject: Record<string, string> = {};
        remarksData?.forEach(r => {
          if (r.jury_name && r.remarks) {
            remarksObject[r.jury_name] = r.remarks;
          }
        });
        
        const allRemarks = Object.keys(remarksObject).length > 0 ? JSON.stringify(remarksObject) : '';
        
        dataToExport.push({
          Rank: prizeLevel || `#${index + 1}`,
          'Participant ID': participantId,
          'Participant Name': participantName,
          'Final Score': scoreCount > 0 ? score.toFixed(2) : 'No Score',
          'Jury Count': scoreCount,
          'Remarks': allRemarks
        });
      }

      // Create CSV content
      const headers = Object.keys(dataToExport[0] || {});
      const csvContent = [
        headers.join(','),
        ...dataToExport.map(row => 
          headers.map(header => {
            const value = (row as any)[header];
            // Escape commas and quotes in the data
            if (typeof value === 'string' && (value.includes(',') || value.includes('"') || value.includes('\n'))) {
              return `"${value.replace(/"/g, '""')}"`;
            }
            return value;
          }).join(',')
        )
      ].join('\n');

      // Create and download file
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      
      // Generate filename with event and category info
      const eventTitle = events.find(e => e.id === selectedEventId)?.title || 'Event';
      const sanitizedEventTitle = eventTitle.replace(/[^a-zA-Z0-9]/g, '_');
      const sanitizedCategoryName = categoryName.replace(/[^a-zA-Z0-9]/g, '_');
      const timestamp = new Date().toISOString().split('T')[0];
      
      link.setAttribute('download', `${sanitizedEventTitle}_${sanitizedCategoryName}_Results_${timestamp}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

    } catch (err) {
      console.error('Error exporting to CSV:', err);
      alert('Failed to export CSV. Please try again.');
    }
  };

  if (eventsLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-piano-wine"></div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
        <div>
          <div className="flex items-center space-x-3">
            <h2 className="text-2xl font-bold text-piano-wine">Competition Results</h2>
            {realtimeActive && (
              <div className="flex items-center px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm font-medium animate-pulse">
                <div className="w-2 h-2 bg-green-500 rounded-full mr-2 animate-ping"></div>
                Live Update
              </div>
            )}
          </div>
          <p className="text-gray-600">
            {selectedCategoryCombo === 'all' 
              ? 'View high scorers across all categories (sorted by score)' 
              : 'View prize assignments and participant scores'}
          </p>
          {selectedEventId && selectedCategoryCombo && (
            <div className="flex items-center space-x-2 mt-1">
              {realtimeStatus.connected ? (
                <p className="text-xs text-green-600 flex items-center">
                  <span className="w-2 h-2 bg-green-500 rounded-full mr-2 animate-pulse"></span>
                  Real-time sync active - updates automatically when juries submit scores
                </p>
              ) : realtimeStatus.error ? (
                <p className="text-xs text-red-600 flex items-center">
                  <span className="w-2 h-2 bg-red-500 rounded-full mr-2"></span>
                  Real-time sync failed: {realtimeStatus.error}
                </p>
              ) : (
                <p className="text-xs text-yellow-600 flex items-center">
                  <span className="w-2 h-2 bg-yellow-500 rounded-full mr-2 animate-pulse"></span>
                  Connecting to real-time sync...
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Event Selection - Required First Step */}
      <div className="bg-white rounded-xl shadow-sm border border-piano-gold/20 p-6 mb-6">
        <div className="flex items-center">
          <div className="flex-1">
            <label className="block text-sm font-medium text-piano-wine mb-2">
              Select Event
            </label>
            <select
              value={selectedEventId}
              onChange={(e) => setSelectedEventId(e.target.value)}
              className="w-full px-3 py-2 border border-piano-gold/30 rounded-lg focus:ring-2 focus:ring-piano-gold focus:border-transparent"
            >
              <option value="">Select an event...</option>
              {events.map(event => (
                <option key={event.id} value={event.id}>
                  {event.title}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {!selectedEventId ? (
        <div className="bg-piano-cream rounded-xl p-8 text-center">
          <Calendar className="mx-auto h-12 w-12 text-piano-wine/40 mb-4" />
          <h3 className="text-lg font-medium text-piano-wine mb-2">Select an Event</h3>
          <p className="text-gray-600">Please select an event to view competition results</p>
        </div>
      ) : (
        <>
          {/* Category Selection and Controls */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
            <div className="flex items-center space-x-4">
              <select
                value={selectedCategoryCombo}
                onChange={(e) => setSelectedCategoryCombo(e.target.value)}
                className="px-3 py-2 border border-piano-gold/30 rounded-lg focus:ring-2 focus:ring-piano-gold focus:border-transparent"
                disabled={categoriesLoading}
              >
                <option value="">Select a category</option>
                <option value="all">All Categories</option>
                {categories.map(category => (
                  <option key={`${category.categoryId}|${category.subcategoryId}`} value={`${category.categoryId}|${category.subcategoryId}`}>
                    {category.displayName}
                  </option>
                ))}
              </select>
              {selectedCategoryCombo !== 'all' && (
                <>
                  <button
                    onClick={exportToCSV}
                    disabled={!selectedCategoryCombo || participantsWithScores.length === 0}
                    className={`inline-flex items-center px-4 py-2 rounded-lg focus:ring-2 focus:ring-offset-2 transition-colors duration-200 ${
                      selectedCategoryCombo && participantsWithScores.length > 0
                        ? 'bg-piano-gold text-white hover:bg-piano-gold/90 focus:ring-piano-gold'
                        : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    }`}
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Export CSV
                  </button>
                  <button
                    onClick={finalizeScores}
                    disabled={!selectedCategoryCombo || participantsWithScores.length === 0 || participantsWithScores.some(p => p.isFinalized)}
                    className={`inline-flex items-center px-4 py-2 rounded-lg focus:ring-2 focus:ring-offset-2 transition-colors duration-200 ${
                      selectedCategoryCombo && participantsWithScores.length > 0 && !participantsWithScores.some(p => p.isFinalized)
                        ? 'bg-piano-wine text-white hover:bg-piano-wine/90 focus:ring-piano-wine'
                        : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    }`}
                  >
                    <Lock className="w-4 h-4 mr-2" />
                    Finalize Scores
                  </button>
                </>
              )}
            </div>
          </div>

          {!selectedCategoryCombo ? (
            <div className="bg-piano-cream rounded-xl p-8 text-center">
              <Trophy className="mx-auto h-12 w-12 text-piano-wine/40 mb-4" />
              <h3 className="text-lg font-medium text-piano-wine mb-2">Select a Category</h3>
              <p className="text-gray-600">Please select a category to view competition results</p>
            </div>
          ) : categoriesLoading || participantsLoading || loading || prizeConfigsLoading ? (
            <div className="flex justify-center items-center h-64">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-piano-wine"></div>
            </div>
          ) : (
            <>
              {/* Prize Configuration Status */}
              {selectedCategoryCombo !== 'all' && prizeConfigurations.length === 0 && (
                <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-lg">
                  <div className="flex items-center">
                    <Award className="w-5 h-5 text-amber-600 mr-2" />
                    <div>
                      <h3 className="text-sm font-medium text-amber-800">No Prize Configuration</h3>
                      <p className="text-sm text-amber-600">No prize levels have been configured for this category. Participants will be displayed by rank order.</p>
                    </div>
                  </div>
                </div>
              )}

              <div className="bg-white rounded-xl shadow-sm border border-piano-gold/20 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-piano-gold/20">
                    <thead className="bg-piano-cream/50">
                      <tr>
                        {selectedCategoryCombo !== 'all' && (
                          <th className="px-6 py-3 text-left text-xs font-medium text-piano-wine uppercase tracking-wider">
                            {prizeConfigurations.length > 0 ? 'Prize Level' : 'Rank'}
                          </th>
                        )}
                        <th className="px-6 py-3 text-left text-xs font-medium text-piano-wine uppercase tracking-wider">
                          Participant
                        </th>
                        {selectedCategoryCombo === 'all' && (
                          <th className="px-6 py-3 text-left text-xs font-medium text-piano-wine uppercase tracking-wider">
                            Category
                          </th>
                        )}
                        <th className="px-6 py-3 text-left text-xs font-medium text-piano-wine uppercase tracking-wider">
                          Performance Piece
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-piano-wine uppercase tracking-wider">
                          Final Score
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-piano-wine uppercase tracking-wider">
                          Jury Count
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-piano-wine uppercase tracking-wider">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-piano-gold/20">
                      {(selectedCategoryCombo === 'all' ? participantsWithScores : (prizeConfigurations.length > 0 ? assignedParticipants : participantsWithScores)).map((participant, index) => {
                        const isAssignedParticipant = 'prizeLevel' in participant;
                        const prizeLevel = isAssignedParticipant ? participant.prizeLevel : undefined;
                        const displayOrder = isAssignedParticipant ? participant.prizeDisplayOrder : undefined;
                        const participantName = isAssignedParticipant ? participant.participant_name : (participant as ParticipantWithScores).fullName;
                        const score = participant.averageScore;
                        const scoreCount = participant.scoreCount;
                        const piece = participant.piece;
                        const duration = participant.duration;
                        const juryScores = participant.juryScores;
                        const participantId = participant.id;
                        const category = isAssignedParticipant ? '' : (participant as ParticipantWithScores).category;
                        
                        return (
                          <tr key={participantId} className={selectedCategoryCombo === 'all' ? '' : getPrizeRowClass(displayOrder)}>
                            {selectedCategoryCombo !== 'all' && (
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className="flex items-center">
                                  {getPrizeIcon(prizeLevel, displayOrder)}
                                  <span className="ml-2 text-sm font-medium text-piano-wine">
                                    {prizeLevel || `#${index + 1}`}
                                  </span>
                                </div>
                              </td>
                            )}
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div>
                                <div className="text-sm font-medium text-piano-wine">
                                  {participantName}
                                </div>
                              </div>
                            </td>
                            {selectedCategoryCombo === 'all' && (
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className="text-sm text-gray-900">{category}</div>
                              </td>
                            )}
                            <td className="px-6 py-4">
                              <div className="text-sm text-gray-900">{piece}</div>
                              <div className="text-sm text-gray-500 flex items-center">
                                <Clock className="w-3 h-3 mr-1" />
                                {duration !== 'Not specified' ? duration : '--'}
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="text-lg font-bold text-piano-wine">
                                {scoreCount > 0 ? score.toFixed(2) : '--'}
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="flex items-center text-sm text-gray-500 mb-1">
                                <Users className="w-4 h-4 mr-1" />
                                {scoreCount} jury
                              </div>
                              <div className="text-xs text-gray-500 space-y-0.5">
                                {juryScores.map((jury, idx) => (
                                  <div key={idx}>
                                    {jury.name}: {jury.score.toFixed(1)}
                                  </div>
                                ))}
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <button
                                onClick={() => viewRemarks(participantId)}
                                className="inline-flex items-center px-3 py-1 text-xs font-medium rounded-lg border border-piano-gold/30 text-piano-wine hover:bg-piano-gold/10 focus:ring-2 focus:ring-piano-gold focus:ring-offset-2 transition-colors"
                              >
                                <MessageSquare className="w-3 h-3 mr-1" />
                                Remarks
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {participantsWithScores.length === 0 && (
                  <div className="text-center py-12">
                    <Trophy className="mx-auto h-12 w-12 text-piano-wine/40" />
                    <h3 className="mt-2 text-sm font-medium text-piano-wine">No results yet</h3>
                    <p className="mt-1 text-sm text-gray-500">
                      Scores will appear here once jury members begin scoring participants.
                    </p>
                  </div>
                )}
              </div>

              {/* Prize Summary */}
              {selectedCategoryCombo !== 'all' && prizeConfigurations.length > 0 && prizeAssignments.length > 0 && (
                <div className="mt-6 bg-white rounded-xl shadow-sm border border-piano-gold/20 p-6">
                  <h3 className="text-lg font-semibold text-piano-wine mb-4">Prize Summary</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {prizeAssignments.map(assignment => (
                      <div key={assignment.prizeLevel} className="border border-piano-gold/30 rounded-lg p-4">
                        <div className="flex items-center mb-2">
                          {getPrizeIcon(assignment.prizeLevel, assignment.displayOrder)}
                          <h4 className="ml-2 font-medium text-piano-wine">{assignment.prizeLevel}</h4>
                        </div>
                        <p className="text-sm text-gray-600 mb-2">
                          {assignment.winners.length} of {assignment.maxWinners} winners
                          {assignment.winners.length > assignment.maxWinners && ' (tied)'}
                        </p>
                        {assignment.winners.length > 0 && (
                          <div className="text-xs text-gray-500">
                            Score range: {Math.min(...assignment.winners.map(w => w.averageScore)).toFixed(1)} - {Math.max(...assignment.winners.map(w => w.averageScore)).toFixed(1)}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </>
      )}

      {/* Remarks Modal */}
      {remarksModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl mx-4 max-h-[80vh] overflow-hidden">
            <div className="bg-piano-wine p-4 text-white">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">Jury Remarks</h3>
                <button
                  onClick={() => setRemarksModalOpen(false)}
                  className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center hover:bg-white/30 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            <div className="p-6 max-h-[60vh] overflow-y-auto">
              {selectedParticipantRemarks.length > 0 ? (
                <div className="space-y-4">
                  {selectedParticipantRemarks.map((remark, index) => (
                    <div key={index} className="p-4 bg-gray-50 rounded-lg border">
                      <div className="flex items-center mb-2">
                        <MessageSquare className="w-4 h-4 text-piano-wine mr-2" />
                        <h4 className="font-medium text-piano-wine">{remark.jury_name || 'Unknown Jury'}</h4>
                      </div>
                      <p className="text-gray-700 text-sm leading-relaxed">{remark.remarks}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <MessageSquare className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No Remarks</h3>
                  <p className="text-gray-500">No jury members have provided remarks for this participant yet.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}