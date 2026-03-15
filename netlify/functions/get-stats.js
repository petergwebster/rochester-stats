const { getStore, listStores } = require("@netlify/blobs");

exports.handler = async (event, context) => {
  try {
    const token = process.env.NETLIFY_AUTH_TOKEN;
    const siteID = process.env.NETLIFY_SITE_ID;

    // Debug: log what credentials we have
    console.log("Token present:", !!token);
    console.log("SiteID:", siteID);

    const storeOpts = (token && siteID)
      ? { name: "baseball-stats", token, siteID }
      : "baseball-stats";

    // Debug: list all available stores
    let storeList = [];
    try {
      const result = await listStores(token && siteID ? { token, siteID } : {});
      storeList = result.stores || [];
      console.log("Available stores:", JSON.stringify(storeList));
    } catch(e) {
      console.log("Could not list stores:", e.message);
    }

    const store = getStore(storeOpts);

    // Debug: list keys in the store
    let keys = [];
    try {
      const listed = await store.list();
      keys = (listed.blobs || []).map(b => b.key);
      console.log("Keys in baseball-stats:", JSON.stringify(keys));
    } catch(e) {
      console.log("Could not list keys:", e.message);
    }

    const data = await store.get("stats", { type: "json", consistency: "strong" });

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "no-store"
      },
      body: JSON.stringify({
        debug: { tokenPresent: !!token, siteID, storeList, keys },
        data: data || null
      })
    };
  } catch (err) {
    console.error("Error:", err.message);
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({ error: err.message })
    };
  }
};
