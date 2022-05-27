import * as bcrypt from "https://deno.land/x/bcrypt/mod.ts";
import { v4 } from "https://deno.land/std/uuid/mod.ts";

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

export default handleLogin;
