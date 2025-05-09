"use client";

import { useState } from 'react';
import { usePluginConnection } from '~/hooks/usePluginConnection';

interface PluginConnectionIndicatorProps {
  port?: number;
}

export function PluginConnectionIndicator({ port = 7437 }: PluginConnectionIndicatorProps) {
  const [showInfo, setShowInfo] = useState(false);
  
  const { status } = usePluginConnection({
    port,
    authToken: "versatile_training_scanner_token",
    onConnect: () => {
      console.log('Plugin connected!');
    },
    onDisconnect: () => {
      console.log('Plugin disconnected!');
    }
  });

  const getStatusColor = () => {
    switch (status) {
      case 'connected': return 'bg-green-500';
      case 'scanning': return 'bg-yellow-500';
      case 'disconnected': return 'bg-red-500';
    }
  };

  const getStatusText = () => {
    switch (status) {
      case 'connected': return 'Plugin connected';
      case 'scanning': return 'Searching for plugin...';
      case 'disconnected': return 'Plugin not detected';
    }
  };

  return (
    <div 
      className="fixed bottom-4 right-4 z-50 flex items-center"
      onMouseEnter={() => setShowInfo(true)}
      onMouseLeave={() => setShowInfo(false)}
    >
      <div className={`relative flex items-center gap-2 rounded-full px-3 py-1.5 ${status === 'connected' ? 'bg-green-100' : 'bg-gray-100'}`}>
        <div className={`h-3 w-3 rounded-full ${getStatusColor()}`}></div>
        {showInfo && (
          <span className="text-sm font-medium">{getStatusText()}</span>
        )}
      </div>
    </div>
  );
}