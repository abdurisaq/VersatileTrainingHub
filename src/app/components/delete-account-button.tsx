"use client";

import { useState } from "react";
import { signOut } from "next-auth/react";
import { useRouter } from "next/navigation";


//response
interface DeleteAccountResponse {
  error?: string;
  success?: boolean;
}

export function DeleteAccountButton({ userId }: { userId: string }) {
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  const handleDeleteRequest = () => {
    setShowConfirmation(true);
  };

  const handleCancelDelete = () => {
    setShowConfirmation(false);
  };

  const handleConfirmDelete = async () => {
    setIsDeleting(true);
    setError("");

    try {
      const response = await fetch("/api/auth/delete-account", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ userId }),
      });

      if (!response.ok) {
       
        const data = await response.json() as DeleteAccountResponse;
        
        throw new Error(data.error ?? "Failed to delete account");
      }

      await signOut({ redirect: false });
      
      router.push("/?deleted=true");
    } catch (err) {
      setError(err instanceof Error ? err.message : "An unexpected error occurred");
      setIsDeleting(false);
    }
  };

  if (showConfirmation) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-md p-4">
        <h4 className="text-red-700 font-medium mb-2">Are you absolutely sure?</h4>
        <p className="text-sm text-gray-700 mb-4">
          This will permanently delete your account and all associated data. This action cannot be undone.
        </p>
        
        {error && (
          <div className="mb-4 text-sm text-red-600 bg-red-100 p-2 rounded">
            {error}
          </div>
        )}
        
        <div className="flex space-x-3">
          <button
            onClick={handleCancelDelete}
            className="px-4 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300"
            disabled={isDeleting}
          >
            Cancel
          </button>
          <button
            onClick={handleConfirmDelete}
            className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:bg-red-300"
            disabled={isDeleting}
          >
            {isDeleting ? "Deleting..." : "Yes, Delete My Account"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <button
      onClick={handleDeleteRequest}
      className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
    >
      Delete Account
    </button>
  );
}