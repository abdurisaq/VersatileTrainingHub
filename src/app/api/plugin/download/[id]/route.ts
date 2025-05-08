import { NextRequest, NextResponse } from "next/server";
import { createTRPCContext } from "~/server/api/trpc";
import { appRouter } from "~/server/api/root";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const id = params.id;
    
    // Create tRPC context and caller
    const ctx = await createTRPCContext({ headers: req.headers });
    const caller = appRouter.createCaller(ctx);

    // Call the tRPC procedure
    const result = await caller.trainingPack.getByIdForPlugin({ id });
    
    return NextResponse.json(result);
  } catch (error: any) {
    console.error("Plugin download error:", error);
    
    if (error.code === "NOT_FOUND") {
      return NextResponse.json(
        { error: error.message },
        { status: 404 }
      );
    }
    
    if (error.code === "FORBIDDEN") {
      return NextResponse.json(
        { error: error.message },
        { status: 403 }
      );
    }
    
    return NextResponse.json(
      { error: error.message || "Server error" },
      { status: 500 }
    );
  }
}