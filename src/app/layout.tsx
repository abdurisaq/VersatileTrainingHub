import "~/styles/globals.css";

import { TRPCReactProvider } from "~/trpc/react";
import { getServerAuthSession } from "~/server/auth";
import { Providers } from "./providers";
import { UserNav } from "~/app/components/user-nav";
import { PluginConnectionIndicator } from "./components/plugin-connection-indicator";
import Link from "next/link";



export const metadata = {
  title: "VersatileTraining Hub",
  description: "Share and discover Rocket League training packs",
  icons: [{ rel: "icon", url: "/favicon.ico" }],
};

async function NavBar() {
  const session = await getServerAuthSession();
  
  return (
    <nav className="bg-slate-900 text-slate-100 p-4 shadow-md dark:bg-gray-800"> {/* Added dark:bg-gray-800 */}
      <div className="container mx-auto flex justify-between items-center">
        
        <Link href="/" className="text-2xl font-bold hover:text-slate-200 transition-colors dark:hover:text-gray-300">
          VersatileTraining Hub
        </Link>
        
        <div className="flex items-center space-x-2 md:space-x-4"> {/* Adjusted spacing for switcher */}
          
          <Link href="/training-packs" className="hover:text-brand-accent py-2 px-3 rounded-md transition-colors dark:hover:text-yellow-400"> 
            Browse Packs
          </Link>
          
          <Link href="/hub-guide" className="hover:text-brand-accent py-2 px-3 rounded-md transition-colors dark:hover:text-yellow-400">
            Hub Guide
          </Link>
          
          {session ? (
            <>
              <Link href="/training-packs/upload" className="hover:text-brand-accent py-2 px-3 rounded-md transition-colors dark:hover:text-yellow-400">
                Upload Pack
              </Link>
              <UserNav user={session.user} />
            </>
          ) : (
            <div className="flex items-center space-x-3">
              <Link href="/api/auth/signin" className="hover:text-brand-accent py-2 px-3 rounded-md transition-colors dark:hover:text-yellow-400">
                Sign In
              </Link>
              <Link href="/api/auth/signup" className="px-4 py-2 bg-brand-primary hover:bg-brand-secondary text-white rounded-md font-medium transition-colors dark:bg-purple-600 dark:hover:bg-purple-700">
                Sign Up
              </Link>
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
    <html lang="en" suppressHydrationWarning> 
      {/* Replace the className on the line below */}
      <body className="bg-white text-black dark:bg-black dark:text-white font-sans min-h-screen flex flex-col"> {/* Simplified for testing */}
       
          <Providers>
            <TRPCReactProvider>
              <NavBar />
              <main className="pt-6 pb-12 flex-grow">{children}</main> 
              <PluginConnectionIndicator />
              
            </TRPCReactProvider>
          </Providers>
        
      </body>
    </html>
  );
}