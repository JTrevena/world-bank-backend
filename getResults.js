import getUserInfo from "./getUserInfo";

async function getResults(server) {
  const { country, indicator, startYear, endYear, sessionID } = server.queryParams;
  if (country === undefined) return server.json({ error: "country must be specified" });

  // const cookies = await server.cookies;
  // const sessionID = cookies.sessionID;
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

export default getResults;
