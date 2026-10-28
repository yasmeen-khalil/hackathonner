// Serves /api/one/authorize and /api/one/callback. One's SDK handles state and PKCE.
import { createOneConnectRoutes } from "@withone/connect/next";
import { oneConnect, oneConfigured } from "@/lib/one";
import { currentUserId } from "@/lib/backend";

const routes = oneConfigured && oneConnect
  ? createOneConnectRoutes(oneConnect, { identifyUser: async () => currentUserId(), signInUrl: "/sign-in" })
  : { GET: async () => new Response(JSON.stringify({ error: "One Connect is not configured on this deployment" }), { status: 503, headers: { "content-type": "application/json" } }) };

export const { GET } = routes;
