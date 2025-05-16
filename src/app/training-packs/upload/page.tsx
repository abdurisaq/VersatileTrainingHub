"use client";

import { useState, useEffect } from "react";
import { api } from "~/trpc/react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { usePluginConnection } from "~/hooks/usePluginConnection";
import { ROCKET_LEAGUE_RANKS } from "~/utils/ranks";

interface LocalPack {
  id: string;
  name: string;
  numShots: number;
}

interface PluginPackData {
  trainingData: string;
  shotsRecording?: string;
  numShots?: number;
}

export default function UploadTrainingPackPage() {
  const { status } = useSession();
  const router = useRouter();
  
  const [localPacks, setLocalPacks] = useState<LocalPack[]>([]);
  const [selectedLocalPack, setSelectedLocalPack] = useState<string>("");
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

  const { isConnected, getLocalPacks } = usePluginConnection({
    port: 7437,
    authToken: "versatile_training_scanner_token",
  });

  useEffect(() => {
    const loadLocalPacks = async () => {
      if (isConnected) {
        const packs = await getLocalPacks();
        if (packs) {
          setLocalPacks(packs);
        }
      }
    };

    void loadLocalPacks();
  }, [isConnected, getLocalPacks]);

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
    void router.push("/api/auth/signin");
    return null;
  }

  if (status === "loading") {
    return <div className="text-center p-8">Loading...</div>;
  }

  const handlePackSelection = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const packId = e.target.value;
    setSelectedLocalPack(packId);
    
    // If a pack is selected, auto-fill the name
    if (packId) {
      const selectedPack = localPacks.find(pack => pack.id === packId);
      if (selectedPack) {
        // Auto-fill the name field with the pack name
        setFormData(prev => ({
          ...prev,
          name: selectedPack.name,
          code: selectedPack.id
        }));
      }
    } else {
      setFormData(prev => ({
        ...prev, 
        name: ""
      }));
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
    if (!selectedLocalPack) {
      setErrorMessage("Please select a training pack");
      return;
    }

    setIsLoading(true);
    setErrorMessage("");

    try {
      const selectedPack = localPacks.find(pack => pack.id === selectedLocalPack);
      
      if (!selectedPack) {
        throw new Error("Selected pack not found");
      }

      console.log("Fetching pack data for:", selectedPack.id);
      
      // First check if plugin is connected
      if (!isConnected) {
        throw new Error("Plugin connection lost. Please ensure Rocket League is running with the VersatileTraining plugin.");
      }
      
      // Make a single request to get both pack and recording data
      const response = await fetch(`http://localhost:7437/pack-recording/${selectedPack.id}`, {
        headers: {
          'Authorization': `Bearer versatile_training_scanner_token`
        }
      }).catch(err => {
        console.error("Network error when contacting plugin:", err);
        throw new Error("Could not connect to the plugin. Is Rocket League running?");
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`Plugin returned status ${response.status}: ${errorText}`);
        throw new Error(`Plugin returned error ${response.status}: ${errorText}`);
      }
      
      // Get text response first to sanitize it before parsing as JSON
      const responseText = await response.text();
      
      // Sanitize the JSON by removing invalid control characters
      const sanitizedText = responseText.replace(/[\u0000-\u001F\u007F-\u009F]/g, "");
      
      let packData: PluginPackData;
      try {
        packData = JSON.parse(sanitizedText) as PluginPackData;
      } catch (parseError) {
        console.error("Failed to parse JSON:", parseError);
        console.log("Response data:", sanitizedText.substring(0, 200) + "..."); // Log a preview
        throw new Error("Invalid response from plugin. The data format is incorrect.");
      }
      
      console.log("Received pack data with size:", 
        packData.trainingData?.length ?? 0, 
        "bytes and recording size:", 
        packData.shotsRecording?.length ?? 0, "bytes");
      
      if (!packData.trainingData) {
        throw new Error("Missing training data in plugin response");
      }

      // Rest of your code remains the same
      const data = {
        name: formData.name || selectedPack.name,
        description: formData.description || null,
        code: formData.code || null,
        difficulty: parseInt(formData.difficulty.toString()),
        tags: formData.tags.filter(tag => tag.trim() !== ""),
        visibility: formData.visibility as "PUBLIC" | "PRIVATE" | "UNLISTED",
        packMetadataCompressed: packData.trainingData,
        recordingDataCompressed: packData.shotsRecording ?? "", 
        totalShots: selectedPack.numShots,
      };

      // Submit to API
      createTrainingPack.mutate(data);
    } catch (error) {
      setIsLoading(false);
      setErrorMessage("Error preparing pack data: " + (error instanceof Error ? error.message : String(error)));
      console.error("Error processing pack:", error);
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

      {!isConnected ? (
        <div className="text-center p-8">
          <p className="text-amber-600 font-medium">Plugin Connection Required</p>
          <p className="text-gray-600 mt-2">
            Please make sure Rocket League is running with the VersatileTraining plugin installed to upload training packs.
          </p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium mb-1">Select Training Pack</label>
            <select
              value={selectedLocalPack}
              onChange={handlePackSelection}
              className="w-full border rounded-md p-2"
              required
            >
              <option value="">Select a pack...</option>
              {localPacks.map((pack) => (
                <option key={pack.id} value={pack.id}>
                  {pack.name} ({pack.numShots} shots)
                </option>
              ))}
            </select>
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
              readOnly={!!selectedLocalPack}
            />
            {selectedLocalPack && (
              <p className="text-xs text-gray-500 mt-1">
                Name is automatically set to match the selected training pack
              </p>
            )}
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
              readOnly={!!selectedLocalPack}
            />
            {selectedLocalPack && (
              <p className="text-xs text-gray-500 mt-1">
                code is automatically set to match the selected training pack
              </p>
            )}
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-1">Difficulty (Rank)</label>
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
            <button
              type="button"
              onClick={() => router.back()}
              className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-100"
            >
              Cancel
            </button>
            
            <button
              type="submit"
              disabled={isLoading || !selectedLocalPack}
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-md disabled:bg-blue-400"
            >
              {isLoading ? "Uploading..." : "Upload Training Pack"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}