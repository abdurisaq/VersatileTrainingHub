"use client";

import { useSession, signIn, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";

export function useAuth() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const login = async (email: string, password: string) => {
    const result = await signIn("credentials", {
      redirect: false,
      email,
      password,
    });
    
    if (result?.ok) {
      router.refresh();
      return { success: true };
    }
    
    return { success: false, error: result?.error || "Failed to sign in" };
  };

  const logout = async () => {
    await signOut({ redirect: false });
    router.refresh();
    router.push("/");
  };

  return {
    session,
    status,
    isAuthenticated: status === "authenticated",
    isLoading: status === "loading",
    login,
    logout,
  };
}