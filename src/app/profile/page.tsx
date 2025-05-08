import { getServerAuthSession } from "~/server/auth";
import { redirect } from "next/navigation";
import { DeleteAccountButton } from "~/app/components/delete-account-button";

export default async function ProfilePage() {
  const session = await getServerAuthSession();
  
  if (!session) {
    redirect("/auth/signin?callbackUrl=/profile");
  }
  
  return (
    <div className="container mx-auto py-8">
      <h1 className="text-2xl font-bold mb-6">Your Profile</h1>
      
      <div className="bg-white p-6 rounded-lg shadow-md">
        <div className="flex items-center space-x-4 mb-6">
          <div className="h-16 w-16 rounded-full bg-gray-300 flex items-center justify-center text-xl">
            {session.user.name?.[0] || session.user.email?.[0] || "U"}
          </div>
          <div>
            <h2 className="text-xl font-semibold">{session.user.name}</h2>
            <p className="text-gray-600">{session.user.email}</p>
          </div>
        </div>
        
        <div className="border-t pt-4">
          <h3 className="font-medium mb-2">Account Information</h3>
          <p className="text-gray-600 mb-1">User ID: {session.user.id}</p>
          <p className="text-gray-600">Joined: {new Date().toLocaleDateString()}</p>
        </div>
        
        <div className="border-t mt-6 pt-6">
          <h3 className="font-medium text-red-600 mb-2">Danger Zone</h3>
          <p className="text-gray-600 mb-4 text-sm">
            Deleting your account is permanent and will remove all your data including training packs, 
            comments, and ratings. This action cannot be undone.
          </p>
          
          <DeleteAccountButton userId={session.user.id} />
        </div>
      </div>
    </div>
  );
}