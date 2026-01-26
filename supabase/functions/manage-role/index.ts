import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface CreateRoleInput {
  action: 'create';
  name: string;
  description?: string | null;
  role_type?: string;
}

interface UpdateRoleInput {
  action: 'update';
  role_id: string;
  name?: string;
  description?: string | null;
}

interface DeleteRoleInput {
  action: 'delete';
  role_id: string;
}

type RoleInput = CreateRoleInput | UpdateRoleInput | DeleteRoleInput;

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get auth token
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create user client to verify auth
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // Get authenticated user
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      console.error("[manage-role] Auth error:", authError);
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[manage-role] User ${user.id} authenticated`);

    // Use service role for mutations
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    // Get user's restaurant
    const { data: profile, error: profileError } = await adminClient
      .from("profiles")
      .select("restaurant_id")
      .eq("user_id", user.id)
      .single();

    if (profileError || !profile?.restaurant_id) {
      console.error("[manage-role] Profile error:", profileError);
      return new Response(
        JSON.stringify({ error: "User has no restaurant" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify user is restaurant owner
    const { data: restaurant, error: restaurantError } = await adminClient
      .from("restaurants")
      .select("owner_id")
      .eq("id", profile.restaurant_id)
      .single();

    if (restaurantError || !restaurant || restaurant.owner_id !== user.id) {
      console.error("[manage-role] Not restaurant owner");
      return new Response(
        JSON.stringify({ error: "Only restaurant owners can manage roles" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const input: RoleInput = await req.json();
    console.log(`[manage-role] Action: ${input.action}`, input);

    if (input.action === 'create') {
      const { name, description, role_type = 'custom' } = input;

      if (!name?.trim()) {
        return new Response(
          JSON.stringify({ error: "Role name is required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Check for duplicate name
      const { data: existing } = await adminClient
        .from("roles")
        .select("id")
        .eq("restaurant_id", profile.restaurant_id)
        .eq("name", name.trim())
        .single();

      if (existing) {
        return new Response(
          JSON.stringify({ error: "This role name already exists." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { data: role, error: createError } = await adminClient
        .from("roles")
        .insert({
          restaurant_id: profile.restaurant_id,
          name: name.trim(),
          description: description || null,
          role_type: role_type,
        })
        .select()
        .single();

      if (createError) {
        console.error("[manage-role] Create error:", createError);
        return new Response(
          JSON.stringify({ error: createError.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      console.log(`[manage-role] Created role: ${role.id}`);
      return new Response(
        JSON.stringify({ success: true, role }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );

    } else if (input.action === 'update') {
      const { role_id, name, description } = input;

      if (!role_id) {
        return new Response(
          JSON.stringify({ error: "Role ID is required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Verify role belongs to restaurant
      const { data: role, error: roleError } = await adminClient
        .from("roles")
        .select("id, restaurant_id, is_system_role, role_type")
        .eq("id", role_id)
        .single();

      if (roleError || !role) {
        return new Response(
          JSON.stringify({ error: "Role not found" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (role.restaurant_id !== profile.restaurant_id) {
        return new Response(
          JSON.stringify({ error: "Cannot modify roles from other restaurants" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Prevent modifying OWNER system role name
      if (role.role_type === 'owner' && name && name.trim().toLowerCase() !== 'owner') {
        return new Response(
          JSON.stringify({ error: "Cannot rename the Owner system role" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Check for duplicate name if updating name
      if (name?.trim()) {
        const { data: existing } = await adminClient
          .from("roles")
          .select("id")
          .eq("restaurant_id", profile.restaurant_id)
          .eq("name", name.trim())
          .neq("id", role_id)
          .single();

        if (existing) {
          return new Response(
            JSON.stringify({ error: "This role name already exists." }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }

      const updates: Record<string, any> = {};
      if (name !== undefined) updates.name = name.trim();
      if (description !== undefined) updates.description = description;

      const { error: updateError } = await adminClient
        .from("roles")
        .update(updates)
        .eq("id", role_id);

      if (updateError) {
        console.error("[manage-role] Update error:", updateError);
        return new Response(
          JSON.stringify({ error: updateError.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      console.log(`[manage-role] Updated role: ${role_id}`);
      return new Response(
        JSON.stringify({ success: true }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );

    } else if (input.action === 'delete') {
      const { role_id } = input;

      if (!role_id) {
        return new Response(
          JSON.stringify({ error: "Role ID is required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Verify role belongs to restaurant and is not system role
      const { data: role, error: roleError } = await adminClient
        .from("roles")
        .select("id, restaurant_id, is_system_role, role_type")
        .eq("id", role_id)
        .single();

      if (roleError || !role) {
        return new Response(
          JSON.stringify({ error: "Role not found" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (role.restaurant_id !== profile.restaurant_id) {
        return new Response(
          JSON.stringify({ error: "Cannot delete roles from other restaurants" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (role.is_system_role || role.role_type === 'owner') {
        return new Response(
          JSON.stringify({ error: "Cannot delete system roles" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Check if role is in use
      const { count: userCount } = await adminClient
        .from("user_roles")
        .select("id", { count: 'exact', head: true })
        .eq("role_id", role_id);

      if (userCount && userCount > 0) {
        return new Response(
          JSON.stringify({ error: "Cannot delete role that is assigned to users. Remove users from this role first." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Delete role permissions first
      await adminClient
        .from("role_permissions")
        .delete()
        .eq("role_id", role_id);

      // Delete role inheritance records
      await adminClient
        .from("role_inheritance")
        .delete()
        .or(`parent_role_id.eq.${role_id},child_role_id.eq.${role_id}`);

      // Delete the role
      const { error: deleteError } = await adminClient
        .from("roles")
        .delete()
        .eq("id", role_id);

      if (deleteError) {
        console.error("[manage-role] Delete error:", deleteError);
        return new Response(
          JSON.stringify({ error: deleteError.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      console.log(`[manage-role] Deleted role: ${role_id}`);
      return new Response(
        JSON.stringify({ success: true }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Invalid action" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (err: unknown) {
    console.error("[manage-role] Unexpected error:", err);
    const message = err instanceof Error ? err.message : "Internal server error";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
