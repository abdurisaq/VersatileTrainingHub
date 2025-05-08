import { getServerAuthSession } from "~/server/auth";

export default async function TestAuthPage() {
  const session = await getServerAuthSession();
  
  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">Session Test</h1>
      <pre className="bg-gray-100 p-4 rounded">
        {JSON.stringify(session, null, 2)}
      </pre>
    </div>
  );
}