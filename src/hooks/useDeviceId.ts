import { useState, useEffect } from 'react';

const DEVICE_ID_KEY = 'device_id';

/**
 * Generates a unique device ID using crypto API or fallback
 */
const generateDeviceId = (): string => {
  // Use crypto.randomUUID if available (modern browsers)
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  
  // Fallback: Generate a UUID-like string
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};

/**
 * Hook to manage persistent device identification
 * Creates and stores a unique device ID in localStorage
 */
export const useDeviceId = () => {
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    // Try to get existing device ID from localStorage
    let storedDeviceId = localStorage.getItem(DEVICE_ID_KEY);
    
    // If no device ID exists, generate and store one
    if (!storedDeviceId) {
      storedDeviceId = generateDeviceId();
      localStorage.setItem(DEVICE_ID_KEY, storedDeviceId);
    }
    
    setDeviceId(storedDeviceId);
    setIsLoaded(true);
  }, []);

  return {
    deviceId,
    isLoaded,
  };
};
