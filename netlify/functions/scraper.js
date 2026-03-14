const { getStore } = require("@netlify/blobs");

const LL_URL = "https://libertyleagueathletics.com/stats.aspx?path=baseball&year=2026";
const ROC_URL = "https://static.uofrathletics.com/custompages/UR%20BASEBALL/2026/teamcume.htm";

async function fetchHTML(url) {
  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; stats-scraper/1.0)" }
  });
  if (!res.ok) throw new Error("Failed " + url + ": " + res.status);
  return res.text();
}

function safeNum(s) {
  if (!s) return 0;
  const n = parseFloat(String(s).replace(/[^0-9.\-]/g, ""));
  return isNaN(n) ? 0 : n;
}

function parseRows(html, tableIndex) {
  const rows = [];
  const tableRx = /<table[^>]*>([\s\S]*?)<\/table>/gi;
  const rowRx = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  const strip = s => s.replace(/<[^>]+>/g,"").replace(/&amp;/g,"&").replace(/&nbsp;/g," ").replace(/&#\d+;/g,"").trim();
  let ti = 0, tm;
  while ((tm = tableRx.exec(html)) !== null) {
    if (ti++ === tableIndex) {
      let rm;
      while ((rm = rowRx.exec(tm[1])) !== null) {
        const cells = [];
        const cr = /<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi;
        let cm;
        while ((cm = cr.exec(rm[1])) !== null) cells.push(strip(cm[1]));
        if (cells.length > 1) rows.push(cells);
      }
      break;
    }
  }
  return rows;
}

async function scrapeLL() {
  const html = await fetchHTML(LL_URL);
  const teams = parseRows(html, 0).slice(1).filter(r => r[1] && r[1].trim()).map(r => ({
    team: r[1].replace(/[^\w\s.]/g,"").trim(),
    avg: safeNum(r[2]), g: safeNum(r[3]), ab: safeNum(r[4]),
    r: safeNum(r[5]), h: safeNum(r[6]), d: safeNum(r[7]),
    t: safeNum(r[8]), hr: safeNum(r[9]), rbi: safeNum(r[10]),
    tb: safeNum(r[11]), slg: safeNum(r[12]), bb: safeNum(r[13]),
    so: safeNum(r[15]), obp: safeNum(r[16]), sb: r[19]||"0-0", fld: safeNum(r[23])
  }));

  parseRows(html, 1).slice(1).forEach(r => {
    const name = r[1] ? r[1].replace(/[^\w\s.]/g,"").trim() : "";
    const t = teams.find(t => name.toLowerCase().includes(t.team.toLowerCase().split(" ")[0].toLowerCase()));
    if (t) { t.era = safeNum(r[2]); t.wl = r[3]||"0-0"; }
  });

  const hitters = parseRows(html, 2).slice(1).filter(r => r[1] && r[1].trim()).map(r => {
    const p = r[1].split("(");
    return { name: p[0].trim(), team: p[1] ? p[1].replace(")","").trim() : "",
      avg: safeNum(r[2]), ops: safeNum(r[3]), gp: r[4]||"0-0",
      ab: safeNum(r[5]), r: safeNum(r[6]), h: safeNum(r[7]),
      d: safeNum(r[8]), t: safeNum(r[9]), hr: safeNum(r[10]),
      rbi: safeNum(r[11]), tb: safeNum(r[12]), slg: safeNum(r[13]),
      bb: safeNum(r[14]), hbp: safeNum(r[15]), so: safeNum(r[16]),
      obp: safeNum(r[18]), sb: r[21]||"0-0" };
  });

  const pitchers = parseRows(html, 3).slice(1).filter(r => r[1] && r[1].trim()).map(r => {
    const p = r[1].split("(");
    return { name: p[0].trim(), team: p[1] ? p[1].replace(")","").trim() : "",
      era: safeNum(r[2]), w: safeNum(r[3]), l: safeNum(r[4]),
      gs: safeNum(r[5]), sv: safeNum(r[8]), ip: safeNum(r[9]),
      h: safeNum(r[10]), r: safeNum(r[11]), er: safeNum(r[12]),
      bb: safeNum(r[13]), so: safeNum(r[14]), hr: safeNum(r[17]),
      bavg: safeNum(r[19]) };
  });

  return { teams, hitters, pitchers };
}

async function scrapeROC() {
  const html = await fetchHTML(ROC_URL);
  const recMatch = html.match(/Record:\s*([\d]+-[\d]+)/);
  const record = recMatch ? recMatch[1] : "0-0";

  const hitters = parseRows(html, 0).slice(1)
    .filter(r => r[0] && r[0] !== "Totals" && r[0] !== "Opponents" && r[2] !== undefined)
    .map(r => ({
      name: r[0], avg: safeNum(r[1]), gp: r[2]||"0-0",
      ab: safeNum(r[3]), r: safeNum(r[4]), h: safeNum(r[5]),
      d: safeNum(r[6]), t: safeNum(r[7]), hr: safeNum(r[8]),
      rbi: safeNum(r[9]), tb: safeNum(r[10]), slg: safeNum(r[11]),
      bb: safeNum(r[12]), hbp: safeNum(r[13]), so: safeNum(r[14]),
      gdp: safeNum(r[15]), obp: safeNum(r[16]),
      sf: safeNum(r[17]), sh: safeNum(r[18]), sb: r[19]||"0-0",
      po: safeNum(r[20]), a: safeNum(r[21]), e: safeNum(r[22]), fld: safeNum(r[23])
    }));

  const pitchers = parseRows(html, 1).slice(1)
    .filter(r => r[0] && r[0] !== "Totals" && r[0] !== "Opponents")
    .map(r => ({
      name: r[0], era: safeNum(r[1]), wl: r[2]||"0-0",
      app: r[3] ? safeNum(r[3].split("-")[0]) : 0,
      gs: r[3] ? safeNum(r[3].split("-")[1]) : 0,
      sv: safeNum(r[6]), ip: safeNum(r[7]),
      h: safeNum(r[8]), r: safeNum(r[9]), er: safeNum(r[10]),
      bb: safeNum(r[11]), so: safeNum(r[12]), hr: safeNum(r[15]),
      bavg: safeNum(r[17]), wp: safeNum(r[18]), hbp: safeNum(r[19]), bk: safeNum(r[20])
    }));

  return { record, hitters, pitchers, innings: { roc: [], opp: [] } };
}

exports.handler = async (event, context) => {
  try {
    // Get credentials from environment OR from context (auto-injected by Netlify for scheduled functions)
    const token = process.env.NETLIFY_AUTH_TOKEN;
    const siteID = process.env.NETLIFY_SITE_ID;

    console.log("Scraper starting. Token present:", !!token, "SiteID present:", !!siteID);

    const storeConfig = {};
    if (token && siteID) {
      storeConfig.token = token;
      storeConfig.siteID = siteID;
    }

    const [ll, roc] = await Promise.all([scrapeLL(), scrapeROC()]);

    const data = {
      lastUpdated: new Date().toISOString(),
      roc: { record: roc.record, hitters: roc.hitters, pitchers: roc.pitchers, innings: roc.innings },
      ll: { teams: ll.teams, hitters: ll.hitters, pitchers: ll.pitchers }
    };

    const store = getStore(Object.keys(storeConfig).length > 0
      ? { name: "baseball-stats", ...storeConfig }
      : "baseball-stats"
    );

    await store.setJSON("stats", data);

    console.log("Done. Teams:", ll.teams.length, "ROC hitters:", roc.hitters.length);
    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ok: true, lastUpdated: data.lastUpdated, rocHitters: roc.hitters.length, llTeams: ll.teams.length })
    };
  } catch (err) {
    console.error("Scrape failed:", err.message);
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: err.message })
    };
  }
};
