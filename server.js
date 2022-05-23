import { Application } from "https://deno.land/x/abc/mod.ts";
import { abcCors } from "https://deno.land/x/cors/mod.ts";
import { Client } from "https://deno.land/x/postgres@v0.11.3/mod.ts";
import * as bcrypt from "https://deno.land/x/bcrypt/mod.ts";

const client = new Client("postgres://rlihxtrg:PmCvI1D4fiW4F0zD6Ik11j5ZxEM7XKxC@surus.db.elephantsql.com/rlihxtrg");
await client.connect();

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

  // User verified. TODO: Rest of function
}

async function getResults(server) {}

async function getHistory(server) {}

async function handleLogout(server) {}

console.log(`Server running on http://localhost:${PORT}`);
