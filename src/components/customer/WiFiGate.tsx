import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Wifi, RefreshCw, ShieldAlert, Loader2 } from 'lucide-react';

interface WiFiGateProps {
  shopId: string;
  children: React.ReactNode;
}

type GateState =
  | { status: 'loading' }
  | { status: 'allowed' }
  | { status: 'denied_ip'; clientIp: string }
  | { status: 'shop_not_configured' }
  | { status: 'error'; message: string };

export function WiFiGate({ shopId, children }: WiFiGateProps) {
  const [state, setState] = useState<GateState>({ status: 'loading' });

  const checkAccess = async () => {
    setState({ status: 'loading' });

    try {
      const { data, error } = await supabase.functions.invoke('validate-shop-ip', {
        body: { shop_id: shopId },
      });

      if (error) {
        setState({ status: 'error', message: 'Unable to verify access. Please try again.' });
        return;
      }

      if (data.allowed) {
        setState({ status: 'allowed' });
      } else if (data.reason === 'shop_not_configured') {
        setState({ status: 'shop_not_configured' });
      } else if (data.reason === 'shop_not_found') {
        setState({ status: 'error', message: 'Shop not found.' });
      } else {
        setState({ status: 'denied_ip', clientIp: data.client_ip || 'unknown' });
      }
    } catch (err) {
      setState({ status: 'error', message: 'Something went wrong. Please try again.' });
    }
  };

  useEffect(() => {
    checkAccess();
  }, [shopId]);

  if (state.status === 'loading') {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen px-6 text-center gap-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-muted-foreground">Verifying network access...</p>
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
          <h1 className="text-xl font-bold">Shop Not Configured</h1>
          <p className="text-muted-foreground max-w-sm">
            This shop has not configured WiFi access yet. Please contact the shop owner.
          </p>
        </div>
      </div>
    );
  }

  if (state.status === 'denied_ip') {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen px-6 text-center gap-6">
        <div className="rounded-full bg-destructive/10 p-4">
          <Wifi className="h-10 w-10 text-destructive" />
        </div>
        <div className="space-y-2">
          <h1 className="text-xl font-bold">Connect to Shop WiFi</h1>
          <p className="text-muted-foreground max-w-sm">
            You must connect to the shop's WiFi network to access the ordering page.
          </p>
          <p className="text-sm text-muted-foreground">
            Please connect to the shop's WiFi and try again.
          </p>
        </div>
        <Button onClick={checkAccess} className="gap-2">
          <RefreshCw className="h-4 w-4" />
          Refresh
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
        <h1 className="text-xl font-bold">Access Error</h1>
        <p className="text-muted-foreground max-w-sm">
          {state.status === 'error' ? state.message : 'An error occurred.'}
        </p>
      </div>
      <Button onClick={checkAccess} variant="outline" className="gap-2">
        <RefreshCw className="h-4 w-4" />
        Retry
      </Button>
    </div>
  );
}
