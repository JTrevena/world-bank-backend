import { Application } from "https://deno.land/x/abc/mod.ts";
import { abcCors } from "https://deno.land/x/cors/mod.ts";
import { Client } from "https://deno.land/x/postgres@v0.11.3/mod.ts";
import * as bcrypt from "https://deno.land/x/bcrypt/mod.ts";
import { v4 } from "https://deno.land/std/uuid/mod.ts";
import { config } from "https://deno.land/x/dotenv/mod.ts";

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

  const salt = await bcrypt.genSalt(8);
  const hashed_password = await bcrypt.hash(password, salt);

  try {
    await client.queryObject(
      "INSERT INTO users (username, hashed_password, salt, admin_permission, created_at) VALUES ($1,$2,$3,$4, NOW())",
      username,
      hashed_password,
      salt,
      false
    );
  } catch (e) {
    return server.json({ error: "could not add user to database" }, 500);
  }

  server.json({ response: "User added successfully" }, 200);
}

async function handleLogin(server) {
  const { username, password } = await server.body;
  const users = (await client.queryObject(`SELECT * FROM users;`)).rows;

  let user;
  users.forEach(currentUser => {
    if (currentUser.username === username) {
      user = currentUser;
    }
  });

  const userExists = user !== undefined;
  const passwordIsValid = userExists ? await bcrypt.compare(password, user.hashed_password) : false;

  if (!(userExists && passwordIsValid)) return server.json({ error: "Username or password is incorrect" }, 400);

  // EDGE CASE: user left site and deleted their cookies
  await client.queryObject("DELETE FROM sessions WHERE user_id = $1;", user.id);

  const sessionUUID = v4.generate();

  await client.queryObject(
    "INSERT INTO sessions (uuid, user_id, created_at) VALUES ($1, $2, NOW());",
    sessionUUID,
    user.id
  );

  server.setCookie({
    name: "sessionID",
    value: sessionUUID,
  });
  server.setCookie({
    name: "username",
    value: username,
  });
}

async function getResults(server) {
  const { country, indicator, startYear, endYear } = server.queryParams;
  if (country == undefined) return server.json({ error: "country must be specified" });

  let query = `SELECT CountryName, IndicatorName, Year, Value FROM indicators WHERE CountryName = $1`;
  const results = (await worldBankDB.queryObject(query, country)).rows();
  await server.json({ response: results });
}

async function getHistory(server) {
  const cookies = await server.cookies;
  const username = cookies.username;
  //return server.json({ username: username }); <-- This line has been used to test the above and username IS being read correctly
  const user = getUserInfo(username);

  let query = `SELECT * FROM search_history`;
  if (!user.admin_permission) query += ` WHERE user_id = ${user.id};`;

  const searches = (await client.queryObject(query)).rows;

  if (searches) server.json(searches);
  else server.json({ response: "no searches found" });
}

async function handleLogout(server) {
  const cookies = await server.cookies;
  let sessionID;
  try {
    sessionID = cookies.sessionID;
  } catch (e) {
    //Error("No session cookie exists")
  }

  if (sessionID !== undefined)
    try {
      await client.queryObject("DELETE FROM sessions WHERE uuid = $1;", sessionID);
      // if above code fails does it go straight to catch or does below code run?
      return server.json({ response: "session ended" });
    } catch (e) {
      return server.json({ error: "could not remove session" });
    } // spent about an hour and couldn't delete/overwrite cookies so I propose to delete in frontend (if we get response from backend)
}

async function getUserInfo(username) {
  const user = (await client.queryObject("SELECT * FROM users WHERE username = $1;", username)).rows;
  return user;
}

console.log(`Server running on http://localhost:${PORT}`);
