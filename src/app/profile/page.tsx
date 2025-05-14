"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { api } from "~/trpc/react";
import { DeleteAccountButton } from "~/app/components/delete-account-button";
import Link from "next/link";
import { usePluginConnection } from "~/hooks/usePluginConnection";

export default function ProfilePage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'info' | 'packs'>('info');

  // Plugin connection to enable updating packs
  const { isConnected } = usePluginConnection({
    port: 7437,
    authToken: "versatile_training_scanner_token",
  });

  // Query to get user's training packs
  const { data: userPacks, isLoading: packsLoading, refetch } = api.trainingPack.getUserPacks.useQuery(
    undefined,
    { enabled: !!session }
  );
  
  // Delete pack mutation
  const deletePack = api.trainingPack.delete.useMutation({
    onSuccess: () => {
      refetch();
    },
  });

  // Update visibility mutation
  const updateVisibility = api.trainingPack.updateVisibility.useMutation({
    onSuccess: () => {
      refetch();
    },
  });

  // Handle pack deletion
  const handleDeletePack = async (packId: string, packName: string) => {
    if (confirm(`Are you sure you want to delete "${packName}"? This action cannot be undone.`)) {
      await deletePack.mutateAsync({ id: packId });
    }
  };

  // Handle visibility change
  const handleVisibilityChange = async (packId: string, visibility: "PUBLIC" | "PRIVATE" | "UNLISTED") => {
    await updateVisibility.mutateAsync({ id: packId, visibility });
  };

  if (status === "loading") {
    return <div className="container mx-auto py-8">Loading profile...</div>;
  }
  
  if (status === "unauthenticated") {
    router.push("/api/auth/signin?callbackUrl=/profile");
    return null;
  }
  
  if (!session) {
    return null;
  }

  return (
    <div className="container mx-auto py-8 px-4">
      <h1 className="text-2xl font-bold mb-6">Your Profile</h1>
      
      <div className="bg-white p-6 rounded-lg shadow-md">
        <div className="flex items-center space-x-4 mb-6">
          <div className="h-16 w-16 rounded-full bg-gray-300 flex items-center justify-center text-xl">
            {session.user.name?.[0] || session.user.email?.[0] || "U"}
          </div>
          <div>
            <h2 className="text-xl font-semibold">{session.user.name}</h2>
            <p className="text-gray-600">{session.user.email}</p>
          </div>
        </div>
        
        {/* Tab navigation */}
        <div className="border-b mb-6">
          <nav className="flex space-x-8">
            <button 
              onClick={() => setActiveTab('info')}
              className={`py-2 px-1 ${activeTab === 'info' ? 'border-b-2 border-blue-500 font-medium text-blue-600' : 'text-gray-500'}`}
            >
              Account Info
            </button>
            <button 
              onClick={() => setActiveTab('packs')}
              className={`py-2 px-1 ${activeTab === 'packs' ? 'border-b-2 border-blue-500 font-medium text-blue-600' : 'text-gray-500'}`}
            >
              Your Training Packs
            </button>
          </nav>
        </div>
        
        {/* Account info tab */}
        {activeTab === 'info' && (
          <>
            <div>
              <h3 className="font-medium mb-2">Account Information</h3>
              <p className="text-gray-600 mb-1">User ID: {session.user.id}</p>
              <p className="text-gray-600">Joined: {new Date(session.user.createdAt || Date.now()).toLocaleDateString()}</p>
            </div>
            
            <div className="border-t mt-6 pt-6">
              <h3 className="font-medium text-red-600 mb-2">Danger Zone</h3>
              <p className="text-gray-600 mb-4 text-sm">
                Deleting your account is permanent and will remove all your data including training packs, 
                comments, and ratings. This action cannot be undone.
              </p>
              
              <DeleteAccountButton userId={session.user.id} />
            </div>
          </>
        )}
        
        {/* Training packs tab */}
        {activeTab === 'packs' && (
          <div>
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-medium">Your Training Packs</h3>
              <Link
                href="/training-packs/upload"
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm"
              >
                Upload New Pack
              </Link>
            </div>
            
            {packsLoading ? (
              <p className="text-gray-500 py-4">Loading your training packs...</p>
            ) : !userPacks || userPacks.length === 0 ? (
              <div className="bg-gray-50 rounded-lg p-8 text-center">
                <p className="text-gray-500 mb-4">You haven't created any training packs yet.</p>
                <Link
                  href="/training-packs/upload"
                  className="text-blue-600 hover:underline"
                >
                  Upload your first training pack
                </Link>
              </div>
            ) : (
              <div className="space-y-4">
                {userPacks?.map((pack) => (
                  <div key={pack.id} className="border rounded-lg p-4 hover:bg-gray-50">
                    <div className="flex justify-between items-start">
                      <div>
                        <Link href={`/training-packs/${pack.id}`} className="text-lg font-medium text-blue-600 hover:underline">
                          {pack.name}
                        </Link>
                        <p className="text-sm text-gray-500">
                          {pack.totalShots} shots • {pack.downloadCount} downloads • 
                          Created: {new Date(pack.createdAt).toLocaleDateString()}
                        </p>
                        {pack.tags.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {pack.tags.map(tag => (
                              <span key={tag} className="bg-gray-100 text-gray-700 text-xs px-2 py-1 rounded">
                                {tag}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                      <span className={`text-xs font-medium px-2 py-1 rounded ${
                        pack.visibility === "PUBLIC" ? "bg-green-100 text-green-800" :
                        pack.visibility === "UNLISTED" ? "bg-yellow-100 text-yellow-800" :
                        "bg-gray-100 text-gray-800"
                      }`}>
                        {pack.visibility}
                      </span>
                    </div>
                    
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Link 
                        href={`/training-packs/${pack.id}/edit`}
                        className="text-blue-600 text-sm hover:underline"
                      >
                        Edit Details
                      </Link>
                      
                      {isConnected && (
                        <Link 
                          href={`/training-packs/${pack.id}/update`}
                          className="text-purple-600 text-sm hover:underline"
                        >
                          Update from Plugin
                        </Link>
                      )}
                      
                      <div className="relative group">
                        <button className="text-gray-500 text-sm hover:text-gray-700">
                          Visibility ▾
                        </button>
                        <div className="absolute z-10 left-0 mt-1 w-48 bg-white shadow-lg rounded-md hidden group-hover:block">
                          <div className="py-1">
                            <button 
                              onClick={() => handleVisibilityChange(pack.id, "PUBLIC")}
                              className={`w-full text-left px-4 py-2 text-sm ${pack.visibility === "PUBLIC" ? "bg-blue-50 text-blue-700" : "hover:bg-gray-100"}`}
                            >
                              Public
                            </button>
                            <button 
                              onClick={() => handleVisibilityChange(pack.id, "UNLISTED")}
                              className={`w-full text-left px-4 py-2 text-sm ${pack.visibility === "UNLISTED" ? "bg-blue-50 text-blue-700" : "hover:bg-gray-100"}`}
                            >
                              Unlisted
                            </button>
                            <button 
                              onClick={() => handleVisibilityChange(pack.id, "PRIVATE")}
                              className={`w-full text-left px-4 py-2 text-sm ${pack.visibility === "PRIVATE" ? "bg-blue-50 text-blue-700" : "hover:bg-gray-100"}`}
                            >
                              Private
                            </button>
                          </div>
                        </div>
                      </div>
                      
                      <button 
                        onClick={() => handleDeletePack(pack.id, pack.name)}
                        className="text-red-600 text-sm hover:underline ml-auto"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}