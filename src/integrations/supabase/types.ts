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
    PostgrestVersion: "13.0.4"
  }
  public: {
    Tables: {
      menu_categories: {
        Row: {
          created_at: string
          description: string | null
          display_order: number | null
          id: string
          name: string
          restaurant_id: string
          status: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          display_order?: number | null
          id?: string
          name: string
          restaurant_id: string
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string
          description?: string | null
          display_order?: number | null
          id?: string
          name?: string
          restaurant_id?: string
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_menu_categories_restaurant_id"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "public_restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_menu_categories_restaurant_id"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      menu_items: {
        Row: {
          category_id: string | null
          created_at: string
          description: string | null
          id: string
          image_url: string | null
          is_available: boolean | null
          name: string
          options: Json | null
          price_khr: number | null
          price_usd: number | null
          restaurant_id: string
          size_enabled: boolean
          sizes: Json | null
          updated_at: string
        }
        Insert: {
          category_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          is_available?: boolean | null
          name: string
          options?: Json | null
          price_khr?: number | null
          price_usd?: number | null
          restaurant_id: string
          size_enabled?: boolean
          sizes?: Json | null
          updated_at?: string
        }
        Update: {
          category_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          is_available?: boolean | null
          name?: string
          options?: Json | null
          price_khr?: number | null
          price_usd?: number | null
          restaurant_id?: string
          size_enabled?: boolean
          sizes?: Json | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_menu_items_category_id"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "menu_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_menu_items_restaurant_id"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "public_restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_menu_items_restaurant_id"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      order_items: {
        Row: {
          created_at: string
          id: string
          menu_item_id: string
          notes: string | null
          order_id: string
          price_khr: number | null
          price_usd: number | null
          quantity: number
        }
        Insert: {
          created_at?: string
          id?: string
          menu_item_id: string
          notes?: string | null
          order_id: string
          price_khr?: number | null
          price_usd?: number | null
          quantity?: number
        }
        Update: {
          created_at?: string
          id?: string
          menu_item_id?: string
          notes?: string | null
          order_id?: string
          price_khr?: number | null
          price_usd?: number | null
          quantity?: number
        }
        Relationships: [
          {
            foreignKeyName: "fk_order_items_menu_item_id"
            columns: ["menu_item_id"]
            isOneToOne: false
            referencedRelation: "menu_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_order_items_order_id"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          created_at: string
          customer_notes: string | null
          id: string
          order_token: string | null
          restaurant_id: string
          status: string | null
          table_id: string | null
          table_number: string
          table_session_id: string | null
          total_khr: number | null
          total_usd: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          customer_notes?: string | null
          id?: string
          order_token?: string | null
          restaurant_id: string
          status?: string | null
          table_id?: string | null
          table_number: string
          table_session_id?: string | null
          total_khr?: number | null
          total_usd?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          customer_notes?: string | null
          id?: string
          order_token?: string | null
          restaurant_id?: string
          status?: string | null
          table_id?: string | null
          table_number?: string
          table_session_id?: string | null
          total_khr?: number | null
          total_usd?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_orders_restaurant_id"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "public_restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_orders_restaurant_id"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_orders_table_id"
            columns: ["table_id"]
            isOneToOne: false
            referencedRelation: "tables"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_table_session_id_fkey"
            columns: ["table_session_id"]
            isOneToOne: false
            referencedRelation: "table_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      permission_conditions: {
        Row: {
          condition_json: Json
          created_at: string
          id: string
          owner_id: string
          owner_type: string
          permission_id: string
          updated_at: string
        }
        Insert: {
          condition_json: Json
          created_at?: string
          id?: string
          owner_id: string
          owner_type: string
          permission_id: string
          updated_at?: string
        }
        Update: {
          condition_json?: Json
          created_at?: string
          id?: string
          owner_id?: string
          owner_type?: string
          permission_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "permission_conditions_permission_id_fkey"
            columns: ["permission_id"]
            isOneToOne: false
            referencedRelation: "permissions"
            referencedColumns: ["id"]
          },
        ]
      }
      permissions: {
        Row: {
          action: string
          created_at: string
          description: string | null
          id: string
          key: string
          name: string
          resource: string
          scope: string | null
        }
        Insert: {
          action: string
          created_at?: string
          description?: string | null
          id?: string
          key: string
          name: string
          resource: string
          scope?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          description?: string | null
          id?: string
          key?: string
          name?: string
          resource?: string
          scope?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          full_name: string | null
          id: string
          restaurant_id: string | null
          role: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          full_name?: string | null
          id?: string
          restaurant_id?: string | null
          role?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          full_name?: string | null
          id?: string
          restaurant_id?: string | null
          role?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_profiles_restaurant_id"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "public_restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_profiles_restaurant_id"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "public_restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      restaurants: {
        Row: {
          address: string | null
          allow_multiple_orders_per_table: boolean | null
          auto_close_session_after_payment: boolean | null
          business_type: string | null
          city: string | null
          country: string | null
          created_at: string
          cuisine_type: string | null
          currency: string | null
          default_order_type: string | null
          default_tax_percentage: number | null
          exchange_rate_usd_to_khr: number | null
          id: string
          is_onboarded: boolean | null
          logo_url: string | null
          name: string
          owner_id: string
          phone: string | null
          receipt_footer_text: string | null
          receipt_header_text: string | null
          service_charge_percentage: number | null
          show_service_charge_on_receipt: boolean | null
          show_tax_on_receipt: boolean | null
          timezone: string | null
          updated_at: string
          vat_tin: string | null
        }
        Insert: {
          address?: string | null
          allow_multiple_orders_per_table?: boolean | null
          auto_close_session_after_payment?: boolean | null
          business_type?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          cuisine_type?: string | null
          currency?: string | null
          default_order_type?: string | null
          default_tax_percentage?: number | null
          exchange_rate_usd_to_khr?: number | null
          id?: string
          is_onboarded?: boolean | null
          logo_url?: string | null
          name: string
          owner_id: string
          phone?: string | null
          receipt_footer_text?: string | null
          receipt_header_text?: string | null
          service_charge_percentage?: number | null
          show_service_charge_on_receipt?: boolean | null
          show_tax_on_receipt?: boolean | null
          timezone?: string | null
          updated_at?: string
          vat_tin?: string | null
        }
        Update: {
          address?: string | null
          allow_multiple_orders_per_table?: boolean | null
          auto_close_session_after_payment?: boolean | null
          business_type?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          cuisine_type?: string | null
          currency?: string | null
          default_order_type?: string | null
          default_tax_percentage?: number | null
          exchange_rate_usd_to_khr?: number | null
          id?: string
          is_onboarded?: boolean | null
          logo_url?: string | null
          name?: string
          owner_id?: string
          phone?: string | null
          receipt_footer_text?: string | null
          receipt_header_text?: string | null
          service_charge_percentage?: number | null
          show_service_charge_on_receipt?: boolean | null
          show_tax_on_receipt?: boolean | null
          timezone?: string | null
          updated_at?: string
          vat_tin?: string | null
        }
        Relationships: []
      }
      role_inheritance: {
        Row: {
          child_role_id: string
          created_at: string
          id: string
          parent_role_id: string
        }
        Insert: {
          child_role_id: string
          created_at?: string
          id?: string
          parent_role_id: string
        }
        Update: {
          child_role_id?: string
          created_at?: string
          id?: string
          parent_role_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "role_inheritance_child_role_id_fkey"
            columns: ["child_role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "role_inheritance_parent_role_id_fkey"
            columns: ["parent_role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
      role_permissions: {
        Row: {
          created_at: string
          id: string
          permission_id: string
          role_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          permission_id: string
          role_id: string
        }
        Update: {
          created_at?: string
          id?: string
          permission_id?: string
          role_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "role_permissions_permission_id_fkey"
            columns: ["permission_id"]
            isOneToOne: false
            referencedRelation: "permissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "role_permissions_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
      roles: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_system_role: boolean
          name: string
          restaurant_id: string
          role_type: Database["public"]["Enums"]["app_role"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_system_role?: boolean
          name: string
          restaurant_id: string
          role_type?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_system_role?: boolean
          name?: string
          restaurant_id?: string
          role_type?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "roles_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "public_restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "roles_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      table_sessions: {
        Row: {
          cashier_name: string | null
          created_at: string
          ended_at: string | null
          id: string
          invoice_number: string | null
          is_invoice_locked: boolean | null
          order_type: string | null
          restaurant_id: string
          started_at: string
          status: string
          table_id: string
          total_amount: number | null
          updated_at: string
        }
        Insert: {
          cashier_name?: string | null
          created_at?: string
          ended_at?: string | null
          id?: string
          invoice_number?: string | null
          is_invoice_locked?: boolean | null
          order_type?: string | null
          restaurant_id: string
          started_at?: string
          status?: string
          table_id: string
          total_amount?: number | null
          updated_at?: string
        }
        Update: {
          cashier_name?: string | null
          created_at?: string
          ended_at?: string | null
          id?: string
          invoice_number?: string | null
          is_invoice_locked?: boolean | null
          order_type?: string | null
          restaurant_id?: string
          started_at?: string
          status?: string
          table_id?: string
          total_amount?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "table_sessions_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "public_restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "table_sessions_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "table_sessions_table_id_fkey"
            columns: ["table_id"]
            isOneToOne: false
            referencedRelation: "tables"
            referencedColumns: ["id"]
          },
        ]
      }
      tables: {
        Row: {
          created_at: string
          id: string
          qr_code_url: string | null
          restaurant_id: string
          table_number: string
        }
        Insert: {
          created_at?: string
          id?: string
          qr_code_url?: string | null
          restaurant_id: string
          table_number: string
        }
        Update: {
          created_at?: string
          id?: string
          qr_code_url?: string | null
          restaurant_id?: string
          table_number?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_tables_restaurant_id"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "public_restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_tables_restaurant_id"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      user_permissions: {
        Row: {
          assigned_by: string | null
          created_at: string
          id: string
          permission_id: string
          restaurant_id: string
          user_id: string
        }
        Insert: {
          assigned_by?: string | null
          created_at?: string
          id?: string
          permission_id: string
          restaurant_id: string
          user_id: string
        }
        Update: {
          assigned_by?: string | null
          created_at?: string
          id?: string
          permission_id?: string
          restaurant_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_permissions_permission_id_fkey"
            columns: ["permission_id"]
            isOneToOne: false
            referencedRelation: "permissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_permissions_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "public_restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_permissions_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          assigned_by: string | null
          created_at: string
          id: string
          restaurant_id: string
          role_id: string
          user_id: string
        }
        Insert: {
          assigned_by?: string | null
          created_at?: string
          id?: string
          restaurant_id: string
          role_id: string
          user_id: string
        }
        Update: {
          assigned_by?: string | null
          created_at?: string
          id?: string
          restaurant_id?: string
          role_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "public_restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_roles_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_roles_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      public_restaurants: {
        Row: {
          created_at: string | null
          id: string | null
          name: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string | null
          name?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string | null
          name?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      check_circular_inheritance: {
        Args: { p_child_role_id: string; p_parent_role_id: string }
        Returns: boolean
      }
      complete_session_payment:
        | { Args: { p_session_id: string }; Returns: Json }
        | {
            Args: { p_cashier_name?: string; p_session_id: string }
            Returns: Json
          }
      create_order_with_items_validated: {
        Args: {
          p_customer_notes: string
          p_items: Json
          p_restaurant_id: string
          p_table_id: string
          p_table_number: string
          p_total_usd: number
        }
        Returns: Json
      }
      get_active_orders_by_tokens: {
        Args: { p_order_tokens: string[] }
        Returns: {
          created_at: string
          customer_notes: string
          id: string
          restaurant_name: string
          status: string
          table_id: string
          table_number: string
          total_usd: number
        }[]
      }
      get_inherited_role_ids: { Args: { p_role_id: string }; Returns: string[] }
      get_or_create_table_session: {
        Args: { p_restaurant_id: string; p_table_id: string }
        Returns: string
      }
      get_order_details: {
        Args: { p_order_id: string; p_order_token?: string }
        Returns: {
          created_at: string
          id: string
          restaurant_name: string
          status: string
          table_id: string
          table_number: string
          total_usd: number
        }[]
      }
      get_order_items_by_token: {
        Args: { p_order_id: string; p_order_token: string }
        Returns: {
          id: string
          menu_item_name: string
          notes: string
          price_usd: number
          quantity: number
        }[]
      }
      get_public_menu_categories: {
        Args: { p_restaurant_id: string }
        Returns: {
          created_at: string
          description: string
          display_order: number
          id: string
          name: string
          status: string
          updated_at: string
        }[]
      }
      get_public_restaurant: {
        Args: { p_restaurant_id: string }
        Returns: {
          created_at: string
          id: string
          name: string
          updated_at: string
        }[]
      }
      get_public_table: {
        Args: { p_table_id: string }
        Returns: {
          created_at: string
          id: string
          qr_code_url: string
          restaurant_id: string
          table_number: string
        }[]
      }
      get_role_effective_permissions: {
        Args: { p_role_id: string }
        Returns: {
          condition_json: Json
          is_inherited: boolean
          permission_id: string
          permission_key: string
          permission_name: string
          source_role_id: string
          source_role_name: string
        }[]
      }
      get_role_inheritance_tree: {
        Args: { p_restaurant_id: string }
        Returns: {
          depth: number
          parent_role_id: string
          parent_role_name: string
          role_id: string
          role_name: string
          role_type: Database["public"]["Enums"]["app_role"]
        }[]
      }
      get_session_details: {
        Args: { p_session_id: string }
        Returns: {
          cashier_name: string
          currency: string
          default_tax_percentage: number
          ended_at: string
          exchange_rate_at_payment: number
          exchange_rate_usd_to_khr: number
          invoice_number: string
          is_invoice_locked: boolean
          order_type: string
          orders: Json
          receipt_footer_text: string
          receipt_header_text: string
          restaurant_address: string
          restaurant_city: string
          restaurant_country: string
          restaurant_id: string
          restaurant_logo_url: string
          restaurant_name: string
          restaurant_phone: string
          restaurant_vat_tin: string
          service_charge_percentage: number
          session_id: string
          started_at: string
          status: string
          table_id: string
          table_number: string
          total_amount: number
        }[]
      }
      get_user_effective_permissions: {
        Args: { p_restaurant_id: string; p_user_id: string }
        Returns: {
          condition_json: Json
          permission_id: string
          permission_key: string
          permission_name: string
          source_name: string
          source_type: string
        }[]
      }
      get_user_restaurant_id: { Args: { _user_id: string }; Returns: string }
      user_has_permission: {
        Args: {
          p_context?: Json
          p_permission_key: string
          p_restaurant_id: string
          p_user_id: string
        }
        Returns: boolean
      }
      user_owns_restaurant: {
        Args: { _restaurant_id: string; _user_id: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role:
        | "owner"
        | "admin"
        | "manager"
        | "supervisor"
        | "cashier"
        | "waiter"
        | "kitchen"
        | "custom"
    }
    CompositeTypes: {
      order_validation_result: {
        success: boolean | null
        order_id: string | null
        unavailable_items: Json | null
      }
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
      app_role: [
        "owner",
        "admin",
        "manager",
        "supervisor",
        "cashier",
        "waiter",
        "kitchen",
        "custom",
      ],
    },
  },
} as const
