import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

function getClientIp(req: Request): string {
  const forwarded = req.headers.get('x-forwarded-for');
  const realIp = req.headers.get('x-real-ip');
  if (forwarded) return forwarded.split(',')[0].trim();
  if (realIp) return realIp.trim();
  return 'unknown';
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { order_id, device_id, shop_id } = await req.json();

    if (!order_id || !device_id || !shop_id) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing required fields' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    const clientIp = getClientIp(req);
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Step 1: Validate IP against shop's allowed IPs
    const { data: ipData, error: ipError } = await supabase.rpc('get_shop_allowed_ips', {
      p_shop_id: shop_id,
    });

    if (ipError || !ipData || ipData.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: 'Shop not found' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    const allowedIpsRaw = ipData[0].allowed_public_ips;

    if (!allowedIpsRaw || allowedIpsRaw.trim() === '') {
      return new Response(
        JSON.stringify({ success: false, error: 'Shop WiFi not configured. Cannot place order.' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    const allowedIps = allowedIpsRaw.split(',').map((ip: string) => ip.trim()).filter(Boolean);

    if (!allowedIps.includes(clientIp)) {
      console.log(`Order blocked: IP ${clientIp} not in allowed list for shop ${shop_id}`);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'You must be connected to the shop WiFi to place an order.',
          reason: 'ip_mismatch',
          client_ip: clientIp,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    // Step 2: IP is valid, proceed to place order via RPC
    const { data: result, error: placeError } = await supabase.rpc('place_device_order', {
      p_order_id: order_id,
      p_device_id: device_id,
    });

    if (placeError) {
      return new Response(
        JSON.stringify({ success: false, error: placeError.message }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );
  } catch (error) {
    console.error('place-order-secure error:', error);
    return new Response(
      JSON.stringify({ success: false, error: 'Server error' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
