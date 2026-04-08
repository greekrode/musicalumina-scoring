import { createClient } from '@supabase/supabase-js';

// These should be replaced with your actual Supabase project credentials
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
});

// Database types
export type Database = {
  public: {
    Tables: {
      events: {
        Row: {
          id: string;
          title: string;
          description?: string | null;
          start_date?: string;
          end_date?: string;
          registration_deadline?: string;
          location: string;
          venue_details?: string;
          terms_and_conditions?: string | null;
          created_at?: string;
          updated_at?: string;
          type: 'competition' | 'masterclass' | 'group_class' | 'mixed';
          status: 'upcoming' | 'ongoing' | 'completed';
          poster_image?: string;
          lark_base?: string;
          lark_table?: string;
          max_quota?: number;
          active: boolean;
        };
        Insert: Omit<Database['public']['Tables']['events']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['events']['Insert']>;
      };
      event_categories: {
        Row: {
          id: string;
          event_id?: string;
          name: string;
          description?: string;
          created_at?: string;
          repertoire?: string | null;
          order_index?: number;
          updated_at?: string;
        };
      };
      event_subcategories: {
        Row: {
          id: string;
          category_id?: string;
          name: string;
          repertoire?: string | null;
          performance_duration?: string;
          requirements?: string;
          created_at?: string;
          age_requirement: string;
          registration_fee: number;
          order_index: number;
          updated_at?: string;
          final_registration_fee?: number;
          foreign_registration_fee?: number | null;
          foreign_final_registration_fee?: number | null;
        };
      };
      event_jury: {
        Row: {
          id: string;
          event_id?: string;
          name: string;
          title: string;
          description?: string;
          avatar_url?: string;
          credentials?: string | null;
          created_at?: string;
        };
      };
    };
  };
}; 