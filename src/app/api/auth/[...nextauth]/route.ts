import NextAuth from "next-auth";
import { authConfig } from "~/server/auth.config";
import type { NextRequest } from "next/server";
import type { NextResponse } from "next/server";

// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
const handler: (req: NextRequest) => Promise<NextResponse> = NextAuth(authConfig);


export { handler as GET, handler as POST };
