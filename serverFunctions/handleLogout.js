async function handleLogout(server) {
  const { sessionID } = server.queryParams;

  if (sessionID !== undefined)
    try {
      await client.queryObject("DELETE FROM sessions WHERE uuid = $1;", sessionID);
      // if above code fails does it go straight to catch or does below code run?
      return server.json({ response: "session ended" });
    } catch (e) {
      return server.json({ error: "could not remove session" });
    } // spent about an hour and couldn't delete/overwrite cookies so I propose to delete in frontend (if we get response from backend)
}

export default handleLogout;
