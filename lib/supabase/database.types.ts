export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      user_preferences: {
        Row: {
          budget: "under_50" | "50_100" | "100_200" | "over_200" | null;
          created_at: string;
          interests: string[];
          onboarding_completed_at: string | null;
          onboarding_step: "interests" | "pace" | "prompt" | "budget" | "complete";
          pace: "relaxed" | "balanced" | "intense" | null;
          travel_style_prompt: string | null;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          budget?: "under_50" | "50_100" | "100_200" | "over_200" | null;
          created_at?: string;
          interests?: string[];
          onboarding_completed_at?: string | null;
          onboarding_step?: "interests" | "pace" | "prompt" | "budget" | "complete";
          pace?: "relaxed" | "balanced" | "intense" | null;
          travel_style_prompt?: string | null;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          budget?: "under_50" | "50_100" | "100_200" | "over_200" | null;
          created_at?: string;
          interests?: string[];
          onboarding_completed_at?: string | null;
          onboarding_step?: "interests" | "pace" | "prompt" | "budget" | "complete";
          pace?: "relaxed" | "balanced" | "intense" | null;
          travel_style_prompt?: string | null;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
