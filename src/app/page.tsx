import Link from "next/link";
import { api } from "~/trpc/server";
import { DeletionMessage } from "./components/deletion-message";

export default async function Home() {
  const latestPacks = await api.trainingPack.listPublic({
    limit: 3,
  });

  return (
    <div className="container mx-auto px-4 py-8">
      <DeletionMessage />
      
      <div className="text-center my-12">
        <h1 className="text-4xl md:text-5xl font-bold mb-4">
          VersatileTraining Hub
        </h1>
        <p className="text-xl text-gray-600 max-w-3xl mx-auto">
          Discover, share, and download custom Rocket League training packs 
          created with the VersatileTraining plugin.
        </p>
        
        <div className="mt-8 flex flex-col sm:flex-row justify-center gap-4">
          <Link
            href="/training-packs"
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-md text-lg"
          >
            Browse Training Packs
          </Link>
          
          <Link
            href="/training-packs/upload"
            className="bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-md text-lg"
          >
            Upload Your Pack
          </Link>
        </div>
      </div>
      
      {latestPacks.items.length > 0 && (
        <div className="mt-16">
          <h2 className="text-2xl font-bold mb-6">Latest Training Packs</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {latestPacks.items.map((pack) => (
              <div key={pack.id} className="border bg-white rounded-lg shadow p-4">
                <Link href={`/training-packs/${pack.id}`}>
                  <h3 className="text-xl font-semibold text-blue-600 hover:underline">
                    {pack.name}
                  </h3>
                </Link>
                
                <p className="text-sm text-gray-600 mt-1">
                  By {pack.creator.name} • {pack.totalShots} shots
                </p>
                
                <div className="mt-3 flex flex-wrap gap-1">
                  {pack.tags?.slice(0, 3).map((tag) => (
                    <span key={tag} className="text-xs bg-gray-200 text-gray-700 px-2 py-1 rounded-full">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
          
          <div className="text-center mt-8">
            <Link
              href="/training-packs"
              className="text-blue-600 hover:underline"
            >
              View all training packs →
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}