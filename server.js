import { Application } from "https://deno.land/x/abc/mod.ts";
import { abcCors } from "https://deno.land/x/cors/mod.ts";
import { Client } from "https://deno.land/x/postgres@v0.11.3/mod.ts";
import * as bcrypt from "https://deno.land/x/bcrypt/mod.ts";
import { v4 } from "https://deno.land/std/uuid/mod.ts";
import { config } from "https://deno.land/x/dotenv/mod.ts";

const DENO_ENV = Deno.env.get("DENO_ENV") ?? "development";
config({ path: `./.env.${DENO_ENV}`, export: true });

const client = new Client(Deno.env.get("PG_URL"));
await client.connect();

const app = new Application();
const PORT = Number(Deno.env.get("PORT"));

const CorsSettings = {
  origin: /^.+localhost:(3000|1234)$/, // TODO: Change this to include Netlify domain once hosted
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

async function postNewUser(server) {
  const { username, password } = await server.body;

  const salt = bcrypt.genSalt(8);
  const hashed_password = bcrypt.hash(password, salt);

  try {
    await client.query(`INSERT INTO users (username, hashed_password, salt, admin_permission, created_at)
  VALUES (?,?,?,?, NOW())`),
      [username, hashed_password, salt, false];
  } catch (e) {
    return server.json({ Error: e }, 500);
  }

  server.json({ response: "User added successfully" }, 200);
}

async function handleLogin(server) {
  const { username, password } = await server.body;
  const users = (await client.queryObject(`SELECT * FROM users`)).rows;

  let user;
  users.forEach(currentUser => {
    if (currentUser.username === username) {
      user = currentUser;
    }
  });

  const userExists = user !== undefined;
  const passwordIsValid = userExists ? await bcrypt.compare(password, user.hashed_password) : false;

  if (!(userExists && passwordIsValid)) return server.json({ Error: "Username or password is incorrect" });

  // EDGE CASE: user left site and deleted their cookies
  await client.query(`DELETE * FROM sessions WHERE user_id = ?`, [user.id]);

  const sessionUUID = v4.generate();

  await client.query(
    `INSERT INTO sessions (uuid, user_id, created_at)
  VALUES (?, ?, NOW())`,
    [sessionUUID, user.id]
  );

  server.setCookie({
    name: "sessionId",
    value: sessionUUID,
  });
  server.setCookie({
    name: "username",
    value: username,
  });
}

async function getResults(server) {
  //server test
  return server.json({ response: "The server is running" }, 200);
}

async function getHistory(server) {}

async function handleLogout(server) {}

console.log(`Server running on http://localhost:${PORT}`);
