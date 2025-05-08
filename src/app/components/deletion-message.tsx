"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";

export function DeletionMessage() {
  const searchParams = useSearchParams();
  const [showDeletedMessage, setShowDeletedMessage] = useState(false);
  
  useEffect(() => {
    if (searchParams.get('deleted') === 'true') {
      setShowDeletedMessage(true);
      
      // Auto-hide message after 5 seconds
      const timer = setTimeout(() => {
        setShowDeletedMessage(false);
      }, 5000);
      
      return () => clearTimeout(timer);
    }
  }, [searchParams]);

  if (!showDeletedMessage) return null;

  return (
    <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-6 relative">
      <span className="block sm:inline">Your account has been successfully deleted.</span>
      <button 
        className="absolute top-0 bottom-0 right-0 px-4"
        onClick={() => setShowDeletedMessage(false)}
      >
        &times;
      </button>
    </div>
  );
}