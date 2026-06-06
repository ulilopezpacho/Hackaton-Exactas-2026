export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

type TimestampColumns = {
  created_at: string;
  updated_at: string;
};

export type Database = {
  public: {
    Tables: {
      trips: {
        Row: TimestampColumns & {
          country: string;
          copied_from_trip_id: string | null;
          current_day_number: number | null;
          current_itinerary_item_id: string | null;
          destination_id: string | null;
          ends_on: string;
          id: string;
          owner_id: string;
          route_customization_prompt: string | null;
          starts_on: string;
          status: string;
          timezone: string;
          title: string;
          travel_completed_at: string | null;
          travel_started_at: string | null;
          visibility: string;
        };
        Insert: {
          country?: string;
          copied_from_trip_id?: string | null;
          created_at?: string;
          current_day_number?: number | null;
          current_itinerary_item_id?: string | null;
          destination_id?: string | null;
          ends_on: string;
          id?: string;
          owner_id: string;
          route_customization_prompt?: string | null;
          starts_on: string;
          status?: string;
          timezone?: string;
          title: string;
          travel_completed_at?: string | null;
          travel_started_at?: string | null;
          updated_at?: string;
          visibility?: string;
        };
        Update: Partial<Database["public"]["Tables"]["trips"]["Insert"]>;
        Relationships: [];
      };
      destinations: {
        Row: TimestampColumns & {
          admin_area: string | null;
          country: string | null;
          description: string | null;
          external_id: string | null;
          id: string;
          location: unknown | null;
          name: string;
          owner_id: string | null;
          source: string;
          status: string;
        };
        Insert: {
          admin_area?: string | null;
          country?: string | null;
          created_at?: string;
          description?: string | null;
          external_id?: string | null;
          id?: string;
          location?: unknown | null;
          name: string;
          owner_id?: string | null;
          source?: string;
          status?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["destinations"]["Insert"]>;
        Relationships: [];
      };
      itineraries: {
        Row: TimestampColumns & {
          day_number: number;
          generated_from_itinerary_id: string | null;
          generation_prompt: string | null;
          id: string;
          itinerary_type: string | null;
          status: string;
          title: string;
          trip_id: string;
        };
        Insert: {
          created_at?: string;
          day_number?: number;
          generated_from_itinerary_id?: string | null;
          generation_prompt?: string | null;
          id?: string;
          itinerary_type?: string | null;
          status?: string;
          title?: string;
          trip_id: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["itineraries"]["Insert"]>;
        Relationships: [];
      };
      itinerary_items: {
        Row: TimestampColumns & {
          description: string | null;
          ends_at: string;
          id: string;
          itinerary_id: string;
          item_type: string;
          locked: boolean;
          place_id: string | null;
          position: number;
          starts_at: string;
          title: string;
        };
        Insert: {
          created_at?: string;
          description?: string | null;
          ends_at: string;
          id?: string;
          itinerary_id: string;
          item_type: string;
          locked?: boolean;
          place_id?: string | null;
          position: number;
          starts_at: string;
          title: string;
          updated_at?: string;
        };
        Update: Partial<
          Database["public"]["Tables"]["itinerary_items"]["Insert"]
        >;
        Relationships: [];
      };
      places: {
        Row: TimestampColumns & {
          address: string | null;
          category: string | null;
          default_duration_minutes: number | null;
          description: string | null;
          destination_id: string | null;
          external_id: string | null;
          id: string;
          location: unknown | null;
          name: string;
          owner_id: string | null;
          popularity: number | null;
          primary_type: string | null;
          quality_score: number | null;
          rating: number | null;
          source: string;
          status: string;
          summary: string | null;
          types: string[] | null;
          user_ratings_total: number | null;
        };
        Insert: {
          address?: string | null;
          category?: string | null;
          created_at?: string;
          default_duration_minutes?: number | null;
          description?: string | null;
          destination_id?: string | null;
          external_id?: string | null;
          id?: string;
          location?: unknown | null;
          name: string;
          owner_id?: string | null;
          popularity?: number | null;
          primary_type?: string | null;
          quality_score?: number | null;
          rating?: number | null;
          source?: string;
          status?: string;
          summary?: string | null;
          types?: string[] | null;
          updated_at?: string;
          user_ratings_total?: number | null;
        };
        Update: Partial<Database["public"]["Tables"]["places"]["Insert"]>;
        Relationships: [];
      };
      user_preferences: {
        Row: TimestampColumns & {
          budget: "under_50" | "50_100" | "100_200" | "over_200" | null;
          interests: string[];
          onboarding_completed_at: string | null;
          onboarding_step:
            | "interests"
            | "pace"
            | "prompt"
            | "budget"
            | "complete";
          pace: "relaxed" | "balanced" | "intense" | null;
          travel_style_prompt: string | null;
          user_id: string;
        };
        Insert: {
          budget?: "under_50" | "50_100" | "100_200" | "over_200" | null;
          created_at?: string;
          interests?: string[];
          onboarding_completed_at?: string | null;
          onboarding_step?:
            | "interests"
            | "pace"
            | "prompt"
            | "budget"
            | "complete";
          pace?: "relaxed" | "balanced" | "intense" | null;
          travel_style_prompt?: string | null;
          updated_at?: string;
          user_id: string;
        };
        Update: Partial<
          Database["public"]["Tables"]["user_preferences"]["Insert"]
        >;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      get_trip_place_coordinates: {
        Args: { target_trip_id: string };
        Returns: {
          itinerary_item_id: string;
          latitude: number;
          longitude: number;
          place_id: string;
        }[];
      };
      start_trip_travel: {
        Args: {
          target_item_id: string;
          target_trip_id: string;
        };
        Returns: string;
      };
      advance_trip_travel: {
        Args: {
          target_trip_id: string;
        };
        Returns: {
          current_day_number: number | null;
          current_itinerary_item_id: string | null;
          status: string;
          trip_id: string;
        }[];
      };
      apply_trip_replan: {
        Args: {
          operations?: Json;
          strategy: string;
          target_trip_id: string;
        };
        Returns: string;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
