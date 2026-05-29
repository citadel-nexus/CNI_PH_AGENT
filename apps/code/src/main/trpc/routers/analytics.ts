import { z } from "zod";
import {
  getRecentEvents,
  identifyUser,
  resetUser,
  setCurrentUserId,
} from "../../services/posthog-analytics";
import { publicProcedure, router } from "../trpc";

const recentEventSchema = z.object({
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
    .output(z.array(recentEventSchema))
    .query(() => getRecentEvents()),
});
