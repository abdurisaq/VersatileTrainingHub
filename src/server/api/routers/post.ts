import { z } from "zod";

import { createTRPCRouter, publicProcedure, protectedProcedure } from "~/server/api/trpc";

export const postRouter = createTRPCRouter({
  hello: publicProcedure
    .input(z.object({ text: z.string() }))
    .query(({ input }) => {
      return {
        greeting: `Hello ${input.text}`,
      };
    }),

  
  create: protectedProcedure
    .input(z.object({ 
      name: z.string().min(1),
      totalShots: z.number().int().min(1),
      packMetadataCompressed: z.string().min(1),
      
    }))
    .mutation(async ({ ctx, input }) => {
      return await ctx.db.trainingPack.create({
        data: {
          name: input.name,
          totalShots: input.totalShots,
          packMetadataCompressed: input.packMetadataCompressed,
          
          creator: {
            connect: {
              id: ctx.session.user.id,
            },
          },
          
          recordingDataCompressed: "", 
          visibility: "PUBLIC", 
          
        },
      });
    }),

  getLatest: publicProcedure.query(async ({ ctx }) => {
    const item = await ctx.db.trainingPack.findFirst({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        createdAt: true,
        totalShots: true,
        // Include other fields you want to retrieve
      },
    });

    return item;
  }),
});