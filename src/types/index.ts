export interface User {
  id: string;
  username: string;
  role: 'admin' | 'jury';
  name: string;
}

export interface ScoringCriteria {
  id: string;
  name: string;
  description: string;
  weight: number;
  maxScore: number;
}

export interface Category {
  id: string;
  name: string;
  description: string;
  timeSlot: string;
  isActive: boolean;
  criteria: ScoringCriteria[];
  createdAt: string;
  updatedAt: string;
}

export interface Participant {
  id: string;
  number: number;
  fullName: string;
  piece: string;
  duration: number;
  categoryId: string;
  registrationDate: string;
}

export interface Score {
  id: string;
  participantId: string;
  juryId: string;
  categoryId: string;
  scores: Record<string, number>; // criteriaId -> score
  totalScore: number;
  submittedAt: string;
  lastModified: string;
}

export interface ScoreSubmission {
  participantId: string;
  scores: Record<string, number>;
}

// New Supabase types
export interface Event {
  id: string;
  title: string;
  description?: any;
  start_date?: string;
  end_date?: string;
  registration_deadline?: string;
  location: string;
  venue_details?: string;
  terms_and_conditions?: any;
  created_at?: string;
  updated_at?: string;
  type: 'competition' | 'masterclass' | 'group_class' | 'mixed' | 'festival';
  status: 'upcoming' | 'ongoing' | 'completed';
  poster_image?: string;
  lark_base?: string;
  lark_table?: string;
  max_quota?: number;
  active: boolean;
}

export interface EventCategory {
  id: string;
  event_id?: string;
  name: string;
  description?: string;
  created_at?: string;
  repertoire?: any;
  order_index?: number;
  updated_at?: string;
}

export interface EventSubcategory {
  id: string;
  category_id?: string;
  name: string;
  repertoire?: any;
  performance_duration?: string;
  requirements?: string;
  created_at?: string;
  age_requirement: string;
  registration_fee: number;
  order_index: number;
  updated_at?: string;
  final_registration_fee?: number;
  foreign_registration_fee?: any;
  foreign_final_registration_fee?: any;
}

export interface EventJury {
  id: string;
  event_id?: string;
  name: string;
  title: string;
  description?: string;
  avatar_url?: string;
  credentials?: any;
  created_at?: string;
}

export interface Registration {
  id: string;
  event_id?: string;
  category_id?: string;
  subcategory_id?: string;
  registrant_name?: string;
  registrant_whatsapp: string;
  registrant_email: string;
  participant_name: string;
  song_title?: string;
  song_duration?: string;
  birth_certificate_url?: string;
  song_pdf_url?: string;
  bank_name: string;
  bank_account_number: string;
  bank_account_name: string;
  payment_receipt_url: string;
  created_at?: string;
  updated_at?: string;
  registrant_status?: string;
  status?: string;
  email_sent_at?: string;
  participant_age?: number;
  video_url?: string;
}

// Combined category-subcategory for selection
export interface CategorySubcategory {
  categoryId: string;
  subcategoryId: string;
  categoryName: string;
  subcategoryName: string;
  ageRequirement: string;
  displayName: string;
  eventId: string;
}

// Event Scoring types
export interface EventScoringAspect {
  id: string;
  event_id?: string;
  name: string;
  description?: string;
  weight: number;
  max_score: number;
  order_index?: number;
  created_at?: string;
  updated_at?: string;
}

export interface EventScoring {
  id: string;
  registration_id?: string;
  category_id?: string;
  subcategory_id?: string;
  jury_id: string;
  jury_name?: string;
  finalized: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface EventScoringDetail {
  id: string;
  scoring_id?: string;
  aspect_id?: string;
  score: number;
  created_at?: string;
  updated_at?: string;
}

export interface EventScoringHistory {
  id: string;
  table_name: 'event_scoring' | 'event_scoring_details';
  record_id: string;
  operation: 'INSERT' | 'UPDATE' | 'DELETE';
  before_data?: any;
  after_data?: any;
  changed_by: string;
  jury_name?: string;
  event_id?: string;
  registration_id?: string;
  participant_name?: string;
  category_id?: string;
  subcategory_id?: string;
  changed_at: string;
}

// Prize Configuration Types
export interface PrizeConfiguration {
  id: string;
  event_id: string;
  category_id: string;
  subcategory_id: string;
  prize_level: string; // '1st', '2nd', '3rd', 'Honorable Mention', etc.
  max_winners: number; // How many people can win this prize level
  min_score: number | null; // Minimum score to qualify for this prize (null means no minimum)
  max_score: number | null; // Maximum score for this prize bracket (null means no maximum)
  display_order: number; // For ordering prizes (1st=1, 2nd=2, etc.)
  active: boolean; // Whether this prize level is currently active
  created_at?: string;
  updated_at?: string;
}

// Participant with Prize Assignment
export interface ParticipantWithPrize {
  id: string;
  participant_name: string;
  averageScore: number;
  scoreCount: number;
  piece: string;
  duration: string;
  juryScores: Array<{ name: string; score: number }>;
  prizeLevel?: string; // The prize they won
  prizeDisplayOrder?: number; // For sorting by prize level
  isFinalized: boolean;
}

// Prize Assignment Result
export interface PrizeAssignment {
  prizeLevel: string;
  displayOrder: number;
  maxWinners: number;
  winners: ParticipantWithPrize[];
  scoreRange: {
    min: number;
    max: number;
  };
}