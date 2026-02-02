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
          created_at?: string;
        };
        Relationships: [];
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
        Relationships: [];
      };
    };
    Views: {};
    Functions: {};
    Enums: {};
    CompositeTypes: {};
  };
};

export type Profile = Database['public']['Tables']['profiles']['Row'];
export type Event = Database['public']['Tables']['events']['Row'];
export type Participant = Database['public']['Tables']['participants']['Row'];
