function relativeTime(isoDate) {
  if (!isoDate) return "";
  const then = new Date(isoDate).getTime();
  if (Number.isNaN(then)) return "";
  const diffMs = Date.now() - then;
  const mins = Math.round(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} hr ago`;
  const days = Math.round(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

function cell(tag, text, className) {
  const el = document.createElement(tag);
  if (text != null) el.textContent = text;
  if (className) el.className = className;
  return el;
}

function numCell(text) {
  return cell("td", text, "num");
}

function storyMeta(article) {
  return [article.source, relativeTime(article.publishedAt)].filter(Boolean).join(" · ");
}

function renderLead(article) {
  const a = document.createElement("a");
  a.className = "story-link story-lead" + (article.image ? "" : " no-image");
  a.href = article.link;
  a.target = "_blank";
  a.rel = "noopener noreferrer";

  if (article.image) {
    const img = document.createElement("img");
    img.className = "story-lead-image";
    img.src = article.image;
    img.alt = "";
    img.loading = "lazy";
    img.referrerPolicy = "no-referrer";
    img.onerror = () => img.remove();
    a.appendChild(img);
  }

  const body = document.createElement("div");
  body.appendChild(cell("h3", article.title, "story-lead-headline"));
  if (article.summary) body.appendChild(cell("p", article.summary, "story-lead-summary"));
  body.appendChild(cell("div", storyMeta(article), "story-meta"));
  a.appendChild(body);

  return a;
}

function renderSecondary(article) {
  const a = document.createElement("a");
  a.className = "story-link";
  a.href = article.link;
  a.target = "_blank";
  a.rel = "noopener noreferrer";

  if (article.image) {
    const img = document.createElement("img");
    img.className = "story-secondary-image";
    img.src = article.image;
    img.alt = "";
    img.loading = "lazy";
    img.referrerPolicy = "no-referrer";
    img.onerror = () => img.remove();
    a.appendChild(img);
  }

  a.appendChild(cell("h4", article.title, "story-secondary-headline"));
  if (article.summary) a.appendChild(cell("p", article.summary, "story-secondary-summary"));
  a.appendChild(cell("div", storyMeta(article), "story-meta"));

  return a;
}

function renderBrief(article) {
  const a = document.createElement("a");
  a.className = "story-link story-brief";
  a.href = article.link;
  a.target = "_blank";
  a.rel = "noopener noreferrer";

  a.appendChild(cell("span", article.title, "story-brief-headline"));
  a.appendChild(cell("span", storyMeta(article), "story-brief-meta"));

  return a;
}

function renderSection(section) {
  const wrap = document.createElement("section");
  wrap.className = "section";
  wrap.id = `section-${section.id}`;

  wrap.appendChild(cell("h2", section.title, "section-title"));

  if (section.articles.length === 0) {
    wrap.appendChild(cell("p", "No stories right now — check back later.", "status"));
    return wrap;
  }

  const [lead, ...rest] = section.articles;
  const secondary = rest.slice(0, 2);
  const briefs = rest.slice(2);

  wrap.appendChild(renderLead(lead));

  if (secondary.length > 0) {
    const grid = document.createElement("div");
    grid.className = "story-secondary-grid";
    secondary.forEach((article) => grid.appendChild(renderSecondary(article)));
    wrap.appendChild(grid);
  }

  if (briefs.length > 0) {
    const list = document.createElement("div");
    list.className = "story-briefs";
    briefs.forEach((article) => list.appendChild(renderBrief(article)));
    wrap.appendChild(list);
  }

  return wrap;
}

function renderOlympiadRound(round) {
  const wrap = document.createElement("div");
  wrap.className = "olympiad-round";

  const scoreText =
    round.saScore != null && round.opponentScore != null
      ? `SA ${round.saScore} – ${round.opponentScore}`
      : "In progress";
  wrap.appendChild(
    cell("div", `Round ${round.round} · vs ${round.opponent} · ${scoreText}`, "olympiad-round-header")
  );

  const tableWrap = document.createElement("div");
  tableWrap.className = "olympiad-table-wrap";
  const table = document.createElement("table");
  table.className = "olympiad-table";

  const thead = document.createElement("thead");
  const headRow = document.createElement("tr");
  ["Bd", "Player", "Rtg", "", "Opponent", "Rtg"].forEach((h, i) =>
    headRow.appendChild(cell("th", h, i === 2 || i === 5 ? "num" : undefined))
  );
  thead.appendChild(headRow);
  table.appendChild(thead);

  const tbody = document.createElement("tbody");
  round.boards
    .slice()
    .sort((a, b) => a.board - b.board)
    .forEach((b) => {
      const tr = document.createElement("tr");
      tr.appendChild(numCell(b.board));
      tr.appendChild(cell("td", [b.title, b.player].filter(Boolean).join(" ")));
      tr.appendChild(numCell(b.rating ?? "—"));
      tr.appendChild(cell("td", b.result ?? "–", "olympiad-result num"));
      tr.appendChild(cell("td", [b.opponentTitle, b.opponent].filter(Boolean).join(" ")));
      tr.appendChild(numCell(b.opponentRating ?? "—"));
      tbody.appendChild(tr);
    });
  table.appendChild(tbody);
  tableWrap.appendChild(table);
  wrap.appendChild(tableWrap);
  return wrap;
}

function renderStandingsTable(group) {
  const wrap = document.createElement("div");
  wrap.className = "olympiad-round";

  wrap.appendChild(cell("div", `Top 10 after Round ${group.asOfRound}`, "olympiad-round-header"));

  const tableWrap = document.createElement("div");
  tableWrap.className = "olympiad-table-wrap";
  const table = document.createElement("table");
  table.className = "olympiad-table";

  const thead = document.createElement("thead");
  const headRow = document.createElement("tr");
  const numericHeads = new Set(["Rk", "W", "D", "L", "Pts", "Seed", "vs Seed"]);
  ["Rk", "Team", "W", "D", "L", "Pts", "Seed", "vs Seed"].forEach((h) =>
    headRow.appendChild(cell("th", h, numericHeads.has(h) ? "num" : undefined))
  );
  thead.appendChild(headRow);
  table.appendChild(thead);

  const tbody = document.createElement("tbody");
  const rowFor = (t) => {
    const tr = document.createElement("tr");
    tr.appendChild(numCell(t.rank));
    tr.appendChild(cell("td", `${t.team} (${t.fed})`));
    tr.appendChild(numCell(t.wins));
    tr.appendChild(numCell(t.draws));
    tr.appendChild(numCell(t.losses));
    tr.appendChild(cell("td", t.matchPoints, "olympiad-result num"));
    tr.appendChild(numCell(t.seedRank ?? "—"));

    let vsSeedText = "—";
    if (t.seedRank != null) {
      const diff = t.seedRank - t.rank; // positive = better than seed
      if (diff > 0) vsSeedText = `▲ ${diff}`;
      else if (diff < 0) vsSeedText = `▼ ${-diff}`;
      else vsSeedText = "on seed";
    }
    tr.appendChild(cell("td", vsSeedText, "olympiad-result num"));

    if (t.fed === "RSA") tr.classList.add("olympiad-sa-row");
    return tr;
  };

  group.top10.forEach((t) => tbody.appendChild(rowFor(t)));

  if (group.sa && !group.top10.some((t) => t.fed === "RSA")) {
    const spacer = document.createElement("tr");
    const spacerCell = cell("td", "⋯");
    spacerCell.colSpan = 8;
    spacerCell.className = "olympiad-spacer";
    spacer.appendChild(spacerCell);
    tbody.appendChild(spacer);
    tbody.appendChild(rowFor(group.sa));
  }

  table.appendChild(tbody);
  tableWrap.appendChild(table);
  wrap.appendChild(tableWrap);
  return wrap;
}

function renderStandingsSection(standings) {
  if (!standings || standings.length === 0) return null;

  const wrap = document.createElement("section");
  wrap.className = "section section-scoreboard";
  wrap.id = "section-standings";
  wrap.appendChild(cell("h2", "Olympiad Standings", "section-title"));

  standings.forEach((group) => {
    if (!group.top10 || group.top10.length === 0) return;
    wrap.appendChild(cell("h3", group.label, "olympiad-team-title"));
    wrap.appendChild(renderStandingsTable(group));
  });

  return wrap;
}

function formatChange(n) {
  if (n == null) return "—";
  const sign = n > 0 ? "+" : "";
  return `${sign}${n}`;
}

function renderPerformanceTeam(team) {
  const wrap = document.createElement("div");
  wrap.className = "olympiad-round";

  let verdict = "";
  if (team.seedRank != null && team.currentRank != null) {
    const diff = team.seedRank - team.currentRank; // positive = better than seed
    if (diff > 0) verdict = `${diff} place${diff === 1 ? "" : "s"} better than seed`;
    else if (diff < 0) verdict = `${-diff} place${-diff === 1 ? "" : "s"} below seed`;
    else verdict = "right on seed";
  }

  const summaryBits = [
    team.seedRank != null ? `Seeded ${team.seedRank}` : null,
    team.currentRank != null ? `now ${team.currentRank}` : null,
    verdict,
  ].filter(Boolean);
  wrap.appendChild(cell("div", summaryBits.join(" · "), "olympiad-round-header"));

  if (team.roster && team.roster.length > 0) {
    const tableWrap = document.createElement("div");
    tableWrap.className = "olympiad-table-wrap";
    const table = document.createElement("table");
    table.className = "olympiad-table";

    const thead = document.createElement("thead");
    const headRow = document.createElement("tr");
    const numericHeads = new Set(["Bd", "Rtg", "Score", "Perf.", "+/-"]);
    ["Bd", "Player", "Rtg", "Score", "Perf.", "+/-"].forEach((h) =>
      headRow.appendChild(cell("th", h, numericHeads.has(h) ? "num" : undefined))
    );
    thead.appendChild(headRow);
    table.appendChild(thead);

    const tbody = document.createElement("tbody");
    team.roster.forEach((p) => {
      const tr = document.createElement("tr");
      tr.appendChild(numCell(p.board));
      tr.appendChild(cell("td", [p.title, p.name].filter(Boolean).join(" ")));
      tr.appendChild(numCell(p.rating ?? "—"));
      tr.appendChild(numCell(p.points != null && p.games != null ? `${p.points}/${p.games}` : "—"));
      tr.appendChild(numCell(p.performanceRating ?? "—"));
      tr.appendChild(cell("td", formatChange(p.ratingChange), "olympiad-result num"));
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    tableWrap.appendChild(table);
    wrap.appendChild(tableWrap);
  }

  return wrap;
}

function renderPerformanceSection(performance) {
  if (!performance || performance.length === 0) return null;

  const wrap = document.createElement("section");
  wrap.className = "section section-scoreboard";
  wrap.id = "section-performance";
  wrap.appendChild(cell("h2", "Performance vs Expectations", "section-title"));

  performance.forEach((team) => {
    wrap.appendChild(cell("h3", team.label, "olympiad-team-title"));
    wrap.appendChild(renderPerformanceTeam(team));
  });

  return wrap;
}

function renderOlympiadSection(teams) {
  if (!teams || teams.length === 0) return null;

  const wrap = document.createElement("section");
  wrap.className = "section section-scoreboard";
  wrap.id = "section-olympiad";
  wrap.appendChild(cell("h2", "SA at the Olympiad", "section-title"));

  teams.forEach((team) => {
    if (!team.rounds || team.rounds.length === 0) return;
    wrap.appendChild(cell("h3", team.label, "olympiad-team-title"));
    team.rounds.forEach((round) => wrap.appendChild(renderOlympiadRound(round)));
  });

  return wrap;
}

function renderJumpNav(items) {
  const nav = document.getElementById("jump-nav");
  items.forEach(({ id, title }) => {
    const link = document.createElement("a");
    link.href = `#section-${id}`;
    link.textContent = title;
    nav.appendChild(link);
  });
}

function renderOutageDay(day) {
  const el = document.createElement("div");
  el.className = day.hasOutage ? "outage-day has-outage" : "outage-day";
  el.appendChild(cell("div", day.day, "outage-day-label"));
  el.appendChild(cell("div", day.dayOfMonth, "outage-day-num"));
  if (day.hasOutage) {
    el.appendChild(cell("div", "Planned", "outage-day-badge"));
    el.appendChild(cell("div", day.window, "outage-day-window"));
  }
  return el;
}

function renderOutageChart(monthly) {
  const max = Math.max(1, ...monthly.flatMap((m) => [m.unplannedHours, m.scheduledHours]));
  const chart = document.createElement("div");
  chart.className = "outage-chart";

  monthly.forEach((m) => {
    const col = document.createElement("div");
    col.className = "outage-chart-col";

    const bars = document.createElement("div");
    bars.className = "outage-chart-bars";

    const unplanned = cell("div", null, "outage-chart-bar unplanned");
    unplanned.style.height = `${(m.unplannedHours / max) * 100}%`;
    unplanned.title = `${m.month}: ${m.unplannedHours}h unplanned`;

    const scheduled = cell("div", null, "outage-chart-bar scheduled");
    scheduled.style.height = `${(m.scheduledHours / max) * 100}%`;
    scheduled.title = `${m.month}: ${m.scheduledHours}h scheduled`;

    bars.appendChild(unplanned);
    bars.appendChild(scheduled);
    col.appendChild(bars);
    col.appendChild(cell("div", m.month, "outage-chart-month"));
    chart.appendChild(col);
  });

  return chart;
}

function renderBoxPlot(stats) {
  const wrap = document.createElement("div");
  wrap.className = "boxplot-wrap";
  wrap.appendChild(cell("div", "Outage Duration Distribution — Last 6 Months", "outage-subhead-small"));

  const axisMax = Math.max(stats.whiskerHigh, ...stats.outliers) * 1.15;
  const pct = (v) => (v / axisMax) * 100;

  const track = document.createElement("div");
  track.className = "boxplot-track";

  const whisker = cell("div", null, "boxplot-whisker");
  whisker.style.left = `${pct(stats.whiskerLow)}%`;
  whisker.style.width = `${pct(stats.whiskerHigh) - pct(stats.whiskerLow)}%`;
  track.appendChild(whisker);

  [stats.whiskerLow, stats.whiskerHigh].forEach((v) => {
    const capEl = cell("div", null, "boxplot-cap");
    capEl.style.left = `${pct(v)}%`;
    track.appendChild(capEl);
  });

  const box = cell("div", null, "boxplot-box");
  box.style.left = `${pct(stats.q1)}%`;
  box.style.width = `${pct(stats.q3) - pct(stats.q1)}%`;
  box.title = `IQR ${stats.q1}h – ${stats.q3}h`;
  track.appendChild(box);

  const medianLine = cell("div", null, "boxplot-median");
  medianLine.style.left = `${pct(stats.median)}%`;
  medianLine.title = `Median ${stats.median}h`;
  track.appendChild(medianLine);

  stats.outliers.forEach((v) => {
    const dot = cell("div", null, "boxplot-outlier");
    dot.style.left = `${pct(v)}%`;
    dot.title = `Outlier: ${v}h`;
    track.appendChild(dot);
  });

  wrap.appendChild(track);

  const axis = document.createElement("div");
  axis.className = "boxplot-axis";
  const zeroLabel = cell("span", "0h");
  zeroLabel.style.left = "0%";
  const maxLabel = cell("span", `${Math.round(axisMax)}h`);
  maxLabel.style.left = "100%";
  axis.appendChild(zeroLabel);
  axis.appendChild(maxLabel);
  wrap.appendChild(axis);

  const outlierText =
    stats.outliers.length > 0
      ? ` · ${stats.outliers.length} outlier${stats.outliers.length === 1 ? "" : "s"} (${stats.outliers.join("h, ")}h)`
      : "";
  wrap.appendChild(
    cell(
      "p",
      `Median ${stats.median}h · typical range ${stats.q1}h–${stats.q3}h${outlierText}`,
      "outage-footnote"
    )
  );

  return wrap;
}

function renderOutageSection(outage) {
  if (!outage) return null;

  const wrap = document.createElement("section");
  wrap.className = "section section-scoreboard";
  wrap.id = "section-outage";
  wrap.appendChild(cell("h2", `Power Outlook — ${outage.suburb}`, "section-title"));

  wrap.appendChild(cell("div", outage.status.label, `outage-status level-${outage.status.level}`));

  // 1. Horizon forecast
  wrap.appendChild(cell("h3", "Next 7 Days", "outage-subhead"));
  const forecast = document.createElement("div");
  forecast.className = "outage-forecast";
  outage.forecast.forEach((day) => forecast.appendChild(renderOutageDay(day)));
  wrap.appendChild(forecast);

  // 2. Maintenance registry
  wrap.appendChild(cell("h3", "Localized Maintenance Registry", "outage-subhead"));
  const tableWrap = document.createElement("div");
  tableWrap.className = "olympiad-table-wrap";
  const table = document.createElement("table");
  table.className = "olympiad-table";
  const thead = document.createElement("thead");
  const headRow = document.createElement("tr");
  ["Date", "Affected Infrastructure", "Status", "ETR"].forEach((h) => headRow.appendChild(cell("th", h)));
  thead.appendChild(headRow);
  table.appendChild(thead);
  const tbody = document.createElement("tbody");
  outage.maintenance.forEach((m) => {
    const tr = document.createElement("tr");
    tr.appendChild(cell("td", m.date));
    tr.appendChild(cell("td", m.infrastructure));
    tr.appendChild(cell("td", m.status, m.status === "In Progress" ? "olympiad-result" : undefined));
    tr.appendChild(cell("td", m.etr));
    tbody.appendChild(tr);
  });
  table.appendChild(tbody);
  tableWrap.appendChild(table);
  wrap.appendChild(tableWrap);
  wrap.appendChild(cell("p", `Data synced from ${outage.source}.`, "outage-footnote"));

  // 3. Suburb history & reliability index
  wrap.appendChild(cell("h3", "Suburb History & Reliability Index", "outage-subhead"));
  const stats = document.createElement("div");
  stats.className = "outage-stats";
  const daysStat = document.createElement("div");
  daysStat.className = "outage-stat";
  daysStat.appendChild(cell("div", outage.reliability.daysSinceLastUnplannedOutage, "outage-stat-value"));
  daysStat.appendChild(cell("div", "Days Since Last Unplanned Outage", "outage-stat-label"));
  const avgStat = document.createElement("div");
  avgStat.className = "outage-stat";
  avgStat.appendChild(cell("div", `${outage.reliability.avgOutageDurationHours}h`, "outage-stat-value"));
  avgStat.appendChild(cell("div", "Average Outage Duration", "outage-stat-label"));
  stats.appendChild(daysStat);
  stats.appendChild(avgStat);
  wrap.appendChild(stats);

  if (outage.reliability.durationStats) {
    wrap.appendChild(renderBoxPlot(outage.reliability.durationStats));
  }

  wrap.appendChild(cell("div", "Monthly Downtime — Unplanned vs Scheduled", "outage-subhead-small"));
  wrap.appendChild(renderOutageChart(outage.reliability.monthly));
  const legend = document.createElement("div");
  legend.className = "outage-legend";
  legend.appendChild(cell("span", "Unplanned", "unplanned"));
  legend.appendChild(cell("span", "Scheduled", "scheduled"));
  wrap.appendChild(legend);

  return wrap;
}

async function main() {
  const paper = document.getElementById("paper");
  const status = document.getElementById("status");
  const dateEl = document.getElementById("edition-date");
  const labelEl = document.getElementById("edition-label");

  dateEl.textContent = new Date().toLocaleDateString("en-ZA", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  try {
    const res = await fetch(`data.json?_=${Date.now()}`, { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    labelEl.textContent = data.edition || "";
    status.remove();

    const navItems = data.sections.map((s) => ({ id: s.id, title: s.title }));
    if (data.outage) navItems.push({ id: "outage", title: `Power — ${data.outage.suburb}` });
    renderJumpNav(navItems);

    data.sections.forEach((section) => {
      paper.appendChild(renderSection(section));
      if (section.id === "chess") {
        const olympiad = renderOlympiadSection(data.olympiad);
        if (olympiad) paper.appendChild(olympiad);
        const standings = renderStandingsSection(data.standings);
        if (standings) paper.appendChild(standings);
        const performance = renderPerformanceSection(data.performance);
        if (performance) paper.appendChild(performance);
      }
    });

    const outage = renderOutageSection(data.outage);
    if (outage) paper.appendChild(outage);
  } catch (err) {
    status.textContent = "Couldn't load today's edition. Pull to refresh in a bit.";
    console.error(err);
  }
}

main();
