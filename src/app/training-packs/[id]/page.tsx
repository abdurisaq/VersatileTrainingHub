"use client";

import { useParams } from "next/navigation";
import { api } from "~/trpc/react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { saveAs } from "file-saver";
import { usePluginConnection } from "~/hooks/usePluginConnection";
import { useState, useEffect } from "react";
import type {FormEvent} from "react";
import { useQueryClient } from "@tanstack/react-query";
import toast from 'react-hot-toast'; 


interface Vector {
  x: number;
  y: number;
  z: number;
}

interface ShotDetail {
  boostAmount: number;
  startingVelocity: number;
  extendedVelocity: Vector;
  freezeCar: boolean;
  hasStartingJump: boolean;
  goalBlocker: {
    firstX: number;
    firstZ: number;
    secondX: number;
    secondZ: number;
  };
}

interface DecodedTrainingPack {
  name: string;
  code: string;
  numShots: number;
  shotDetails: ShotDetail[];
}

function base64Decode(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

function readBits(
  bitstream: Uint8Array, 
  bitIndex: { value: number }, 
  numBits: number
): number {
  let value = 0;
  let byteIndex = Math.floor(bitIndex.value / 8);
  let bitOffset = bitIndex.value % 8;

  for (let i = 0; i < numBits; i++) {
    if (byteIndex >= bitstream.length) break;
    if (bitstream[byteIndex]! & (1 << (7 - bitOffset))) {
      value |= (1 << (numBits - 1 - i));
    }
    bitOffset++;
    if (bitOffset === 8) {
      bitOffset = 0;
      byteIndex++;
    }
  }
  bitIndex.value += numBits;
  return value;
}

function decompressIntegers(
  output: number[], globalMin: number, numBits: number,
  bitstream: Uint8Array, bitIndex: { value: number }
): void {
  for (let i = 0; i < output.length; i++) {
    const compressed = readBits(bitstream, bitIndex, numBits);
    output[i] = compressed + globalMin;
  }
}

function decompressBits(
  output: boolean[], bitstream: Uint8Array, bitIndex: { value: number }
): void {
  for (let i = 0; i < output.length; i++) {
    output[i] = readBits(bitstream, bitIndex, 1) === 1;
  }
}

function decompressVectors(
  vectors: Vector[], maxMagnitude: number,
  bitstream: Uint8Array, bitIndex: { value: number }
): void {
  const numBits = 16; 
  const range = 2.0 * maxMagnitude;
  const scale = 1.0 / ((1 << numBits) - 1);
  for (let i = 0; i < vectors.length; i++) {
    const xBits = readBits(bitstream, bitIndex, numBits);
    const yBits = readBits(bitstream, bitIndex, numBits);
    const zBits = readBits(bitstream, bitIndex, numBits);
    vectors[i] = {
      x: (xBits * scale * range) - maxMagnitude,
      y: (yBits * scale * range) - maxMagnitude,
      z: (zBits * scale * range) - maxMagnitude
    };
  }
}

function decodeTrainingPack(base64String: string): DecodedTrainingPack | null {
  try {
    const TRAINING_CODE_FLAG_BITS = 1;
    const TRAINING_CODE_CHARS = 19; 
    const NAME_LEN_BITS = 5; 
    const NUM_SHOTS_BITS = 6; 
    const BOOST_MIN_BITS = 7; 
    const VELOCITY_MIN_BITS = 12; 
    const MAX_REASONABLE_SHOTS = 50; 
    
    const bitstream = base64Decode(base64String);
    const bitIndex = { value: 0 };

    const hasCode = readBits(bitstream, bitIndex, TRAINING_CODE_FLAG_BITS) !== 0;
    let code = "";
    if (hasCode) {
      for (let i = 0; i < TRAINING_CODE_CHARS; i++) code += String.fromCharCode(readBits(bitstream, bitIndex, 8));
    }

    const nameLength = readBits(bitstream, bitIndex, NAME_LEN_BITS);
    if (nameLength === 0 || nameLength > 30) throw new Error(`Invalid name length: ${nameLength}`);
    const numShots = readBits(bitstream, bitIndex, NUM_SHOTS_BITS);
    if (numShots <= 0 || numShots > MAX_REASONABLE_SHOTS) throw new Error(`Invalid num shots: ${numShots}`);
    
    const minBoost = readBits(bitstream, bitIndex, BOOST_MIN_BITS);
    const minVelocity = readBits(bitstream, bitIndex, VELOCITY_MIN_BITS);
    const maxMagnitude = readBits(bitstream, bitIndex, 12); 
    const minGoalBlockX = readBits(bitstream, bitIndex, VELOCITY_MIN_BITS); 
    const minGoalBlockZ = readBits(bitstream, bitIndex, VELOCITY_MIN_BITS); 
    
    const packedBits = readBits(bitstream, bitIndex, 7);
    const numBitsForBoost = (packedBits >> 4) & 0x07;
    const numBitsForVelocity = packedBits & 0x0F;
    if (numBitsForBoost > 7 || numBitsForVelocity > 15) throw new Error("Invalid boost/velocity bit counts");

    const packedGoalBlockerBits = readBits(bitstream, bitIndex, 8);
    const numBitsForXBlocker = (packedGoalBlockerBits >> 4) & 0x0F;
    const numBitsForZBlocker = packedGoalBlockerBits & 0x0F;
    if (numBitsForXBlocker > 15 || numBitsForZBlocker > 15) throw new Error("Invalid goal blocker bit counts");
    
    let name = "";
    for (let i = 0; i < nameLength; i++) name += String.fromCharCode(readBits(bitstream, bitIndex, 7));
    
    const boostAmounts = new Array(numShots).fill(0) as number[];
    const startingVelocities = new Array(numShots).fill(0) as number[];
    const extendedVelocities = Array.from({ length: numShots }, () => ({ x: 0, y: 0, z: 0 })) as Vector[];
    const freezeCar = new Array(numShots).fill(false) as boolean[];
    const hasStartingJump = new Array(numShots).fill(false) as boolean[];
    
    if (numBitsForBoost === 0) {
      boostAmounts.fill(minBoost);
    } else {
      decompressIntegers(boostAmounts, minBoost, numBitsForBoost, bitstream, bitIndex);
    }
    
    if (numBitsForVelocity === 0) {
      startingVelocities.fill(minVelocity);
    } else {
      decompressIntegers(startingVelocities, minVelocity, numBitsForVelocity, bitstream, bitIndex);
    }
    
    if (maxMagnitude !== 0) decompressVectors(extendedVelocities, maxMagnitude, bitstream, bitIndex);
    
    const xVals = new Array(numShots * 2).fill(0) as number[];
    const zVals = new Array(numShots * 2).fill(0) as number[];
    
    if (numBitsForXBlocker === 0) {
      xVals.fill(minGoalBlockX);
    } else {
      decompressIntegers(xVals, minGoalBlockX, numBitsForXBlocker, bitstream, bitIndex);
    }
    
    if (numBitsForZBlocker === 0) {
      zVals.fill(minGoalBlockZ);
    } else {
      decompressIntegers(zVals, minGoalBlockZ, numBitsForZBlocker, bitstream, bitIndex);
    }
    
    decompressBits(freezeCar, bitstream, bitIndex);
    decompressBits(hasStartingJump, bitstream, bitIndex);
    
    const shotDetails: ShotDetail[] = [];
    for (let i = 0; i < numShots; i++) {
      if (i * 2 + 1 >= xVals.length || i * 2 + 1 >= zVals.length) continue; // Bounds check
      const detail: ShotDetail = {
        boostAmount: boostAmounts[i]!,
        startingVelocity: startingVelocities[i]! - 2000,
        extendedVelocity: extendedVelocities[i]!,
        freezeCar: freezeCar[i]!,
        hasStartingJump: hasStartingJump[i]!,
        goalBlocker: {
          firstX: xVals[i * 2]! - 910, 
          firstZ: zVals[i * 2]! - 20,
          secondX: xVals[i * 2 + 1]! - 910, 
          secondZ: zVals[i * 2 + 1]! - 20
        }
      };
      shotDetails.push(detail);
    }
    return { name, code, numShots: shotDetails.length, shotDetails };
  } catch (error) {
    console.error("Error decoding training pack:", error);
    return null;
  }
}

interface StarRatingProps {
  rating: number;
  onRatingChange?: (rating: number) => void;
  readOnly?: boolean;
  maxStars?: number;
}

const StarRating: React.FC<StarRatingProps> = ({ rating, onRatingChange, readOnly = false, maxStars = 5 }) => {
  const [hoverRating, setHoverRating] = useState(0);

  return (
    <div className="flex items-center">
      {[...Array<number>(maxStars)].map((_, index) => {
        const starValue = index + 1;
        return (
          <button
            key={starValue}
            type="button"
            disabled={readOnly}
            className={`text-2xl focus:outline-none ${readOnly ? 'cursor-default' : 'cursor-pointer'}`}
            onClick={() => !readOnly && onRatingChange && onRatingChange(starValue)}
            onMouseEnter={() => !readOnly && setHoverRating(starValue)}
            onMouseLeave={() => !readOnly && setHoverRating(0)}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className={`h-6 w-6 ${starValue <= (hoverRating || rating) ? 'text-yellow-400' : 'text-gray-300'}`}
              fill="currentColor"
              viewBox="0 0 24 24"
            >
              <path d="M12 .587l3.668 7.568 8.332 1.151-6.064 5.828 1.48 8.279L12 18.896l-7.416 4.517 1.48-8.279-6.064-5.828 8.332-1.151L12 .587z" />
            </svg>
          </button>
        );
      })}
    </div>
  );
};


export default function TrainingPackDetailPage() {
  const params = useParams();
  const packId = params.id as string;
  const { data: session } = useSession();
  const queryClient = useQueryClient();

  const [loadingToGame, setLoadingToGame] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showShotDetails, setShowShotDetails] = useState(false);
  const [decodedData, setDecodedData] = useState<DecodedTrainingPack | null>(null);
  const [decodeError, setDecodeError] = useState<string | null>(null);
  
  const [newComment, setNewComment] = useState("");
  const [replyToCommentId, setReplyToCommentId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  const [userRating, setUserRating] = useState<number | null>(null); // Stores the current user's rating for this pack
  const [isFavorited, setIsFavorited] = useState<boolean | null>(null);
  
  const { data: packResult, isLoading: packLoading, error: packError, refetch: refetchPack } = api.trainingPack.getByIdForWeb.useQuery(
    { id: packId },
    { enabled: !!packId }
  );
  const pack = packResult; 

  useEffect(() => {
    if (pack) {
      setIsFavorited(pack.isFavoritedByCurrentUser);
    }
  }, [pack]);

  const { data: userRatingData, refetch: refetchUserRating } = api.trainingPack.getUserRatingForPack.useQuery(
    { trainingPackId: packId },
    { enabled: !!packId && !!session?.user }
  );

  useEffect(() => {
    if (userRatingData) {
      setUserRating(userRatingData.value);
    }
  }, [userRatingData]);
  
  const { data: comments, isLoading: commentsLoading, refetch: refetchComments } = api.trainingPack.listCommentsForPack.useQuery(
    { trainingPackId: packId },
    { enabled: !!packId && !!session?.user } // only if loggged in
  );
  
  const { data: packWithMetadata, isLoading: metadataLoading } = api.trainingPack.getPackWithMetadata.useQuery(
    { id: packId },
    { enabled: !!packId && showShotDetails && !decodedData }
  );
  
  const getPackForPlugin = api.trainingPack.getByIdForPlugin.useMutation();
  
  const { isConnected, sendTrainingPack } = usePluginConnection({
    port: 7437, 
    authToken: "versatile_training_scanner_token", 
  });

  useEffect(() => {
    if (packWithMetadata?.packMetadataCompressed && showShotDetails && !decodedData) {
      try {
        const decoded = decodeTrainingPack(packWithMetadata.packMetadataCompressed);
        setDecodedData(decoded);
        if (!decoded) setDecodeError("Failed to decode training pack data. The format might be unrecognized or corrupted.");
      } catch (error) {
        console.error("Decoding error:", error);
        setDecodeError("Error decoding pack data: " + (error instanceof Error ? error.message : String(error)));
      }
    }
  }, [packWithMetadata, showShotDetails, decodedData]);

  const copyPackId = async () => {
    await navigator.clipboard.writeText(packId);
    setCopied(true);
    toast.success("Pack ID copied!");
    setTimeout(() => setCopied(false), 2000); 
  };

  const toggleFavoriteMutation = api.trainingPack.toggleFavorite.useMutation({
    onMutate: () => {
      setIsFavorited(current => !current);
    },
    onSuccess: (data) => {
      void queryClient.invalidateQueries({ queryKey: [["trainingPack", "getByIdForWeb"], { id: packId }] });
      toast.success(data.favorited ? "Added to favorites!" : "Removed from favorites.");
    },
    onError: (error) => {
      setIsFavorited(pack?.isFavoritedByCurrentUser ?? false);
      toast.error("Failed to update favorites: " + error.message);
    },
  });

  const submitRatingMutation = api.trainingPack.submitOrUpdateRating.useMutation({
    onSuccess: (data) => {
      toast.success(`Rated ${data.userRating} stars!`);
      void refetchPack();
      void refetchUserRating();
    },
    onError: (error) => {
      toast.error("Failed to submit rating: " + error.message);
    },
  });

  const addCommentMutation = api.trainingPack.addComment.useMutation({
    onSuccess: () => {
      toast.success("Comment added!");
      setNewComment(""); // Clear the main comment input
      setReplyText("");   // Clear reply input
      setReplyToCommentId(null); // Close reply form
      void refetchComments(); // Refetch comments to show the new one
    },
    onError: (error) => {
      toast.error("Failed to add comment: " + error.message);
    },
  });
 
  const handleToggleFavorite = () => {
    if (!session?.user) {
      toast.error("Please log in to favorite packs.");
      return;
    }
    if (pack) {
      void toggleFavoriteMutation.mutate({ trainingPackId: pack.id });
    }
  };

  const handleRatingSubmit = (newRatingValue: number) => {
    if (!session?.user) {
      toast.error("Please log in to rate packs.");
      return;
    }
    setUserRating(newRatingValue); 
    void submitRatingMutation.mutate({ trainingPackId: packId, value: newRatingValue });
  };

  const handleAddComment = (e: FormEvent) => {
    e.preventDefault();
    if (!session?.user) {
      toast.error("Please log in to comment.");
      return;
    }
    if (!newComment.trim()) {
      toast.error("Comment cannot be empty.");
      return;
    }
    void addCommentMutation.mutate({ trainingPackId: packId, text: newComment, parentId: null });
  };

  const handleAddReply = (parentId: string) => (e: FormEvent) => {
    e.preventDefault();
    if (!session?.user) {
      toast.error("Please log in to reply.");
      return;
    }
    if (!replyText.trim()) {
      toast.error("Reply cannot be empty.");
      return;
    }
    void addCommentMutation.mutate({ trainingPackId: packId, text: replyText, parentId });
  };

  const handleDownload = async () => {
    if (!pack) return;
    try {
      const packDataForPlugin = await getPackForPlugin.mutateAsync({ id: packId });
      if (packDataForPlugin) {
        const jsonData = JSON.stringify(packDataForPlugin, null, 2);
        const blob = new Blob([jsonData], { type: "application/json;charset=utf-8" });
        const safePackName = (packDataForPlugin.name || pack.name).replace(/[^a-z0-9_.-]/gi, "_") || "training_pack";
        saveAs(blob, `${safePackName}.json`);
        toast.success("Download started!");
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      toast.error(`Error downloading pack: ${errorMessage}`);
    }
  };

  const handleLoadInGame = async () => {
    if (!isConnected) {
      toast.error("Game with plugin not detected. Please ensure Rocket League is running with the VersatileTraining plugin.");
      return;
    }
    if (!pack) return;
    try {
      setLoadingToGame(true);
      const packDataForPlugin = await getPackForPlugin.mutateAsync({ id: packId });
      if (packDataForPlugin) {
        const success = await sendTrainingPack(packDataForPlugin);
        if (success) {
          toast.success("Pack sent to game!");
        } else {
          toast.error("Failed to load pack into game. Check plugin console.");
        }
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      toast.error(`Error loading pack in game: ${errorMessage}`);
    }
    
    finally {
      setLoadingToGame(false);
    }
  };
  
  const renderShotDetails = () => {
    if (!showShotDetails) return <button onClick={() => setShowShotDetails(true)} className="mt-4 text-blue-600 hover:underline">Show Shot Details</button>;
    if (metadataLoading) return <div className="mt-4 text-gray-600">Loading shot details...</div>;
    if (decodeError) return <div className="mt-4"><p className="text-red-500">{decodeError}</p><button onClick={() => setShowShotDetails(false)} className="mt-2 text-blue-600 hover:underline">Hide Details</button></div>;
    if (!decodedData) return <div className="mt-4 text-gray-600">Unable to decode shot details.</div>;
    return (
      <div className="mt-6">
        <div className="flex justify-between items-center mb-2">
          <h2 className="text-lg font-semibold">Shot Details ({decodedData.numShots})</h2>
          <button onClick={() => setShowShotDetails(false)} className="text-blue-600 hover:underline text-sm">Hide Details</button>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full bg-white rounded-lg overflow-hidden">
            <thead className="bg-gray-100">
              <tr>
                <th className="py-2 px-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">#</th>
                <th className="py-2 px-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Boost</th>
                <th className="py-2 px-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Velocity</th>
                <th className="py-2 px-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Freeze</th>
                <th className="py-2 px-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Jump</th>
                <th className="py-2 px-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Blocker</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {decodedData.shotDetails.map((shot, index) => (
                <tr key={index} className={index % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                  <td className="py-2 px-3 text-sm text-gray-900">{index + 1}</td>
                  <td className="py-2 px-3 text-sm text-gray-900">{shot.boostAmount}</td>
                  <td className="py-2 px-3 text-sm text-gray-900" title={`X:${shot.extendedVelocity.x.toFixed(0)},Y:${shot.extendedVelocity.y.toFixed(0)},Z:${shot.extendedVelocity.z.toFixed(0)}`}>{shot.startingVelocity}</td>
                  <td className="py-2 px-3 text-sm text-gray-900">{shot.freezeCar ? "Yes" : "No"}</td>
                  <td className="py-2 px-3 text-sm text-gray-900">{shot.hasStartingJump ? "Yes" : "No"}</td>
                  <td className="py-2 px-3 text-sm text-gray-900">{(shot.goalBlocker.firstX === 910 && shot.goalBlocker.firstZ === 20 && shot.goalBlocker.secondX === 910 && shot.goalBlocker.secondZ === 20) ? "None" : "Active"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  if (packLoading) return <div className="text-center p-8">Loading training pack...</div>;
  if (packError) return <div className="text-center text-red-500 p-8">Error: {packError.message}</div>;
  if (!pack) return <div className="text-center p-8">Training pack not found.</div>;

  return (
    <div className="container mx-auto p-4 max-w-4xl">
      <div className="bg-white rounded-lg shadow-md p-6">
        {/* Pack Info Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start mb-6">
          <div>
            <h1 className="text-3xl font-bold mb-1">{pack.name}</h1>
            <p className="text-gray-600 text-sm">
              By {pack.creator ? <Link href={`/user/${pack.creator.id}`} className="text-blue-600 hover:underline">{pack.creator.name}</Link> : "Unknown User"}
              {' • '}Uploaded: {new Date(pack.createdAt).toLocaleDateString()}
              {new Date(pack.updatedAt).getTime() !== new Date(pack.createdAt).getTime() && ` • Updated: ${new Date(pack.updatedAt).toLocaleDateString()}`}
            </p>
          </div>
          {session?.user && (
            <button
              onClick={handleToggleFavorite}
              disabled={toggleFavoriteMutation.isPending}
              className={`p-2 rounded-full transition-colors duration-150 ${
                isFavorited ?? pack.isFavoritedByCurrentUser
                  ? 'text-red-500 bg-red-100 hover:bg-red-200' 
                  : 'text-gray-500 hover:bg-gray-100 hover:text-red-400'
              }`}
              title={isFavorited ?? pack.isFavoritedByCurrentUser ? "Remove from Favorites" : "Add to Favorites"}
            >
              <svg 
                xmlns="http://www.w3.org/2000/svg" 
                className="h-6 w-6" 
                fill={isFavorited ?? pack.isFavoritedByCurrentUser ? "currentColor" : "none"} 
                viewBox="0 0 24 24" 
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
              </svg>
            </button>
          )}
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4 mb-6">
          <div>
            {pack.description && (
              <div className="mb-4">
                <h2 className="text-lg font-semibold mb-1">Description</h2>
                <p className="text-gray-700 whitespace-pre-wrap">{pack.description}</p>
              </div>
            )}
            {pack.tags && pack.tags.length > 0 && (
              <div className="mb-4">
                <h2 className="text-lg font-semibold mb-1">Tags</h2>
                <div className="flex flex-wrap gap-2">
                  {pack.tags.map((tag) => (
                    <span key={tag} className="bg-blue-100 text-blue-800 px-2 py-1 text-sm rounded-full">{tag}</span>
                  ))}
                </div>
              </div>
            )}
          </div>
          <div className="text-sm text-gray-700 space-y-1">
            {pack.code && <p><span className="font-semibold">Official Code:</span> <code className="bg-gray-100 px-1 rounded">{pack.code}</code></p>}
            <p><span className="font-semibold">Difficulty:</span> {pack.difficulty ?? "N/A"}</p>
            <p><span className="font-semibold">Shots:</span> {pack.totalShots}</p>
            <p><span className="font-semibold">Downloads:</span> {pack.downloadCount}</p>
            <p><span className="font-semibold">Visibility:</span> {pack.visibility}</p>
            <div className="flex items-center gap-1 pt-1">
              <span className="font-semibold">Pack ID:</span>
              <code className="bg-gray-100 px-1 rounded text-xs">{pack.id}</code>
              <button onClick={copyPackId} title="Copy ID" className="text-blue-500 hover:text-blue-700 p-0.5">
                {copied ? <span className="text-green-500 text-xs">✓ Copied</span> : <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" /></svg>}
              </button>
            </div>
          </div>
        </div>

        {/* ratings */}
        <div className="mb-8 p-4 border rounded-lg bg-gray-50">
          <h2 className="text-xl font-semibold mb-3">Rate this Pack</h2>
          <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-6">
            <div>
              <p className="text-sm text-gray-600 mb-1">Average Rating:</p>
              <div className="flex items-center">
                <StarRating rating={pack.averageRating ?? 0} readOnly />
                <span className="ml-2 text-gray-700 text-sm">
                  {pack.averageRating != null && pack.averageRating > 0 ? pack.averageRating.toFixed(1) : 'N/A'} ({pack.ratingCount ?? 0} ratings)
                </span>
              </div>
            </div>
            {session?.user && (
              <div className="sm:ml-auto">
                <p className="text-sm text-gray-600 mb-1">Your Rating:</p>
                <StarRating rating={userRating ?? 0} onRatingChange={handleRatingSubmit} />
              </div>
            )}
            {!session?.user && <p className="text-sm text-gray-500 sm:ml-auto mt-2 sm:mt-0">Log in to rate this pack.</p>}
          </div>
        </div>

       
        <div className="flex flex-wrap gap-3 mb-8">
          <button onClick={handleDownload} disabled={getPackForPlugin.isPending} className="bg-green-600 hover:bg-green-700 text-white py-2 px-4 rounded disabled:bg-green-400">
            {getPackForPlugin.isPending ? "Preparing..." : "Download (.json)"}
          </button>
          {isConnected && (
            <button onClick={handleLoadInGame} disabled={loadingToGame || getPackForPlugin.isPending} className="bg-purple-600 hover:bg-purple-700 text-white py-2 px-4 rounded disabled:bg-purple-400 flex items-center justify-center">
              {loadingToGame ? (<><svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>Loading...</>) : "Load in Game"}
            </button>
          )}
          {session?.user?.id === pack.creatorId && (
            <>
              <Link href={`/training-packs/${pack.id}/edit`} className="bg-blue-600 hover:bg-blue-700 text-white text-center py-2 px-4 rounded">Edit Details</Link>
              <Link href={`/training-packs/${pack.id}/update`} className="bg-orange-500 hover:bg-orange-600 text-white text-center py-2 px-4 rounded">Update from Plugin</Link>
            </>
          )}
        </div>
        {!isConnected && (
          <div className="mb-8 text-sm text-gray-600 bg-gray-100 p-3 rounded">
            <p className="font-medium">Want to load packs directly into the game?</p>
            <p>Launch Rocket League with the VersatileTraining plugin to enable one-click loading.</p>
          </div>
        )}

        {/*decode */}
        <div className="mb-8">
          {renderShotDetails()}
        </div>

        
        {session?.user ? (
          <div className="mt-8 pt-6 border-t">
            <h2 className="text-xl font-semibold mb-4">Comments ({pack._count?.comments ?? 0})</h2>
            <form onSubmit={handleAddComment} className="mb-6">
              <textarea
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder="Write a comment..."
                className="w-full p-2 border rounded-md focus:ring-blue-500 focus:border-blue-500"
                rows={3}
                maxLength={1000}
              />
              <button type="submit" disabled={addCommentMutation.isPending} className="mt-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md disabled:bg-blue-400">
                {addCommentMutation.isPending ? "Posting..." : "Post Comment"}
              </button>
            </form>

            {commentsLoading ? (
              <p className="text-gray-500">Loading comments...</p>
            ) : comments && comments.length > 0 ? (
              <div className="space-y-6">
                {comments.map((comment) => (
                  <div key={comment.id} className="p-4 bg-gray-50 rounded-lg">
                    <div className="flex-grow">
                      <div className="flex items-center justify-between mb-2">
                        <p className="font-semibold text-sm">{comment.user.name ?? "Anonymous"}</p>
                        <p className="text-xs text-gray-500">{new Date(comment.createdAt).toLocaleString()}</p>
                      </div>
                      <p className="text-gray-800 whitespace-pre-wrap">{comment.text}</p>
                    </div>
                    
                    <button 
                      onClick={() => setReplyToCommentId(replyToCommentId === comment.id ? null : comment.id)} 
                      className="text-xs text-blue-500 hover:underline mt-2"
                    >
                      {replyToCommentId === comment.id ? "Cancel Reply" : "Reply"}
                    </button>

                    {replyToCommentId === comment.id && (
                      <form onSubmit={handleAddReply(comment.id)} className="mt-2">
                        <textarea
                          value={replyText}
                          onChange={(e) => setReplyText(e.target.value)}
                          placeholder={`Replying to ${comment.user.name ?? "User"}...`}
                          className="w-full p-2 border rounded-md text-sm"
                          rows={2}
                          maxLength={1000}
                        />
                        <button type="submit" disabled={addCommentMutation.isPending} className="mt-1 bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded-md text-xs disabled:bg-blue-300">
                          {addCommentMutation.isPending ? "Replying..." : "Post Reply"}
                        </button>
                      </form>
                    )}

                    
                    {comment.replies && comment.replies.length > 0 && (
                      <div className="mt-3 space-y-3 pl-4 border-l-2 border-gray-200">
                        {comment.replies.map(reply => (
                          <div key={reply.id} className="bg-gray-100 p-3 rounded-md">
                             <div className="flex-grow">
                                <div className="flex items-center justify-between mb-1">
                                  <p className="font-semibold text-xs">{reply.user.name ?? "Anonymous"}</p>
                                  <p className="text-xs text-gray-500">{new Date(reply.createdAt).toLocaleString()}</p>
                                 </div>
                                <p className="text-gray-700 text-sm whitespace-pre-wrap">{reply.text}</p>
                             </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500">No comments yet. Be the first to comment!</p>
            )}
          </div>
        ) : (
          
          <div className="mt-8 pt-6 border-t">
            <div className="text-center p-8 bg-gray-50 rounded-lg">
              <h2 className="text-xl font-semibold mb-2">Comments</h2>
              <p className="text-gray-600 mb-4">Sign in to view and post comments</p>
              <Link 
                href={`/api/auth/signin?callbackUrl=/training-packs/${packId}`}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md"
              >
                Sign In
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}