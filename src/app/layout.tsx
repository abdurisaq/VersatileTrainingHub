import "~/styles/globals.css";
import { Inter } from "next/font/google";
import { TRPCReactProvider } from "~/trpc/react";
import { headers } from "next/headers";
import { getServerAuthSession } from "~/server/auth";
import { Providers } from "./providers";
import { UserNav } from "~/app/components/user-nav";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
});

export const metadata = {
  title: "VersatileTraining Hub",
  description: "Share and discover Rocket League training packs",
  icons: [{ rel: "icon", url: "/favicon.ico" }],
};

async function NavBar() {
  const session = await getServerAuthSession();
  
  return (
    <nav className="bg-gray-800 text-white p-4">
      <div className="container mx-auto flex justify-between items-center">
        <a href="/" className="text-xl font-bold">
          VersatileTraining Hub
        </a>
        
        <div className="flex items-center space-x-6">
          <a href="/training-packs" className="hover:text-gray-300">
            Browse Packs
          </a>
          
          {session ? (
            <>
              <a href="/training-packs/upload" className="hover:text-gray-300">
                Upload Pack
              </a>
              <UserNav user={session.user} />
            </>
          ) : (
            <div className="flex space-x-4">
              <a href="/auth/signin" className="hover:text-gray-300">
                Sign In
              </a>
              <a href="/auth/signup" className="px-3 py-1 bg-blue-600 rounded hover:bg-blue-700">
                Sign Up
              </a>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={`font-sans ${inter.variable} min-h-screen bg-gray-100`}>
        <Providers>
          <TRPCReactProvider headers={headers()}>
            <NavBar />
            <main className="pt-4">{children}</main>
          </TRPCReactProvider>
        </Providers>
      </body>
    </html>
  );
}