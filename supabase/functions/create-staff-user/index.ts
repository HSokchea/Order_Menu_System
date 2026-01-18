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
    const normalizedEmail = email.toLowerCase().trim();

    console.log(`Creating staff: ${normalizedEmail} for restaurant ${restaurant.id}`);

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

    // STEP 1: Check if a profile already exists for this email (in ANY restaurant)
    // This is the authoritative check - profiles table enforces one-user-one-shop
    const { data: existingProfile, error: profileCheckError } = await supabaseAdmin
      .from('profiles')
      .select('id, user_id, restaurant_id, email')
      .eq('email', normalizedEmail)
      .maybeSingle();

    if (profileCheckError) {
      console.error('Error checking existing profile by email:', profileCheckError);
    }

    if (existingProfile) {
      console.log(`Profile already exists for email ${normalizedEmail}: user_id=${existingProfile.user_id}, restaurant_id=${existingProfile.restaurant_id}`);
      if (existingProfile.restaurant_id === restaurant.id) {
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

    // STEP 2: Check if auth user exists (using admin.getUserById via email lookup is not available,
    // so we try to create and handle the "already exists" error)
    const tempPassword = crypto.randomUUID().slice(0, 12) + 'Aa1!';
    let userId: string;
    let isNewUser = false;

    // Try to create the auth user first
    const { data: newUser, error: createUserError } = await supabaseAdmin.auth.admin.createUser({
      email: normalizedEmail,
      password: tempPassword,
      email_confirm: true,
      user_metadata: {
        full_name,
        restaurant_id: restaurant.id,
        is_staff: true
      }
    });

    if (createUserError) {
      // Check if user already exists
      if (createUserError.message?.includes('already been registered') || 
          createUserError.message?.includes('already exists') ||
          createUserError.status === 422) {
        console.log(`Auth user already exists for ${normalizedEmail}, fetching...`);
        
        // User exists in auth, need to find their ID
        // We need to search for the user - use listUsers with filter
        const { data: usersData, error: listError } = await supabaseAdmin.auth.admin.listUsers({
          page: 1,
          perPage: 1000 // Get more users to search through
        });

        if (listError) {
          console.error('Error listing users:', listError);
          return new Response(JSON.stringify({ error: 'Failed to verify existing user' }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        const existingAuthUser = usersData?.users?.find(u => u.email?.toLowerCase() === normalizedEmail);
        
        if (!existingAuthUser) {
          console.error(`Could not find auth user for ${normalizedEmail} despite create saying it exists`);
          return new Response(JSON.stringify({ error: 'User verification failed. Please try again.' }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        userId = existingAuthUser.id;
        console.log(`Found existing auth user: ${userId}`);

        // Double-check no profile exists for this user_id (belt and suspenders)
        const { data: profileByUserId } = await supabaseAdmin
          .from('profiles')
          .select('id, restaurant_id')
          .eq('user_id', userId)
          .maybeSingle();

        if (profileByUserId) {
          console.log(`Profile found by user_id ${userId}: restaurant_id=${profileByUserId.restaurant_id}`);
          if (profileByUserId.restaurant_id === restaurant.id) {
            return new Response(JSON.stringify({ error: 'This user is already staff in your restaurant' }), {
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
      } else {
        console.error('Error creating user:', createUserError);
        return new Response(JSON.stringify({ error: createUserError.message || 'Failed to create user' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    } else {
      userId = newUser.user.id;
      isNewUser = true;
      console.log(`Created new auth user: ${userId}`);
    }

    // STEP 3: Create or update the profile
    // NOTE: The database trigger `handle_new_user` may have already created a profile
    // when the auth user was created. We use upsert to handle this case.
    
    // First, check if the trigger already created the profile
    const { data: existingProfileById } = await supabaseAdmin
      .from('profiles')
      .select('id, user_id, restaurant_id')
      .eq('user_id', userId)
      .maybeSingle();

    if (existingProfileById) {
      console.log(`Profile already exists for user ${userId} (created by trigger), updating...`);
      
      // Update the existing profile with correct data
      const { error: updateError } = await supabaseAdmin
        .from('profiles')
        .update({
          restaurant_id: restaurant.id,
          full_name: full_name.trim(),
          email: normalizedEmail,
          status: status || 'active',
          must_change_password: true
        })
        .eq('user_id', userId);

      if (updateError) {
        console.error('Error updating profile:', updateError);
        
        // If we just created the user, clean up
        if (isNewUser) {
          console.log(`Cleaning up newly created auth user ${userId} due to profile update failure`);
          await supabaseAdmin.auth.admin.deleteUser(userId);
        }
        
        return new Response(JSON.stringify({ error: 'Failed to update staff profile' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    } else {
      // Profile doesn't exist, create it
      const { error: profileError } = await supabaseAdmin
        .from('profiles')
        .insert({
          user_id: userId,
          restaurant_id: restaurant.id,
          full_name: full_name.trim(),
          email: normalizedEmail,
          status: status || 'active',
          must_change_password: true
        });

      if (profileError) {
        console.error('Error creating profile:', profileError);
        
        // If we just created the user, clean up
        if (isNewUser) {
          console.log(`Cleaning up newly created auth user ${userId} due to profile creation failure`);
          await supabaseAdmin.auth.admin.deleteUser(userId);
        }
        
        // Check if it's a duplicate error (race condition with trigger)
        if (profileError.code === '23505') {
          // Try to update instead
          console.log('Duplicate profile detected, attempting update...');
          const { error: retryUpdateError } = await supabaseAdmin
            .from('profiles')
            .update({
              restaurant_id: restaurant.id,
              full_name: full_name.trim(),
              email: normalizedEmail,
              status: status || 'active',
              must_change_password: true
            })
            .eq('user_id', userId);

          if (retryUpdateError) {
            return new Response(JSON.stringify({ error: 'Failed to create staff profile' }), {
              status: 500,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
          }
        } else {
          return new Response(JSON.stringify({ error: 'Failed to create staff profile' }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
      }
    }

    console.log(`Profile created for user ${userId}`);

    // STEP 4: Assign roles
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
        // Continue anyway - role assignment is not critical for the initial creation
      }
    }

    console.log(`Successfully created staff user ${normalizedEmail} (${userId}) for restaurant ${restaurant.id}`);

    return new Response(JSON.stringify({
      success: true,
      user_id: userId,
      message: `Staff member ${full_name} created successfully`,
      temp_password: isNewUser ? tempPassword : null // Only return temp password for new users
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
