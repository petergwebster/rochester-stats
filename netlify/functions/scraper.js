const { getStore } = require("@netlify/blobs");

const LL_URL = "https://libertyleagueathletics.com/stats.aspx?path=baseball&year=2026";
const ROC_URL = "https://static.uofrathletics.com/custompages/UR%20BASEBALL/2026/teamcume.htm";
const SCHEDULE_URL = "https://uofrathletics.com/sports/baseball/schedule";

async function fetchHTML(url) {
  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; stats-scraper/1.0)" }
  });
  if (!res.ok) throw new Error(`Failed ${url}: ${res.status}`);
  return res.text();
}

function parseTable(html, selector) {
  const rows = [];
  const tableRx = /<table[^>]*>([\s\S]*?)<\/table>/gi;
  const rowRx = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  const cellRx = /<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi;
  const stripTags = s => s.replace(/<[^>]+>/g, "").replace(/&amp;/g,"&").replace(/&nbsp;/g," ").replace(/&#[0-9]+;/g,"").trim();

  let tableMatch;
  let tableIdx = 0;
  while ((tableMatch = tableRx.exec(html)) !== null) {
    if (tableIdx === selector) {
      const tableHtml = tableMatch[1];
      let rowMatch;
      while ((rowMatch = rowRx.exec(tableHtml)) !== null) {
        const cells = [];
        let cellMatch;
        const cellRx2 = /<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi;
        while ((cellMatch = cellRx2.exec(rowMatch[1])) !== null) {
          cells.push(stripTags(cellMatch[1]));
        }
        if (cells.length > 1) rows.push(cells);
      }
      break;
    }
    tableIdx++;
  }
  return rows;
}

function safeNum(s) {
  if (!s) return 0;
  const n = parseFloat(String(s).replace(/[^0-9.\-]/g, ""));
  return isNaN(n) ? 0 : n;
}

async function scrapeLL() {
  const html = await fetchHTML(LL_URL);
  
  // Team batting (table 0)
  const batRows = parseTable(html, 0).slice(1); // skip header
  const teams = batRows.filter(r => r[1] && r[1].trim()).map(r => ({
    team: r[1].replace(/[^\w\s.]/g, "").trim(),
    avg: safeNum(r[2]), g: safeNum(r[3]), ab: safeNum(r[4]),
    r: safeNum(r[5]), h: safeNum(r[6]), d: safeNum(r[7]),
    t: safeNum(r[8]), hr: safeNum(r[9]), rbi: safeNum(r[10]),
    tb: safeNum(r[11]), slg: safeNum(r[12]), bb: safeNum(r[13]),
    so: safeNum(r[15]), obp: safeNum(r[16]),
    sb: r[19] || "0-0", fld: safeNum(r[23])
  }));

  // Team pitching (table 1)
  const pitRows = parseTable(html, 1).slice(1);
  pitRows.forEach(r => {
    const name = r[1] ? r[1].replace(/[^\w\s.]/g, "").trim() : "";
    const t = teams.find(t => name.toLowerCase().includes(t.team.toLowerCase().split(" ")[0].toLowerCase()));
    if (t) { t.era = safeNum(r[2]); t.wl = r[3] || "0-0"; }
  });

  // Individual hitters (table 2)
  const hitRows = parseTable(html, 2).slice(1);
  const hitters = hitRows.filter(r => r[1] && r[1].trim()).map(r => {
    const parts = r[1].split("(");
    const name = parts[0].trim();
    const team = parts[1] ? parts[1].replace(")", "").trim() : "";
    return {
      name, team,
      avg: safeNum(r[2]), ops: safeNum(r[3]), gp: r[4] || "0-0",
      ab: safeNum(r[5]), r: safeNum(r[6]), h: safeNum(r[7]),
      d: safeNum(r[8]), t: safeNum(r[9]), hr: safeNum(r[10]),
      rbi: safeNum(r[11]), tb: safeNum(r[12]), slg: safeNum(r[13]),
      bb: safeNum(r[14]), hbp: safeNum(r[15]), so: safeNum(r[16]),
      obp: safeNum(r[18]), sb: r[21] || "0-0"
    };
  });

  // Individual pitchers (table 3)
  const pitIndRows = parseTable(html, 3).slice(1);
  const pitchers = pitIndRows.filter(r => r[1] && r[1].trim()).map(r => {
    const parts = r[1].split("(");
    const name = parts[0].trim();
    const team = parts[1] ? parts[1].replace(")", "").trim() : "";
    return {
      name, team,
      era: safeNum(r[2]), w: safeNum(r[3]), l: safeNum(r[4]),
      gs: safeNum(r[5]), sv: safeNum(r[8]),
      ip: safeNum(r[9]), h: safeNum(r[10]), r: safeNum(r[11]),
      er: safeNum(r[12]), bb: safeNum(r[13]), so: safeNum(r[14]),
      hr: safeNum(r[17]), bavg: safeNum(r[19])
    };
  });

  return { teams, hitters, pitchers };
}

async function scrapeROC() {
  const html = await fetchHTML(ROC_URL);
  const stripTags = s => s.replace(/<[^>]+>/g, "").replace(/&amp;/g,"&").replace(/&nbsp;/g," ").replace(/&#[0-9]+;/g,"").trim();
  
  // Extract record
  const recMatch = html.match(/Record:\s*([\d]+-[\d]+)/);
  const record = recMatch ? recMatch[1] : "0-0";

  // Hitters table (table 0)
  const hitRows = parseTable(html, 0).slice(1);
  const hitters = hitRows.filter(r => r[0] && r[0] !== "Totals" && r[0] !== "Opponents" && r[2] !== undefined).map(r => ({
    name: r[0],
    avg: safeNum(r[1]), gp: r[2] || "0-0",
    ab: safeNum(r[3]), r: safeNum(r[4]), h: safeNum(r[5]),
    d: safeNum(r[6]), t: safeNum(r[7]), hr: safeNum(r[8]),
    rbi: safeNum(r[9]), tb: safeNum(r[10]), slg: safeNum(r[11]),
    bb: safeNum(r[12]), hbp: safeNum(r[13]), so: safeNum(r[14]),
    gdp: safeNum(r[15]), obp: safeNum(r[16]),
    sf: safeNum(r[17]), sh: safeNum(r[18]),
    sb: r[19] || "0-0", po: safeNum(r[20]),
    a: safeNum(r[21]), e: safeNum(r[22]), fld: safeNum(r[23])
  }));

  // Pitchers table (table 1)  
  const pitRows = parseTable(html, 1).slice(1);
  const pitchers = pitRows.filter(r => r[0] && r[0] !== "Totals" && r[0] !== "Opponents").map(r => ({
    name: r[0],
    era: safeNum(r[1]), wl: r[2] || "0-0",
    app: r[3] ? safeNum(r[3].split("-")[0]) : 0,
    gs: r[3] ? safeNum(r[3].split("-")[1]) : 0,
    sv: safeNum(r[6]), ip: safeNum(r[7]),
    h: safeNum(r[8]), r: safeNum(r[9]), er: safeNum(r[10]),
    bb: safeNum(r[11]), so: safeNum(r[12]),
    hr: safeNum(r[15]), bavg: safeNum(r[17]),
    wp: safeNum(r[18]), hbp: safeNum(r[19]), bk: safeNum(r[20])
  }));

  // Inning by inning
  const innMatch = html.match(/Rochester.*?(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)/);
  const oppMatch = html.match(/Opponents.*?(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)/);
  const innings = {
    roc: innMatch ? innMatch.slice(1).map(Number) : [],
    opp: oppMatch ? oppMatch.slice(1).map(Number) : []
  };

  return { record, hitters, pitchers, innings };
}

async function scrapeSchedule() {
  try {
    const html = await fetchHTML(SCHEDULE_URL);
    // Extract games from structured patterns in the HTML
    const games = [];
    const dateRx = /Mar|Apr|May/g;
    // Simple extraction: look for result patterns W,\d+-\d+ or L,\d+-\d+
    const gameRx = /(Mar|Apr|May)\s+(\d+)[^W|L]*(W|L),\s*([\d]+-[\d]+)/g;
    let m;
    while ((m = gameRx.exec(html)) !== null) {
      games.push({ date: m[1]+" "+m[2], result: m[3], score: m[4] });
    }
    return games;
  } catch(e) {
    return [];
  }
}

exports.handler = async (event) => {
  try {
    console.log("Scraper starting...");
    const [ll, roc, schedule] = await Promise.all([
      scrapeLL(),
      scrapeROC(),
      scrapeSchedule()
    ]);

    const data = {
      lastUpdated: new Date().toISOString(),
      roc: { ...roc },
      ll: { teams: ll.teams, hitters: ll.hitters, pitchers: ll.pitchers },
      schedule
    };

    const store = getStore("baseball-stats");
    await store.setJSON("stats", data);

    console.log("Scrape complete. Teams:", ll.teams.length, "ROC hitters:", roc.hitters.length);
    return { statusCode: 200, body: JSON.stringify({ ok: true, lastUpdated: data.lastUpdated }) };
  } catch (err) {
    console.error("Scrape failed:", err);
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};

