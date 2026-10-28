// One Connect, key mode: the app holds one connect key, and one short reference per user who linked their One account.
// The reference is stored in the API's per-user key-value table, so it lives next to the user's hackathons.
import { createOneConnect } from "@withone/connect/server";
import { backend } from "./backend";

export const oneConfigured = !!(process.env.ONE_CLIENT_ID && process.env.ONE_CLIENT_SECRET && process.env.ONE_CONNECT_KEY);

export const oneConnect = oneConfigured
  ? createOneConnect({
      clientId: process.env.ONE_CLIENT_ID!,
      clientSecret: process.env.ONE_CLIENT_SECRET!,
      redirectUri: process.env.ONE_REDIRECT_URI || "http://localhost:3000/api/one/callback",
      permissionSet: process.env.ONE_PERMISSION_SET,
      connectKey: process.env.ONE_CONNECT_KEY!,
      userStore: {
        saveUser: async (userId, reference) => { await backend(userId, "/api/kv/one_connect", { method: "PUT", body: JSON.stringify({ value: reference }) }); },
        loadUser: async (userId) => (await backend(userId, "/api/kv/one_connect")).value ?? null,
        clearUser: async (userId) => { await backend(userId, "/api/kv/one_connect", { method: "DELETE" }); },
      },
    })
  : null;
