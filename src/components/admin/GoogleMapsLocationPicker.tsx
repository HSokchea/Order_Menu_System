/// <reference types="google.maps" />
import { useEffect, useRef, useState, useCallback } from 'react';
import { Input } from "@/components/ui/input";

const GOOGLE_MAPS_API_KEY = 'AIzaSyBNuDpBD1LgUWg6ItHJkc1nOGWDQUftvFk';

interface GoogleMapsLocationPickerProps {
  latitude: number | null;
  longitude: number | null;
  radius: number;
  onPositionChange: (lat: number, lng: number) => void;
}

// Load Google Maps script once
let googleMapsPromise: Promise<void> | null = null;
function loadGoogleMaps(): Promise<void> {
  if (googleMapsPromise) return googleMapsPromise;
  if ((window as any).google?.maps?.Map) return Promise.resolve();
  
  googleMapsPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}&libraries=places`;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load Google Maps'));
    document.head.appendChild(script);
  });
  return googleMapsPromise;
}

export default function GoogleMapsLocationPicker({
  latitude,
  longitude,
  radius,
  onPositionChange,
}: GoogleMapsLocationPickerProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const mapInstance = useRef<google.maps.Map | null>(null);
  const markerRef = useRef<google.maps.marker.AdvancedMarkerElement | null>(null);
  const circleRef = useRef<google.maps.Circle | null>(null);
  const [loaded, setLoaded] = useState(false);

  const defaultCenter = { lat: 11.5564, lng: 104.9282 }; // Phnom Penh fallback

  const updateMarkerPosition = useCallback((lat: number, lng: number) => {
    const roundedLat = Math.round(lat * 1000000) / 1000000;
    const roundedLng = Math.round(lng * 1000000) / 1000000;
    
    if (markerRef.current) {
      markerRef.current.position = { lat: roundedLat, lng: roundedLng };
    }
    if (circleRef.current) {
      circleRef.current.setCenter({ lat: roundedLat, lng: roundedLng });
    }
    
    onPositionChange(roundedLat, roundedLng);
  }, [onPositionChange]);

  // Initialize map
  useEffect(() => {
    let cancelled = false;

    loadGoogleMaps().then(async () => {
      if (cancelled || !mapRef.current) return;

      // Import marker library
      const { AdvancedMarkerElement } = await google.maps.importLibrary("marker") as google.maps.MarkerLibrary;
      
      const center = latitude && longitude
        ? { lat: latitude, lng: longitude }
        : defaultCenter;

      const map = new google.maps.Map(mapRef.current, {
        center,
        zoom: 16,
        mapId: 'location-picker',
        disableDefaultUI: false,
        zoomControl: true,
        streetViewControl: false,
        mapTypeControl: false,
        fullscreenControl: false,
      });
      mapInstance.current = map;

      // Draggable marker
      const marker = new AdvancedMarkerElement({
        map,
        position: center,
        gmpDraggable: true,
        title: 'Shop Location',
      });
      markerRef.current = marker;

      // Radius circle
      const circle = new google.maps.Circle({
        map,
        center,
        radius,
        strokeColor: 'hsl(221, 83%, 53%)',
        strokeOpacity: 0.8,
        strokeWeight: 2,
        fillColor: 'hsl(221, 83%, 53%)',
        fillOpacity: 0.15,
      });
      circleRef.current = circle;

      // Marker drag event
      marker.addListener('dragend', () => {
        const pos = marker.position;
        if (pos) {
          const lat = typeof pos.lat === 'function' ? pos.lat() : pos.lat;
          const lng = typeof pos.lng === 'function' ? pos.lng() : pos.lng;
          updateMarkerPosition(lat as number, lng as number);
          map.panTo({ lat: lat as number, lng: lng as number });
        }
      });

      // Click on map to move marker
      map.addListener('click', (e: google.maps.MapMouseEvent) => {
        if (e.latLng) {
          updateMarkerPosition(e.latLng.lat(), e.latLng.lng());
          map.panTo(e.latLng);
        }
      });

      // Places Autocomplete
      if (searchRef.current) {
        const autocomplete = new google.maps.places.Autocomplete(searchRef.current, {
          fields: ['geometry', 'name'],
        });
        autocomplete.bindTo('bounds', map);
        
        autocomplete.addListener('place_changed', () => {
          const place = autocomplete.getPlace();
          if (place.geometry?.location) {
            const lat = place.geometry.location.lat();
            const lng = place.geometry.location.lng();
            map.setCenter({ lat, lng });
            map.setZoom(17);
            updateMarkerPosition(lat, lng);
          }
        });
      }

      // If no saved location, request browser location
      if (!latitude && !longitude) {
        navigator.geolocation?.getCurrentPosition(
          (pos) => {
            if (cancelled) return;
            const lat = pos.coords.latitude;
            const lng = pos.coords.longitude;
            map.setCenter({ lat, lng });
            updateMarkerPosition(lat, lng);
          },
          () => {
            // Use default center (Phnom Penh)
          },
          { enableHighAccuracy: true, timeout: 5000 }
        );
      }

      setLoaded(true);
    });

    return () => { cancelled = true; };
  }, []); // Only init once

  // Update circle radius when it changes
  useEffect(() => {
    if (circleRef.current) {
      circleRef.current.setRadius(radius);
    }
  }, [radius]);

  return (
    <div className="space-y-3">
      {/* Search input */}
      <Input
        ref={searchRef}
        type="text"
        placeholder="Search for an address or place..."
        className="flex h-10 w-full rounded-md border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground"
      />
      {/* Map container */}
      <div
        ref={mapRef}
        className="rounded-lg overflow-hidden border"
        style={{ height: 350, width: '100%' }}
      />
    </div>
  );
}
