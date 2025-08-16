import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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
    const { email, adminSecret } = await req.json();

    // Verify admin secret
    const expectedSecret = Deno.env.get('ADMIN_DELETE_SECRET');
    if (!expectedSecret || adminSecret !== expectedSecret) {
      console.error('Invalid admin secret provided');
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!email) {
      return new Response(JSON.stringify({ error: 'Email is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Create Supabase admin client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    console.log(`Starting deletion process for user: ${email}`);

    // First, find the auth user by email
    const { data: users, error: getUserError } = await supabaseAdmin.auth.admin.listUsers();
    
    if (getUserError) {
      console.error('Error fetching users:', getUserError);
      return new Response(JSON.stringify({ error: 'Failed to fetch users' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const userToDelete = users.users.find(user => user.email === email);
    
    if (!userToDelete) {
      console.log(`User with email ${email} not found`);
      return new Response(JSON.stringify({ error: 'User not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const userId = userToDelete.id;
    console.log(`Found user with ID: ${userId}`);

    // Delete related data in the correct order (to respect foreign key constraints)
    
    // 1. Delete order items first (they reference orders)
    const { error: orderItemsError } = await supabaseAdmin
      .from('order_items')
      .delete()
      .in('order_id', 
        supabaseAdmin
          .from('orders')
          .select('id')
          .in('restaurant_id',
            supabaseAdmin
              .from('restaurants')
              .select('id')
              .eq('owner_id', userId)
          )
      );

    if (orderItemsError) {
      console.error('Error deleting order items:', orderItemsError);
    } else {
      console.log('Successfully deleted order items');
    }

    // 2. Delete orders
    const { error: ordersError } = await supabaseAdmin
      .from('orders')
      .delete()
      .in('restaurant_id',
        supabaseAdmin
          .from('restaurants')
          .select('id')
          .eq('owner_id', userId)
      );

    if (ordersError) {
      console.error('Error deleting orders:', ordersError);
    } else {
      console.log('Successfully deleted orders');
    }

    // 3. Delete menu items
    const { error: menuItemsError } = await supabaseAdmin
      .from('menu_items')
      .delete()
      .in('restaurant_id',
        supabaseAdmin
          .from('restaurants')
          .select('id')
          .eq('owner_id', userId)
      );

    if (menuItemsError) {
      console.error('Error deleting menu items:', menuItemsError);
    } else {
      console.log('Successfully deleted menu items');
    }

    // 4. Delete menu categories
    const { error: categoriesError } = await supabaseAdmin
      .from('menu_categories')
      .delete()
      .in('restaurant_id',
        supabaseAdmin
          .from('restaurants')
          .select('id')
          .eq('owner_id', userId)
      );

    if (categoriesError) {
      console.error('Error deleting menu categories:', categoriesError);
    } else {
      console.log('Successfully deleted menu categories');
    }

    // 5. Delete tables
    const { error: tablesError } = await supabaseAdmin
      .from('tables')
      .delete()
      .in('restaurant_id',
        supabaseAdmin
          .from('restaurants')
          .select('id')
          .eq('owner_id', userId)
      );

    if (tablesError) {
      console.error('Error deleting tables:', tablesError);
    } else {
      console.log('Successfully deleted tables');
    }

    // 6. Delete restaurants
    const { error: restaurantsError } = await supabaseAdmin
      .from('restaurants')
      .delete()
      .eq('owner_id', userId);

    if (restaurantsError) {
      console.error('Error deleting restaurants:', restaurantsError);
    } else {
      console.log('Successfully deleted restaurants');
    }

    // 7. Delete profiles
    const { error: profilesError } = await supabaseAdmin
      .from('profiles')
      .delete()
      .eq('user_id', userId);

    if (profilesError) {
      console.error('Error deleting profiles:', profilesError);
    } else {
      console.log('Successfully deleted profiles');
    }

    // 8. Finally, delete the auth user (this will cascade delete any remaining references)
    const { error: deleteUserError } = await supabaseAdmin.auth.admin.deleteUser(userId);

    if (deleteUserError) {
      console.error('Error deleting auth user:', deleteUserError);
      return new Response(JSON.stringify({ error: 'Failed to delete auth user' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Successfully deleted user ${email} and all related data`);

    return new Response(JSON.stringify({ 
      success: true, 
      message: `User ${email} and all related data have been deleted successfully` 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in admin-delete-user function:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});