import { Application } from "https://deno.land/x/abc/mod.ts";
import { abcCors } from "https://deno.land/x/cors/mod.ts";
import { Client } from "https://deno.land/x/postgres@v0.11.3/mod.ts";
import * as bcrypt from "https://deno.land/x/bcrypt/mod.ts";
import { v4 } from "https://deno.land/std/uuid/mod.ts";
import { config } from "https://deno.land/x/dotenv/mod.ts";
import postNewUser from "./serverFunctions/postNewUser";
import verifySession from "./serverFunctions/verifySession";
import handleLogin from "./serverFunctions/handleLogin";
import getResults from "./serverFunctions/getResults";
import getHistory from "./serverFunctions/getHistory";
import handleLogout from "./serverFunctions/handleLogout";

const WORLD_BANK_PATH = "postgres://czreijar:TJ2StTuQIl2CoRoinQTwPxk8pBGfdf6t@kandula.db.elephantsql.com/czreijar";

const DENO_ENV = Deno.env.get("DENO_ENV") ?? "development";
config({ path: `./.env.${DENO_ENV}`, export: true });

const client = new Client(Deno.env.get("PG_URL"));
await client.connect();

const worldBankDB = new Client(WORLD_BANK_PATH);
await worldBankDB.connect();

const app = new Application();
const PORT = Number(Deno.env.get("PORT"));

const CorsSettings = {
  origin: [
    /^.+localhost:(3000|1234)$/,
    "https://world-bank-dashboard.netlify.app",
    "https://world-bank-dashboard.netlify.app/",
    "https://world-bank-dashboard.netlify.app/login",
    "https://world-bank-dashboard.netlify.app/sign-up",
    "https://world-bank-dashboard.netlify.app/history",
  ],
  allowedHeaders: ["Access-Control-Allow-Origin", "Authorization", "Content-Type", "Accept", "Origin", "User-Agent"],
  credentials: true,
};

app
  .use(abcCors(CorsSettings))
  .post("/create-user", postNewUser)
  .post("/login", handleLogin)
  .get("/results", getResults)
  .get("/history", getHistory)
  .delete("/logout", handleLogout)
  .post("/verify-session", verifySession)
  .start({ port: PORT });

console.log(`Server running on http://localhost:${PORT}`);
