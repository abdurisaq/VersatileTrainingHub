"use client";

import { useState } from "react";
import { api } from "~/trpc/react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";

export default function UploadTrainingPackPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  
  const [packFile, setPackFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    code: "",
    difficulty: 1,
    tags: [""],
    visibility: "PUBLIC",
  });

  const createTrainingPack = api.trainingPack.create.useMutation({
    onSuccess: (data) => {
      setIsLoading(false);
      router.push(`/training-packs/${data.id}`);
    },
    onError: (error) => {
      setIsLoading(false);
      setErrorMessage(error.message);
    },
  });

  // Redirect if not authenticated
  if (status === "unauthenticated") {
    router.push("/api/auth/signin");
    return null;
  }

  if (status === "loading") {
    return <div className="text-center p-8">Loading...</div>;
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      setPackFile(e.target.files[0]);
      setErrorMessage("");
    }
  };

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!packFile) {
      setErrorMessage("Please select a training pack file");
      return;
    }

    setIsLoading(true);
    setErrorMessage("");

    try {
      // Read file as base64
      const fileData = await readFileAsBase64(packFile);
      
      // Parse the file to get the pack data
      const packData = JSON.parse(fileData);
      
      // Prepare data for API
      const data = {
        name: formData.name,
        description: formData.description || null,
        code: formData.code || null,
        difficulty: parseInt(formData.difficulty.toString()),
        tags: formData.tags.filter(tag => tag.trim() !== ""),
        packMetadataCompressed: packData.metadata || "",
        shots: packData.shots.map((shot: any, index: number) => ({
          shotIndex: index,
          recordingDataCompressed: shot.data,
        })),
        visibility: formData.visibility as "PUBLIC" | "PRIVATE" | "UNLISTED",
        gameVersion: packData.gameVersion || null,
        pluginVersion: packData.pluginVersion || null,
      };

      // Submit to API
      createTrainingPack.mutate(data);
    } catch (error) {
      setIsLoading(false);
      setErrorMessage("Invalid file format. Please upload a valid training pack file.");
      console.error("Error processing file:", error);
    }
  };

  return (
    <div className="container mx-auto p-4 max-w-3xl">
      <h1 className="text-3xl font-bold mb-6">Upload Training Pack</h1>
      
      {errorMessage && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {errorMessage}
        </div>
      )}
      
      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label className="block text-sm font-medium mb-1">Training Pack File</label>
          <input
            type="file"
            accept=".json,.vtp"
            onChange={handleFileChange}
            className="w-full border rounded-md p-2"
            required
          />
          <p className="text-sm text-gray-500 mt-1">
            Upload a training pack file exported from the Versatile Training plugin
          </p>
        </div>
        
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
          <label className="block text-sm font-medium mb-1">Official Training Pack Code (Optional)</label>
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
            <option value={1}>1 - Beginner</option>
            <option value={2}>2 - Easy</option>
            <option value={3}>3 - Medium</option>
            <option value={4}>4 - Hard</option>
            <option value={5}>5 - Expert</option>
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
          <button
            type="button"
            onClick={() => router.back()}
            className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-100"
          >
            Cancel
          </button>
          
          <button
            type="submit"
            disabled={isLoading}
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-md disabled:bg-blue-400"
          >
            {isLoading ? "Uploading..." : "Upload Training Pack"}
          </button>
        </div>
      </form>
    </div>
  );
}

// Utility function to read file as base64
function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result.split(',')[1] || reader.result);
      } else {
        reject(new Error("Failed to read file as text"));
      }
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}