import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CreateStaffRequest {
  email: string;
  full_name: string;
  role_ids: string[];
  status: 'active' | 'inactive';
}

serve(async (req) => {
  // Handle CORS preflight requests
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
    // Get the authorization header to verify the caller
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Create clients
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    
    // Client for verifying the caller (uses their JWT)
    const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { autoRefreshToken: false, persistSession: false }
    });

    // Admin client for creating users
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    // Verify the caller is authenticated
    const { data: { user: callerUser }, error: authError } = await supabaseClient.auth.getUser();
    
    if (authError || !callerUser) {
      console.error('Auth error:', authError);
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get the caller's restaurant (they must be the owner)
    const { data: restaurant, error: restaurantError } = await supabaseAdmin
      .from('restaurants')
      .select('id')
      .eq('owner_id', callerUser.id)
      .single();

    if (restaurantError || !restaurant) {
      console.error('Restaurant error:', restaurantError);
      return new Response(JSON.stringify({ error: 'Only restaurant owners can create staff' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { email, full_name, role_ids, status }: CreateStaffRequest = await req.json();

    // Validate input
    if (!email || !email.includes('@')) {
      return new Response(JSON.stringify({ error: 'Valid email is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!full_name || full_name.trim().length < 2) {
      return new Response(JSON.stringify({ error: 'Full name is required (min 2 characters)' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!role_ids || !Array.isArray(role_ids) || role_ids.length === 0) {
      console.error('No roles provided');
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'At least one role is required. Please create roles first in the Roles tab.' 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // SECURITY: Validate that none of the roles are 'owner' type
    const { data: roleTypes, error: roleTypesError } = await supabaseAdmin
      .from('roles')
      .select('id, role_type')
      .in('id', role_ids);

    if (roleTypesError) {
      console.error('Error checking role types:', roleTypesError);
      return new Response(JSON.stringify({ error: 'Failed to validate roles' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Block if trying to assign owner role
    const ownerRole = roleTypes?.find(r => r.role_type === 'owner');
    if (ownerRole) {
      return new Response(JSON.stringify({ 
        error: 'Cannot assign Owner role to staff. Owner role is reserved for the restaurant creator.' 
      }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check if email exists in auth.users
    const { data: users } = await supabaseAdmin.auth.admin.listUsers();
    const existingUser = users?.users?.find(u => u.email === email);

    if (existingUser) {
      // ONE-USER-ONE-SHOP RULE: Check if this user already has a profile (belongs to ANY shop)
      const { data: existingProfileForUser, error: profileCheckError } = await supabaseAdmin
        .from('profiles')
        .select('id, restaurant_id')
        .eq('user_id', existingUser.id)
        .maybeSingle();

      // If there's an error other than not finding data, log it
      if (profileCheckError) {
        console.error('Error checking existing profile:', profileCheckError);
      }

      if (existingProfileForUser) {
        // User already belongs to a shop - block creation
        if (existingProfileForUser.restaurant_id === restaurant.id) {
          return new Response(JSON.stringify({ error: 'This email is already registered as staff in your restaurant' }), {
            status: 409,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        } else {
          return new Response(JSON.stringify({ error: 'This user already belongs to another shop' }), {
            status: 409,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
      }
    }

    // Generate a random temporary password
    const tempPassword = crypto.randomUUID().slice(0, 12) + 'Aa1!';

    let userId: string;

    if (existingUser) {
      // User exists in auth but not in this restaurant - just create profile
      userId = existingUser.id;
    } else {
      // Create the auth user
      const { data: newUser, error: createUserError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password: tempPassword,
        email_confirm: true, // Auto-confirm email for staff
        user_metadata: {
          full_name,
          restaurant_id: restaurant.id,
          is_staff: true
        }
      });

      if (createUserError) {
        console.error('Error creating user:', createUserError);
        return new Response(JSON.stringify({ error: createUserError.message }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      userId = newUser.user.id;
    }

    // Create the profile (one-user-one-shop: user should not have a profile yet)
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .insert({
        user_id: userId,
        restaurant_id: restaurant.id,
        full_name: full_name.trim(),
        email: email.toLowerCase().trim(),
        status: status || 'active',
        must_change_password: true // Force password change on first login
      });

    if (profileError) {
      console.error('Error creating profile:', profileError);
      // Try to clean up the created user if we just created them
      if (!existingUser) {
        await supabaseAdmin.auth.admin.deleteUser(userId);
      }
      return new Response(JSON.stringify({ error: 'Failed to create profile. User may already belong to another shop.' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Assign roles
    for (const roleId of role_ids) {
      const { error: roleError } = await supabaseAdmin
        .from('user_roles')
        .insert({
          user_id: userId,
          role_id: roleId,
          restaurant_id: restaurant.id,
          assigned_by: callerUser.id
        });

      if (roleError) {
        console.error('Error assigning role:', roleError);
        // Continue anyway - role assignment is not critical
      }
    }

    console.log(`Successfully created staff user ${email} for restaurant ${restaurant.id}`);

    return new Response(JSON.stringify({
      success: true,
      user_id: userId,
      message: `Staff member ${full_name} created successfully`,
      temp_password: existingUser ? null : tempPassword // Only return temp password for new users
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in create-staff-user function:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
