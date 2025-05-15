import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createTRPCContext } from "~/server/api/trpc";
import { appRouter } from "~/server/api/root";
import { getServerAuthSession } from "~/server/auth";
import { z } from "zod";
import { Visibility } from "@prisma/client";

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
});

export async function POST(req: NextRequest) {
  try {
    
    const session = await getServerAuthSession();
    
    if (!session?.user) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    
    try {
      const rawBody: unknown = await req.json();
      
      const validatedData = trainingPackSchema.safeParse(rawBody);
      
      if (!validatedData.success) {
        return NextResponse.json(
          { error: "Invalid data", details: validatedData.error.format() },
          { status: 400 }
        );
      }

      
      const ctx = await createTRPCContext({ headers: req.headers });
      const caller = appRouter.createCaller(ctx);

      
      const transformedData = {
        name: validatedData.data.name,
        description: validatedData.data.description,
        code: validatedData.data.code,
        difficulty: validatedData.data.difficulty,
        tags: validatedData.data.tags,
        packMetadataCompressed: validatedData.data.packMetadataCompressed,
        totalShots: validatedData.data.shots.length, 
        recordingDataCompressed: "", 
        visibility: validatedData.data.visibility,
      };

      
      const result = await caller.trainingPack.create(transformedData);
      
      return NextResponse.json(result, { status: 201 });
    } catch  {
      
      return NextResponse.json(
        { error: "Invalid JSON in request body" },
        { status: 400 }
      );
    }
  } catch (error: unknown) {
    
    console.error("Plugin upload error:", error);
    
    
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    
    return NextResponse.json(
      { error: errorMessage ?? "Server error" },
      { status: 500 }
    );
  }
}