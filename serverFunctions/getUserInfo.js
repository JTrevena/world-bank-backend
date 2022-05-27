async function getUserInfo(server, sessionID) {
  const session = (await client.queryObject("SELECT * FROM sessions WHERE uuid = $1;", sessionID)).rows;
  if (!session) return {}; // TODO: this should log them out; not that this request should ever be sent without a session id

  const user_id = session[0].user_id;
  const user = (await client.queryObject("SELECT * FROM users WHERE id = $1;", user_id)).rows;
  return { user: user[0] };
}

export default getUserInfo;
