import { parse } from "node-html-parser";

function directChildren(el, tagName) {
  return el.childNodes.filter((n) => n.tagName && n.tagName.toUpperCase() === tagName);
}

function cellText(el) {
  if (!el) return "";
  return el.text.replace(/ /g, " ").replace(/\s+/g, " ").trim();
}

function findSeedingTable(root) {
  const headers = root.querySelectorAll("h2");
  const target = headers.find((h) => h.text.trim().startsWith("Team-Starting rank"));
  if (!target) return null;
  let node = target.nextElementSibling;
  while (node && (!node.tagName || node.tagName.toUpperCase() !== "TABLE")) {
    node = node.nextElementSibling;
  }
  return node;
}

// Returns South Africa's pre-tournament seed (rank by average rating) and
// the total number of teams, so it can be compared with their current
// standing to see whether they're over- or under-performing expectations.
export async function fetchSeeding({ tnr, fed }) {
  const url = `https://s1.chess-results.com/tnr${tnr}.aspx?lan=1&art=32&turdet=YES&flag=30`;
  const res = await Promise.race([
    fetch(url, { headers: { "User-Agent": "Mozilla/5.0 (compatible; DailyNewsBot/1.0)" } }),
    new Promise((_, reject) => setTimeout(() => reject(new Error("hard timeout after 20s")), 20000)),
  ]);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const html = await res.text();
  const root = parse(html);
  const table = findSeedingTable(root);
  if (!table) return { seedRank: null, totalTeams: null, ratingAvg: null };

  const rows = directChildren(table, "TR");
  let seedRank = null;
  let ratingAvg = null;
  let totalTeams = 0;

  for (const row of rows) {
    if (directChildren(row, "TH").length > 0) continue;
    const tds = directChildren(row, "TD");
    if (tds.length < 5) continue;
    const rank = Number.parseInt(cellText(tds[0]), 10);
    if (!Number.isFinite(rank)) continue;
    totalTeams = Math.max(totalTeams, rank);
    if (cellText(tds[2]) === fed) {
      seedRank = rank;
      ratingAvg = Number.parseInt(cellText(tds[4]), 10);
    }
  }

  return { seedRank, totalTeams, ratingAvg: Number.isFinite(ratingAvg) ? ratingAvg : null };
}
