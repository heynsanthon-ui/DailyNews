import { parse } from "node-html-parser";

const TITLES = new Set(["GM", "IM", "FM", "CM", "NM", "WGM", "WIM", "WFM", "WCM"]);

function directChildren(el, tagName) {
  return el.childNodes.filter((n) => n.tagName && n.tagName.toUpperCase() === tagName);
}

function cellText(el) {
  if (!el) return "";
  return el.text.replace(/ /g, " ").replace(/\s+/g, " ").trim();
}

function fedFromHeaderCell(th) {
  const div = th.querySelector("div");
  const cls = div ? div.getAttribute("class") || "" : "";
  const m = cls.match(/tn_([A-Za-z]{2,3})/);
  return m ? m[1].toUpperCase() : null;
}

function teamNameFromHeaderCell(th) {
  // Cell text is like "  South Africa (RSA)" (flag div text is empty).
  return cellText(th);
}

function playerFromBoardCell(titleCell, nameCell, ratingCell) {
  const title = cellText(titleCell);
  const link = nameCell.querySelector("a");
  const name = link ? link.text.trim() : cellText(nameCell);
  const rating = Number.parseInt(cellText(ratingCell), 10);
  return {
    name,
    title: TITLES.has(title) ? title : null,
    rating: Number.isFinite(rating) ? rating : null,
  };
}

function findBoardPairingsTable(root) {
  const headers = root.querySelectorAll("h2");
  const target = headers.find((h) => h.text.trim().startsWith("Board Pairings"));
  if (!target) return null;
  let node = target.nextElementSibling;
  while (node && (!node.tagName || node.tagName.toUpperCase() !== "TABLE")) {
    node = node.nextElementSibling;
  }
  return node;
}

function findTeamCompositionTable(root) {
  const headers = root.querySelectorAll("h2");
  const target = headers.find((h) => h.text.trim().startsWith("Team composition"));
  if (!target) return null;
  let node = target.nextElementSibling;
  while (node && (!node.tagName || node.tagName.toUpperCase() !== "TABLE")) {
    node = node.nextElementSibling;
  }
  return node;
}

function parseNumber(text) {
  const n = Number.parseFloat((text || "").replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

// Per-player performance vs expectations: rating faced (RtgAvg), performance
// rating (Rp), and the rating points gained/lost this event (rtg+/-).
function parseRoster(root) {
  const table = findTeamCompositionTable(root);
  if (!table) return [];

  const roster = [];
  for (const row of directChildren(table, "TR")) {
    const ths = directChildren(row, "TH");
    if (ths.length > 0) continue;

    const tds = directChildren(row, "TD");
    if (tds.length < 12) continue;

    const board = Number.parseInt(cellText(tds[0]), 10);
    if (!Number.isFinite(board)) continue;

    const nameLink = tds[2].querySelector("a");
    const name = nameLink ? nameLink.text.trim() : cellText(tds[2]);
    if (!name) continue;

    const title = cellText(tds[1]);
    const rating = Number.parseInt(cellText(tds[3]), 10);
    const roundsCount = tds.length - 12;
    const points = parseNumber(cellText(tds[6 + roundsCount]));
    const games = Number.parseInt(cellText(tds[7 + roundsCount]), 10);
    const avgOpponentRating = Number.parseInt(cellText(tds[8 + roundsCount]), 10);
    const performanceRating = Number.parseInt(cellText(tds[9 + roundsCount]), 10);
    const ratingChange = parseNumber(cellText(tds[11 + roundsCount]));

    roster.push({
      board,
      name,
      title: TITLES.has(title) ? title : null,
      rating: Number.isFinite(rating) ? rating : null,
      games: Number.isFinite(games) ? games : null,
      points,
      avgOpponentRating: Number.isFinite(avgOpponentRating) ? avgOpponentRating : null,
      performanceRating: Number.isFinite(performanceRating) ? performanceRating : null,
      ratingChange,
    });
  }

  return roster.sort((a, b) => a.board - b.board);
}

function parseBoardPairings(root) {
  const table = findBoardPairingsTable(root);
  if (!table) return [];

  const rows = directChildren(table, "TR");
  const rounds = [];
  let current = null;

  for (const row of rows) {
    const ths = directChildren(row, "TH");

    if (ths.length >= 9) {
      // Match header: Bo. | no | team1 | Rtg | - | no | team2 | Rtg | score
      const team1Fed = fedFromHeaderCell(ths[2]);
      const team2Fed = fedFromHeaderCell(ths[6]);
      const saIsTeam1 = team1Fed === "RSA";
      const scoreParts = cellText(ths[8]).split(":").map((s) => s.trim());
      const [score1, score2] = scoreParts.length === 2 ? scoreParts : [null, null];
      current = {
        round: current ? current.round : null,
        date: current ? current.date : null,
        saIsTeam1,
        opponent: saIsTeam1 ? teamNameFromHeaderCell(ths[6]) : teamNameFromHeaderCell(ths[2]),
        opponentFed: saIsTeam1 ? team2Fed : team1Fed,
        saScore: saIsTeam1 ? score1 : score2,
        opponentScore: saIsTeam1 ? score2 : score1,
        boards: [],
      };
      rounds.push(current);
      continue;
    }

    const tds = directChildren(row, "TD");

    if (tds.length === 1) {
      const text = cellText(tds[0]);
      const m = text.match(/^Round (\d+) on (\d{4}\/\d{2}\/\d{2}) at (\d{2}:\d{2})$/);
      if (m) {
        current = null; // next header row will attach round/date
        var pendingRound = Number.parseInt(m[1], 10);
        var pendingDate = m[2];
      }
      continue;
    }

    if (tds.length < 9) continue;

    const boardId = cellText(tds[0]);
    if (!/^\d+\.\d+$/.test(boardId)) continue; // not a board row (captains, etc.)
    if (!current) continue;

    if (current.round == null && typeof pendingRound === "number") {
      current.round = pendingRound;
      current.date = pendingDate;
    }

    const p1 = playerFromBoardCell(tds[1], tds[2], tds[3]);
    const p2 = playerFromBoardCell(tds[5], tds[6], tds[7]);
    const result = cellText(tds[8]) || null;

    const board = Number.parseInt(boardId.split(".")[1], 10);
    const sa = current.saIsTeam1 ? p1 : p2;
    const opp = current.saIsTeam1 ? p2 : p1;
    let saResult = null;
    let oppResult = null;
    if (result) {
      const parts = result.split("-").map((s) => s.trim());
      if (parts.length === 2) {
        [saResult, oppResult] = current.saIsTeam1 ? parts : [parts[1], parts[0]];
      }
    }

    current.boards.push({
      board,
      player: sa.name,
      title: sa.title,
      rating: sa.rating,
      opponent: opp.name,
      opponentTitle: opp.title,
      opponentRating: opp.rating,
      result: saResult,
      opponentResult: oppResult,
    });
  }

  return rounds
    .filter((r) => r.round != null && r.boards.length > 0)
    .map(({ saIsTeam1, ...rest }) => rest)
    .sort((a, b) => b.round - a.round);
}

export async function fetchOlympiadTeam(team) {
  const url = `https://s1.chess-results.com/tnr${team.tnr}.aspx?lan=1&art=20&fed=${team.fed}&turdet=YES&flag=30`;
  const res = await Promise.race([
    fetch(url, { headers: { "User-Agent": "Mozilla/5.0 (compatible; DailyNewsBot/1.0)" } }),
    new Promise((_, reject) => setTimeout(() => reject(new Error("hard timeout after 20s")), 20000)),
  ]);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const html = await res.text();
  const root = parse(html);
  const rounds = parseBoardPairings(root);
  const roster = parseRoster(root);
  return { id: team.id, label: team.label, rounds, roster };
}
