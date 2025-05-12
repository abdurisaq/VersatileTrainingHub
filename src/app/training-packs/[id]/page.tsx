"use client";

import { useParams } from "next/navigation";
import { api } from "~/trpc/react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { saveAs } from "file-saver";
import { usePluginConnection } from "~/hooks/usePluginConnection";
import { useState } from "react";

export default function TrainingPackDetailPage() {
  const params = useParams();
  const packId = params.id as string;
  const { data: session } = useSession();
  const [loadingToGame, setLoadingToGame] = useState(false);
  const [copied, setCopied] = useState(false);


  const copyPackId = () => {
    navigator.clipboard.writeText(packId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000); // Reset after 2 seconds
  };

  const { data: pack, isLoading, error } = api.trainingPack.getByIdForWeb.useQuery(
    { id: packId },
    { enabled: !!packId }
  );
  
  const getPackForPlugin = api.trainingPack.getByIdForPlugin.useMutation();
  
  const { isConnected, sendTrainingPack } = usePluginConnection({
    port: 7437, // Your plugin's standard port
    authToken: "versatile_training_scanner_token",
  });

  const handleDownload = async () => {
    try {
      const packData = await getPackForPlugin.mutateAsync({ id: packId });
      
      if (packData) {
        
        const jsonData = JSON.stringify(packData, null, 2);
        
  
        const blob = new Blob([jsonData], { type: "application/json;charset=utf-8" });
        const safePackName = packData.name.replace(/[^a-z0-9_.-]/gi, "_") || "training_pack";
        saveAs(blob, `${safePackName}.vtp.json`);
      }
    } catch (error: any) {
      console.error("Download error:", error);
      alert(`Error downloading pack: ${error.message}`);
    }
  };

  const handleLoadInGame = async () => {
    if (!isConnected) {
      alert("Game with plugin is not detected. Please make sure the game is running with the VersatileTraining plugin.");
      return;
    }

    try {
      setLoadingToGame(true);
      const packData = await getPackForPlugin.mutateAsync({ id: packId });
      
      if (packData) {
        const success = await sendTrainingPack(packData);
        if (success) {
          // Show success notification
        } else {
          alert("Failed to load training pack into game. Please try again.");
        }
      }
    } catch (error: any) {
      console.error("Load in game error:", error);
      alert(`Error loading pack in game: ${error.message}`);
    } finally {
      setLoadingToGame(false);
    }
  };

  if (isLoading) return <div className="text-center p-8">Loading training pack...</div>;
  if (error) return <div className="text-center text-red-500 p-8">Error: {error.message}</div>;
  if (!pack) return <div className="text-center p-8">Training pack not found</div>;

  return (
    <div className="container mx-auto p-4 max-w-4xl">
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="space-y-4">
  <h1 className="text-2xl font-bold">{pack.name}</h1>

  <div className="text-gray-700">
    <p><span className="font-semibold">Creator:</span> {pack.creator.name}</p>
    <p><span className="font-semibold">Uploaded:</span> {new Date(pack.createdAt).toLocaleDateString()}</p>
    <p><span className="font-semibold">Last Updated:</span> {new Date(pack.updatedAt).toLocaleDateString()}</p>
    {pack.code && <p><span className="font-semibold">Official Code:</span> {pack.code}</p>}
    {pack.gameVersion && <p><span className="font-semibold">Game Version:</span> {pack.gameVersion}</p>}
    {pack.pluginVersion && <p><span className="font-semibold">Plugin Version:</span> {pack.pluginVersion}</p>}
  </div>

  {pack.description && (
    <div>
      <h2 className="text-lg font-semibold">Description</h2>
      <p className="text-gray-800">{pack.description}</p>
    </div>
  )}

  <div>
    <h2 className="text-lg font-semibold">Tags</h2>
    <div className="flex flex-wrap gap-2">
      {pack.tags.map((tag) => (
        <span
          key={tag}
          className="bg-blue-100 text-blue-800 px-2 py-1 text-sm rounded"
        >
          {tag}
        </span>
      ))}
    </div>
  </div>

  <div className="text-gray-700">
    <p><span className="font-semibold">Difficulty:</span> {pack.difficulty ?? "Unrated"}</p>
    <p><span className="font-semibold">Total Shots:</span> {pack.totalShots}</p>
    <p><span className="font-semibold">Visibility:</span> {pack.visibility}</p>
    <p><span className="font-semibold">Downloads:</span> {pack.downloadCount}</p>
    <p><span className="font-semibold">Average Rating:</span> {pack.ratingCount > 0 ? `${pack.averageRating.toFixed(2)} (${pack.ratingCount} ratings)` : "Not yet rated"}</p>
      <div className="flex items-center gap-2 mt-1">
    <span className="font-semibold">Pack ID:</span>
    <code className="bg-gray-100 px-2 py-0.5 rounded text-sm">{pack.id}</code>
    <button 
      onClick={copyPackId}
      className="text-blue-500 text-sm hover:text-blue-700 focus:outline-none"
      title="Copy ID to clipboard"
    >
      {copied ? (
        <span className="text-green-500">✓ Copied!</span>
      ) : (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 inline" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
        </svg>
      )}
    </button>
  </div>
  </div>
</div>
        
        <div className="flex flex-col sm:flex-row gap-3 mt-6">
          <button
            onClick={handleDownload}
            disabled={getPackForPlugin.isPending}
            className="bg-green-600 hover:bg-green-700 text-white py-2 px-4 rounded disabled:bg-green-400"
          >
            {getPackForPlugin.isPending ? "Preparing Download..." : "Download for Plugin"}
          </button>
          
          {isConnected && (
            <button
              onClick={handleLoadInGame}
              disabled={loadingToGame || getPackForPlugin.isPending}
              className="bg-purple-600 hover:bg-purple-700 text-white py-2 px-4 rounded disabled:bg-purple-400 flex items-center justify-center"
            >
              {loadingToGame ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Loading into Game...
                </>
              ) : (
                "Load Directly in Game"
              )}
            </button>
          )}
          
          {session?.user?.id === pack.creatorId && (
            <Link
              href={`/training-packs/${pack.id}/edit`}
              className="bg-blue-600 hover:bg-blue-700 text-white text-center py-2 px-4 rounded"
            >
              Edit Pack
            </Link>
          )}
        </div>
        
        {!isConnected && (
          <div className="mt-4 text-sm text-gray-600 bg-gray-100 p-3 rounded">
            <p className="font-medium">Want to load packs directly into the game?</p>
            <p>Launch Rocket League with the VersatileTraining plugin to enable one-click loading.</p>
          </div>
        )}
      </div>
    </div>
  );
}