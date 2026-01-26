import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface AssignRoleInput {
  action: 'assign';
  user_id: string;
  role_id: string;
}

interface RemoveRoleInput {
  action: 'remove';
  user_id: string;
  role_id: string;
}

interface BulkAssignInput {
  action: 'bulk_assign';
  user_id: string;
  role_ids: string[];
}

type UserRoleInput = AssignRoleInput | RemoveRoleInput | BulkAssignInput;

Deno.serve(async (req: Request) => {
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
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      console.error("[manage-user-roles] Auth error:", authError);
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[manage-user-roles] User ${user.id} authenticated`);

    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    // Get caller's restaurant
    const { data: callerProfile, error: profileError } = await adminClient
      .from("profiles")
      .select("restaurant_id")
      .eq("user_id", user.id)
      .single();

    if (profileError || !callerProfile?.restaurant_id) {
      return new Response(
        JSON.stringify({ error: "User has no restaurant" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify caller is restaurant owner
    const { data: restaurant, error: restaurantError } = await adminClient
      .from("restaurants")
      .select("owner_id")
      .eq("id", callerProfile.restaurant_id)
      .single();

    if (restaurantError || !restaurant || restaurant.owner_id !== user.id) {
      return new Response(
        JSON.stringify({ error: "Only restaurant owners can manage user roles" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const input: UserRoleInput = await req.json();
    console.log(`[manage-user-roles] Action: ${input.action}`, input);

    // Prevent modifying own roles (owner)
    if (input.user_id === user.id) {
      return new Response(
        JSON.stringify({ error: "Cannot modify your own roles" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify target user belongs to same restaurant
    const { data: targetProfile, error: targetError } = await adminClient
      .from("profiles")
      .select("restaurant_id, user_id")
      .eq("user_id", input.user_id)
      .single();

    if (targetError || !targetProfile) {
      return new Response(
        JSON.stringify({ error: "Target user not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (targetProfile.restaurant_id !== callerProfile.restaurant_id) {
      return new Response(
        JSON.stringify({ error: "Cannot manage roles for users from other restaurants" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (input.action === 'assign') {
      const { user_id: targetUserId, role_id } = input;

      // Verify role belongs to restaurant and is not owner role
      const { data: role, error: roleError } = await adminClient
        .from("roles")
        .select("id, restaurant_id, role_type")
        .eq("id", role_id)
        .single();

      if (roleError || !role) {
        return new Response(
          JSON.stringify({ error: "Role not found" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (role.restaurant_id !== callerProfile.restaurant_id) {
        return new Response(
          JSON.stringify({ error: "Cannot assign roles from other restaurants" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (role.role_type === 'owner') {
        return new Response(
          JSON.stringify({ error: "Cannot assign Owner role to other users" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Check if already assigned
      const { data: existing } = await adminClient
        .from("user_roles")
        .select("id")
        .eq("user_id", targetUserId)
        .eq("role_id", role_id)
        .single();

      if (existing) {
        return new Response(
          JSON.stringify({ success: true, message: "Role already assigned" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { error: insertError } = await adminClient
        .from("user_roles")
        .insert({
          user_id: targetUserId,
          role_id,
          restaurant_id: callerProfile.restaurant_id,
          assigned_by: user.id
        });

      if (insertError) {
        console.error("[manage-user-roles] Insert error:", insertError);
        return new Response(
          JSON.stringify({ error: insertError.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      console.log(`[manage-user-roles] Assigned role ${role_id} to user ${targetUserId}`);
      return new Response(
        JSON.stringify({ success: true }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );

    } else if (input.action === 'remove') {
      const { user_id: targetUserId, role_id } = input;

      const { error: deleteError } = await adminClient
        .from("user_roles")
        .delete()
        .eq("user_id", targetUserId)
        .eq("role_id", role_id)
        .eq("restaurant_id", callerProfile.restaurant_id);

      if (deleteError) {
        console.error("[manage-user-roles] Delete error:", deleteError);
        return new Response(
          JSON.stringify({ error: deleteError.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      console.log(`[manage-user-roles] Removed role ${role_id} from user ${targetUserId}`);
      return new Response(
        JSON.stringify({ success: true }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );

    } else if (input.action === 'bulk_assign') {
      const { user_id: targetUserId, role_ids } = input;

      if (!Array.isArray(role_ids)) {
        return new Response(
          JSON.stringify({ error: "role_ids must be an array" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (role_ids.length === 0) {
        return new Response(
          JSON.stringify({ error: "At least one role must be assigned" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Verify all roles belong to restaurant and none are owner
      const { data: roles, error: rolesError } = await adminClient
        .from("roles")
        .select("id, restaurant_id, role_type")
        .in("id", role_ids);

      if (rolesError || !roles) {
        return new Response(
          JSON.stringify({ error: "Error fetching roles" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      for (const role of roles) {
        if (role.restaurant_id !== callerProfile.restaurant_id) {
          return new Response(
            JSON.stringify({ error: "Cannot assign roles from other restaurants" }),
            { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        if (role.role_type === 'owner') {
          return new Response(
            JSON.stringify({ error: "Cannot assign Owner role" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }

      // Get current roles
      const { data: currentRoles } = await adminClient
        .from("user_roles")
        .select("role_id")
        .eq("user_id", targetUserId)
        .eq("restaurant_id", callerProfile.restaurant_id);

      const currentRoleIds = new Set((currentRoles || []).map((r: any) => r.role_id));
      const newRoleIds = new Set(role_ids);

      // Roles to add
      const toAdd = role_ids.filter((id: string) => !currentRoleIds.has(id));
      // Roles to remove
      const toRemove = [...currentRoleIds].filter((id: string) => !newRoleIds.has(id));

      // Remove old roles
      if (toRemove.length > 0) {
        await adminClient
          .from("user_roles")
          .delete()
          .eq("user_id", targetUserId)
          .eq("restaurant_id", callerProfile.restaurant_id)
          .in("role_id", toRemove);
      }

      // Add new roles
      if (toAdd.length > 0) {
        await adminClient
          .from("user_roles")
          .insert(
            toAdd.map((role_id: string) => ({
              user_id: targetUserId,
              role_id,
              restaurant_id: callerProfile.restaurant_id,
              assigned_by: user.id
            }))
          );
      }

      console.log(`[manage-user-roles] Bulk updated roles for user ${targetUserId}: added ${toAdd.length}, removed ${toRemove.length}`);
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
    console.error("[manage-user-roles] Unexpected error:", err);
    const message = err instanceof Error ? err.message : "Internal server error";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
