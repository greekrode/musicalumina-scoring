import { useCallback, useState } from 'react';
import { supabase } from '../lib/supabase';
import { ParticipantWithPrize, PrizeConfiguration } from '../types';
import { CategorySubcategory } from '../types/index';
import { ParticipantWithScores } from '../types/results';

interface ExportResultsParams {
  events: Array<{ id: string; title: string }>;
  selectedEventId: string;
  categories: CategorySubcategory[];
  categoryId: string;
  subcategoryId: string;
  prizeConfigurations: PrizeConfiguration[];
  assignedParticipants: ParticipantWithPrize[];
  participantsWithScores: ParticipantWithScores[];
}

export function useResultsExport() {
  const [exporting, setExporting] = useState(false);

  const exportResults = useCallback(
    async ({
      events,
      selectedEventId,
      categories,
      categoryId,
      subcategoryId,
      prizeConfigurations,
      assignedParticipants,
      participantsWithScores,
    }: ExportResultsParams) => {
      if (!categoryId || !subcategoryId) {
        throw new Error('Please select a category before exporting.');
      }

      setExporting(true);
      try {
        const selectedCategory = categories.find(
          (category) =>
            category.categoryId === categoryId &&
            category.subcategoryId === subcategoryId
        );
        const categoryName = selectedCategory?.displayName || 'Unknown Category';
        const eventTitle =
          events.find((event) => event.id === selectedEventId)?.title || 'Event';
        const sanitizedEventTitle = eventTitle.replace(/[^a-zA-Z0-9]/g, '_');
        const sanitizedCategoryName = categoryName.replace(/[^a-zA-Z0-9]/g, '_');
        const timestamp = new Date().toISOString().split('T')[0];

        const participantsToExport =
          prizeConfigurations.length > 0
            ? assignedParticipants
            : participantsWithScores.map((participant) => ({
                id: participant.id,
                participant_name: participant.fullName,
                averageScore: participant.averageScore,
                scoreCount: participant.scoreCount,
                piece: participant.piece,
                duration: participant.duration,
                juryScores: participant.juryScores,
                isFinalized: participant.isFinalized,
              }));

        const dataToExport: Array<Record<string, string | number>> = [];

        for (let index = 0; index < participantsToExport.length; index++) {
          const participant = participantsToExport[index];
          const isAssigned = 'participant_name' in participant;
          const participantName = isAssigned
            ? participant.participant_name
            : (participant as ParticipantWithScores).fullName;
          const participantId = participant.id;
          const score = participant.averageScore;
          const scoreCount = participant.scoreCount;
          const prizeLevel = isAssigned ? participant.prizeLevel : undefined;

          const { data: remarksData, error: remarksError } = await supabase
            .from('event_scoring')
            .select('jury_name, remarks')
            .eq('registration_id', participantId)
            .not('remarks', 'is', null)
            .not('remarks', 'eq', '');

          if (remarksError) {
            console.error('Error fetching remarks for export:', remarksError);
          }

          const remarksObject: Record<string, string> = {};
          remarksData?.forEach((remark) => {
            if (remark.jury_name && remark.remarks) {
              remarksObject[remark.jury_name] = remark.remarks;
            }
          });

          const allRemarks =
            Object.keys(remarksObject).length > 0
              ? JSON.stringify(remarksObject)
              : '';

          dataToExport.push({
            Rank: prizeLevel || `#${index + 1}`,
            'Participant ID': participantId,
            'Participant Name': participantName,
            'Final Score': scoreCount > 0 ? score.toFixed(2) : 'No Score',
            'Jury Count': scoreCount,
            Remarks: allRemarks,
          });
        }

        if (!dataToExport.length) {
          throw new Error('No results available to export.');
        }

        const headers = Object.keys(dataToExport[0]);
        const csvContent = [
          headers.join(','),
          ...dataToExport.map((row) =>
            headers
              .map((header) => {
                const value = row[header];
                if (
                  typeof value === 'string' &&
                  (value.includes(',') ||
                    value.includes('"') ||
                    value.includes('\n'))
                ) {
                  return `"${value.replace(/"/g, '""')}"`;
                }
                return value;
              })
              .join(',')
          ),
        ].join('\n');

        const blob = new Blob([csvContent], {
          type: 'text/csv;charset=utf-8;',
        });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute(
          'download',
          `${sanitizedEventTitle}_${sanitizedCategoryName}_Results_${timestamp}.csv`
        );
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        return true;
      } finally {
        setExporting(false);
      }
    },
    []
  );

  return { exportResults, exporting };
}
