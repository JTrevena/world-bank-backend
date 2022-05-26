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

  //Cookies must be set from frontend because of netlify
  return server.json({ response: sessionUUID });
}

async function getResults(server) {
  const { country, indicator, startYear, endYear } = server.queryParams;
  if (country === undefined) return server.json({ error: "country must be specified" });

  const cookies = await server.cookies;
  const sessionID = cookies.sessionID;
  const user = await getUserInfo(server, sessionID);

  //record search
  await client.queryObject(
    `INSERT INTO search_history (user_id,	first_country,	indicator,	start_year,	end_year,	created_at)
    VALUES ($1, $2, $3, $4, $5, NOW())`,
    user.user.id,
    country,
    indicator,
    startYear,
    endYear
  );

  let query = `SELECT CountryName, IndicatorName, Year, Value FROM indicators WHERE CountryName = $1`;
  let params = [country];
  let furtherInterpolations = [`$2`, `$3`, `$4`];
  let results;

  if (indicator !== undefined) {
    query += ` AND IndicatorName = ` + furtherInterpolations.shift();
    params.push(indicator);
  }

  if (startYear && !endYear) {
    query += ` AND Year = ` + furtherInterpolations.shift();
    params.push(startYear);
  } else if (startYear && endYear) {
    query += ` AND Year BETWEEN ` + furtherInterpolations.shift() + ` AND ` + furtherInterpolations.shift();
    params.push(startYear);
    params.push(endYear);
  }

  // Forgive me for this repetitive code, Ibrahim
  if (params.length === 4)
    results = (await worldBankDB.queryObject(query, params[0], params[1], params[2], params[3])).rows;
  if (params.length === 3) results = (await worldBankDB.queryObject(query, params[0], params[1], params[2])).rows;
  if (params.length === 2) results = (await worldBankDB.queryObject(query, params[0], params[1])).rows;
  if (results === undefined) results = (await worldBankDB.queryObject(query, params[0])).rows;

  await server.json(results);
}

async function getHistory(server) {
  const cookies = await server.cookies;
  const sessionID = cookies.sessionID;
  const user = await getUserInfo(server, sessionID);

  return server.json({ user: user });

  let query = `SELECT * FROM search_history`;
  let searches;

  if (!user.admin_permission) {
    query += ` WHERE user_id = $1;`;
    searches = (await client.queryObject(query, user.user.id)).rows;
  } else searches = (await client.queryObject(query)).rows;

  if (searches) server.json({ response: searches });
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

async function getUserInfo(server, sessionID) {
  const session = (await client.queryObject("SELECT * FROM sessions WHERE uuid = $1;", sessionID)).rows;
  if (!session) return {}; // TODO: this should log them out; not that this request should ever be sent without a session id

  const user_id = session[0].user_id;
  const user = (await client.queryObject("SELECT * FROM users WHERE id = $1;", user_id)).rows;
  return { user: user[0] };
}

console.log(`Server running on http://localhost:${PORT}`);
