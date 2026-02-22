import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Wifi, Loader2, Globe } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface WiFiSettings {
  allowed_public_ips: string | null;
}

interface WiFiRestrictionSettingsProps {
  settings: WiFiSettings;
  onChange: (settings: WiFiSettings) => void;
}

// Simple IP format validation (IPv4 and IPv6)
function isValidIp(ip: string): boolean {
  const trimmed = ip.trim();
  // IPv4
  const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
  if (ipv4Regex.test(trimmed)) {
    return trimmed.split('.').every(p => parseInt(p) >= 0 && parseInt(p) <= 255);
  }
  // IPv6 (simplified check)
  const ipv6Regex = /^([0-9a-fA-F]{0,4}:){2,7}[0-9a-fA-F]{0,4}$/;
  if (ipv6Regex.test(trimmed)) return true;
  // ::1 shorthand
  if (trimmed === '::1') return true;
  return false;
}

export function WiFiRestrictionSettings({ settings, onChange }: WiFiRestrictionSettingsProps) {
  const [detecting, setDetecting] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  const handleIpChange = (value: string) => {
    onChange({ ...settings, allowed_public_ips: value || null });
    
    // Validate
    if (!value.trim()) {
      setValidationError(null);
      return;
    }
    
    const ips = value.split(',').map(ip => ip.trim()).filter(Boolean);
    const invalidIps = ips.filter(ip => !isValidIp(ip));
    
    if (invalidIps.length > 0) {
      setValidationError(`Invalid IP format: ${invalidIps.join(', ')}`);
    } else {
      setValidationError(null);
    }
  };

  const detectCurrentIp = async () => {
    setDetecting(true);
    try {
      const { data, error } = await supabase.functions.invoke('detect-ip');
      
      if (error) throw error;
      
      const detectedIp = data?.ip;
      if (!detectedIp || detectedIp === 'unknown') {
        toast.error('Could not detect your public IP address');
        return;
      }

      // Append to existing IPs or set as new
      const currentIps = settings.allowed_public_ips?.trim() || '';
      const existingIps = currentIps.split(',').map(ip => ip.trim()).filter(Boolean);
      
      if (existingIps.includes(detectedIp)) {
        toast.info(`IP ${detectedIp} is already in the list`);
        return;
      }

      const newValue = existingIps.length > 0 
        ? `${currentIps}, ${detectedIp}` 
        : detectedIp;

      onChange({ ...settings, allowed_public_ips: newValue });
      setValidationError(null);
      toast.success(`Detected IP: ${detectedIp}`);
    } catch (err: any) {
      console.error('Failed to detect IP:', err);
      toast.error('Failed to detect IP. Please enter it manually.');
    } finally {
      setDetecting(false);
    }
  };

  const isConfigured = settings.allowed_public_ips && settings.allowed_public_ips.trim() !== '';

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Wifi className="h-4 w-4 text-primary" />
          <CardTitle className="text-lg font-medium">WiFi Access Restriction</CardTitle>
        </div>
        <CardDescription>
          Only customers connected to your shop's WiFi network can access the ordering page.
          This is <span className="font-medium text-foreground">required</span> before generating QR codes.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* IP Input */}
        <div className="space-y-2">
          <Label htmlFor="allowed_ips">Allowed Public IP Addresses</Label>
          <div className="flex gap-2">
            <Input
              id="allowed_ips"
              value={settings.allowed_public_ips || ''}
              onChange={(e) => handleIpChange(e.target.value)}
              placeholder="e.g., 103.21.44.55, 103.21.44.56"
              className={validationError ? 'border-destructive' : ''}
            />
            <Button
              type="button"
              variant="outline"
              onClick={detectCurrentIp}
              disabled={detecting}
              className="shrink-0 gap-2"
            >
              {detecting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Globe className="h-4 w-4" />
              )}
              Detect IP
            </Button>
          </div>
          {validationError && (
            <p className="text-xs text-destructive">{validationError}</p>
          )}
          <p className="text-xs text-muted-foreground">
            Enter your shop's public IP address. Support multiple IPs separated by commas.
            Click "Detect IP" to automatically detect your current network's public IP.
          </p>
        </div>

        {/* Helper info */}
        <div className="rounded-md bg-muted/50 p-3 space-y-1">
          <p className="text-xs font-medium">How it works:</p>
          <ul className="text-xs text-muted-foreground space-y-0.5 list-disc list-inside">
            <li>Customers must be connected to your shop's WiFi to access the menu</li>
            <li>If your ISP changes your IP, click "Detect IP" to update it</li>
            <li>For multiple routers, add all public IPs separated by commas</li>
            <li>Orders are also validated server-side to prevent bypass</li>
          </ul>
        </div>

        {!isConfigured && (
          <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
            ⚠️ You must set at least one allowed IP address before QR codes can be generated.
          </div>
        )}
      </CardContent>
    </Card>
  );
}
