import { serve } from "@hono/node-server";

import app from "@/app";
import env from "@/env";
import { injectWebSocket } from "@/routes/websockets/websocket.index";

const server = serve(
  {
    fetch: app.fetch,
    port: env.PORT || 4444,
  },
  (info) => {
    console.log(`Server is running on http://localhost:${info.port}`);
    console.log(`WebSocket endpoint ready at ws://localhost:${info.port}/ws/tasks`);
    console.log(`GraphQL endpoint ready at http://localhost:${info.port}/graphql`);
  },
);

injectWebSocket(server);
