import { supabase } from './supabase';
import { EventScoringHistory } from '../types';

export interface LogHistoryParams {
  tableName: 'event_scoring' | 'event_scoring_details';
  recordId: string;
  operation: 'INSERT' | 'UPDATE' | 'DELETE';
  beforeData?: any;
  afterData?: any;
  changedBy: string;
  juryName?: string;
  eventId?: string;
  registrationId?: string;
  participantName?: string;
}

export async function logScoringHistory(params: LogHistoryParams): Promise<void> {
  try {
          // Extract category info from the data if it's a scoring record
      let categoryId = null;
      let subcategoryId = null;
      
      if (params.tableName === 'event_scoring' && params.afterData) {
        categoryId = params.afterData.category_id;
        subcategoryId = params.afterData.subcategory_id;
      }

      const { error } = await supabase
        .from('event_scoring_history')
        .insert({
          table_name: params.tableName,
          record_id: params.recordId,
          operation: params.operation,
          before_data: params.beforeData,
          after_data: params.afterData,
          changed_by: params.changedBy,
          jury_name: params.juryName,
          event_id: params.eventId,
          registration_id: params.registrationId,
          participant_name: params.participantName,
          category_id: categoryId,
          subcategory_id: subcategoryId,
        });

    if (error) {
      console.error('Failed to log scoring history:', error);
    }
  } catch (err) {
    console.error('Error logging scoring history:', err);
  }
}

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