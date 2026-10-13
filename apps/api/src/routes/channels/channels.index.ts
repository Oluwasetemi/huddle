import { requireAuth } from "@/lib/auth";
import { createRouter } from "@/lib/create-app";

import * as handlers from "./channels.handlers";
import * as routes from "./channels.routes";

const router = createRouter();

router.use("/channels/*", requireAuth);

router.openapi(routes.listChannels, handlers.listChannels);
router.openapi(routes.listMessages, handlers.listMessages);
router.openapi(routes.postMessage, handlers.postMessage);

export default router;
