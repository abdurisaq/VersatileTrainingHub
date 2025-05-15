import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createTRPCContext } from "~/server/api/trpc";
import { appRouter } from "~/server/api/root";
import { TRPCError } from "@trpc/server";

export async function GET(req: NextRequest) {
  try {
    const regex = /\/plugin\/download\/(.+)/;
    const execResult = regex.exec(req.nextUrl.pathname);
    const id = execResult?.[1];

    if (!id) {
      return NextResponse.json({ error: "Missing ID parameter" }, { status: 400 });
    }

    const ctx = await createTRPCContext({ headers: req.headers });
    const caller = appRouter.createCaller(ctx);
    const result = await caller.trainingPack.getByIdForPlugin({ id });

    return NextResponse.json(result);
  } catch (error) {
    console.error("Plugin download error:", error);

    if (error instanceof TRPCError) {
      if (error.code === "NOT_FOUND") {
        return NextResponse.json({ error: error.message }, { status: 404 });
      }

      if (error.code === "FORBIDDEN") {
        return NextResponse.json({ error: error.message }, { status: 403 });
      }
    }

    const errorMessage = error instanceof Error ? error.message : "Server error";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
