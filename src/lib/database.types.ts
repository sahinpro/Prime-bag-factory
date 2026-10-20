// Generated from the deployed Supabase public schema and Phase 1 migration.
// Regenerate with the Supabase CLI after linking the project.
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
      audit_logs: {
        Row: {
          id: string;
          actor_id: string | null;
          action: string;
          table_name: string;
          record_id: string | null;
          diff: Json | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          actor_id?: string | null;
          action: string;
          table_name: string;
          record_id?: string | null;
          diff?: Json | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          actor_id?: string | null;
          action?: string;
          table_name?: string;
          record_id?: string | null;
          diff?: Json | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "audit_logs_actor_id_fkey";
            columns: ["actor_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      blocked_contacts: {
        Row: {
          id: string;
          type: Database["public"]["Enums"]["blocked_contact_type"];
          value: string;
          reason: string | null;
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          type: Database["public"]["Enums"]["blocked_contact_type"];
          value: string;
          reason?: string | null;
          created_by?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          type?: Database["public"]["Enums"]["blocked_contact_type"];
          value?: string;
          reason?: string | null;
          created_by?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "blocked_contacts_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      categories: {
        Row: {
          id: string;
          parent_id: string | null;
          slug: string;
          name_en: string;
          name_bn: string | null;
          description_en: string | null;
          description_bn: string | null;
          image_path: string | null;
          seo_title_en: string | null;
          seo_title_bn: string | null;
          seo_description_en: string | null;
          seo_description_bn: string | null;
          sort_order: number;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          parent_id?: string | null;
          slug: string;
          name_en: string;
          name_bn?: string | null;
          description_en?: string | null;
          description_bn?: string | null;
          image_path?: string | null;
          seo_title_en?: string | null;
          seo_title_bn?: string | null;
          seo_description_en?: string | null;
          seo_description_bn?: string | null;
          sort_order?: number;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          parent_id?: string | null;
          slug?: string;
          name_en?: string;
          name_bn?: string | null;
          description_en?: string | null;
          description_bn?: string | null;
          image_path?: string | null;
          seo_title_en?: string | null;
          seo_title_bn?: string | null;
          seo_description_en?: string | null;
          seo_description_bn?: string | null;
          sort_order?: number;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "categories_parent_id_fkey";
            columns: ["parent_id"];
            isOneToOne: false;
            referencedRelation: "categories";
            referencedColumns: ["id"];
          },
        ];
      };
      clients: {
        Row: {
          id: string;
          name: string;
          logo_path: string | null;
          sort_order: number;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          logo_path?: string | null;
          sort_order?: number;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          logo_path?: string | null;
          sort_order?: number;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      collections: {
        Row: {
          id: string;
          slug: string;
          name_en: string;
          name_bn: string | null;
          description_en: string | null;
          description_bn: string | null;
          image_path: string | null;
          sort_order: number;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          slug: string;
          name_en: string;
          name_bn?: string | null;
          description_en?: string | null;
          description_bn?: string | null;
          image_path?: string | null;
          sort_order?: number;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          slug?: string;
          name_en?: string;
          name_bn?: string | null;
          description_en?: string | null;
          description_bn?: string | null;
          image_path?: string | null;
          sort_order?: number;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      faqs: {
        Row: {
          id: string;
          question_en: string;
          question_bn: string | null;
          answer_en: string;
          answer_bn: string | null;
          sort_order: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          question_en: string;
          question_bn?: string | null;
          answer_en: string;
          answer_bn?: string | null;
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          question_en?: string;
          question_bn?: string | null;
          answer_en?: string;
          answer_bn?: string | null;
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      gallery_items: {
        Row: {
          id: string;
          image_path: string;
          caption: string | null;
          sort_order: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          image_path: string;
          caption?: string | null;
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          image_path?: string;
          caption?: string | null;
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      inventory_movements: {
        Row: {
          id: string;
          variant_id: string;
          delta: number;
          reason: Database["public"]["Enums"]["movement_reason"];
          ref_type: string | null;
          ref_id: string | null;
          note: string | null;
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          variant_id: string;
          delta: number;
          reason: Database["public"]["Enums"]["movement_reason"];
          ref_type?: string | null;
          ref_id?: string | null;
          note?: string | null;
          created_by?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          variant_id?: string;
          delta?: number;
          reason?: Database["public"]["Enums"]["movement_reason"];
          ref_type?: string | null;
          ref_id?: string | null;
          note?: string | null;
          created_by?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "inventory_movements_variant_id_fkey";
            columns: ["variant_id"];
            isOneToOne: false;
            referencedRelation: "product_variants";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "inventory_movements_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      legal_documents: {
        Row: {
          id: string;
          title: string;
          number: string | null;
          image_path: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          title: string;
          number?: string | null;
          image_path?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          title?: string;
          number?: string | null;
          image_path?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      notifications: {
        Row: {
          id: string;
          channel: Database["public"]["Enums"]["notification_channel"];
          recipient: string;
          template: string | null;
          payload: Json;
          status: Database["public"]["Enums"]["notification_status"];
          attempts: number;
          last_error: string | null;
          sent_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          channel: Database["public"]["Enums"]["notification_channel"];
          recipient: string;
          template?: string | null;
          payload?: Json;
          status?: Database["public"]["Enums"]["notification_status"];
          attempts?: number;
          last_error?: string | null;
          sent_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          channel?: Database["public"]["Enums"]["notification_channel"];
          recipient?: string;
          template?: string | null;
          payload?: Json;
          status?: Database["public"]["Enums"]["notification_status"];
          attempts?: number;
          last_error?: string | null;
          sent_at?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      order_items: {
        Row: {
          id: string;
          order_id: string;
          variant_id: string | null;
          title_snapshot: string;
          sku_snapshot: string | null;
          color_snapshot: string | null;
          size_snapshot: string | null;
          unit_price: number;
          qty: number;
          line_total: number;
          tier_min_qty: number | null;
          customization: Json | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          order_id: string;
          variant_id?: string | null;
          title_snapshot: string;
          sku_snapshot?: string | null;
          color_snapshot?: string | null;
          size_snapshot?: string | null;
          unit_price: number;
          qty: number;
          line_total: number;
          tier_min_qty?: number | null;
          customization?: Json | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          order_id?: string;
          variant_id?: string | null;
          title_snapshot?: string;
          sku_snapshot?: string | null;
          color_snapshot?: string | null;
          size_snapshot?: string | null;
          unit_price?: number;
          qty?: number;
          line_total?: number;
          tier_min_qty?: number | null;
          customization?: Json | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey";
            columns: ["order_id"];
            isOneToOne: false;
            referencedRelation: "orders";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "order_items_variant_id_fkey";
            columns: ["variant_id"];
            isOneToOne: false;
            referencedRelation: "product_variants";
            referencedColumns: ["id"];
          },
        ];
      };
      order_status_history: {
        Row: {
          id: string;
          order_id: string;
          from_status: Database["public"]["Enums"]["order_status"] | null;
          to_status: Database["public"]["Enums"]["order_status"];
          note: string | null;
          changed_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          order_id: string;
          from_status?: Database["public"]["Enums"]["order_status"] | null;
          to_status: Database["public"]["Enums"]["order_status"];
          note?: string | null;
          changed_by?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          order_id?: string;
          from_status?: Database["public"]["Enums"]["order_status"] | null;
          to_status?: Database["public"]["Enums"]["order_status"];
          note?: string | null;
          changed_by?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "order_status_history_order_id_fkey";
            columns: ["order_id"];
            isOneToOne: false;
            referencedRelation: "orders";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "order_status_history_changed_by_fkey";
            columns: ["changed_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      orders: {
        Row: {
          id: string;
          order_no: string;
          type: Database["public"]["Enums"]["order_type"];
          status: Database["public"]["Enums"]["order_status"];
          payment_method: Database["public"]["Enums"]["payment_method"];
          payment_status: Database["public"]["Enums"]["payment_status"];
          production_status: string | null;
          idempotency_key: string | null;
          courier_name: string | null;
          tracking_code: string | null;
          shipped_at: string | null;
          delivered_at: string | null;
          vat_amount: number;
          customer_name: string;
          customer_phone: string;
          customer_email: string | null;
          division: string | null;
          district: string | null;
          area: string | null;
          address_line: string | null;
          shipping_zone_id: string | null;
          subtotal: number;
          shipping_fee: number;
          discount: number;
          total: number;
          customer_note: string | null;
          admin_note: string | null;
          source_quote_id: string | null;
          source: Database["public"]["Enums"]["order_source"];
          channel: Database["public"]["Enums"]["order_channel"] | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          order_no: string;
          type?: Database["public"]["Enums"]["order_type"];
          status?: Database["public"]["Enums"]["order_status"];
          payment_method?: Database["public"]["Enums"]["payment_method"];
          payment_status?: Database["public"]["Enums"]["payment_status"];
          production_status?: string | null;
          idempotency_key?: string | null;
          courier_name?: string | null;
          tracking_code?: string | null;
          shipped_at?: string | null;
          delivered_at?: string | null;
          vat_amount?: number;
          customer_name: string;
          customer_phone: string;
          customer_email?: string | null;
          division?: string | null;
          district?: string | null;
          area?: string | null;
          address_line?: string | null;
          shipping_zone_id?: string | null;
          subtotal?: number;
          shipping_fee?: number;
          discount?: number;
          total?: number;
          customer_note?: string | null;
          admin_note?: string | null;
          source_quote_id?: string | null;
          source?: Database["public"]["Enums"]["order_source"];
          channel?: Database["public"]["Enums"]["order_channel"] | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          order_no?: string;
          type?: Database["public"]["Enums"]["order_type"];
          status?: Database["public"]["Enums"]["order_status"];
          payment_method?: Database["public"]["Enums"]["payment_method"];
          payment_status?: Database["public"]["Enums"]["payment_status"];
          production_status?: string | null;
          idempotency_key?: string | null;
          courier_name?: string | null;
          tracking_code?: string | null;
          shipped_at?: string | null;
          delivered_at?: string | null;
          vat_amount?: number;
          customer_name?: string;
          customer_phone?: string;
          customer_email?: string | null;
          division?: string | null;
          district?: string | null;
          area?: string | null;
          address_line?: string | null;
          shipping_zone_id?: string | null;
          subtotal?: number;
          shipping_fee?: number;
          discount?: number;
          total?: number;
          customer_note?: string | null;
          admin_note?: string | null;
          source_quote_id?: string | null;
          source?: Database["public"]["Enums"]["order_source"];
          channel?: Database["public"]["Enums"]["order_channel"] | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "orders_shipping_zone_id_fkey";
            columns: ["shipping_zone_id"];
            isOneToOne: false;
            referencedRelation: "shipping_zones";
            referencedColumns: ["id"];
          },
        ];
      };
      payments: {
        Row: {
          id: string;
          order_id: string;
          amount: number;
          method: Database["public"]["Enums"]["payment_method"];
          reference: string | null;
          received_at: string;
          recorded_by: string | null;
          note: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          order_id: string;
          amount: number;
          method: Database["public"]["Enums"]["payment_method"];
          reference?: string | null;
          received_at?: string;
          recorded_by?: string | null;
          note?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          order_id?: string;
          amount?: number;
          method?: Database["public"]["Enums"]["payment_method"];
          reference?: string | null;
          received_at?: string;
          recorded_by?: string | null;
          note?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "payments_order_id_fkey";
            columns: ["order_id"];
            isOneToOne: false;
            referencedRelation: "orders";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "payments_recorded_by_fkey";
            columns: ["recorded_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      posts: {
        Row: {
          id: string;
          slug: string;
          title_en: string;
          title_bn: string | null;
          body_en: string | null;
          body_bn: string | null;
          cover_path: string | null;
          status: string;
          published_at: string | null;
          seo_title_en: string | null;
          seo_title_bn: string | null;
          seo_description_en: string | null;
          seo_description_bn: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          slug: string;
          title_en: string;
          title_bn?: string | null;
          body_en?: string | null;
          body_bn?: string | null;
          cover_path?: string | null;
          status?: string;
          published_at?: string | null;
          seo_title_en?: string | null;
          seo_title_bn?: string | null;
          seo_description_en?: string | null;
          seo_description_bn?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          slug?: string;
          title_en?: string;
          title_bn?: string | null;
          body_en?: string | null;
          body_bn?: string | null;
          cover_path?: string | null;
          status?: string;
          published_at?: string | null;
          seo_title_en?: string | null;
          seo_title_bn?: string | null;
          seo_description_en?: string | null;
          seo_description_bn?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      price_tiers: {
        Row: {
          id: string;
          product_id: string;
          min_qty: number;
          max_qty: number | null;
          unit_price: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          product_id: string;
          min_qty: number;
          max_qty?: number | null;
          unit_price: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          product_id?: string;
          min_qty?: number;
          max_qty?: number | null;
          unit_price?: number;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "price_tiers_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
        ];
      };
      product_categories: {
        Row: {
          id: string;
          product_id: string;
          category_id: string;
          is_primary: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          product_id: string;
          category_id: string;
          is_primary?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          product_id?: string;
          category_id?: string;
          is_primary?: boolean;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "product_categories_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "product_categories_category_id_fkey";
            columns: ["category_id"];
            isOneToOne: false;
            referencedRelation: "categories";
            referencedColumns: ["id"];
          },
        ];
      };
      product_collections: {
        Row: {
          id: string;
          product_id: string;
          collection_id: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          product_id: string;
          collection_id: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          product_id?: string;
          collection_id?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "product_collections_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "product_collections_collection_id_fkey";
            columns: ["collection_id"];
            isOneToOne: false;
            referencedRelation: "collections";
            referencedColumns: ["id"];
          },
        ];
      };
      product_custom_parts: {
        Row: {
          id: string;
          product_id: string;
          key: string;
          label_en: string;
          label_bn: string | null;
          input_type: Database["public"]["Enums"]["product_custom_input_type"];
          swatch_group_id: string | null;
          is_required: boolean;
          price_delta: number;
          config: Json;
          help_text_en: string | null;
          help_text_bn: string | null;
          sort_order: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          product_id: string;
          key: string;
          label_en: string;
          label_bn?: string | null;
          input_type: Database["public"]["Enums"]["product_custom_input_type"];
          swatch_group_id?: string | null;
          is_required?: boolean;
          price_delta?: number;
          config?: Json;
          help_text_en?: string | null;
          help_text_bn?: string | null;
          sort_order?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          product_id?: string;
          key?: string;
          label_en?: string;
          label_bn?: string | null;
          input_type?: Database["public"]["Enums"]["product_custom_input_type"];
          swatch_group_id?: string | null;
          is_required?: boolean;
          price_delta?: number;
          config?: Json;
          help_text_en?: string | null;
          help_text_bn?: string | null;
          sort_order?: number;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "product_custom_parts_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "product_custom_parts_swatch_group_id_fkey";
            columns: ["swatch_group_id"];
            isOneToOne: false;
            referencedRelation: "swatch_groups";
            referencedColumns: ["id"];
          },
        ];
      };
      product_images: {
        Row: {
          id: string;
          product_id: string;
          variant_id: string | null;
          path: string;
          alt_en: string | null;
          alt_bn: string | null;
          sort_order: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          product_id: string;
          variant_id?: string | null;
          path: string;
          alt_en?: string | null;
          alt_bn?: string | null;
          sort_order?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          product_id?: string;
          variant_id?: string | null;
          path?: string;
          alt_en?: string | null;
          alt_bn?: string | null;
          sort_order?: number;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "product_images_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
        ];
      };
      product_part_swatches: {
        Row: {
          id: string;
          part_id: string;
          swatch_id: string;
          is_default: boolean;
          price_delta: number | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          part_id: string;
          swatch_id: string;
          is_default?: boolean;
          price_delta?: number | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          part_id?: string;
          swatch_id?: string;
          is_default?: boolean;
          price_delta?: number | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "product_part_swatches_part_id_fkey";
            columns: ["part_id"];
            isOneToOne: false;
            referencedRelation: "product_custom_parts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "product_part_swatches_swatch_id_fkey";
            columns: ["swatch_id"];
            isOneToOne: false;
            referencedRelation: "swatches";
            referencedColumns: ["id"];
          },
        ];
      };
      product_variants: {
        Row: {
          id: string;
          product_id: string;
          sku: string;
          swatch_id: string | null;
          color_name: string | null;
          color_hex: string | null;
          size: string | null;
          price_delta: number;
          stock_qty: number;
          reserved_qty: number;
          low_stock_threshold: number;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          product_id: string;
          sku: string;
          swatch_id?: string | null;
          color_name?: string | null;
          color_hex?: string | null;
          size?: string | null;
          price_delta?: number;
          stock_qty?: number;
          reserved_qty?: number;
          low_stock_threshold?: number;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          product_id?: string;
          sku?: string;
          swatch_id?: string | null;
          color_name?: string | null;
          color_hex?: string | null;
          size?: string | null;
          price_delta?: number;
          stock_qty?: number;
          reserved_qty?: number;
          low_stock_threshold?: number;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "product_variants_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
        ];
      };
      products: {
        Row: {
          id: string;
          slug: string;
          type: Database["public"]["Enums"]["product_type"];
          title_en: string;
          title_bn: string | null;
          short_description_en: string | null;
          short_description_bn: string | null;
          description_en: string | null;
          description_bn: string | null;
          specs: Json;
          material: string | null;
          moq: number;
          lead_time_days: number | null;
          stock_mode: Database["public"]["Enums"]["product_stock_mode"];
          customization_enabled: boolean;
          status: Database["public"]["Enums"]["product_status"];
          is_featured: boolean;
          seo_title_en: string | null;
          seo_title_bn: string | null;
          seo_description_en: string | null;
          seo_description_bn: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          slug: string;
          type?: Database["public"]["Enums"]["product_type"];
          title_en: string;
          title_bn?: string | null;
          short_description_en?: string | null;
          short_description_bn?: string | null;
          description_en?: string | null;
          description_bn?: string | null;
          specs?: Json;
          material?: string | null;
          moq?: number;
          lead_time_days?: number | null;
          stock_mode?: Database["public"]["Enums"]["product_stock_mode"];
          customization_enabled?: boolean;
          status?: Database["public"]["Enums"]["product_status"];
          is_featured?: boolean;
          seo_title_en?: string | null;
          seo_title_bn?: string | null;
          seo_description_en?: string | null;
          seo_description_bn?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          slug?: string;
          type?: Database["public"]["Enums"]["product_type"];
          title_en?: string;
          title_bn?: string | null;
          short_description_en?: string | null;
          short_description_bn?: string | null;
          description_en?: string | null;
          description_bn?: string | null;
          specs?: Json;
          material?: string | null;
          moq?: number;
          lead_time_days?: number | null;
          stock_mode?: Database["public"]["Enums"]["product_stock_mode"];
          customization_enabled?: boolean;
          status?: Database["public"]["Enums"]["product_status"];
          is_featured?: boolean;
          seo_title_en?: string | null;
          seo_title_bn?: string | null;
          seo_description_en?: string | null;
          seo_description_bn?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          id: string;
          full_name: string | null;
          phone: string | null;
          role: Database["public"]["Enums"]["user_role"];
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          full_name?: string | null;
          phone?: string | null;
          role?: Database["public"]["Enums"]["user_role"];
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          full_name?: string | null;
          phone?: string | null;
          role?: Database["public"]["Enums"]["user_role"];
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      quote_requests: {
        Row: {
          id: string;
          source: Database["public"]["Enums"]["quote_source"];
          company_name: string | null;
          contact_name: string;
          phone: string;
          email: string | null;
          product_id: string | null;
          category_id: string | null;
          quantity: number | null;
          custom_size: string | null;
          custom_color: string | null;
          needs_logo_print: boolean;
          customization: Json | null;
          estimated_unit_price: number | null;
          estimated_total: number | null;
          needed_by: string | null;
          message: string | null;
          attachment_path: string | null;
          status: Database["public"]["Enums"]["quote_status"];
          quoted_amount: number | null;
          valid_until: string | null;
          assigned_to: string | null;
          internal_notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          source?: Database["public"]["Enums"]["quote_source"];
          company_name?: string | null;
          contact_name: string;
          phone: string;
          email?: string | null;
          product_id?: string | null;
          category_id?: string | null;
          quantity?: number | null;
          custom_size?: string | null;
          custom_color?: string | null;
          needs_logo_print?: boolean;
          customization?: Json | null;
          estimated_unit_price?: number | null;
          estimated_total?: number | null;
          needed_by?: string | null;
          message?: string | null;
          attachment_path?: string | null;
          status?: Database["public"]["Enums"]["quote_status"];
          quoted_amount?: number | null;
          valid_until?: string | null;
          assigned_to?: string | null;
          internal_notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          source?: Database["public"]["Enums"]["quote_source"];
          company_name?: string | null;
          contact_name?: string;
          phone?: string;
          email?: string | null;
          product_id?: string | null;
          category_id?: string | null;
          quantity?: number | null;
          custom_size?: string | null;
          custom_color?: string | null;
          needs_logo_print?: boolean;
          customization?: Json | null;
          estimated_unit_price?: number | null;
          estimated_total?: number | null;
          needed_by?: string | null;
          message?: string | null;
          attachment_path?: string | null;
          status?: Database["public"]["Enums"]["quote_status"];
          quoted_amount?: number | null;
          valid_until?: string | null;
          assigned_to?: string | null;
          internal_notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "quote_requests_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "quote_requests_category_id_fkey";
            columns: ["category_id"];
            isOneToOne: false;
            referencedRelation: "categories";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "quote_requests_assigned_to_fkey";
            columns: ["assigned_to"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      rate_limits: {
        Row: {
          id: string;
          key: string;
          window_start: string;
          count: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          key: string;
          window_start: string;
          count?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          key?: string;
          window_start?: string;
          count?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      redirects: {
        Row: {
          id: string;
          from_path: string;
          to_path: string;
          status_code: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          from_path: string;
          to_path: string;
          status_code?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          from_path?: string;
          to_path?: string;
          status_code?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      settings: {
        Row: {
          id: string;
          key: string;
          value: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          key: string;
          value?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          key?: string;
          value?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      shipping_zones: {
        Row: {
          id: string;
          name_en: string;
          name_bn: string | null;
          fee: number;
          free_over: number | null;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name_en: string;
          name_bn?: string | null;
          fee?: number;
          free_over?: number | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name_en?: string;
          name_bn?: string | null;
          fee?: number;
          free_over?: number | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      site_sections: {
        Row: {
          id: string;
          page: string;
          key: string;
          content: Json;
          sort_order: number;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          page: string;
          key: string;
          content?: Json;
          sort_order?: number;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          page?: string;
          key?: string;
          content?: Json;
          sort_order?: number;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      swatch_groups: {
        Row: {
          id: string;
          key: string;
          name_en: string;
          name_bn: string | null;
          sort_order: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          key: string;
          name_en: string;
          name_bn?: string | null;
          sort_order?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          key?: string;
          name_en?: string;
          name_bn?: string | null;
          sort_order?: number;
          created_at?: string;
        };
        Relationships: [];
      };
      swatches: {
        Row: {
          id: string;
          group_id: string;
          name_en: string;
          name_bn: string | null;
          code: string | null;
          color_hex: string | null;
          texture_image_path: string | null;
          sort_order: number;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          group_id: string;
          name_en: string;
          name_bn?: string | null;
          code?: string | null;
          color_hex?: string | null;
          texture_image_path?: string | null;
          sort_order?: number;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          group_id?: string;
          name_en?: string;
          name_bn?: string | null;
          code?: string | null;
          color_hex?: string | null;
          texture_image_path?: string | null;
          sort_order?: number;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "swatches_group_id_fkey";
            columns: ["group_id"];
            isOneToOne: false;
            referencedRelation: "swatch_groups";
            referencedColumns: ["id"];
          },
        ];
      };
      testimonials: {
        Row: {
          id: string;
          name: string;
          company: string | null;
          rating: number;
          body_en: string | null;
          body_bn: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          company?: string | null;
          rating?: number;
          body_en?: string | null;
          body_bn?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          company?: string | null;
          rating?: number;
          body_en?: string | null;
          body_bn?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<never, never>;
    Functions: {
      has_role: { Args: { roles: string[] }; Returns: boolean };
      place_order: { Args: { payload: Json }; Returns: string };
      admin_create_order: { Args: { payload: Json }; Returns: string };
      admin_set_order_status: {
        Args: {
          p_order_id: string;
          p_to_status: Database["public"]["Enums"]["order_status"];
          p_note?: string | null;
        };
        Returns: string;
      };
      admin_record_payment: {
        Args: {
          p_order_id: string;
          p_amount: number;
          p_method: Database["public"]["Enums"]["payment_method"];
          p_reference?: string | null;
          p_note?: string | null;
        };
        Returns: string;
      };
      check_rate_limit: {
        Args: { p_key: string; p_limit: number; p_window_seconds: number };
        Returns: boolean;
      };
      admin_unblock_contact: {
        Args: { p_id: string };
        Returns: void;
      };
      admin_adjust_stock: {
        Args: {
          p_variant_id: string;
          p_delta: number;
          p_reason: Database["public"]["Enums"]["movement_reason"];
          p_note: string;
        };
        Returns: number;
      };
    };
    Enums: {
      blocked_contact_type: "phone" | "ip_hash";
      order_channel: "phone" | "whatsapp" | "facebook" | "walk_in" | "other";
      order_source: "web" | "admin";
      movement_reason:
        | "opening"
        | "purchase"
        | "sale"
        | "return"
        | "adjustment"
        | "damage"
        | "cancel_release";
      notification_channel: "email" | "sms" | "whatsapp" | "admin_alert";
      notification_status: "pending" | "sent" | "failed";
      order_status:
        | "pending"
        | "confirmed"
        | "processing"
        | "shipped"
        | "delivered"
        | "cancelled"
        | "returned";
      order_type: "retail" | "bulk";
      payment_method:
        | "cod"
        | "bkash_manual"
        | "nagad_manual"
        | "bank_transfer"
        | "cash";
      payment_status: "unpaid" | "partially_paid" | "paid" | "refunded";
      product_custom_input_type:
        | "swatch"
        | "select"
        | "dimensions"
        | "file"
        | "text";
      product_status: "draft" | "published" | "archived";
      product_stock_mode: "tracked" | "made_to_order";
      product_type: "buy_now" | "quote_only";
      quote_source: "form" | "builder";
      quote_status: "new" | "contacted" | "quoted" | "won" | "lost";
      shipping_zone_status: "active" | "inactive";
      user_role: "owner" | "manager" | "sales" | "inventory" | "customer";
    };
    CompositeTypes: Record<never, never>;
  };
};
