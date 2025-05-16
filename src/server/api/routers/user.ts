import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";
import { Visibility } from "@prisma/client"; // Make sure this enum is correctly imported or defined

export const userRouter = createTRPCRouter({
  getPublicProfile: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const user = await ctx.db.user.findUnique({
        where: { id: input.id },
        select: {
          id: true,
          name: true,
          image: true,
          createdAt: true,
        },
      });

      if (!user) {
        // This will be handled on the client-side as data being null
        return null;
      }

      const trainingPacks = await ctx.db.trainingPack.findMany({
        where: {
          creatorId: input.id,
          OR: [ // Only show public or unlisted packs on a public profile
            { visibility: Visibility.PUBLIC },
            { visibility: Visibility.UNLISTED },
          ],
        },
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          name: true,
          code: true,
          totalShots: true,
          tags: true,
          visibility: true,
          downloadCount: true,
          averageRating: true,
          createdAt: true,
          // No need to select creator again as we are on the creator's page
        },
        take: 50, // Add pagination in the future if needed
      });

      return {
        user,
        trainingPacks,
      };
    }),
});