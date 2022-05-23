import { Application } from "https://deno.land/x/abc/mod.ts";
import { abcCors } from "https://deno.land/x/cors/mod.ts";

const app = new Application();
const PORT = 8080; // single source of truth

const CorsSettings = {
  origin: /^.+localhost:(3000|1234)$/,
  allowedHeaders: ["Authorization", "Content-Type", "Accept", "Origin", "User-Agent"],
  credentials: true,
};

app
  .use(abcCors(CorsSettings))
  .post("/create-user", postNewUser)
  .post("/login", handleLogin)
  .get("/results", getResults)
  .get("/history", getHistory)
  .delete("/logout", handleLogout)
  .start({ port: PORT });

async function postNewUser(server) {}

async function handleLogin(server) {}

async function getResults(server) {}

async function getHistory(server) {}

async function handleLogout(server) {}

console.log(`Server running on http://localhost:${PORT}`);
