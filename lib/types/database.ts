export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          first_name: string;
          last_name: string;
          email: string;
          phone: string;
          date_of_birth: string;
          gender: string;
          favourite_sports: string[] | null;
          about_me: string | null;
          avatar_url: string | null;
          created_at: string;
          stripe_account_id: string | null;
          stripe_onboarding_complete: boolean;
          stripe_payouts_enabled: boolean;
          stripe_customer_id: string | null;
        };
        Insert: {
          id: string;
          first_name: string;
          last_name: string;
          email: string;
          phone: string;
          date_of_birth: string;
          gender: string;
          favourite_sports?: string[] | null;
          about_me?: string | null;
          avatar_url?: string | null;
          created_at?: string;
          stripe_account_id?: string | null;
          stripe_onboarding_complete?: boolean;
          stripe_payouts_enabled?: boolean;
          stripe_customer_id?: string | null;
        };
        Update: {
          id?: string;
          first_name?: string;
          last_name?: string;
          email?: string;
          phone?: string;
          date_of_birth?: string;
          gender?: string;
          favourite_sports?: string[] | null;
          about_me?: string | null;
          avatar_url?: string | null;
          created_at?: string;
          stripe_account_id?: string | null;
          stripe_onboarding_complete?: boolean;
          stripe_payouts_enabled?: boolean;
          stripe_customer_id?: string | null;
        };
        Relationships: [];
      };
      events: {
        Row: {
          id: string;
          host_id: string;
          title: string;
          sport: string;
          date: string;
          location: string;
          latitude: number | null;
          longitude: number | null;
          description: string | null;
          max_participants: number;
          is_paid: boolean;
          price: number | null;
          current_participants: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          host_id: string;
          title: string;
          sport: string;
          date: string;
          location: string;
          latitude?: number | null;
          longitude?: number | null;
          description?: string | null;
          max_participants?: number;
          is_paid?: boolean;
          price?: number | null;
          current_participants?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          host_id?: string;
          title?: string;
          sport?: string;
          date?: string;
          location?: string;
          latitude?: number | null;
          longitude?: number | null;
          description?: string | null;
          max_participants?: number;
          is_paid?: boolean;
          price?: number | null;
          current_participants?: number;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'events_host_id_fkey';
            columns: ['host_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      participants: {
        Row: {
          event_id: string;
          user_id: string;
          joined_at: string;
        };
        Insert: {
          event_id: string;
          user_id: string;
          joined_at?: string;
        };
        Update: {
          event_id?: string;
          user_id?: string;
          joined_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'participants_event_id_fkey';
            columns: ['event_id'];
            isOneToOne: false;
            referencedRelation: 'events';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'participants_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      blocks: {
        Row: {
          blocker_id: string;
          blocked_id: string;
          created_at: string;
        };
        Insert: {
          blocker_id: string;
          blocked_id: string;
          created_at?: string;
        };
        Update: {
          blocker_id?: string;
          blocked_id?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'blocks_blocker_id_fkey';
            columns: ['blocker_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'blocks_blocked_id_fkey';
            columns: ['blocked_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      reports: {
        Row: {
          id: string;
          reporter_id: string;
          reported_id: string;
          reason: ReportReason;
          details: string | null;
          status: ReportStatus;
          created_at: string;
        };
        Insert: {
          id?: string;
          reporter_id: string;
          reported_id: string;
          reason: ReportReason;
          details?: string | null;
          status?: ReportStatus;
          created_at?: string;
        };
        Update: {
          id?: string;
          reporter_id?: string;
          reported_id?: string;
          reason?: ReportReason;
          details?: string | null;
          status?: ReportStatus;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'reports_reporter_id_fkey';
            columns: ['reporter_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'reports_reported_id_fkey';
            columns: ['reported_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      feedback: {
        Row: {
          id: string;
          user_id: string | null;
          category: FeedbackCategory;
          message: string;
          status: FeedbackStatus;
          app_version: string | null;
          platform: 'ios' | 'android' | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string | null;
          category: FeedbackCategory;
          message: string;
          status?: FeedbackStatus;
          app_version?: string | null;
          platform?: 'ios' | 'android' | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string | null;
          category?: FeedbackCategory;
          message?: string;
          status?: FeedbackStatus;
          app_version?: string | null;
          platform?: 'ios' | 'android' | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'feedback_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
    };
    Views: {};
    Functions: {
      join_event: {
        Args: { p_event_id: string };
        Returns: undefined;
      };
      leave_event: {
        Args: { p_event_id: string };
        Returns: undefined;
      };
      block_user: {
        Args: { p_blocked_id: string };
        Returns: undefined;
      };
    };
    Enums: {
      report_reason: ReportReason;
      report_status: ReportStatus;
      feedback_category: FeedbackCategory;
      feedback_status: FeedbackStatus;
    };
    CompositeTypes: {};
  };
};

export type ReportReason =
  | 'harassment'
  | 'inappropriate'
  | 'fake_profile'
  | 'spam'
  | 'host_no_show'
  | 'other';

export type ReportStatus = 'open' | 'reviewing' | 'resolved' | 'dismissed';

export type FeedbackCategory = 'bug' | 'suggestion' | 'other';

export type FeedbackStatus = 'new' | 'triaged' | 'resolved' | 'wontfix';

export type Profile = Database['public']['Tables']['profiles']['Row'];
export type Event = Database['public']['Tables']['events']['Row'];
export type Participant = Database['public']['Tables']['participants']['Row'];
export type Block = Database['public']['Tables']['blocks']['Row'];
export type Report = Database['public']['Tables']['reports']['Row'];
export type Feedback = Database['public']['Tables']['feedback']['Row'];
