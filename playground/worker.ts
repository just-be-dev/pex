/**
 * PEX Playground Worker
 * Serves the static playground assets
 */
import type { ExportedHandler, Fetcher } from "@cloudflare/workers-types";

export default {
  async fetch(request: Request, env: { ASSETS: Fetcher }): Promise<Response> {
    // Serve static assets from the dist directory
    return env.ASSETS.fetch(request);
  },
} satisfies ExportedHandler<{ ASSETS: Fetcher }>;
