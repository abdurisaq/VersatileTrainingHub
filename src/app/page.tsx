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
      
      <div className="text-center my-16 md:my-24">
        <h1 className="text-5xl md:text-6xl font-bold mb-6 text-brand-primary dark:text-purple-400">
          VersatileTraining Hub
        </h1>
        <p className="text-xl text-neutral-dark dark:text-neutral-light max-w-3xl mx-auto mb-10">
          Discover, share, and download custom Rocket League training packs 
          created with the VersatileTraining plugin.
        </p>
        
        <div className="mt-8 flex flex-col sm:flex-row justify-center gap-4 sm:gap-6">
          <Link
            href="/training-packs"
            className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-lg text-lg font-medium shadow-md hover:shadow-lg transition-all dark:bg-blue-500 dark:hover:bg-blue-600" 
          >
            Browse Training Packs
          </Link>
          
          <Link
            href="/training-packs/upload"
            className="bg-green-500 hover:bg-green-600 text-white px-8 py-3 rounded-lg text-lg font-medium shadow-md hover:shadow-lg transition-all dark:bg-green-600 dark:hover:bg-green-700" 
          >
            Upload Your Pack
          </Link>
        </div>
      </div>
      
      {latestPacks.items.length > 0 && (
        <div className="my-16 md:my-24"> 
          <h2 className="text-3xl font-bold mb-8 text-center text-slate-800">Latest Training Packs</h2> 
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8"> 
            {latestPacks.items.map((pack) => (
              <div key={pack.id} className="bg-white rounded-xl shadow-lg p-6 hover:shadow-xl transition-shadow duration-300 flex flex-col">
                <Link href={`/training-packs/${pack.id}`} className="group">
                  <h3 className="text-2xl font-semibold text-brand-primary group-hover:text-brand-secondary group-hover:underline mb-2">
                    {pack.name}
                  </h3>
                </Link>
                
                <p className="text-sm text-slate-600 mt-1 mb-3">
                  By <span className="font-medium text-black">{pack.creator.name}</span> • {pack.totalShots} shots
                </p>
                
                <div className="mt-auto pt-3 flex flex-wrap gap-2"> 
                  {pack.tags?.slice(0, 3).map((tag) => (
                    <span key={tag} className="text-xs bg-slate-800 text-white px-3 py-1 rounded-full font-medium border border-slate-700">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
          
          <div className="text-center mt-12">
            <Link
              href="/training-packs"
              className="text-brand-primary hover:text-brand-secondary font-medium text-lg hover:underline dark:text-purple-400 dark:hover:text-purple-300"
            >
              View all training packs →
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}