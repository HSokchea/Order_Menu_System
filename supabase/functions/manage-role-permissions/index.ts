import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface AssignPermissionInput {
  action: 'assign';
  role_id: string;
  permission_id: string;
}

interface RemovePermissionInput {
  action: 'remove';
  role_id: string;
  permission_id: string;
}

// Note: Condition actions are disabled for v1 - binary permissions only
type PermissionInput = AssignPermissionInput | RemovePermissionInput;

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

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // Get authenticated user
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      console.error("[manage-role-permissions] Auth error:", authError);
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[manage-role-permissions] User ${user.id} authenticated`);

    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    // Get user's restaurant
    const { data: profile, error: profileError } = await adminClient
      .from("profiles")
      .select("restaurant_id")
      .eq("user_id", user.id)
      .single();

    if (profileError || !profile?.restaurant_id) {
      console.error("[manage-role-permissions] Profile error:", profileError);
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
      return new Response(
        JSON.stringify({ error: "Only restaurant owners can manage role permissions" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const input: PermissionInput = await req.json();
    console.log(`[manage-role-permissions] Action: ${input.action}`, input);

    // Check for disabled condition actions (v1)
    if ((input as any).action === 'set_condition' || (input as any).action === 'remove_condition') {
      console.warn("[manage-role-permissions] Condition actions are disabled in v1");
      return new Response(
        JSON.stringify({ error: "Permission conditions are disabled in v1. Binary permissions only." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify role belongs to this restaurant
    const { data: role, error: roleError } = await adminClient
      .from("roles")
      .select("id, restaurant_id, role_type")
      .eq("id", input.role_id)
      .single();

    if (roleError || !role) {
      return new Response(
        JSON.stringify({ error: "Role not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (role.restaurant_id !== profile.restaurant_id) {
      return new Response(
        JSON.stringify({ error: "Cannot modify permissions for roles from other restaurants" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Owner role has all permissions implicitly - prevent manual assignment
    if (role.role_type === 'owner') {
      return new Response(
        JSON.stringify({ error: "Owner role has all permissions by default and cannot be modified" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (input.action === 'assign') {
      const { role_id, permission_id } = input;

      // Verify permission exists
      const { data: permission } = await adminClient
        .from("permissions")
        .select("id")
        .eq("id", permission_id)
        .single();

      if (!permission) {
        return new Response(
          JSON.stringify({ error: "Permission not found" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Check if already assigned
      const { data: existing } = await adminClient
        .from("role_permissions")
        .select("id")
        .eq("role_id", role_id)
        .eq("permission_id", permission_id)
        .single();

      if (existing) {
        return new Response(
          JSON.stringify({ success: true, message: "Permission already assigned" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { error: insertError } = await adminClient
        .from("role_permissions")
        .insert({ role_id, permission_id });

      if (insertError) {
        console.error("[manage-role-permissions] Insert error:", insertError);
        return new Response(
          JSON.stringify({ error: insertError.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      console.log(`[manage-role-permissions] Assigned permission ${permission_id} to role ${role_id}`);
      return new Response(
        JSON.stringify({ success: true }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );

    } else if (input.action === 'remove') {
      const { role_id, permission_id } = input;

      const { error: deleteError } = await adminClient
        .from("role_permissions")
        .delete()
        .eq("role_id", role_id)
        .eq("permission_id", permission_id);

      if (deleteError) {
        console.error("[manage-role-permissions] Delete error:", deleteError);
        return new Response(
          JSON.stringify({ error: deleteError.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      console.log(`[manage-role-permissions] Removed permission ${permission_id} from role ${role_id}`);
      return new Response(
        JSON.stringify({ success: true }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Invalid action. Supported actions: assign, remove" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (err: unknown) {
    console.error("[manage-role-permissions] Unexpected error:", err);
    const message = err instanceof Error ? err.message : "Internal server error";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
