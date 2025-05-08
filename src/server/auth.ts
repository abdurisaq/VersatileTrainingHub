import { getServerSession } from "next-auth";
import { cookies, headers } from "next/headers";
import { authConfig } from "./auth.config";

/**
 * Gets the session from the server context using next-auth
 */
export const getServerAuthSession = async () => {
  return getServerSession(authConfig);
};