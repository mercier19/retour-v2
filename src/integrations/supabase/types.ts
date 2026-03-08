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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      archived_parcels: {
        Row: {
          archived_at: string
          boutique: string | null
          box_name: string | null
          commune: string | null
          created_at: string | null
          id: string
          is_multi_part: boolean
          part_number: number
          phone: string | null
          status: string | null
          total_parts: number
          tracking: string
          warehouse_id: string
          wilaya: string | null
        }
        Insert: {
          archived_at?: string
          boutique?: string | null
          box_name?: string | null
          commune?: string | null
          created_at?: string | null
          id?: string
          is_multi_part?: boolean
          part_number?: number
          phone?: string | null
          status?: string | null
          total_parts?: number
          tracking: string
          warehouse_id: string
          wilaya?: string | null
        }
        Update: {
          archived_at?: string
          boutique?: string | null
          box_name?: string | null
          commune?: string | null
          created_at?: string | null
          id?: string
          is_multi_part?: boolean
          part_number?: number
          phone?: string | null
          status?: string | null
          total_parts?: number
          tracking?: string
          warehouse_id?: string
          wilaya?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "archived_parcels_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      boxes: {
        Row: {
          created_at: string
          id: string
          name: string
          quota: number | null
          warehouse_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          quota?: number | null
          warehouse_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          quota?: number | null
          warehouse_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "boxes_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      parcel_status_log: {
        Row: {
          changed_by: string | null
          created_at: string
          id: string
          parcel_id: string
          status: string
          warehouse_id: string | null
        }
        Insert: {
          changed_by?: string | null
          created_at?: string
          id?: string
          parcel_id: string
          status: string
          warehouse_id?: string | null
        }
        Update: {
          changed_by?: string | null
          created_at?: string
          id?: string
          parcel_id?: string
          status?: string
          warehouse_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "parcel_status_log_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "parcel_status_log_parcel_id_fkey"
            columns: ["parcel_id"]
            isOneToOne: false
            referencedRelation: "parcels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "parcel_status_log_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      parcels: {
        Row: {
          added_by: string | null
          boutique: string | null
          box_id: string | null
          commune: string | null
          created_at: string
          destination_warehouse_id: string | null
          given_at: string | null
          id: string
          is_missing: boolean | null
          is_multi_part: boolean
          misrouted_at_warehouse_id: string | null
          part_number: number
          phone: string | null
          status: string | null
          total_parts: number
          tracking: string
          transfer_completed_at: string | null
          transfer_initiated_at: string | null
          transfer_status: string | null
          updated_at: string
          warehouse_id: string
          wilaya: string | null
        }
        Insert: {
          added_by?: string | null
          boutique?: string | null
          box_id?: string | null
          commune?: string | null
          created_at?: string
          destination_warehouse_id?: string | null
          given_at?: string | null
          id?: string
          is_missing?: boolean | null
          is_multi_part?: boolean
          misrouted_at_warehouse_id?: string | null
          part_number?: number
          phone?: string | null
          status?: string | null
          total_parts?: number
          tracking: string
          transfer_completed_at?: string | null
          transfer_initiated_at?: string | null
          transfer_status?: string | null
          updated_at?: string
          warehouse_id: string
          wilaya?: string | null
        }
        Update: {
          added_by?: string | null
          boutique?: string | null
          box_id?: string | null
          commune?: string | null
          created_at?: string
          destination_warehouse_id?: string | null
          given_at?: string | null
          id?: string
          is_missing?: boolean | null
          is_multi_part?: boolean
          misrouted_at_warehouse_id?: string | null
          part_number?: number
          phone?: string | null
          status?: string | null
          total_parts?: number
          tracking?: string
          transfer_completed_at?: string | null
          transfer_initiated_at?: string | null
          transfer_status?: string | null
          updated_at?: string
          warehouse_id?: string
          wilaya?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "parcels_added_by_fkey"
            columns: ["added_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "parcels_box_id_fkey"
            columns: ["box_id"]
            isOneToOne: false
            referencedRelation: "boxes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "parcels_destination_warehouse_id_fkey"
            columns: ["destination_warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "parcels_misrouted_at_warehouse_id_fkey"
            columns: ["misrouted_at_warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "parcels_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
        }
        Relationships: []
      }
      transfer_history: {
        Row: {
          completed_at: string | null
          from_warehouse_id: string
          id: string
          initiated_at: string
          initiated_by: string | null
          misrouted_at_warehouse_id: string | null
          parcel_id: string
          status: string
          to_warehouse_id: string
        }
        Insert: {
          completed_at?: string | null
          from_warehouse_id: string
          id?: string
          initiated_at?: string
          initiated_by?: string | null
          misrouted_at_warehouse_id?: string | null
          parcel_id: string
          status?: string
          to_warehouse_id: string
        }
        Update: {
          completed_at?: string | null
          from_warehouse_id?: string
          id?: string
          initiated_at?: string
          initiated_by?: string | null
          misrouted_at_warehouse_id?: string | null
          parcel_id?: string
          status?: string
          to_warehouse_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "transfer_history_from_warehouse_id_fkey"
            columns: ["from_warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transfer_history_initiated_by_fkey"
            columns: ["initiated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transfer_history_misrouted_at_warehouse_id_fkey"
            columns: ["misrouted_at_warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transfer_history_parcel_id_fkey"
            columns: ["parcel_id"]
            isOneToOne: false
            referencedRelation: "parcels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transfer_history_to_warehouse_id_fkey"
            columns: ["to_warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      user_warehouses: {
        Row: {
          user_id: string
          warehouse_id: string
        }
        Insert: {
          user_id: string
          warehouse_id: string
        }
        Update: {
          user_id?: string
          warehouse_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_warehouses_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_warehouses_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      warehouses: {
        Row: {
          code: string
          created_at: string
          id: string
          name: string
          type: string
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          name: string
          type?: string
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          name?: string
          type?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_incoming_transfer: {
        Args: { p_destination_warehouse_id: string; p_tracking: string }
        Returns: {
          boutique: string
          commune: string
          destination_warehouse_id: string
          id: string
          is_multi_part: boolean
          part_number: number
          phone: string
          total_parts: number
          tracking: string
          transfer_status: string
          warehouse_id: string
          wilaya: string
        }[]
      }
      is_parcel_given: {
        Args: { p_tracking: string; p_warehouse_id: string }
        Returns: boolean
      }
      is_super_admin: { Args: never; Returns: boolean }
      receive_incoming_transfer: {
        Args: {
          p_box_id: string
          p_new_warehouse_id: string
          p_parcel_id: string
        }
        Returns: undefined
      }
      search_parcels_global: {
        Args: { p_search: string }
        Returns: {
          boutique: string
          box_name: string
          destination_warehouse_name: string
          id: string
          is_missing: boolean
          is_multi_part: boolean
          part_number: number
          status: string
          total_parts: number
          tracking: string
          transfer_status: string
          warehouse_name: string
        }[]
      }
      setup_super_admin: { Args: { _user_id: string }; Returns: undefined }
      user_role: {
        Args: never
        Returns: Database["public"]["Enums"]["app_role"]
      }
      user_warehouse_ids: { Args: never; Returns: string[] }
    }
    Enums: {
      app_role: "operations" | "chef_agence" | "regional" | "super_admin"
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
      app_role: ["operations", "chef_agence", "regional", "super_admin"],
    },
  },
} as const
