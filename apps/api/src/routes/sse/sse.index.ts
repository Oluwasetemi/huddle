import { createRouter } from "@/lib/create-app";

import * as handlers from "./sse.handlers";
import * as routes from "./sse.routes";

const router = createRouter();

router.openapi(routes.tasksStream, handlers.tasksStream);

router.get("/sse-client", (c) => {
  return c.html(`<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>SSE Test Client</title>
    <style>
      body { font-family: system-ui, sans-serif; max-width: 960px; margin: 2rem auto; padding: 0 1rem; }
      pre { background: #111827; color: #f9fafb; padding: 1rem; min-height: 320px; overflow: auto; }
      button { padding: 0.5rem 0.75rem; margin-right: 0.5rem; }
    </style>
  </head>
  <body>
    <h1>SSE Test Client</h1>
    <p><button id="connect">Connect</button><button id="disconnect">Disconnect</button></p>
    <pre id="log"></pre>
    <script>
      let source;
      const log = document.getElementById("log");
      const write = (message) => { log.textContent += message + "\\n"; log.scrollTop = log.scrollHeight; };
      document.getElementById("connect").addEventListener("click", () => {
        source = new EventSource("/sse/tasks");
        ["connected", "heartbeat", "task.created", "task.updated", "task.deleted"].forEach((eventName) => {
          source.addEventListener(eventName, (event) => write(eventName + ": " + event.data));
        });
        source.onerror = () => write("error");
      });
      document.getElementById("disconnect").addEventListener("click", () => source?.close());
    </script>
  </body>
</html>`);
});

export default router;
