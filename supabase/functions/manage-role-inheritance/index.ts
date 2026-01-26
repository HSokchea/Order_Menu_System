import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface AddInheritanceInput {
  action: 'add';
  parent_role_id: string;
  child_role_id: string;
}

interface RemoveInheritanceInput {
  action: 'remove';
  parent_role_id: string;
  child_role_id: string;
}

type InheritanceInput = AddInheritanceInput | RemoveInheritanceInput;

// Check if adding inheritance would create a cycle
async function wouldCreateCycle(
  adminClient: any,
  parentRoleId: string,
  childRoleId: string
): Promise<boolean> {
  if (parentRoleId === childRoleId) return true;

  const { data: allInheritance } = await adminClient
    .from("role_inheritance")
    .select("parent_role_id, child_role_id");

  if (!allInheritance) return false;

  const visited = new Set<string>();

  const traverse = (currentId: string): boolean => {
    if (currentId === parentRoleId) return true;
    if (visited.has(currentId)) return false;
    visited.add(currentId);

    return allInheritance
      .filter((ri: any) => ri.parent_role_id === currentId)
      .some((ri: any) => traverse(ri.child_role_id));
  };

  return traverse(childRoleId);
}

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
      console.error("[manage-role-inheritance] Auth error:", authError);
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[manage-role-inheritance] User ${user.id} authenticated`);

    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    // Get user's restaurant
    const { data: profile, error: profileError } = await adminClient
      .from("profiles")
      .select("restaurant_id")
      .eq("user_id", user.id)
      .single();

    if (profileError || !profile?.restaurant_id) {
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
        JSON.stringify({ error: "Only restaurant owners can manage role inheritance" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const input: InheritanceInput = await req.json();
    console.log(`[manage-role-inheritance] Action: ${input.action}`, input);

    const { parent_role_id, child_role_id } = input;

    // Verify both roles belong to this restaurant
    const { data: roles, error: rolesError } = await adminClient
      .from("roles")
      .select("id, restaurant_id, role_type")
      .in("id", [parent_role_id, child_role_id]);

    if (rolesError || !roles || roles.length !== 2) {
      return new Response(
        JSON.stringify({ error: "One or both roles not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const parentRole = roles.find((r: any) => r.id === parent_role_id);
    const childRole = roles.find((r: any) => r.id === child_role_id);

    if (parentRole?.restaurant_id !== profile.restaurant_id || 
        childRole?.restaurant_id !== profile.restaurant_id) {
      return new Response(
        JSON.stringify({ error: "Cannot manage inheritance for roles from other restaurants" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (input.action === 'add') {
      // Check for cycles
      const hasCycle = await wouldCreateCycle(adminClient, parent_role_id, child_role_id);
      if (hasCycle) {
        return new Response(
          JSON.stringify({ error: "Cannot add inheritance: would create a circular dependency" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Check if already exists
      const { data: existing } = await adminClient
        .from("role_inheritance")
        .select("id")
        .eq("parent_role_id", parent_role_id)
        .eq("child_role_id", child_role_id)
        .single();

      if (existing) {
        return new Response(
          JSON.stringify({ success: true, message: "Inheritance already exists" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { error: insertError } = await adminClient
        .from("role_inheritance")
        .insert({ parent_role_id, child_role_id });

      if (insertError) {
        console.error("[manage-role-inheritance] Insert error:", insertError);
        return new Response(
          JSON.stringify({ error: insertError.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      console.log(`[manage-role-inheritance] Added inheritance: ${parent_role_id} -> ${child_role_id}`);
      return new Response(
        JSON.stringify({ success: true }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );

    } else if (input.action === 'remove') {
      const { error: deleteError } = await adminClient
        .from("role_inheritance")
        .delete()
        .eq("parent_role_id", parent_role_id)
        .eq("child_role_id", child_role_id);

      if (deleteError) {
        console.error("[manage-role-inheritance] Delete error:", deleteError);
        return new Response(
          JSON.stringify({ error: deleteError.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      console.log(`[manage-role-inheritance] Removed inheritance: ${parent_role_id} -> ${child_role_id}`);
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
    console.error("[manage-role-inheritance] Unexpected error:", err);
    const message = err instanceof Error ? err.message : "Internal server error";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
