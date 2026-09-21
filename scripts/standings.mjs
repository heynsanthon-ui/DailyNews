import { parse } from "node-html-parser";

function directChildren(el, tagName) {
  return el.childNodes.filter((n) => n.tagName && n.tagName.toUpperCase() === tagName);
}

function cellText(el) {
  if (!el) return "";
  return el.text.replace(/ /g, " ").replace(/\s+/g, " ").trim();
}

function findStandingsTable(root) {
  const headers = root.querySelectorAll("h2");
  const target = headers.find((h) => h.text.trim().startsWith("Rank after Round"));
  if (!target) return null;
  let node = target.nextElementSibling;
  while (node && (!node.tagName || node.tagName.toUpperCase() !== "TABLE")) {
    node = node.nextElementSibling;
  }
  return { table: node, heading: target.text.trim() };
}

function parseStandings(html) {
  const root = parse(html);
  const found = findStandingsTable(root);
  if (!found || !found.table) return { asOfRound: null, teams: [] };

  const roundMatch = found.heading.match(/Rank after Round (\d+)/);
  const asOfRound = roundMatch ? Number.parseInt(roundMatch[1], 10) : null;

  const rows = directChildren(found.table, "TR");
  const teams = [];

  for (const row of rows) {
    const ths = directChildren(row, "TH");
    if (ths.length > 0) continue; // header row

    const tds = directChildren(row, "TD");
    if (tds.length < 14) continue;

    const rank = Number.parseInt(cellText(tds[0]), 10);
    if (!Number.isFinite(rank)) continue;

    const fed = cellText(tds[2]);
    const link = tds[4].querySelector("a");
    const team = link ? link.text.trim() : cellText(tds[4]);
    const games = Number.parseInt(cellText(tds[6]), 10);
    const wins = Number.parseInt(cellText(tds[7]), 10);
    const draws = Number.parseInt(cellText(tds[8]), 10);
    const losses = Number.parseInt(cellText(tds[9]), 10);
    const matchPoints = cellText(tds[10]);

    teams.push({ rank, fed, team, games, wins, draws, losses, matchPoints });
  }

  return { asOfRound, teams };
}

export async function fetchStandings({ tnr, id, event }) {
  const url = `https://s1.chess-results.com/tnr${tnr}.aspx?lan=1&art=0&turdet=YES&flag=30`;
  const res = await Promise.race([
    fetch(url, { headers: { "User-Agent": "Mozilla/5.0 (compatible; DailyNewsBot/1.0)" } }),
    new Promise((_, reject) => setTimeout(() => reject(new Error("hard timeout after 20s")), 20000)),
  ]);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const html = await res.text();
  const { asOfRound, teams } = parseStandings(html);

  const top10 = teams.slice(0, 10);
  const sa = teams.find((t) => t.fed === "RSA") || null;

  return { id, label: event, asOfRound, top10, sa };
}
