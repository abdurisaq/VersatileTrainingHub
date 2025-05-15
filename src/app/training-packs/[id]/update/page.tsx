"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { api } from "~/trpc/react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { usePluginConnection } from "~/hooks/usePluginConnection";


interface PluginPackData {
  trainingData: string;
  shotsRecording?: string;
  numShots?: number;
}

export default function UpdateTrainingPackPage() {
  const params = useParams();
  const packId = params.id as string;
  const router = useRouter();
  const { data: session, status } = useSession();
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const { data: pack, isLoading, error, isError } = api.trainingPack.getByIdForEdit.useQuery(
    { id: packId },
    { 
      enabled: !!packId && !!session,
      retry: (failureCount, error) => {
        
        if (error.data?.code === 'FORBIDDEN') {
          return false;
        }
        return failureCount < 3; 
      }
    }
  );

  const { isConnected } = usePluginConnection({
    port: 7437,
    authToken: "versatile_training_scanner_token",
  });
  const updatePack = api.trainingPack.updateWithData.useMutation({
    onSuccess: (data) => {
      setIsSubmitting(false);
      setSuccessMessage(`Successfully updated "${data.name}"`);
      setTimeout(() => {
        router.push(`/training-packs/${data.id}`);
      }, 2000);
    },
    onError: (error) => {
      setIsSubmitting(false);
      setErrorMessage(error.message);
    },
  });

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
      </div>
    );
  }

  if (status === "loading" || isLoading) {
    return <div className="container mx-auto p-4 max-w-3xl text-center py-12">Loading...</div>;
  }
  
  if (status === "unauthenticated") {
    router.push(`/api/auth/signin?callbackUrl=/training-packs/${packId}/update`);
    return null;
  }

  if (pack && pack.creatorId !== session?.user?.id) {
    return (
      <div className="container mx-auto p-4 max-w-3xl">
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          <p className="font-bold">Unauthorized</p>
          <p>You don&apos;t have permission to update this training pack.</p>
        </div>
        <Link href={`/training-packs/${packId}`} className="text-blue-600 hover:underline">
          Return to training pack
        </Link>
      </div>
    );
  }

  const handleUpdateFromPlugin = async () => {
    if (!isConnected) {
      setErrorMessage("Please make sure Rocket League is running with the VersatileTraining plugin installed.");
      return;
    }

    if (!pack) {
      setErrorMessage("Training pack data not found");
      return;
    }

    setIsSubmitting(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      
      const packCode = pack.code ?? packId;
      
      console.log("Fetching updated pack data for:", packCode);
      
      
      const response = await fetch(`http://localhost:7437/pack-recording/${packCode}`, {
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
      
      const responseText = await response.text();
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
      
    
      const updateData = {
        id: packId,
        name: pack.name,
        description: pack.description ?? "",
        packMetadataCompressed: packData.trainingData,
        recordingDataCompressed: packData.shotsRecording ?? "",
        totalShots: packData.numShots ?? pack.totalShots,
        tags: pack.tags,
        difficulty: pack.difficulty ?? 1,
        visibility: pack.visibility,
      };
      
      // submit
      await updatePack.mutateAsync(updateData);
    } catch (error) {
      setIsSubmitting(false);
      setErrorMessage("Error updating pack: " + (error instanceof Error ? error.message : String(error)));
      console.error("Error updating pack:", error);
    }
  };

  if (!pack && !isLoading && !isError) {
    return (
      <div className="container mx-auto p-4 max-w-3xl text-center py-12">
        <div className="bg-yellow-100 border border-yellow-400 text-yellow-800 px-4 py-3 rounded mb-4">
          <p className="font-bold">Training Pack Not Found</p>
          <p>The training pack you&apos;re looking for doesn&apos;t exist or has been removed.</p>
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
  
  return (
    <div className="container mx-auto p-4 max-w-3xl">
      <h1 className="text-2xl font-bold mb-6">Update Training Pack from Plugin</h1>
      
      {errorMessage && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {errorMessage}
        </div>
      )}
      
      {successMessage && (
        <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-4">
          {successMessage}
        </div>
      )}
      
      <div className="bg-white p-6 rounded-lg shadow-md">
        <div className="mb-6">
          <h2 className="text-xl font-semibold mb-2">{pack?.name}</h2>
          <p className="text-gray-600 mb-4">
            This will update the training data for this pack from the currently loaded pack in your game.
            The pack&apos;s metadata (name, description, tags, etc.) will remain the same.
          </p>
          
          {isConnected ? (
            <div className="bg-green-100 text-green-700 p-3 rounded mb-4">
              <p className="font-medium">✓ Plugin Connected</p>
              <p className="text-sm">Your game is running with the VersatileTraining plugin.</p>
            </div>
          ) : (
            <div className="bg-yellow-100 text-yellow-800 p-3 rounded mb-4">
              <p className="font-medium">⚠ Plugin Not Detected</p>
              <p className="text-sm">Please make sure Rocket League is running with the VersatileTraining plugin.</p>
            </div>
          )}
          
          <div className="mt-4 text-sm text-gray-600 bg-gray-100 p-3 rounded">
            <p className="font-medium">Important:</p>
            <ul className="list-disc list-inside space-y-1 mt-1">
              <li>Make sure you have loaded the correct training pack in your game</li>
              <li>Use the pack code: <span className="font-mono bg-gray-200 px-1 rounded">{pack?.code ?? packId}</span></li>
              <li>Any changes to shots or ball/car positions will be updated</li>
              <li>This will replace the current pack data on the server</li>
            </ul>
          </div>
        </div>
        
        <div className="flex gap-4 pt-4">
          <Link
            href={`/training-packs/${pack?.id}`}
            className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-100"
          >
            Cancel
          </Link>
          
          <button
            onClick={handleUpdateFromPlugin}
            disabled={isSubmitting || !isConnected}
            className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-2 rounded-md disabled:bg-purple-400 flex items-center"
          >
            {isSubmitting ? (
              <>
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Updating...
              </>
            ) : (
              "Update from Plugin"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}