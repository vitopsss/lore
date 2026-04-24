import { Router } from "express";

import { activityController } from "../controllers/activity.controller";
import { bookDetailController } from "../controllers/book-detail.controller";
import { communityPulseController, communityVerseController } from "../controllers/community.controller";
import { featuredBooksController } from "../controllers/discover.controller";
import { feedController } from "../controllers/feed.controller";
import { meController } from "../controllers/me.controller";
import { searchController } from "../controllers/search.controller";
import { shareController } from "../controllers/share.controller";
import { statsController } from "../controllers/stats.controller";
import { createUserController, usersController } from "../controllers/users.controller";
import { env } from "../config/env";
import { asyncHandler } from "../lib/async-handler";
import {
  requirePremiumForAdvancedStats,
  requirePremiumForExclusiveTheme
} from "../middleware/premium-access";
import { requireAuth } from "../middleware/require-auth";

export const apiRouter = Router();

apiRouter.get("/health", (_request, response) => {
  response.json({
    data: {
      name: env.APP_NAME,
      status: "ok"
    }
  });
});

apiRouter.get("/search", asyncHandler(searchController));
apiRouter.get("/books/detail", asyncHandler(bookDetailController));
apiRouter.get("/discover/highlights", asyncHandler(featuredBooksController));
apiRouter.get("/community/verse", asyncHandler(communityVerseController));
apiRouter.get("/community/pulse", asyncHandler(communityPulseController));
apiRouter.get("/users", asyncHandler(usersController));
apiRouter.post("/users", asyncHandler(createUserController));
apiRouter.get("/me", requireAuth, asyncHandler(meController));
apiRouter.post(
  "/activity",
  requireAuth,
  requirePremiumForExclusiveTheme,
  asyncHandler(activityController)
);
apiRouter.get("/share/:activityId", asyncHandler(shareController));
apiRouter.get("/api/share/:activityId", asyncHandler(shareController));
apiRouter.get("/feed", requireAuth, asyncHandler(feedController));
apiRouter.get(
  "/stats/:userId",
  requireAuth,
  requirePremiumForAdvancedStats,
  asyncHandler(statsController)
);
