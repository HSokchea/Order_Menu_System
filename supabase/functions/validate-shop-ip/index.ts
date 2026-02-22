import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

function getClientIp(req: Request): string {
  const forwarded = req.headers.get('x-forwarded-for');
  const realIp = req.headers.get('x-real-ip');
  
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  if (realIp) {
    return realIp.trim();
  }
  return 'unknown';
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { shop_id } = await req.json();

    if (!shop_id) {
      return new Response(
        JSON.stringify({ allowed: false, reason: 'missing_shop_id' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    const clientIp = getClientIp(req);

    // Create Supabase client with service role to bypass RLS
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get shop's allowed IPs
    const { data, error } = await supabase.rpc('get_shop_allowed_ips', {
      p_shop_id: shop_id,
    });

    if (error || !data || data.length === 0) {
      return new Response(
        JSON.stringify({ allowed: false, reason: 'shop_not_found' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    const allowedIpsRaw = data[0].allowed_public_ips;

    // If shop has not configured IPs, block access
    if (!allowedIpsRaw || allowedIpsRaw.trim() === '') {
      return new Response(
        JSON.stringify({ allowed: false, reason: 'shop_not_configured', client_ip: clientIp }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    // Parse allowed IPs (comma-separated, trim whitespace)
    const allowedIps = allowedIpsRaw.split(',').map((ip: string) => ip.trim()).filter(Boolean);

    // Check if client IP is in allowed list
    const isAllowed = allowedIps.includes(clientIp);

    return new Response(
      JSON.stringify({
        allowed: isAllowed,
        reason: isAllowed ? 'ip_match' : 'ip_mismatch',
        client_ip: clientIp,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );
  } catch (error) {
    console.error('validate-shop-ip error:', error);
    return new Response(
      JSON.stringify({ allowed: false, reason: 'server_error' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
