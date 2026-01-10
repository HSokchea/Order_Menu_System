import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface UpdateStaffRequest {
  user_id: string;
  full_name?: string;
  role_ids?: string[];
  status?: 'active' | 'inactive';
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    
    const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { autoRefreshToken: false, persistSession: false }
    });

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    const { data: { user: callerUser }, error: authError } = await supabaseClient.auth.getUser();
    
    if (authError || !callerUser) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Verify caller is restaurant owner
    const { data: restaurant, error: restaurantError } = await supabaseAdmin
      .from('restaurants')
      .select('id')
      .eq('owner_id', callerUser.id)
      .single();

    if (restaurantError || !restaurant) {
      return new Response(JSON.stringify({ error: 'Only restaurant owners can update staff' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { user_id, full_name, role_ids, status }: UpdateStaffRequest = await req.json();

    if (!user_id) {
      return new Response(JSON.stringify({ error: 'User ID is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Verify the user belongs to this restaurant
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('id, user_id')
      .eq('user_id', user_id)
      .eq('restaurant_id', restaurant.id)
      .single();

    if (profileError || !profile) {
      return new Response(JSON.stringify({ error: 'Staff member not found in your restaurant' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Prevent owner from modifying themselves
    if (user_id === callerUser.id) {
      return new Response(JSON.stringify({ error: 'Cannot modify your own account' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Update profile
    const updates: Record<string, any> = { updated_at: new Date().toISOString() };
    if (full_name !== undefined) updates.full_name = full_name.trim();
    if (status !== undefined) updates.status = status;

    const { error: updateError } = await supabaseAdmin
      .from('profiles')
      .update(updates)
      .eq('user_id', user_id)
      .eq('restaurant_id', restaurant.id);

    if (updateError) {
      console.error('Error updating profile:', updateError);
      return new Response(JSON.stringify({ error: 'Failed to update profile' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Update roles if provided
    if (role_ids !== undefined) {
      // Remove all existing roles
      await supabaseAdmin
        .from('user_roles')
        .delete()
        .eq('user_id', user_id)
        .eq('restaurant_id', restaurant.id);

      // Add new roles
      for (const roleId of role_ids) {
        await supabaseAdmin
          .from('user_roles')
          .insert({
            user_id: user_id,
            role_id: roleId,
            restaurant_id: restaurant.id,
            assigned_by: callerUser.id
          });
      }
    }

    return new Response(JSON.stringify({
      success: true,
      message: 'Staff member updated successfully'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in update-staff-user function:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
