import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { MapPin, RefreshCw, ShieldAlert, Loader2 } from 'lucide-react';

interface GeoGateProps {
  shopId: string;
  children: React.ReactNode;
}

type GeoState =
  | { status: 'loading' }
  | { status: 'allowed' }
  | { status: 'denied_permission' }
  | { status: 'denied_outside'; distance: number; radius: number }
  | { status: 'shop_not_configured' }
  | { status: 'error'; message: string };

export function GeoGate({ shopId, children }: GeoGateProps) {
  const [state, setState] = useState<GeoState>({ status: 'loading' });

  const checkGeo = async () => {
    setState({ status: 'loading' });

    try {
      // Step 1: Get shop geo config
      const { data: geoConfig, error: geoErr } = await supabase.rpc('get_shop_geo_config', {
        p_shop_id: shopId,
      });

      if (geoErr || !geoConfig || geoConfig.length === 0) {
        setState({ status: 'shop_not_configured' });
        return;
      }

      const config = geoConfig[0];

      // If shop has no coordinates, block access
      if (!config.geo_latitude || !config.geo_longitude) {
        setState({ status: 'shop_not_configured' });
        return;
      }

      // Step 2: Request GPS
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 30000,
        });
      }).catch((err) => {
        if (err.code === err.PERMISSION_DENIED) {
          setState({ status: 'denied_permission' });
        } else {
          setState({ status: 'error', message: 'Unable to get your location. Please enable GPS.' });
        }
        return null;
      });

      if (!position) return;

      // Step 3: Backend validation
      const { data: result, error: valErr } = await supabase.rpc('validate_customer_geo', {
        p_shop_id: shopId,
        p_user_latitude: position.coords.latitude,
        p_user_longitude: position.coords.longitude,
      });

      if (valErr) {
        setState({ status: 'error', message: 'Location verification failed. Please try again.' });
        return;
      }

      const validation = result as any;
      if (validation.allowed) {
        setState({ status: 'allowed' });
      } else if (validation.reason === 'shop_not_configured') {
        setState({ status: 'shop_not_configured' });
      } else {
        setState({
          status: 'denied_outside',
          distance: validation.distance || 0,
          radius: validation.radius || 0,
        });
      }
    } catch (err) {
      setState({ status: 'error', message: 'Something went wrong. Please try again.' });
    }
  };

  useEffect(() => {
    checkGeo();
  }, [shopId]);

  if (state.status === 'loading') {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen px-6 text-center gap-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-muted-foreground">Verifying your location...</p>
      </div>
    );
  }

  if (state.status === 'allowed') {
    return <>{children}</>;
  }

  if (state.status === 'shop_not_configured') {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen px-6 text-center gap-6">
        <div className="rounded-full bg-destructive/10 p-4">
          <ShieldAlert className="h-10 w-10 text-destructive" />
        </div>
        <div className="space-y-2">
          <h1 className="text-xl font-bold">Shop Location Not Configured</h1>
          <p className="text-muted-foreground max-w-sm">
            This shop has not configured its location yet. Please contact the shop owner.
          </p>
        </div>
      </div>
    );
  }

  if (state.status === 'denied_permission') {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen px-6 text-center gap-6">
        <div className="rounded-full bg-destructive/10 p-4">
          <MapPin className="h-10 w-10 text-destructive" />
        </div>
        <div className="space-y-2">
          <h1 className="text-xl font-bold">Location Permission Required</h1>
          <p className="text-muted-foreground max-w-sm">
            This shop requires location access to verify you are within the ordering area.
            Please enable location permissions in your browser settings.
          </p>
        </div>
        <Button onClick={checkGeo} className="gap-2">
          <RefreshCw className="h-4 w-4" />
          Retry
        </Button>
      </div>
    );
  }

  if (state.status === 'denied_outside') {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen px-6 text-center gap-6">
        <div className="rounded-full bg-destructive/10 p-4">
          <ShieldAlert className="h-10 w-10 text-destructive" />
        </div>
        <div className="space-y-2">
          <h1 className="text-xl font-bold">Outside Ordering Area</h1>
          <p className="text-muted-foreground max-w-sm">
            You are outside the allowed ordering area for this shop.
          </p>
          <p className="text-sm text-muted-foreground">
            Allowed radius: <span className="font-medium">{state.radius}m</span>
            {' · '}
            Your distance: <span className="font-medium">~{state.distance}m</span>
          </p>
        </div>
        <Button onClick={checkGeo} variant="outline" className="gap-2">
          <RefreshCw className="h-4 w-4" />
          Retry
        </Button>
      </div>
    );
  }

  // Error state
  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-6 text-center gap-6">
      <div className="rounded-full bg-destructive/10 p-4">
        <ShieldAlert className="h-10 w-10 text-destructive" />
      </div>
      <div className="space-y-2">
        <h1 className="text-xl font-bold">Location Error</h1>
        <p className="text-muted-foreground max-w-sm">
          {state.status === 'error' ? state.message : 'An error occurred.'}
        </p>
      </div>
      <Button onClick={checkGeo} variant="outline" className="gap-2">
        <RefreshCw className="h-4 w-4" />
        Retry
      </Button>
    </div>
  );
}
