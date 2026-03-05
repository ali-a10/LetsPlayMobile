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
    };
    Enums: {};
    CompositeTypes: {};
  };
};

export type Profile = Database['public']['Tables']['profiles']['Row'];
export type Event = Database['public']['Tables']['events']['Row'];
export type Participant = Database['public']['Tables']['participants']['Row'];
