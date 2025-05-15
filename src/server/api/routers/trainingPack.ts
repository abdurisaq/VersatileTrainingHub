import { z } from 'zod';
import {
  createTRPCRouter,
  publicProcedure,
  protectedProcedure,
} from "../trpc";
import { TRPCError } from '@trpc/server';
import type { Prisma } from '@prisma/client';
import { Visibility } from '@prisma/client';



const getUserId = (ctx: { session?: { user?: { id?: string | null } | null } | null }): string | null => {
  return ctx.session?.user?.id ?? null;
};

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
});

export const trainingPackRouter = createTRPCRouter({
  
  create: protectedProcedure
    .input(createTrainingPackInputSchema)
    .mutation(async ({ ctx, input }) => {
      
      const isBase64 = (str: string) => /^[A-Za-z0-9+/]+={0,2}$/.test(str);
      
      
      if (!isBase64(input.packMetadataCompressed)) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Invalid Base64 data provided for pack metadata',
        });
      }


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
          creatorId: ctx.session.user.id,
          visibility: input.visibility,
          
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

  getByIdForWeb: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const pack = await ctx.db.trainingPack.findUnique({
        where: { id: input.id },
        select: {
          // ... (all your existing selects for pack details)
          id: true,
          name: true,
          description: true,
          code: true,
          difficulty: true,
          tags: true,
          totalShots: true,
          packMetadataCompressed: true,           
          visibility: true,
          
          createdAt: true,
          updatedAt: true,
          creatorId: true, // Keep
          creator: {
            select: {
              id: true,
              name: true,
              image: true,
            },
          },
          averageRating: true,
          ratingCount: true,
          downloadCount: true,
          _count: { 
            select: {
              comments: true,
              
            }
          }
        },
      });

      if (!pack) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Training pack not found' });
      }

      if (pack.visibility === Visibility.PRIVATE && (getUserId(ctx) === null || pack.creatorId !== getUserId(ctx))) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'This pack is private' });
      }
      
      let isFavoritedByCurrentUser = false;
      const currentUserId = getUserId(ctx);
      if (currentUserId) {
        const favoriteEntry = await ctx.db.userFavoriteTrainingPack.findUnique({
          where: {
            userId_trainingPackId: {
              userId: currentUserId,
              trainingPackId: pack.id,
            },
          },
        });
        isFavoritedByCurrentUser = !!favoriteEntry;
      }

      return { ...pack, isFavoritedByCurrentUser };
    }),

  toggleFavorite: protectedProcedure
    .input(z.object({ trainingPackId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      const { trainingPackId } = input;

      const existingFavorite = await ctx.db.userFavoriteTrainingPack.findUnique({
        where: {
          userId_trainingPackId: {
            userId,
            trainingPackId,
          },
        },
      });

      if (existingFavorite) {
        
        await ctx.db.userFavoriteTrainingPack.delete({
          where: {
            userId_trainingPackId: {
              userId,
              trainingPackId,
            },
          },
        });
        return { favorited: false, trainingPackId };
      } else {
        
        await ctx.db.userFavoriteTrainingPack.create({
          data: {
            userId,
            trainingPackId,
            
          },
        });
        return { favorited: true, trainingPackId };
      }
    }),

  listUserFavorites: protectedProcedure
    .query(async ({ ctx }) => {
      const userId = ctx.session.user.id;
      const favoriteEntries = await ctx.db.userFavoriteTrainingPack.findMany({
        where: { userId },
        select: {
          assignedAt: true, 
          trainingPack: { 
            select: {
              id: true,
              name: true,
              code: true,
              totalShots: true,
              creator: { select: { id: true, name: true, image: true } },
              averageRating: true,
              downloadCount: true,
              createdAt: true,
              updatedAt: true,
              tags: true,
              visibility: true,
             
            }
          }
        },
        orderBy: {
          assignedAt: 'desc', 
        }
      });
      
      return favoriteEntries.map(entry => ({...entry.trainingPack, favoritedAt: entry.assignedAt }));
    }),

  submitOrUpdateRating: protectedProcedure
    .input(z.object({
      trainingPackId: z.string(),
      value: z.number().int().min(1).max(5), 
    }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      const { trainingPackId, value } = input;

      await ctx.db.rating.upsert({
        where: {
          userId_trainingPackId: {
            userId,
            trainingPackId,
          },
        },
        create: {
          userId,
          trainingPackId,
          value,
        },
        update: {
          value,
        },
      });

      const allRatingsForPack = await ctx.db.rating.findMany({
        where: { trainingPackId },
        select: { value: true },
      });

      const ratingCount = allRatingsForPack.length;
      const averageRating = ratingCount > 0
        ? allRatingsForPack.reduce((sum, r) => sum + r.value, 0) / ratingCount
        : 0;

      await ctx.db.trainingPack.update({
        where: { id: trainingPackId },
        data: {
          averageRating: parseFloat(averageRating.toFixed(2)), // Store with a couple of decimal places
          ratingCount,
        },
      });

      return { 
        success: true, 
        newAverageRating: parseFloat(averageRating.toFixed(2)), 
        newRatingCount: ratingCount,
        userRating: value 
      };
    }),

  getUserRatingForPack: protectedProcedure
    .input(z.object({ trainingPackId: z.string() }))
    .query(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      const rating = await ctx.db.rating.findUnique({
        where: {
          userId_trainingPackId: {
            userId,
            trainingPackId: input.trainingPackId,
          },
        },
        select: { value: true },
      });
      return rating; 
    }),
    
    addComment: protectedProcedure
    .input(z.object({
      trainingPackId: z.string(),
      text: z.string().min(1, "Comment cannot be empty").max(1000, "Comment too long"),
      parentId: z.string().nullable().optional(), 
    }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      const { trainingPackId, text, parentId } = input;

      const comment = await ctx.db.comment.create({
        data: {
          text,
          userId,
          trainingPackId,
          parentId: parentId ?? undefined, // Changed || to ??
        },
        
        select: {
            id: true,
            text: true,
            createdAt: true,
            updatedAt: true,
            parentId: true,
            user: { select: { id: true, name: true, image: true } },
        }
      });
      return comment;
    }),

  listCommentsForPack: publicProcedure
    .input(z.object({ trainingPackId: z.string() }))
    .query(async ({ ctx, input }) => {
      
      const comments = await ctx.db.comment.findMany({
        where: {
          trainingPackId: input.trainingPackId,
          parentId: null, 
        },
        select: {
          id: true,
          text: true,
          createdAt: true,
          updatedAt: true,
          user: { select: { id: true, name: true, image: true } },
          replies: {
            select: {
              id: true,
              text: true,
              createdAt: true,
              updatedAt: true,
              parentId: true,
              user: { select: { id: true, name: true, image: true } },
              
            },
            orderBy: { createdAt: 'asc' }
          },
          _count: { 
            select: { replies: true }
          }
        },
        orderBy: { createdAt: 'desc' }, 
      });
      return comments;
    }),

  
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

    // Use the existing top-level getUserId function instead of defining a new one
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

  listPublic: publicProcedure
  .input(z.object({
    limit: z.number().min(1).max(100).nullish(),
    cursor: z.string().nullish(),
    searchTerm: z.string().optional(),
    sortBy: z.enum(["createdAt", "updatedAt", "name", "downloadCount", "averageRating"]).optional().default("createdAt"),
    sortOrder: z.enum(["asc", "desc"]).optional().default("desc"),
  }))
  .query(async ({ ctx, input }) => {
    const limit = input.limit ?? 10;
    const { cursor, searchTerm, sortBy, sortOrder } = input;

    let orderByClause: Prisma.TrainingPackOrderByWithRelationInput | Prisma.TrainingPackOrderByWithRelationInput[] = { [sortBy]: sortOrder };
    
    if (sortBy === "name") {
        orderByClause = [{ name: sortOrder }, { createdAt: 'desc' }];
    }


    const items = await ctx.db.trainingPack.findMany({
      take: limit + 1,
      cursor: cursor ? { id: cursor } : undefined,
      where: {
        visibility: "PUBLIC",
        AND: [
          searchTerm ? {
            OR: [
              { name: { contains: searchTerm, mode: 'insensitive' } },
              { description: { contains: searchTerm, mode: 'insensitive' } },
              { tags: { has: searchTerm.toLowerCase() } }, 
            ],
          } : {},
        ],
      },
      orderBy: orderByClause, 
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
        updatedAt: true, 
        _count: {
          select: {
            comments: true,
            favoritedByUsers: true,
            ratings: true,
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

  
  getUserPacks: protectedProcedure
    .query(async ({ ctx }) => {
      const packs = await ctx.db.trainingPack.findMany({
        where: {
          creatorId: ctx.session.user.id,
        },
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          name: true,
          description: true,
          totalShots: true,
          tags: true,
          visibility: true,
          downloadCount: true,
          createdAt: true,
          updatedAt: true,
        },
      });
      
      return packs;
    }),

  
  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const pack = await ctx.db.trainingPack.findUnique({
        where: { id: input.id },
        select: { creatorId: true },
      });
      
      if (!pack) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Training pack not found',
        });
      }
      
      if (pack.creatorId !== ctx.session.user.id) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'You can only delete your own training packs',
        });
      }
      
      await ctx.db.trainingPack.delete({
        where: { id: input.id },
      });
      
      return { success: true };
    }),

  
  updateVisibility: protectedProcedure
    .input(z.object({ 
      id: z.string(),
      visibility: z.enum(['PUBLIC', 'PRIVATE', 'UNLISTED']),
    }))
    .mutation(async ({ ctx, input }) => {
      const pack = await ctx.db.trainingPack.findUnique({
        where: { id: input.id },
        select: { creatorId: true },
      });
      
      if (!pack) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Training pack not found',
        });
      }
      
      if (pack.creatorId !== ctx.session.user.id) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'You can only update your own training packs',
        });
      }
      
      await ctx.db.trainingPack.update({
        where: { id: input.id },
        data: { visibility: input.visibility },
      });
      
      return { success: true };
    }),

  
  getByIdForEdit: protectedProcedure
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
          visibility: true,
          creatorId: true,
        },
      });
      
      if (!pack) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Training pack not found',
        });
      }
      
      if (pack.creatorId !== ctx.session.user.id) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'You can only edit your own training packs',
        });
      }
      
      return pack;
    }),

  
  updateWithData: protectedProcedure
    .input(z.object({
      id: z.string(),
      packMetadataCompressed: z.string().min(1, "Pack metadata is required"),
      recordingDataCompressed: z.string().optional().default(""),
      totalShots: z.number().int().min(1).max(100),
      name: z.string().min(3).max(100),
      description: z.string().max(2000).optional().nullable(),
      tags: z.array(z.string()).optional(),
      difficulty: z.number().int().min(1).max(5).optional(),
      visibility: z.enum(["PUBLIC", "PRIVATE", "UNLISTED"]).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const pack = await ctx.db.trainingPack.findUnique({
        where: { id: input.id },
        select: { creatorId: true },
      });
      
      if (!pack) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Training pack not found',
        });
      }
      
      if (pack.creatorId !== ctx.session.user.id) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'You can only update your own training packs',
        });
      }
      
      const updatedPack = await ctx.db.trainingPack.update({
        where: { id: input.id },
        data: {
          packMetadataCompressed: input.packMetadataCompressed,
          recordingDataCompressed: input.recordingDataCompressed,
          totalShots: input.totalShots,
          name: input.name,
          description: input.description,
          tags: input.tags,
          difficulty: input.difficulty,
          visibility: input.visibility,
          updatedAt: new Date(),
        },
        select: {
          id: true,
          name: true,
        },
      });
      
      return updatedPack;
    }),

  
  updateDetails: protectedProcedure
    .input(z.object({
      id: z.string(),
      name: z.string().min(3, "Name must be at least 3 characters").max(100, "Name too long"),
      description: z.string().max(2000, "Description too long").optional().nullable(),
      code: z.string().max(50, "Pack code too long").optional().nullable(),
      difficulty: z.number().int().min(1).max(5).optional(),
      tags: z.array(z.string().max(30)).max(10).optional(),
      visibility: z.enum(["PUBLIC", "PRIVATE", "UNLISTED"]),
    }))
    .mutation(async ({ ctx, input }) => {
      const pack = await ctx.db.trainingPack.findUnique({
        where: { id: input.id },
        select: { creatorId: true },
      });
      
      if (!pack) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Training pack not found',
        });
      }
      
      if (pack.creatorId !== ctx.session.user.id) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'You can only update your own training packs',
        });
      }
      
      const updatedPack = await ctx.db.trainingPack.update({
        where: { id: input.id },
        data: {
          name: input.name,
          description: input.description,
          code: input.code,
          difficulty: input.difficulty,
          tags: input.tags,
          visibility: input.visibility,
          updatedAt: new Date(),
        },
        select: {
          id: true,
          name: true,
        },
      });
      
      return updatedPack;
    }),
    getPackWithMetadata: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const pack = await ctx.db.trainingPack.findUnique({
        where: { id: input.id },
        select: {
          id: true,
          name: true,
          packMetadataCompressed: true,
          visibility: true,
          creatorId: true,
        },
      });

      if (!pack) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Training pack not found',
        });
      }

      const getUserId = (ctx: { session?: { user?: { id?: string | null } | null } | null }): string | null => {
        return ctx.session?.user?.id ?? null;
      };

      if (pack.visibility === Visibility.PRIVATE && 
        (getUserId(ctx) === null || pack.creatorId !== getUserId(ctx))) {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: 'This pack is private',
          });
      }

      return pack;
    }),
});