export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      auto_replies: {
        Row: {
          account_id: string | null
          created_at: string
          id: string
          is_active: boolean | null
          reply_message: string
          trigger_keyword: string | null
          trigger_type: string
          updated_at: string
        }
        Insert: {
          account_id?: string | null
          created_at?: string
          id?: string
          is_active?: boolean | null
          reply_message: string
          trigger_keyword?: string | null
          trigger_type: string
          updated_at?: string
        }
        Update: {
          account_id?: string | null
          created_at?: string
          id?: string
          is_active?: boolean | null
          reply_message?: string
          trigger_keyword?: string | null
          trigger_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "auto_replies_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "wa_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      contacts: {
        Row: {
          account_id: string | null
          created_at: string
          id: string
          is_window_open: boolean | null
          last_message_at: string | null
          name: string | null
          phone_number: string
          profile_pic_url: string | null
          unread_count: number | null
          updated_at: string
          window_expires_at: string | null
        }
        Insert: {
          account_id?: string | null
          created_at?: string
          id?: string
          is_window_open?: boolean | null
          last_message_at?: string | null
          name?: string | null
          phone_number: string
          profile_pic_url?: string | null
          unread_count?: number | null
          updated_at?: string
          window_expires_at?: string | null
        }
        Update: {
          account_id?: string | null
          created_at?: string
          id?: string
          is_window_open?: boolean | null
          last_message_at?: string | null
          name?: string | null
          phone_number?: string
          profile_pic_url?: string | null
          unread_count?: number | null
          updated_at?: string
          window_expires_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contacts_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "wa_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          account_id: string | null
          contact_id: string
          content: string | null
          created_at: string
          direction: string
          id: string
          media_filename: string | null
          media_mime_type: string | null
          media_url: string | null
          message_type: string
          status: string | null
          template_data: Json | null
          template_name: string | null
          timestamp: string
          wa_message_id: string | null
        }
        Insert: {
          account_id?: string | null
          contact_id: string
          content?: string | null
          created_at?: string
          direction: string
          id?: string
          media_filename?: string | null
          media_mime_type?: string | null
          media_url?: string | null
          message_type?: string
          status?: string | null
          template_data?: Json | null
          template_name?: string | null
          timestamp?: string
          wa_message_id?: string | null
        }
        Update: {
          account_id?: string | null
          contact_id?: string
          content?: string | null
          created_at?: string
          direction?: string
          id?: string
          media_filename?: string | null
          media_mime_type?: string | null
          media_url?: string | null
          message_type?: string
          status?: string | null
          template_data?: Json | null
          template_name?: string | null
          timestamp?: string
          wa_message_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "messages_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "wa_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          email: string | null
          id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          email?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          email?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      wa_accounts: {
        Row: {
          access_token: string | null
          away_enabled: boolean | null
          away_message: string | null
          business_name: string
          created_at: string
          display_phone: string | null
          id: string
          is_active: boolean | null
          phone_number_id: string | null
          updated_at: string
          user_id: string
          verify_token: string
          welcome_enabled: boolean | null
          welcome_image_url: string | null
          welcome_message: string | null
        }
        Insert: {
          access_token?: string | null
          away_enabled?: boolean | null
          away_message?: string | null
          business_name?: string
          created_at?: string
          display_phone?: string | null
          id?: string
          is_active?: boolean | null
          phone_number_id?: string | null
          updated_at?: string
          user_id: string
          verify_token?: string
          welcome_enabled?: boolean | null
          welcome_image_url?: string | null
          welcome_message?: string | null
        }
        Update: {
          access_token?: string | null
          away_enabled?: boolean | null
          away_message?: string | null
          business_name?: string
          created_at?: string
          display_phone?: string | null
          id?: string
          is_active?: boolean | null
          phone_number_id?: string | null
          updated_at?: string
          user_id?: string
          verify_token?: string
          welcome_enabled?: boolean | null
          welcome_image_url?: string | null
          welcome_message?: string | null
        }
        Relationships: []
      }
      whatsapp_settings: {
        Row: {
          account_id: string | null
          created_at: string
          id: string
          setting_key: string
          setting_value: string | null
          updated_at: string
        }
        Insert: {
          account_id?: string | null
          created_at?: string
          id?: string
          setting_key: string
          setting_value?: string | null
          updated_at?: string
        }
        Update: {
          account_id?: string | null
          created_at?: string
          id?: string
          setting_key?: string
          setting_value?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_settings_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "wa_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_templates: {
        Row: {
          account_id: string | null
          category: string | null
          components: Json | null
          created_at: string
          id: string
          language: string
          name: string
          status: string | null
        }
        Insert: {
          account_id?: string | null
          category?: string | null
          components?: Json | null
          created_at?: string
          id?: string
          language?: string
          name: string
          status?: string | null
        }
        Update: {
          account_id?: string | null
          category?: string | null
          components?: Json | null
          created_at?: string
          id?: string
          language?: string
          name?: string
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_templates_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "wa_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "user"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "user"],
    },
  },
} as const
