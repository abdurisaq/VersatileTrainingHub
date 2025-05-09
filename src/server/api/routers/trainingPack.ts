import { z } from 'zod';
import {
  createTRPCRouter,
  publicProcedure,
  protectedProcedure,
} from "../trpc";
import { TRPCError } from '@trpc/server';
import { Visibility } from '@prisma/client';

// Zod schema for individual shot data
const shotInputSchema = z.object({
  shotIndex: z.number().int().min(0),
  recordingDataCompressed: z.string().min(1, "Recording data is required"),
});

// Schema for creating a training pack
const createTrainingPackInputSchema = z.object({
  name: z.string().min(3, "Name must be at least 3 characters").max(100, "Name too long"),
  description: z.string().max(2000, "Description too long").optional().nullable(),
  code: z.string().max(50, "Pack code too long").optional().nullable(),
  difficulty: z.number().int().min(1).max(5).optional().nullable(),
  tags: z.array(z.string().max(30)).max(10).optional().default([]),
  packMetadataCompressed: z.string().min(1, "Pack metadata is required (Base64)"),
  recordingDataCompressed: z.string().optional().default(""), // New field for all recordings
  totalShots: z.number().int().min(1, "At least one shot is required").max(100),
  visibility: z.nativeEnum(Visibility).default(Visibility.PUBLIC),
  gameVersion: z.string().max(50).optional().nullable(),
  pluginVersion: z.string().max(50).optional().nullable(),
});

export const trainingPackRouter = createTRPCRouter({
  // Create a new training pack
  create: protectedProcedure
    .input(createTrainingPackInputSchema)
    .mutation(async ({ ctx, input }) => {
      // Basic check for base64 data
      const isBase64 = (str: string) => /^[A-Za-z0-9+/]+={0,2}$/.test(str);
      
      // Validate only the packMetadataCompressed - no more shots array
      if (!isBase64(input.packMetadataCompressed)) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Invalid Base64 data provided for pack metadata',
        });
      }

      // Optional validation for recording data if present
      // if (input.recordingDataCompressed && !isBase64(input.recordingDataCompressed)) {
      //   throw new TRPCError({
      //     code: 'BAD_REQUEST',
      //     message: 'Invalid Base64 data provided for recordings',
      //   });
      // }

      // First, create the training pack
      const newTrainingPack = await ctx.db.trainingPack.create({
        data: {
          name: input.name,
          description: input.description,
          code: input.code,
          difficulty: input.difficulty,
          tags: input.tags,
          totalShots: input.totalShots,
          packMetadataCompressed: input.packMetadataCompressed,
          recordingDataCompressed: input.recordingDataCompressed,
          creatorId: ctx.session.user.id, // This should work with protectedProcedure
          visibility: input.visibility,
          gameVersion: input.gameVersion,
          pluginVersion: input.pluginVersion,
        },
        include: {
          creator: {
            select: {
              id: true,
              name: true,
            }
          }
        }
      });

      return newTrainingPack;
    }),

  // Get training pack details for web display
  getByIdForWeb: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const pack = await ctx.db.trainingPack.findUnique({
        where: { id: input.id },
        select: {
          id: true,
          name: true,
          description: true,
          code: true,
          difficulty: true,
          tags: true,
          totalShots: true,
          creatorId: true,
          creator: {
            select: {
              id: true,
              name: true,
              image: true,
            },
          },
          visibility: true,
          gameVersion: true,
          pluginVersion: true,
          createdAt: true,
          updatedAt: true,
          downloadCount: true,
          averageRating: true,
          ratingCount: true,
          _count: {
            select: {
              comments: true,
              favoritedBy: true,
            },
          },
        },
      });

      if (!pack) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Training pack not found',
        });
      }

      function getUserId(ctx: any): string | null {
  return ctx.session?.user?.id || null;
}

    if (pack.visibility === Visibility.PRIVATE && 
      (getUserId(ctx) === null || pack.creatorId !== getUserId(ctx))) {
        throw new TRPCError({
      code: 'FORBIDDEN',
      message: 'This pack is private',
      });
    }

      return pack;
    }),

  // Get complete training pack data for plugin download
  getByIdForPlugin: publicProcedure
  .input(z.object({ id: z.string() }))
  .mutation(async ({ ctx, input }) => {
    const pack = await ctx.db.trainingPack.findUnique({
      where: { id: input.id },
      select: {
        id: true,
        name: true,
        description: true,
        code: true,
        difficulty: true,
        tags: true,
        totalShots: true,
        packMetadataCompressed: true,
        recordingDataCompressed: true,
        visibility: true,
        gameVersion: true,
        pluginVersion: true,
        createdAt: true,
        updatedAt: true,
        creator: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!pack) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Training pack not found',
      });
    }

    function getUserId(ctx: any): string | null {
      return ctx.session?.user?.id || null;
    }

    if (pack.visibility === Visibility.PRIVATE && 
      (getUserId(ctx) === null || pack.creator.id !== getUserId(ctx))) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: 'This pack is private',
      });
    }

    // Increment download count
    await ctx.db.trainingPack.update({
      where: { id: input.id },
      data: { downloadCount: { increment: 1 } },
    });

    return pack;
  }),

  // List public training packs
  listPublic: publicProcedure
    .input(z.object({
      limit: z.number().min(1).max(50).default(10),
      cursor: z.string().optional(),
      searchTerm: z.string().optional(),
      tags: z.array(z.string()).optional(),
    }).optional())
    .query(async ({ ctx, input }) => {
      const limit = input?.limit ?? 10;
      const { cursor, searchTerm, tags } = input ?? {};

      const items = await ctx.db.trainingPack.findMany({
        take: limit + 1,
        cursor: cursor ? { id: cursor } : undefined,
        where: {
          visibility: Visibility.PUBLIC,
          AND: [
            searchTerm ? {
              OR: [
                { name: { contains: searchTerm, mode: 'insensitive' } },
                { description: { contains: searchTerm, mode: 'insensitive' } },
                { tags: { has: searchTerm.toLowerCase() } },
              ],
            } : {},
            tags && tags.length > 0 ? { tags: { hasSome: tags } } : {},
          ],
        },
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          name: true,
          code: true,
          difficulty: true,
          tags: true,
          totalShots: true,
          creator: {
            select: {
              id: true,
              name: true,
              image: true,
            },
          },
          averageRating: true,
          downloadCount: true,
          createdAt: true,
          _count: {
            select: {
              comments: true,
              favoritedBy: true,
            },
          },
        },
      });

      let nextCursor: typeof cursor | undefined = undefined;
      if (items.length > limit) {
        const nextItem = items.pop();
        nextCursor = nextItem!.id;
      }
      
      return { items, nextCursor };
    }),
});