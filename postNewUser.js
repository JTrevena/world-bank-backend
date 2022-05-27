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

export default postNewUser;
