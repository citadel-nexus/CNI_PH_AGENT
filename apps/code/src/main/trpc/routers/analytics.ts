import { z } from "zod";
import {
  getRecentTrackedEvents,
  getRecentEvents,
  identifyUser,
  resetUser,
  setCurrentUserId,
} from "../../services/posthog-analytics";
import { publicProcedure, router } from "../trpc";

const recentEventSchema = z.object({
  eventName: z.string(),
  timestamp: z.string(),
  properties: z.record(
    z.string(),
    z.union([z.string(), z.number(), z.boolean()]),
  ),
  name: z.string(),
  timestamp: z.string(),
  properties: z
    .record(z.string(), z.union([z.string(), z.number(), z.boolean()]))
    .optional(),
});

export const analyticsRouter = router({
  setUserId: publicProcedure
    .input(
      z.object({
        userId: z.string(),
        properties: z
          .record(z.string(), z.union([z.string(), z.number(), z.boolean()]))
          .optional(),
      }),
    )
    .mutation(({ input }) => {
      setCurrentUserId(input.userId);
      if (input.properties) {
        identifyUser(
          input.userId,
          input.properties as Record<string, string | number | boolean>,
        );
      }
    }),

  resetUser: publicProcedure.mutation(() => {
    resetUser();
  }),

  getRecentEvents: publicProcedure
    .input(
      z
        .object({
          limit: z.number().min(1).max(50).optional(),
        })
        .optional(),
    )
    .output(z.array(recentEventSchema))
    .query(({ input }) => getRecentTrackedEvents(input?.limit ?? 20)),
    .output(z.array(recentEventSchema))
    .query(() => getRecentEvents()),
});
