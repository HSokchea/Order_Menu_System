import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface PermissionCreate {
  key: string;
  name: string;
  description?: string | null;
  resource: string;
  action: string;
  scope?: string | null;
}

interface PermissionUpdate extends PermissionCreate {
  id: string;
}

interface BatchInput {
  action: "batch_save";
  creates: PermissionCreate[];
  updates: PermissionUpdate[];
  deletes: string[]; // permission IDs to delete
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Create user client to verify identity
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // Create admin client for privileged operations
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    // Verify user
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[manage-permissions] User ${user.id} authenticated`);

    // Get user's profile to check if they're a restaurant owner
    const { data: profile, error: profileError } = await adminClient
      .from("profiles")
      .select("restaurant_id")
      .eq("user_id", user.id)
      .single();

    if (profileError || !profile?.restaurant_id) {
      return new Response(
        JSON.stringify({ error: "User profile not found or no restaurant assigned" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if user is restaurant owner
    const { data: restaurant, error: restaurantError } = await adminClient
      .from("restaurants")
      .select("owner_id")
      .eq("id", profile.restaurant_id)
      .single();

    if (restaurantError || !restaurant) {
      return new Response(
        JSON.stringify({ error: "Restaurant not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (restaurant.owner_id !== user.id) {
      return new Response(
        JSON.stringify({ error: "Only restaurant owners can manage permission definitions" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const input: BatchInput = await req.json();
    console.log(`[manage-permissions] Action: ${input.action}`, {
      creates: input.creates?.length || 0,
      updates: input.updates?.length || 0,
      deletes: input.deletes?.length || 0,
    });

    if (input.action !== "batch_save") {
      return new Response(
        JSON.stringify({ error: "Invalid action. Only 'batch_save' is supported." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const errors: string[] = [];
    const results = {
      created: 0,
      updated: 0,
      deleted: 0,
    };

    // Process deletes first
    if (input.deletes && input.deletes.length > 0) {
      // Check if any permissions are in use by roles
      const { data: usedPermissions, error: checkError } = await adminClient
        .from("role_permissions")
        .select("permission_id")
        .in("permission_id", input.deletes);

      if (checkError) {
        console.error("[manage-permissions] Check error:", checkError);
        errors.push(`Failed to check permission usage: ${checkError.message}`);
      } else {
        const usedIds = new Set(usedPermissions?.map(rp => rp.permission_id) || []);
        const safeToDelete = input.deletes.filter(id => !usedIds.has(id));
        const blockedDeletes = input.deletes.filter(id => usedIds.has(id));

        if (blockedDeletes.length > 0) {
          // Get names of blocked permissions
          const { data: blockedPerms } = await adminClient
            .from("permissions")
            .select("key")
            .in("id", blockedDeletes);
          
          const keys = blockedPerms?.map(p => p.key).join(", ") || blockedDeletes.join(", ");
          errors.push(`Cannot delete permissions in use by roles: ${keys}`);
        }

        if (safeToDelete.length > 0) {
          const { error: deleteError } = await adminClient
            .from("permissions")
            .delete()
            .in("id", safeToDelete);

          if (deleteError) {
            console.error("[manage-permissions] Delete error:", deleteError);
            errors.push(`Failed to delete permissions: ${deleteError.message}`);
          } else {
            results.deleted = safeToDelete.length;
            console.log(`[manage-permissions] Deleted ${safeToDelete.length} permissions`);
          }
        }
      }
    }

    // Process creates
    if (input.creates && input.creates.length > 0) {
      // Validate unique keys
      const newKeys = input.creates.map(p => p.key);
      const { data: existingPerms } = await adminClient
        .from("permissions")
        .select("key")
        .in("key", newKeys);

      const existingKeys = new Set(existingPerms?.map(p => p.key) || []);
      const duplicateKeys = newKeys.filter(k => existingKeys.has(k));

      if (duplicateKeys.length > 0) {
        errors.push(`Permission keys already exist: ${duplicateKeys.join(", ")}`);
      }

      const validCreates = input.creates.filter(p => !existingKeys.has(p.key));

      if (validCreates.length > 0) {
        const { error: insertError, data: inserted } = await adminClient
          .from("permissions")
          .insert(validCreates.map(p => ({
            key: p.key,
            name: p.name,
            description: p.description || null,
            resource: p.resource,
            action: p.action,
            scope: p.scope || null,
          })))
          .select("id");

        if (insertError) {
          console.error("[manage-permissions] Insert error:", insertError);
          if (insertError.message.includes("unique constraint")) {
            errors.push("One or more permission keys already exist");
          } else {
            errors.push(`Failed to create permissions: ${insertError.message}`);
          }
        } else {
          results.created = inserted?.length || 0;
          console.log(`[manage-permissions] Created ${results.created} permissions`);
        }
      }
    }

    // Process updates
    if (input.updates && input.updates.length > 0) {
      for (const perm of input.updates) {
        // Check for key uniqueness (exclude self)
        const { data: conflict } = await adminClient
          .from("permissions")
          .select("id")
          .eq("key", perm.key)
          .neq("id", perm.id)
          .single();

        if (conflict) {
          errors.push(`Permission key "${perm.key}" already exists`);
          continue;
        }

        const { error: updateError } = await adminClient
          .from("permissions")
          .update({
            key: perm.key,
            name: perm.name,
            description: perm.description || null,
            resource: perm.resource,
            action: perm.action,
            scope: perm.scope || null,
          })
          .eq("id", perm.id);

        if (updateError) {
          console.error("[manage-permissions] Update error:", updateError);
          errors.push(`Failed to update permission "${perm.key}": ${updateError.message}`);
        } else {
          results.updated++;
        }
      }
      console.log(`[manage-permissions] Updated ${results.updated} permissions`);
    }

    // Return results
    const success = errors.length === 0;
    const response = {
      success,
      results,
      errors: errors.length > 0 ? errors : undefined,
    };

    console.log(`[manage-permissions] Batch save complete:`, response);

    return new Response(
      JSON.stringify(response),
      { 
        status: success ? 200 : 207, // 207 Multi-Status for partial success
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );

  } catch (err) {
    console.error("[manage-permissions] Error:", err);
    return new Response(
      JSON.stringify({ error: err.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
