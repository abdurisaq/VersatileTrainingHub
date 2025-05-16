"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { api } from "~/trpc/react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { ROCKET_LEAGUE_RANKS } from "~/utils/ranks";

export default function EditTrainingPackPage() {
  const params = useParams();
  const packId = params.id as string;
  const router = useRouter();
  const { data: session, status } = useSession();
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [redirecting, setRedirecting] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    code: "",
    difficulty: 1,
    tags: [""],
    visibility: "PUBLIC" as "PUBLIC" | "PRIVATE" | "UNLISTED",
  });

  // Get the original pack data with proper error handling
  const { 
    data: pack, 
    isLoading, 
    error,
    isError 
  } = api.trainingPack.getByIdForEdit.useQuery(
    { id: packId },
    { 
      enabled: !!packId && !!session,
      // Add error handling using the retry option
      retry: (failureCount, error) => {
        // Don't retry for 'FORBIDDEN' errors
        if (error.data?.code === 'FORBIDDEN') {
          return false;
        }
        return failureCount < 3; // retry other errors up to 3 times
      }
      
    }
  );

  // Effect to populate form when pack data is loaded
  useEffect(() => {
    if (pack) {
      setFormData({
        name: pack.name,
        description: pack.description ?? "",
        code: pack.code ?? "",
        difficulty: pack.difficulty ?? 1,
        tags: pack.tags.length > 0 ? pack.tags : [""],
        visibility: pack.visibility,
      });
    }
  }, [pack]);
  
  // Update pack mutation
  const updatePack = api.trainingPack.updateDetails.useMutation({
    onSuccess: (data) => {
      setIsSubmitting(false);
      router.push(`/training-packs/${data.id}`);
    },
    onError: (error) => {
      setIsSubmitting(false);
      setErrorMessage(error.message);
    },
  });

  // Show a proper error message for all errors
  if (isError) {
    return (
      <div className="container mx-auto p-4 max-w-3xl">
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          <p className="font-bold">Error</p>
          <p>{error.message}</p>
        </div>
        <div className="flex gap-4 mt-4">
          <Link 
            href="/training-packs" 
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md"
          >
            Browse Training Packs
          </Link>
          <Link 
            href="/"
            className="text-blue-600 hover:underline px-4 py-2"
          >
            Go to Home Page
          </Link>
        </div>
        {redirecting && (
          <p className="text-sm text-gray-500 mt-8">
            {`You'll be automatically redirected in a moment...`}
          </p>
        )}
      </div>
    );
  }

  // Authentication checks
  if (status === "loading" || isLoading) {
    return <div className="container mx-auto p-4 max-w-3xl text-center py-12">Loading...</div>;
  }
  
  if (status === "unauthenticated") {
    router.push(`/api/auth/signin?callbackUrl=/training-packs/${packId}/edit`);
    return null;
  }

  // This authorization check is now a fallback since we handle it in the query
  // But we keep it for double protection
  if (pack && pack.creatorId !== session?.user?.id) {
    setRedirecting(true);
    setTimeout(() => {
      router.push('/training-packs');
    }, 1000);
    
    return (
      <div className="container mx-auto p-4 max-w-3xl">
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          <p className="font-bold">Unauthorized</p>
          <p>{`You don't have permission to edit this training pack.`}</p>
        </div>
        <p className="text-sm text-gray-500 mt-4">Redirecting to training packs...</p>
      </div>
    );
  }

  // Handle the case where the pack isn't found
  if (!pack && !isLoading && !isError) {
    return (
      <div className="container mx-auto p-4 max-w-3xl text-center py-12">
        <div className="bg-yellow-100 border border-yellow-400 text-yellow-800 px-4 py-3 rounded mb-4">
          <p className="font-bold">Training Pack Not Found</p>
          <p>{`The training pack you're looking for doesn't exist or has been removed.`}</p>
        </div>
        <Link 
          href="/training-packs" 
          className="text-blue-600 hover:underline mt-4 inline-block"
        >
          Browse Training Packs
        </Link>
      </div>
    );
  }

  // Handle field changes
  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleTagChange = (index: number, value: string) => {
    setFormData((prev) => {
      const newTags = [...prev.tags];
      newTags[index] = value;
      return { ...prev, tags: newTags };
    });
  };

  const addTagField = () => {
    setFormData((prev) => ({
      ...prev,
      tags: [...prev.tags, ""],
    }));
  };

  const removeTagField = (index: number) => {
    setFormData((prev) => {
      const newTags = prev.tags.filter((_, i) => i !== index);
      return { ...prev, tags: newTags.length ? newTags : [""] };
    });
  };

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMessage("");
    
    try {
      const data = {
        id: packId,
        name: formData.name,
        description: formData.description || null,
        code: formData.code || null,
        difficulty: parseInt(formData.difficulty.toString()),
        tags: formData.tags.filter(tag => tag.trim() !== ""),
        visibility: formData.visibility,
      };
      
      await updatePack.mutateAsync(data);
    } catch (error) {
      console.error("Update error:", error);
      setErrorMessage(error instanceof Error ? error.message : String(error));
      setIsSubmitting(false);
    }
  };
  
  return (
    <div className="container mx-auto p-4 max-w-3xl">
      <h1 className="text-2xl font-bold mb-6">Edit Training Pack</h1>
      
      {errorMessage && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {errorMessage}
        </div>
      )}
      
      <form onSubmit={handleSubmit} className="bg-white p-6 rounded-lg shadow-md space-y-6">
        <div>
          <label className="block text-sm font-medium mb-1">Name</label>
          <input
            type="text"
            name="name"
            value={formData.name}
            onChange={handleInputChange}
            className="w-full border rounded-md p-2"
            required
            minLength={3}
            maxLength={100}
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium mb-1">Description</label>
          <textarea
            name="description"
            value={formData.description}
            onChange={handleInputChange}
            className="w-full border rounded-md p-2"
            rows={3}
            maxLength={2000}
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium mb-1">Official Training Pack Code</label>
          <input
            type="text"
            name="code"
            value={formData.code}
            onChange={handleInputChange}
            className="w-full border rounded-md p-2"
            maxLength={50}
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium mb-1">Difficulty (1-5)</label>
          <select
            name="difficulty"
            value={formData.difficulty}
            onChange={handleInputChange}
            className="w-full border rounded-md p-2"
          >
            {ROCKET_LEAGUE_RANKS.map(rank => (
              <option key={rank.value} value={rank.value}>
                {rank.name}
              </option>
            ))}
          </select>
        </div>
        
        <div>
          <label className="block text-sm font-medium mb-1">Tags</label>
          <div className="space-y-2">
            {formData.tags.map((tag, index) => (
              <div key={index} className="flex gap-2">
                <input
                  type="text"
                  value={tag}
                  onChange={(e) => handleTagChange(index, e.target.value)}
                  className="flex-grow border rounded-md p-2"
                  placeholder="e.g., aerial, defense"
                  maxLength={30}
                />
                <button
                  type="button"
                  onClick={() => removeTagField(index)}
                  className="bg-red-100 text-red-500 p-2 rounded-md hover:bg-red-200"
                  disabled={formData.tags.length === 1}
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
          
          <button
            type="button"
            onClick={addTagField}
            className="mt-2 text-blue-500 text-sm hover:underline"
            disabled={formData.tags.length >= 10}
          >
            + Add another tag
          </button>
        </div>
        
        <div>
          <label className="block text-sm font-medium mb-1">Visibility</label>
          <select
            name="visibility"
            value={formData.visibility}
            onChange={handleInputChange}
            className="w-full border rounded-md p-2"
          >
            <option value="PUBLIC">Public - Anyone can find and download</option>
            <option value="UNLISTED">Unlisted - Only accessible with direct link</option>
            <option value="PRIVATE">Private - Only you can view and download</option>
          </select>
        </div>
        
        <div className="flex gap-4 pt-4">
          <Link
            href={`/training-packs/${pack?.id}`}
            className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-100"
          >
            Cancel
          </Link>
          
          <button
            type="submit"
            disabled={isSubmitting}
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-md disabled:bg-blue-400"
          >
            {isSubmitting ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </form>
    </div>
  );
}