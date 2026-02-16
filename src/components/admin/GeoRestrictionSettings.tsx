import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { MapPin } from 'lucide-react';
import { MapContainer, TileLayer, Marker, Circle, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix default marker icon
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

export interface GeoSettings {
  geo_enabled: boolean;
  geo_latitude: number | null;
  geo_longitude: number | null;
  geo_radius_meters: number;
}

interface GeoRestrictionSettingsProps {
  settings: GeoSettings;
  onChange: (settings: GeoSettings) => void;
}

function DraggableMarker({
  position,
  onPositionChange,
}: {
  position: [number, number];
  onPositionChange: (lat: number, lng: number) => void;
}) {
  const map = useMap();

  useMapEvents({
    click(e) {
      onPositionChange(e.latlng.lat, e.latlng.lng);
    },
  });

  return (
    <Marker
      position={position}
      draggable
      eventHandlers={{
        dragend: (e) => {
          const marker = e.target;
          const pos = marker.getLatLng();
          onPositionChange(pos.lat, pos.lng);
        },
      }}
    />
  );
}

function MapCenterUpdater({ center }: { center: [number, number] }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, map.getZoom());
  }, [center[0], center[1]]);
  return null;
}

export function GeoRestrictionSettings({ settings, onChange }: GeoRestrictionSettingsProps) {
  const [mapCenter, setMapCenter] = useState<[number, number]>([
    settings.geo_latitude || 11.5564,
    settings.geo_longitude || 104.9282,
  ]);
  const [hasRequestedLocation, setHasRequestedLocation] = useState(false);

  // Request browser location if no saved coordinates
  useEffect(() => {
    if (!settings.geo_latitude && !settings.geo_longitude && !hasRequestedLocation && settings.geo_enabled) {
      setHasRequestedLocation(true);
      navigator.geolocation?.getCurrentPosition(
        (pos) => {
          const lat = pos.coords.latitude;
          const lng = pos.coords.longitude;
          setMapCenter([lat, lng]);
          onChange({ ...settings, geo_latitude: lat, geo_longitude: lng });
        },
        () => {
          // Fallback: Cambodia center
          setMapCenter([11.5564, 104.9282]);
        },
        { enableHighAccuracy: true, timeout: 5000 }
      );
    }
  }, [settings.geo_enabled]);

  const handlePositionChange = useCallback(
    (lat: number, lng: number) => {
      const roundedLat = Math.round(lat * 1000000) / 1000000;
      const roundedLng = Math.round(lng * 1000000) / 1000000;
      setMapCenter([roundedLat, roundedLng]);
      onChange({ ...settings, geo_latitude: roundedLat, geo_longitude: roundedLng });
    },
    [settings, onChange]
  );

  const handleRadiusChange = (value: string) => {
    const num = parseInt(value) || 100;
    const clamped = Math.max(20, Math.min(1000, num));
    onChange({ ...settings, geo_radius_meters: clamped });
  };

  const markerPosition: [number, number] = [
    settings.geo_latitude || mapCenter[0],
    settings.geo_longitude || mapCenter[1],
  ];

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <MapPin className="h-5 w-5 text-primary" />
          <CardTitle>Location & Access Control</CardTitle>
        </div>
        <CardDescription>
          Restrict customer access based on their physical location
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Toggle */}
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label>Enable Location Restriction</Label>
            <p className="text-sm text-muted-foreground">
              Customers must be within the defined area to access your menu
            </p>
          </div>
          <Switch
            checked={settings.geo_enabled}
            onCheckedChange={(checked) => onChange({ ...settings, geo_enabled: checked })}
          />
        </div>

        {/* Map & Config (shown only when enabled) */}
        {settings.geo_enabled && (
          <div className="space-y-4 pt-2">
            {/* Map */}
            <div className="rounded-lg overflow-hidden border" style={{ height: 350 }}>
              <MapContainer
                center={mapCenter}
                zoom={16}
                style={{ height: '100%', width: '100%' }}
                scrollWheelZoom
              >
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                <MapCenterUpdater center={mapCenter} />
                <DraggableMarker
                  position={markerPosition}
                  onPositionChange={handlePositionChange}
                />
                <Circle
                  center={markerPosition}
                  radius={settings.geo_radius_meters}
                  pathOptions={{
                    color: 'hsl(var(--primary))',
                    fillColor: 'hsl(var(--primary))',
                    fillOpacity: 0.15,
                    weight: 2,
                  }}
                />
              </MapContainer>
            </div>

            <p className="text-xs text-muted-foreground">
              Click on the map or drag the marker to set your shop location.
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
          </div>
        )}
      </CardContent>
    </Card>
  );
}
