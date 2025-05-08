"use client";

import { useParams } from "next/navigation";
import { api } from "~/trpc/react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { saveAs } from "file-saver";

export default function TrainingPackDetailPage() {
  const params = useParams();
  const packId = params.id as string;
  const { data: session } = useSession();
  
  const { data: pack, isLoading, error } = api.trainingPack.getByIdForWeb.useQuery(
    { id: packId },
    { enabled: !!packId }
  );
  
  const getPackForPlugin = api.trainingPack.getByIdForPlugin.useMutation();

  const handleDownload = async () => {
    try {
      const packData = await getPackForPlugin.mutateAsync({ id: packId });
      
      if (packData) {
        // Format the data as JSON
        const jsonData = JSON.stringify(packData, null, 2);
        
        // Create a blob and download it
        const blob = new Blob([jsonData], { type: "application/json;charset=utf-8" });
        const safePackName = packData.name.replace(/[^a-z0-9_.-]/gi, "_") || "training_pack";
        saveAs(blob, `${safePackName}.vtp.json`);
      }
    } catch (error: any) {
      console.error("Download error:", error);
      alert(`Error downloading pack: ${error.message}`);
    }
  };

  if (isLoading) return <div className="text-center p-8">Loading training pack...</div>;
  if (error) return <div className="text-center text-red-500 p-8">Error: {error.message}</div>;
  if (!pack) return <div className="text-center p-8">Training pack not found</div>;

  return (
    <div className="container mx-auto p-4 max-w-4xl">
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="mb-6">
          <h1 className="text-3xl font-bold">{pack.name}</h1>
          
          <div className="flex flex-wrap items-center gap-2 mt-2 text-sm text-gray-600">
            <span>Created by: {pack.creator.name}</span>
            <span>•</span>
            <span>Shots: {pack.totalShots}</span>
            <span>•</span>
            <span>Downloads: {pack.downloadCount}</span>
            {pack.code && (
              <>
                <span>•</span>
                <span>Code: <span className="font-mono bg-gray-100 px-1 rounded">{pack.code}</span></span>
              </>
            )}
          </div>
          
          <div className="flex flex-wrap gap-1 mt-3">
            {pack.tags?.map((tag) => (
              <span key={tag} className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full">
                {tag}
              </span>
            ))}
          </div>
        </div>
        
        {pack.description && (
          <div className="mb-6">
            <h2 className="text-xl font-semibold mb-2">Description</h2>
            <p className="whitespace-pre-line">{pack.description}</p>
          </div>
        )}
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-gray-50 p-3 rounded text-center">
            <div className="text-lg font-semibold">{pack.totalShots}</div>
            <div className="text-sm text-gray-600">Shots</div>
          </div>
          
          <div className="bg-gray-50 p-3 rounded text-center">
            <div className="text-lg font-semibold">{pack.difficulty || "N/A"}</div>
            <div className="text-sm text-gray-600">Difficulty</div>
          </div>
          
          <div className="bg-gray-50 p-3 rounded text-center">
            <div className="text-lg font-semibold">{pack.downloadCount}</div>
            <div className="text-sm text-gray-600">Downloads</div>
          </div>
          
          <div className="bg-gray-50 p-3 rounded text-center">
            <div className="text-lg font-semibold">{pack.averageRating.toFixed(1)}/5</div>
            <div className="text-sm text-gray-600">{pack.ratingCount} Ratings</div>
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
          
          {session?.user?.id === pack.creatorId && (
            <Link
              href={`/training-packs/${pack.id}/edit`}
              className="bg-blue-600 hover:bg-blue-700 text-white text-center py-2 px-4 rounded"
            >
              Edit Pack
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}