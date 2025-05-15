import { getServerSession } from "next-auth";
import type { Session } from "next-auth";
import { authConfig } from "./auth.config";

export const getServerAuthSession = async (): Promise<Session | null> => {
  return getServerSession(authConfig);
};