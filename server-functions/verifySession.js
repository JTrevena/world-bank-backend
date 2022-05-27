async function verifySession(server) {
  const { sessionID } = server.queryParams;
  const sessions = (await client.queryObject("SELECT * FROM sessions")).rows;

  let isValid = false;
  sessions.forEach(session => {
    if (session.uuid === sessionID) isValid = true;
  });

  return server.json({ response: isValid });
}

export default verifySession;
