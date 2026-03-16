const { getStore } = require("@netlify/blobs");

exports.handler = async (event, context) => {
  try {
    const token = process.env.NETLIFY_AUTH_TOKEN;
    const siteID = process.env.NETLIFY_SITE_ID;
    const storeOpts = (token && siteID) ? { name: "baseball-stats", token, siteID } : "baseball-stats";

    const store = getStore(storeOpts);

    // First check what the latest timestamp is
    let latestTs = null;
    try {
      const tsData = await store.get("latest-timestamp", { type: "json", consistency: "strong" });
      if (tsData && tsData.ts) latestTs = tsData.ts;
    } catch(e) {
      console.log("No latest-timestamp key yet");
    }

    // Get the main stats
    const data = await store.get("stats", { type: "json", consistency: "strong" });

    if (!data) {
      return {
        statusCode: 404,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "Cache-Control": "no-store, no-cache, must-revalidate" },
        body: JSON.stringify({ error: "No data yet." })
      };
    }

    // Override lastUpdated with the freshest timestamp we know about
    if (latestTs) data.lastUpdated = latestTs;

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "no-store, no-cache, must-revalidate",
        "Pragma": "no-cache",
        "Expires": "0"
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
