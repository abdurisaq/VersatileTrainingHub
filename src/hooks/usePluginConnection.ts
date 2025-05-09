import { useState, useEffect, useCallback } from 'react';

interface UsePluginConnectionOptions {
  port: number;
  scanInterval?: number; // in milliseconds
  authToken?: string; // Add authToken parameter
  onConnect?: () => void;
  onDisconnect?: () => void;
}

interface PluginConnection {
  isConnected: boolean;
  sendTrainingPack: (packData: any) => Promise<boolean>;
  status: 'scanning' | 'connected' | 'disconnected';
  getLocalPacks: () => Promise<Array<{
    id: string;
    name: string;
    numShots: number;
  }> | null>;
}

export function usePluginConnection({
  port,
  scanInterval = 5000,
  authToken, // Add authToken parameter
  onConnect,
  onDisconnect,
}: UsePluginConnectionOptions): PluginConnection {
  const [isConnected, setIsConnected] = useState(false);
  const [status, setStatus] = useState<'scanning' | 'connected' | 'disconnected'>('scanning');

  // Function to check if port is open
  const checkPort = useCallback(async (): Promise<boolean> => {
    try {
      // Try to connect to the port using fetch with a small timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 1000);
      
      // Add headers with auth token if provided
      const headers: HeadersInit = {};
      if (authToken) {
        headers['Authorization'] = `Bearer ${authToken}`;
      }
      
      const response = await fetch(`http://localhost:${port}/status`, {
        method: 'GET',
        headers,
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      return response.ok;
    } catch (error) {
      return false;
    }
  }, [port, authToken]); // Add authToken to dependency array

  const sendTrainingPack = useCallback(async (packData: any): Promise<boolean> => {
  if (!isConnected) return false;

  try {
    // Add headers with auth token if provided
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };
    
    if (authToken) {
      headers['Authorization'] = `Bearer ${authToken}`;
    }
    
    // Use fetch with explicit CORS settings
    const response = await fetch(`http://localhost:${port}/load-pack`, {
      method: 'POST',
      headers,
      body: JSON.stringify(packData),
      mode: 'cors',
      credentials: 'omit', // Important for cross-origin requests
    });
    
    if (response.ok) {
      const text = await response.text();
      console.log("Success response:", text);
      return true;
    } else {
      const errorText = await response.text();
      console.error(`Error ${response.status}: ${errorText}`);
      return false;
    }
  } catch (error) {
    console.error('Error sending training pack to plugin:', error);
    return false;
  }
}, [isConnected, port, authToken]);

  // Rest of your hook implementation remains the same
  useEffect(() => {
    let intervalId: NodeJS.Timeout;
    let mounted = true;

    const scanForPlugin = async () => {
      const portOpen = await checkPort();
      
      if (mounted) {
        if (portOpen && !isConnected) {
          setIsConnected(true);
          setStatus('connected');
          onConnect?.();
        } else if (!portOpen && isConnected) {
          setIsConnected(false);
          setStatus('disconnected');
          onDisconnect?.();
        } else if (!portOpen) {
          setStatus('scanning');
        }
      }
    };

    // Initial check
    scanForPlugin();
    
    // Set up interval for checking
    intervalId = setInterval(scanForPlugin, scanInterval);
    
    return () => {
      mounted = false;
      clearInterval(intervalId);
    };
  }, [checkPort, isConnected, onConnect, onDisconnect, scanInterval]);

  const getLocalPacks = useCallback(async () => {
    if (!isConnected) return null;

    try {
      const headers: HeadersInit = {};
      if (authToken) {
        headers['Authorization'] = `Bearer ${authToken}`;
      }

      const response = await fetch(`http://localhost:${port}/list-packs`, {
        method: 'GET',
        headers,
      });

      if (!response.ok) return null;
      const data = await response.json();
      return data.packs;
    } catch (error) {
      console.error('Error getting local packs:', error);
      return null;
    }
  }, [isConnected, port, authToken]);
  return {
    isConnected,
    sendTrainingPack,
    status,
    getLocalPacks,
  };
}