import { useState, useCallback, lazy, Suspense } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { MapPin, Loader2 } from 'lucide-react';

const GoogleMapsLocationPicker = lazy(() => import('./GoogleMapsLocationPicker'));

export interface GeoSettings {
  geo_latitude: number | null;
  geo_longitude: number | null;
  geo_radius_meters: number;
}

interface GeoRestrictionSettingsProps {
  settings: GeoSettings;
  onChange: (settings: GeoSettings) => void;
}

export function GeoRestrictionSettings({ settings, onChange }: GeoRestrictionSettingsProps) {
  const handlePositionChange = useCallback(
    (lat: number, lng: number) => {
      onChange({ ...settings, geo_latitude: lat, geo_longitude: lng });
    },
    [settings, onChange]
  );

  const handleRadiusChange = (value: string) => {
    const num = parseInt(value) || 100;
    const clamped = Math.max(20, Math.min(1000, num));
    onChange({ ...settings, geo_radius_meters: clamped });
  };

  const isConfigured = settings.geo_latitude !== null && settings.geo_longitude !== null;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <MapPin className="h-4 w-4 text-primary" />
          <CardTitle className="text-lg font-medium">Shop Location</CardTitle>
        </div>
        <CardDescription>
          Set your shop's location on the map. Customers must be within the allowed radius to access your menu.
          This is <span className="font-medium text-foreground">required</span> before generating QR codes.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Map */}
        <Suspense
          fallback={
            <div className="rounded-lg border flex items-center justify-center" style={{ height: 350 }}>
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          }
        >
          <GoogleMapsLocationPicker
            latitude={settings.geo_latitude}
            longitude={settings.geo_longitude}
            radius={settings.geo_radius_meters}
            onPositionChange={handlePositionChange}
          />
        </Suspense>

        <p className="text-xs text-muted-foreground">
          Click on the map, drag the marker, or search for an address to set your shop location.
        </p>

        {/* Coordinates display */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Latitude</Label>
            <Input value={settings.geo_latitude?.toString() || ''} readOnly className="text-xs bg-muted" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Longitude</Label>
            <Input value={settings.geo_longitude?.toString() || ''} readOnly className="text-xs bg-muted" />
          </div>
        </div>

        {/* Radius */}
        <div className="space-y-2">
          <Label htmlFor="geo_radius">Allowed Radius (meters)</Label>
          <div className="flex items-center gap-2">
            <Input
              id="geo_radius"
              type="number"
              min={20}
              max={1000}
              value={settings.geo_radius_meters}
              onChange={(e) => handleRadiusChange(e.target.value)}
              className="w-32"
            />
            <span className="text-sm text-muted-foreground">meters</span>
          </div>
          <p className="text-xs text-muted-foreground">
            Min: 20m, Max: 1000m. A 20m tolerance is automatically added.
          </p>
        </div>

        {!isConfigured && (
          <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
            ⚠️ You must set a location before QR codes can be generated.
          </div>
        )}
      </CardContent> 
    </Card>
  );
}
