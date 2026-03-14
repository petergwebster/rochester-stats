const { getStore } = require("@netlify/blobs");

exports.handler = async (event, context) => {
  try {
    const token = process.env.NETLIFY_AUTH_TOKEN;
    const siteID = process.env.NETLIFY_SITE_ID;

    const storeOpts = (token && siteID)
      ? { name: "baseball-stats", token, siteID }
      : "baseball-stats";

    const store = getStore(storeOpts);
    const data = await store.get("stats", { type: "json" });

    if (!data) {
      return {
        statusCode: 404,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
        body: JSON.stringify({ error: "No data yet. Run scraper first." })
      };
    }
    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "public, max-age=1800"
      },
      body: JSON.stringify(data)
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({ error: err.message })
    };
  }
};
