"use client";

import { useParams } from "next/navigation";
import { api } from "~/trpc/react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { saveAs } from "file-saver";
import { usePluginConnection } from "~/hooks/usePluginConnection";
import { useState, useEffect } from "react";

// Define interfaces for better type safety
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

// Function to decode base64 to a Uint8Array
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
    // Check bounds
    if (byteIndex >= bitstream.length) {
      console.error("Bit index out of bounds:", byteIndex, "length:", bitstream.length);
      break;
    }
    
    if (bitstream[byteIndex] & (1 << (7 - bitOffset))) {
      value |= (1 << (numBits - 1 - i));
    }

    // Increment bit position
    bitOffset++;
    if (bitOffset === 8) {
      bitOffset = 0;
      byteIndex++;
    }
  }

  bitIndex.value += numBits;
  return value;
}

function calculateRequiredBits(range: number): number {
  return Math.ceil(Math.log2(range));
}

function decompressIntegers(
  output: number[],
  globalMin: number,
  numBits: number,
  bitstream: Uint8Array,
  bitIndex: { value: number }
): void {
  for (let i = 0; i < output.length; i++) {
    const compressed = readBits(bitstream, bitIndex, numBits);
    output[i] = compressed + globalMin;
  }
}

// Decompress boolean values
function decompressBits(
  output: boolean[],
  bitstream: Uint8Array,
  bitIndex: { value: number }
): void {
  for (let i = 0; i < output.length; i++) {
    output[i] = readBits(bitstream, bitIndex, 1) === 1;
  }
}

function decompressVectors(
  vectors: Vector[],
  maxMagnitude: number,
  bitstream: Uint8Array,
  bitIndex: { value: number }
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

// Debug function to help diagnose issues
function debugBitstream(bitstream: Uint8Array, maxBytes: number = 16): void {
  const bytes = Array.from(bitstream.slice(0, maxBytes))
    .map(b => b.toString(16).padStart(2, '0'))
    .join(' ');
  
  console.log(`Bitstream (${bitstream.length} bytes): ${bytes}${bitstream.length > maxBytes ? '...' : ''}`);
  
  // Show binary for first few bytes
  const binary = Array.from(bitstream.slice(0, 4))
    .map(b => b.toString(2).padStart(8, '0'))
    .join(' ');
  
  console.log(`First 4 bytes in binary: ${binary}`);
}

function decodeTrainingPack(base64String: string): DecodedTrainingPack | null {
  try {
    
    const TRAINING_CODE_FLAG_BITS = 1;
    const TRAINING_CODE_CHARS = 19; 
    const NAME_LEN_BITS = 5; 
    const NUM_SHOTS_BITS = 6; 
    const BOOST_MIN_BITS = 7;
    const VELOCITY_MIN_BITS = 12; 
    const GOAL_X_MIN_BITS = 11; 
    const GOAL_Z_MIN_BITS = 10; 
    const MAX_REASONABLE_SHOTS = 50; 
    
    // Decode base64 to bytes
    const bitstream = base64Decode(base64String);
    
    // Debug the bitstream data to help diagnose issues
    debugBitstream(bitstream);
    
    let bitIndex = { value: 0 };

    // Read header
    const hasCode = readBits(bitstream, bitIndex, TRAINING_CODE_FLAG_BITS) !== 0;
    console.log("Has code:", hasCode);

    // Read code if present
    let code = "";
    if (hasCode) {
      for (let i = 0; i < TRAINING_CODE_CHARS; i++) {
        code += String.fromCharCode(readBits(bitstream, bitIndex, 8));
      }
      console.log("Code:", code);
    }

    // Read pack metadata
    const nameLength = readBits(bitstream, bitIndex, NAME_LEN_BITS);
    if (nameLength === 0 || nameLength > 30) { // Sanity check for name length
      throw new Error(`Invalid name length in header: ${nameLength}`);
    }
    console.log("Name length:", nameLength);

    const numShots = readBits(bitstream, bitIndex, NUM_SHOTS_BITS);
    console.log("Number of shots:", numShots);
    
    // Sanity check to prevent excessive memory allocation
    if (numShots <= 0 || numShots > MAX_REASONABLE_SHOTS) {
      throw new Error(`Invalid number of shots: ${numShots}`);
    }
    
    const minBoost = readBits(bitstream, bitIndex, BOOST_MIN_BITS);
    console.log("Min boost:", minBoost);
    
    const minVelocity = readBits(bitstream, bitIndex, VELOCITY_MIN_BITS);
    console.log("Min velocity:", minVelocity);
    
    const maxMagnitude = readBits(bitstream, bitIndex, 12);
    console.log("Max magnitude:", maxMagnitude);
    
    const minGoalBlockX = readBits(bitstream, bitIndex, GOAL_X_MIN_BITS);
    console.log("Min goal blocker X:", minGoalBlockX);
    
    const minGoalBlockZ = readBits(bitstream, bitIndex, GOAL_Z_MIN_BITS);
    console.log("Min goal blocker Z:", minGoalBlockZ);
    
    // Read packed bits
    const packedBits = readBits(bitstream, bitIndex, 7);
    const numBitsForBoost = (packedBits >> 4) & 0x07;
    const numBitsForVelocity = packedBits & 0x0F;
    console.log("Bits for boost:", numBitsForBoost);
    console.log("Bits for velocity:", numBitsForVelocity);
    
    // Validate bit counts to avoid potential issues
    if (numBitsForBoost > 7) {
      throw new Error(`Invalid boost bit count: ${numBitsForBoost}`);
    }
    if (numBitsForVelocity > 15) {
      throw new Error(`Invalid velocity bit count: ${numBitsForVelocity}`);
    }
    
    const packedGoalBlockerBits = readBits(bitstream, bitIndex, 8);
    const numBitsForXBlocker = (packedGoalBlockerBits >> 4) & 0x0F;
    const numBitsForZBlocker = packedGoalBlockerBits & 0x0F;
    console.log("Bits for X blocker:", numBitsForXBlocker);
    console.log("Bits for Z blocker:", numBitsForZBlocker);
    
    // Validate goal blocker bit counts
    if (numBitsForXBlocker > 15 || numBitsForZBlocker > 15) {
      throw new Error(`Invalid goal blocker bit counts: X=${numBitsForXBlocker}, Z=${numBitsForZBlocker}`);
    }
    
    
    let name = "";
    for (let i = 0; i < nameLength; i++) {
      const charCode = readBits(bitstream, bitIndex, 7);
      // Validate character code is reasonable
      if (charCode < 32 || charCode > 126) {
        console.warn(`Unusual character code in name: ${charCode}`);
      }
      name += String.fromCharCode(charCode);
    }
    console.log("Name:", name);
    
    // Prepare arrays for shot data
    const boostAmounts = new Array(numShots).fill(0);
    const startingVelocities = new Array(numShots).fill(0);
    const extendedVelocities: Vector[] = Array.from(
      { length: numShots }, 
      () => ({ x: 0, y: 0, z: 0 })
    );
    const freezeCar = new Array(numShots).fill(false);
    const hasStartingJump = new Array(numShots).fill(false);
    
    // Decompress boost amounts
    if (numBitsForBoost === 0) {
      boostAmounts.fill(minBoost);
    } else {
      decompressIntegers(boostAmounts, minBoost, numBitsForBoost, bitstream, bitIndex);
    }
    console.log("Boost amounts:", boostAmounts);
    
    // Decompress starting velocities
    if (numBitsForVelocity === 0) {
      startingVelocities.fill(minVelocity);
    } else {
      decompressIntegers(startingVelocities, minVelocity, numBitsForVelocity, bitstream, bitIndex);
    }
    console.log("Starting velocities:", startingVelocities);
    
    // Decompress extended velocities
    if (maxMagnitude === 0) {
      // All zeros, already initialized
    } else {
      decompressVectors(extendedVelocities, maxMagnitude, bitstream, bitIndex);
    }
    console.log("Extended velocities:", extendedVelocities);
    
    // Goal blockers - ensure array size matches expected size (2 coords per shot)
    const xVals = new Array(numShots * 2).fill(0);
    const zVals = new Array(numShots * 2).fill(0);
    
    if (numBitsForXBlocker === 0) {
      xVals.fill(minGoalBlockX);
    } else {
      decompressIntegers(xVals, minGoalBlockX, numBitsForXBlocker, bitstream, bitIndex);
    }
    console.log("X values:", xVals);
    
    if (numBitsForZBlocker === 0) {
      zVals.fill(minGoalBlockZ);
    } else {
      decompressIntegers(zVals, minGoalBlockZ, numBitsForZBlocker, bitstream, bitIndex);
    }
    console.log("Z values:", zVals);
    
    // Decompress boolean flags
    decompressBits(freezeCar, bitstream, bitIndex);
    console.log("Freeze car:", freezeCar);
    
    decompressBits(hasStartingJump, bitstream, bitIndex);
    console.log("Has starting jump:", hasStartingJump);
    
    // Construct result with proper typing
    const shotDetails: ShotDetail[] = [];
    
    // Final validation - ensure arrays have expected length
    if (boostAmounts.length !== numShots || 
        startingVelocities.length !== numShots ||
        extendedVelocities.length !== numShots ||
        freezeCar.length !== numShots ||
        hasStartingJump.length !== numShots ||
        xVals.length !== numShots * 2 ||
        zVals.length !== numShots * 2) {
      throw new Error("Array size mismatch in shot data");
    }
    
    for (let i = 0; i < numShots; i++) {
      // Ensure goal blocker indices are in bounds
      if (i * 2 + 1 >= xVals.length || i * 2 + 1 >= zVals.length) {
        console.error("Goal blocker index out of bounds");
        continue;
      }
      
      shotDetails.push({
        boostAmount: boostAmounts[i],
        startingVelocity: startingVelocities[i],
        extendedVelocity: extendedVelocities[i],
        freezeCar: freezeCar[i],
        hasStartingJump: hasStartingJump[i],
        goalBlocker: {
          firstX: xVals[i * 2],
          firstZ: zVals[i * 2],
          secondX: xVals[i * 2 + 1],
          secondZ: zVals[i * 2 + 1]
        }
      });
    }
    
    // Compare the parsed numShots with the actual shot details array length
    if (shotDetails.length !== numShots) {
      console.warn(`Shot count mismatch: Header says ${numShots}, but actually built ${shotDetails.length}`);
    }
    
    return {
      name,
      code,
      numShots: shotDetails.length, // Use actual count rather than header value
      shotDetails
    };
  } catch (error) {
    console.error("Error decoding training pack:", error);
    return null;
  }
}

export default function TrainingPackDetailPage() {
  const params = useParams();
  const packId = params.id as string;
  const { data: session } = useSession();
  const [loadingToGame, setLoadingToGame] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showShotDetails, setShowShotDetails] = useState(false);
  const [decodedData, setDecodedData] = useState<DecodedTrainingPack | null>(null);
  const [decodeError, setDecodeError] = useState<string | null>(null);

  const copyPackId = () => {
    navigator.clipboard.writeText(packId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000); // Reset after 2 seconds
  };

  const { data: pack, isLoading, error } = api.trainingPack.getByIdForWeb.useQuery(
    { id: packId },
    { enabled: !!packId }
  );
  
  // Get the pack data with metadata for detailed view
  const { data: packWithMetadata, isLoading: metadataLoading } = api.trainingPack.getPackWithMetadata.useQuery(
    { id: packId },
    { enabled: !!packId && showShotDetails && !decodedData }
  );
  
  const getPackForPlugin = api.trainingPack.getByIdForPlugin.useMutation();
  
  const { isConnected, sendTrainingPack } = usePluginConnection({
    port: 7437,
    authToken: "versatile_training_scanner_token",
  });

  // Effect to decode the pack data when metadata is available
  useEffect(() => {
    if (packWithMetadata?.packMetadataCompressed && showShotDetails && !decodedData) {
      try {
        const decoded = decodeTrainingPack(packWithMetadata.packMetadataCompressed);
        setDecodedData(decoded);
        if (!decoded) {
          setDecodeError("Failed to decode training pack data");
        }
      } catch (error) {
        console.error("Error decoding pack:", error);
        setDecodeError("Error decoding pack data: " + (error instanceof Error ? error.message : String(error)));
      }
    }
  }, [packWithMetadata, showShotDetails, decodedData]);

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

  //shot details
  const renderShotDetails = () => {
    if (!showShotDetails) {
      return (
        <button
          onClick={() => setShowShotDetails(true)}
          className="mt-4 text-blue-600 hover:underline"
        >
          Show Shot Details
        </button>
      );
    }

    if (metadataLoading) {
      return <div className="mt-4 text-gray-600">Loading shot details...</div>;
    }

    if (decodeError) {
      return (
        <div className="mt-4">
          <p className="text-red-500">{decodeError}</p>
          <button
            onClick={() => setShowShotDetails(false)}
            className="mt-2 text-blue-600 hover:underline"
          >
            Hide Shot Details
          </button>
        </div>
      );
    }

    if (!decodedData) {
      return <div className="mt-4 text-gray-600">Unable to decode shot details</div>;
    }

    return (
      <div className="mt-6">
        <div className="flex justify-between items-center mb-2">
          <h2 className="text-lg font-semibold">Shot Details</h2>
          <button
            onClick={() => setShowShotDetails(false)}
            className="text-blue-600 hover:underline text-sm"
          >
            Hide Details
          </button>
        </div>
        
        <div className="overflow-x-auto">
          <table className="min-w-full bg-white rounded-lg overflow-hidden">
            <thead className="bg-gray-100">
              <tr>
                <th className="py-2 px-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Shot #</th>
                <th className="py-2 px-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Boost</th>
                <th className="py-2 px-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Velocity</th>
                <th className="py-2 px-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Freeze Car</th>
                <th className="py-2 px-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Starting Jump</th>
                <th className="py-2 px-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Goal Blocker</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {decodedData.shotDetails.map((shot: ShotDetail, index: number) => (
                <tr key={index} className={index % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                  <td className="py-2 px-3 text-sm text-gray-900">{index + 1}</td>
                  <td className="py-2 px-3 text-sm text-gray-900">{shot.boostAmount}</td>
                  <td className="py-2 px-3 text-sm text-gray-900">
                    <span title={`Extended: X:${shot.extendedVelocity.x.toFixed(1)}, Y:${shot.extendedVelocity.y.toFixed(1)}, Z:${shot.extendedVelocity.z.toFixed(1)}`}>
                      {shot.startingVelocity}
                    </span>
                  </td>
                  <td className="py-2 px-3 text-sm text-gray-900">{shot.freezeCar ? "Yes" : "No"}</td>
                  <td className="py-2 px-3 text-sm text-gray-900">{shot.hasStartingJump ? "Yes" : "No"}</td>
                  <td className="py-2 px-3 text-sm text-gray-900">
                    {(shot.goalBlocker.firstX === 910 && shot.goalBlocker.firstZ === 20 && 
                      shot.goalBlocker.secondX === 910 && shot.goalBlocker.secondZ === 20) 
                      ? "None" 
                      : "Active"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
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

          {/* Shot details section */}
          {renderShotDetails()}
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