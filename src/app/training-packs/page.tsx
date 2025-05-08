"use client";

import { useState } from "react";
import { api } from "~/trpc/react";
import Link from "next/link";
import { useRouter } from "next/navigation";

function PackCard({ pack }: { pack: any }) {
  return (
    <div className="border bg-white rounded-lg shadow hover:shadow-md transition-shadow p-4">
      <Link href={`/training-packs/${pack.id}`}>
        <h2 className="text-xl font-semibold text-blue-600 hover:underline">{pack.name}</h2>
      </Link>
      
      {pack.code && <p className="text-sm text-gray-500">Code: {pack.code}</p>}
      
      <div className="flex items-center gap-2 mt-1">
        <p className="text-sm text-gray-700">By: {pack.creator?.name || "Unknown"}</p>
        <span className="text-gray-300">|</span>
        <p className="text-sm text-gray-700">Shots: {pack.totalShots}</p>
        <span className="text-gray-300">|</span>
        <p className="text-sm text-gray-700">Downloads: {pack.downloadCount}</p>
      </div>

      <div className="mt-2 flex flex-wrap gap-1">
        {pack.tags?.map((tag: string) => (
          <span 
            key={tag} 
            className="inline-block text-xs bg-gray-200 text-gray-700 px-2 py-1 rounded-full"
          >
            {tag}
          </span>
        ))}
      </div>
    </div>
  );
}

export default function TrainingPacksPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const router = useRouter();
  
  const { data, isLoading, error } = api.trainingPack.listPublic.useQuery({
    limit: 20,
    searchTerm: searchTerm || undefined,
  });

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    // The search is handled by the useQuery hook
  };

  const handleCreateNew = () => {
    router.push("/training-packs/upload");
  };

  if (isLoading) return <div className="text-center p-8">Loading training packs...</div>;
  if (error) return <div className="text-center text-red-500 p-8">Error: {error.message}</div>;
  
  return (
    <div className="container mx-auto p-4">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Training Packs</h1>
        <button
          onClick={handleCreateNew}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md"
        >
          Upload New Pack
        </button>
      </div>

      <form onSubmit={handleSearch} className="mb-6 flex gap-2">
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Search packs..."
          className="border p-2 rounded-md flex-grow"
        />
        <button
          type="submit"
          className="bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-600"
        >
          Search
        </button>
      </form>

      {data?.items.length === 0 ? (
        <p className="text-center text-gray-600 p-8">No training packs found.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {data?.items.map((pack) => (
            <PackCard key={pack.id} pack={pack} />
          ))}
        </div>
      )}
    </div>
  );
}