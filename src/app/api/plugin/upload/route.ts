import { NextRequest, NextResponse } from "next/server";
import { createTRPCContext } from "~/server/api/trpc";
import { appRouter } from "~/server/api/root";
import { getServerAuthSession } from "~/server/auth";
import { z } from "zod";
import { Visibility } from "@prisma/client";

// Schemas for validation
const shotSchema = z.object({
  shotIndex: z.number().int().min(0),
  recordingDataCompressed: z.string().min(1),
});

const trainingPackSchema = z.object({
  name: z.string().min(3).max(100),
  description: z.string().max(2000).optional().nullable(),
  code: z.string().max(50).optional().nullable(),
  difficulty: z.number().int().min(1).max(5).optional().nullable(),
  tags: z.array(z.string().max(30)).max(10).optional().default([]),
  packMetadataCompressed: z.string().min(1),
  shots: z.array(shotSchema).min(1).max(100),
  visibility: z.nativeEnum(Visibility).default(Visibility.PUBLIC),
  gameVersion: z.string().max(50).optional().nullable(),
  pluginVersion: z.string().max(50).optional().nullable(),
});

export async function POST(req: NextRequest) {
  try {
    // Get authenticated session
    const session = await getServerAuthSession();
    
    if (!session?.user) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    // Parse and validate request body
    const body = await req.json();
    const validatedData = trainingPackSchema.safeParse(body);
    
    if (!validatedData.success) {
      return NextResponse.json(
        { error: "Invalid data", details: validatedData.error.format() },
        { status: 400 }
      );
    }

    // Create tRPC context and caller
    const ctx = await createTRPCContext({ headers: req.headers });
    const caller = appRouter.createCaller(ctx);

    // Call the tRPC procedure
    const result = await caller.trainingPack.create(validatedData.data);
    
    return NextResponse.json(result, { status: 201 });
  } catch (error: any) {
    console.error("Plugin upload error:", error);
    return NextResponse.json(
      { error: error.message || "Server error" },
      { status: 500 }
    );
  }
}