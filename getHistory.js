import getUserInfo from "./getUserInfo";

async function getHistory(server) {
  const { sessionID } = server.queryParams;
  const user = await getUserInfo(server, sessionID);

  let query = `SELECT * FROM search_history`;
  let searches;

  if (!user.admin_permission) {
    query += ` WHERE user_id = $1;`;
    searches = (await client.queryObject(query, user.user.id)).rows;
  } else searches = (await client.queryObject(query)).rows;

  if (searches) server.json({ response: searches });
  else server.json({ response: "no searches found" });
}

export default getHistory;
//try again
