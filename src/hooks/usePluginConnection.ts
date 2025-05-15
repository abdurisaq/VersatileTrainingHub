import { useState, useEffect, useCallback } from 'react';

interface LocalPack {
  id: string;
  name: string;
  numShots: number;
}

interface UsePluginConnectionOptions {
  port: number;
  scanInterval?: number; // in ms
  authToken?: string;
  onConnect?: () => void;
  onDisconnect?: () => void;
}

interface PluginConnection {
  isConnected: boolean;
  sendTrainingPack: (packData: Record<string, unknown>) => Promise<boolean>;
  status: 'scanning' | 'connected' | 'disconnected';
  getLocalPacks: () => Promise<LocalPack[] | null>;
}

export function usePluginConnection({
  port,
  scanInterval = 5000,
  authToken,
  onConnect,
  onDisconnect,
}: UsePluginConnectionOptions): PluginConnection {
  const [isConnected, setIsConnected] = useState(false);
  const [status, setStatus] = useState<'scanning' | 'connected' | 'disconnected'>('scanning');

  // check if port open
  const checkPort = useCallback(async (): Promise<boolean> => {
    try {
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 1000);
      
      const headers: HeadersInit = {};
      if (authToken) {
        headers.Authorization = `Bearer ${authToken}`;
      }
      
      const response = await fetch(`http://localhost:${port}/status`, {
        method: 'GET',
        headers,
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      return response.ok;
    } catch  {
      return false;
    }
  }, [port, authToken]);

  const sendTrainingPack = useCallback(async (packData: Record<string, unknown>): Promise<boolean> => {
    if (!isConnected) return false;

    try {
      
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
      };
      
      if (authToken) {
        headers.Authorization = `Bearer ${authToken}`;
      }
      
      
      const response = await fetch(`http://localhost:${port}/load-pack`, {
        method: 'POST',
        headers,
        body: JSON.stringify(packData),
        mode: 'cors',
        credentials: 'omit', 
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

  useEffect(() => {
    const intervalId = setInterval(() => {
      void scanForPlugin();
    }, scanInterval);
    
    let mounted = true;

    const scanForPlugin = async (): Promise<void> => {
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

    void scanForPlugin();
    
    return () => {
      mounted = false;
      clearInterval(intervalId);
    };
  }, [checkPort, isConnected, onConnect, onDisconnect, scanInterval]);

  const getLocalPacks = useCallback(async (): Promise<LocalPack[] | null> => {
    if (!isConnected) return null;

    try {
      const headers: HeadersInit = {};
      if (authToken) {
        headers.Authorization = `Bearer ${authToken}`;
      }

      const response = await fetch(`http://localhost:${port}/list-packs`, {
        method: 'GET',
        headers,
      });

      if (!response.ok) return null;
      
      const data = await response.json() as { packs: LocalPack[] };
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