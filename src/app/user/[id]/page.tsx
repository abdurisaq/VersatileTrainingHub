"use client";

import { useParams } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { api } from "~/trpc/react";
import { type Visibility } from "@prisma/client";


interface Pack {
  id: string;
  name: string;
  code?: string | null;
  totalShots: number;
  tags: string[];
  visibility: Visibility;
  downloadCount: number;
  averageRating?: number | null;
  createdAt: string | Date; // tRPC serializes Date to string
}


function PackCard({ pack }: { pack: Pack }) {
  return (
    <div className="border bg-white rounded-lg shadow hover:shadow-md transition-shadow p-4 flex flex-col">
      <Link href={`/training-packs/${pack.id}`} className="group">
        <h3 className="text-xl font-semibold text-brand-primary group-hover:text-brand-secondary group-hover:underline mb-1">
          {pack.name}
        </h3>
      </Link>
      {pack.code && (
        <p className="text-xs text-gray-500 mb-1">Code: {pack.code}</p>
      )}
      <p className="text-sm text-slate-600 mb-2">
        {pack.totalShots} shots • {pack.downloadCount} downloads
        {pack.averageRating !== null && pack.averageRating !== undefined && (
          <> • Rating: {pack.averageRating.toFixed(1)}/5</>
        )}
      </p>
      {pack.tags && pack.tags.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-1">
          {pack.tags.slice(0, 4).map((tag) => (
            <span
              key={tag}
              className="text-xs bg-slate-800 text-white px-2 py-0.5 rounded-full font-medium"
            >
              {tag}
            </span>
          ))}
        </div>
      )}
      <p className="text-xs text-gray-500 mt-auto">
        Uploaded: {new Date(pack.createdAt).toLocaleDateString()}
      </p>
    </div>
  );
}

export default function UserProfilePage() {
  const params = useParams();
  const userId = params.id as string;

  const { data, isLoading, error } = api.user.getPublicProfile.useQuery(
    { id: userId },
    { enabled: !!userId }
  );

  if (isLoading) {
    return (
      <div className="container mx-auto p-4 text-center">
        <p>Loading profile...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto p-4 text-center text-red-500">
        <p>Error loading profile: {error.message}</p>
      </div>
    );
  }

  if (!data?.user) {
    return (
      <div className="container mx-auto p-4 text-center">
        <p>User not found.</p>
        <Link href="/training-packs" className="text-brand-primary hover:underline mt-4 inline-block">
          Browse Training Packs
        </Link>
      </div>
    );
  }

  const { user, trainingPacks } = data;

  return (
    <div className="container mx-auto p-4 md:p-8">
      <div className="bg-white shadow-lg rounded-lg p-6 md:p-8 mb-8 flex flex-col sm:flex-row items-center gap-4 sm:gap-6">
        {user.image ? (
          <Image
            src={user.image}
            alt={user.name ?? "User avatar"}
            width={96}
            height={96}
            className="rounded-full h-24 w-24 object-cover border-2 border-slate-200"
          />
        ) : (
          <div className="h-24 w-24 rounded-full bg-slate-300 flex items-center justify-center text-3xl text-slate-600">
            {user.name?.charAt(0).toUpperCase()}
          </div>
        )}
        <div>
          <h1 className="text-3xl md:text-4xl font-bold text-slate-800">{user.name ?? "Anonymous User"}</h1>
          <p className="text-slate-600 text-sm">
            Joined: {new Date(user.createdAt).toLocaleDateString()}
          </p>
        </div>
      </div>

      <div>
        <h2 className="text-2xl font-semibold text-slate-700 mb-6">
          Training Packs by {user.name ?? "this user"} ({trainingPacks.length})
        </h2>
        {trainingPacks.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {trainingPacks.map((pack) => (
              <PackCard key={pack.id} pack={pack} />
            ))}
          </div>
        ) : (
          <div className="bg-slate-50 rounded-lg p-8 text-center">
            <p className="text-slate-500">
              {user.name ?? "This user"} hasn't published any training packs yet.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}