import { createTRPCRouter } from "~/server/api/trpc";
import { trainingPackRouter } from "~/server/api/routers/trainingPack";
import { createCallerFactory } from "~/server/api/trpc";
import { userRouter } from "~/server/api/routers/user";

/**
 * This is the primary router for your server.
 *
 * All routers added in /api/routers should be manually added here.
 */
export const appRouter = createTRPCRouter({
  trainingPack: trainingPackRouter,
  user: userRouter,
});

// Create a server-side caller
export const createCaller = createCallerFactory(appRouter);

// export type definition of API
export type AppRouter = typeof appRouter;