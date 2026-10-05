import { supabase } from './supabase';
import { EventScoringHistory } from '../types';

// Jury history rows are written server-side by submit_jury_score.
export async function getScoringHistory(filters?: {
  eventId?: string;
  registrationId?: string;
  changedBy?: string;
  limit?: number;
}): Promise<EventScoringHistory[]> {
  try {
    let query = supabase
      .from('event_scoring_history')
      .select('*')
      .order('changed_at', { ascending: false });

    if (filters?.eventId) {
      query = query.eq('event_id', filters.eventId);
    }
    if (filters?.registrationId) {
      query = query.eq('registration_id', filters.registrationId);
    }
    if (filters?.changedBy) {
      query = query.eq('changed_by', filters.changedBy);
    }
    if (filters?.limit) {
      query = query.limit(filters.limit);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Failed to fetch scoring history:', error);
      return [];
    }

    return data || [];
  } catch (err) {
    console.error('Error fetching scoring history:', err);
    return [];
  }
}

export function formatHistoryEntry(entry: EventScoringHistory): {
  title: string;
  description: string;
  changes: Array<{ field: string; before: any; after: any }>;
} {
  const operation = entry.operation.toLowerCase();
  const participant = entry.participant_name || 'Unknown Participant';
  const jury = entry.jury_name || 'Unknown Jury';
  
  let title = '';
  let description = '';
  const changes: Array<{ field: string; before: any; after: any }> = [];

  if (entry.table_name === 'event_scoring') {
    const meaningfulFields = ['final_score', 'remarks'];
    
    if (entry.operation === 'INSERT') {
      title = `New Score Submitted`;
      description = `${jury} submitted a score for ${participant}`;
      
      if (entry.after_data) {
        meaningfulFields.forEach(field => {
          if (entry.after_data[field] !== null && entry.after_data[field] !== undefined) {
            changes.push({
              field,
              before: null,
              after: entry.after_data[field]
            });
          }
        });
      }
    } else if (entry.operation === 'UPDATE') {
      title = `Score Updated`;
      description = `${jury} updated the score for ${participant}`;
      
      if (entry.before_data && entry.after_data) {
        meaningfulFields.forEach(field => {
          if (entry.before_data[field] !== entry.after_data[field]) {
            changes.push({
              field,
              before: entry.before_data[field],
              after: entry.after_data[field]
            });
          }
        });
      }
    }
  } else if (entry.table_name === 'event_scoring_details') {
    if (entry.operation === 'INSERT') {
      title = `Aspect Score Added`;
      description = `${jury} added an aspect score for ${participant}`;
    } else if (entry.operation === 'UPDATE') {
      title = `Aspect Score Updated`;
      description = `${jury} updated an aspect score for ${participant}`;
    }
    
    if (entry.before_data && entry.after_data) {
      if (entry.before_data.score !== entry.after_data.score) {
        changes.push({
          field: 'score',
          before: entry.before_data.score,
          after: entry.after_data.score
        });
      }
    } else if (entry.after_data && entry.operation === 'INSERT') {
      changes.push({
        field: 'score',
        before: null,
        after: entry.after_data.score
      });
    }
  }

  return { title, description, changes };
} 