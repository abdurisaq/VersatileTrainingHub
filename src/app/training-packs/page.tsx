"use client";

import { useState, useEffect, useMemo } from "react";
import { api } from "~/trpc/react";
import Link from "next/link";
import { useRouter } from "next/navigation";

type SortByType = "createdAt" | "updatedAt" | "name" | "downloadCount" | "averageRating";
type SortOrderType = "asc" | "desc";

interface SearchConfig {
  name: boolean;
  tags: boolean;
  creator: boolean;
}

type ActiveSearchFieldType = keyof SearchConfig;


interface Pack {
  id: string;
  name: string;
  description?: string | null;
  code?: string | null;
  difficulty?: number | null;
  tags: string[];
  totalShots: number;
  creator?: {
    id: string;
    name?: string | null;
    image?: string | null;
  } | null;
  averageRating?: number | null;
  downloadCount: number;
  createdAt: Date | string; 
  updatedAt: Date | string; 
}

function PackCard({ pack }: { pack: Pack }) {
  return (
    <div className="border bg-white rounded-lg shadow hover:shadow-md transition-shadow p-4">
      <Link href={`/training-packs/${pack.id}`}>
        <h2 className="text-xl font-semibold text-blue-600 hover:underline">{pack.name}</h2>
      </Link>
      
      {pack.code && <p className="text-sm text-gray-500">Code: {pack.code}</p>}
      
      <div className="flex items-center gap-2 mt-1 text-sm text-gray-700">
        <span>By: {pack.creator?.name || "Unknown"}</span>
        <span className="text-gray-300">|</span>
        <span>Shots: {pack.totalShots}</span>
        <span className="text-gray-300">|</span>
        <span>Downloads: {pack.downloadCount}</span>
      </div>
      <p className="text-sm text-gray-700 mt-1">
        Rating: {pack.averageRating != null ? `${pack.averageRating.toFixed(1)}/5` : "N/A"}
      </p>
      <p className="text-xs text-gray-500 mt-1">
        Uploaded: {new Date(pack.createdAt).toLocaleDateString()}
      </p>
      {pack.updatedAt && new Date(pack.updatedAt).getTime() !== new Date(pack.createdAt).getTime() && (
        <p className="text-xs text-gray-500">
          Updated: {new Date(pack.updatedAt).toLocaleDateString()}
        </p>
      )}

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
  const [submittedSearchTerm, setSubmittedSearchTerm] = useState("");
  const [sortBy, setSortBy] = useState<SortByType>("createdAt");
  const [sortOrder, setSortOrder] = useState<SortOrderType>("desc");
   
  const [activeSearchField, setActiveSearchField] = useState<ActiveSearchFieldType>("name");
  
  const router = useRouter();
  
  const { data: initialQueryData, isLoading: isInitialLoading, error: initialError } = api.trainingPack.listPublic.useQuery({
    limit: 100, 
    sortBy: "createdAt", 
    sortOrder: "desc",   
  });

  const [allFetchedPacks, setAllFetchedPacks] = useState<Pack[]>([]);
  
  useEffect(() => {
    if (initialQueryData?.items) {
      const packsWithDates = initialQueryData.items.map(pack => ({
        ...pack,
        createdAt: new Date(pack.createdAt),
        updatedAt: new Date(pack.updatedAt),
      })) as Pack[];
      setAllFetchedPacks(packsWithDates);
    }
  }, [initialQueryData]);

  const displayedPacks = useMemo(() => {
    let packsToDisplay = [...allFetchedPacks];

    if (submittedSearchTerm) {
      const lowerSearchTerm = submittedSearchTerm.toLowerCase();
      packsToDisplay = packsToDisplay.filter(pack => {
        if (activeSearchField === "name" && pack.name?.toLowerCase().includes(lowerSearchTerm)) {
          return true;
        }
        if (activeSearchField === "tags" && pack.tags?.some(tag => tag.toLowerCase().includes(lowerSearchTerm))) {
          return true;
        }
        if (activeSearchField === "creator" && pack.creator?.name && pack.creator.name.toLowerCase().includes(lowerSearchTerm)) {
          return true;
        }
        return false;
      });
    }

    packsToDisplay.sort((a, b) => {
      let compareA: any;
      let compareB: any;

      switch (sortBy) {
        case "name":
          compareA = a.name?.toLowerCase() || "";
          compareB = b.name?.toLowerCase() || "";
          break;
        case "downloadCount":
          compareA = a.downloadCount;
          compareB = b.downloadCount;
          break;
        case "averageRating":
          compareA = a.averageRating ?? -1; 
          compareB = b.averageRating ?? -1;
          break;
        case "updatedAt":
          compareA = new Date(a.updatedAt).getTime();
          compareB = new Date(b.updatedAt).getTime();
          break;
        case "createdAt":
        default:
          compareA = new Date(a.createdAt).getTime();
          compareB = new Date(b.createdAt).getTime();
          break;
      }

      if (compareA < compareB) {
        return sortOrder === "asc" ? -1 : 1;
      }
      if (compareA > compareB) {
        return sortOrder === "asc" ? 1 : -1;
      }
      return 0;
    });

    return packsToDisplay;
  }, [allFetchedPacks, submittedSearchTerm, activeSearchField, sortBy, sortOrder]);


  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmittedSearchTerm(searchTerm);
  };

  const handleCreateNew = () => {
    router.push("/training-packs/upload");
  };

  // Handles changing the active search field (radio button like behavior)
  const handleActiveSearchFieldChange = (field: ActiveSearchFieldType) => {
    setActiveSearchField(field);
  };

  if (isInitialLoading && !initialQueryData) return <div className="text-center p-8">Loading training packs...</div>;
  if (initialError) return <div className="text-center text-red-500 p-8">Error: {initialError.message}</div>;
  
  const searchFieldOptions: ActiveSearchFieldType[] = ["name", "tags", "creator"];

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

      <form onSubmit={handleSearchSubmit} className="mb-6 p-4 border rounded-lg bg-gray-50">
        <div className="flex flex-col sm:flex-row gap-4">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder={`Search by ${activeSearchField}...`}
            className="border p-2 rounded-md flex-grow"
          />
          <button
            type="submit"
            className="bg-blue-500 text-white px-6 py-2 rounded-md hover:bg-blue-600"
          >
            Search
          </button>
        </div>
        <div className="mt-3 text-sm text-gray-600">Search in:</div>
        <div className="mt-1 flex flex-wrap gap-x-4 gap-y-2">
          {searchFieldOptions.map((field) => (
            <label key={field} className="flex items-center space-x-2 cursor-pointer">
              <input
                type="radio" // Changed to radio for exclusive selection
                name="searchField" // Group radio buttons
                checked={activeSearchField === field}
                onChange={() => handleActiveSearchFieldChange(field)}
                className="text-blue-500 focus:ring-blue-500"
              />
              <span className="capitalize">{field}</span>
            </label>
          ))}
        </div>
        <div className="mt-4 flex flex-col sm:flex-row gap-4 items-center">
          <label htmlFor="sort-by" className="text-sm font-medium text-gray-700">Sort by:</label>
          <select
            id="sort-by"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortByType)}
            className="border p-2 rounded-md bg-white"
          >
            <option value="createdAt">Upload Date</option>
            <option value="updatedAt">Last Updated</option>
            <option value="name">Name</option>
            <option value="downloadCount">Downloads</option>
            <option value="averageRating">Rating</option>
          </select>
          <select
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value as SortOrderType)}
            className="border p-2 rounded-md bg-white"
          >
            <option value="desc">Descending</option>
            <option value="asc">Ascending</option>
          </select>
        </div>
      </form>

      {displayedPacks.length === 0 && !isInitialLoading ? (
        <p className="text-center text-gray-600 p-8">
          {submittedSearchTerm ? "No training packs match your search." : "No training packs found."}
        </p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {displayedPacks.map((pack) => (
            <PackCard key={pack.id} pack={pack} />
          ))}
        </div>
      )}
    </div>
  );
}