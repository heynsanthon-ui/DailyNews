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

function renderCard(article) {
  const a = document.createElement("a");
  a.className = "card";
  a.href = article.link;
  a.target = "_blank";
  a.rel = "noopener noreferrer";

  if (article.image) {
    const img = document.createElement("img");
    img.className = "card-image";
    img.src = article.image;
    img.alt = "";
    img.loading = "lazy";
    img.referrerPolicy = "no-referrer";
    img.onerror = () => img.remove();
    a.appendChild(img);
  }

  const body = document.createElement("div");
  body.className = "card-body";

  const headline = document.createElement("h3");
  headline.className = "card-headline";
  headline.textContent = article.title;
  body.appendChild(headline);

  if (article.summary) {
    const summary = document.createElement("p");
    summary.className = "card-summary";
    summary.textContent = article.summary;
    body.appendChild(summary);
  }

  const meta = document.createElement("div");
  meta.className = "card-meta";
  meta.textContent = [article.source, relativeTime(article.publishedAt)].filter(Boolean).join(" · ");
  body.appendChild(meta);

  a.appendChild(body);
  return a;
}

function renderSection(section) {
  const wrap = document.createElement("section");
  wrap.className = "section";

  const title = document.createElement("h2");
  title.className = "section-title";
  title.textContent = section.title;
  wrap.appendChild(title);

  const grid = document.createElement("div");
  grid.className = "card-grid";

  if (section.articles.length === 0) {
    const empty = document.createElement("p");
    empty.className = "status";
    empty.textContent = "No stories right now — check back later.";
    wrap.appendChild(empty);
  } else {
    section.articles.forEach((article) => grid.appendChild(renderCard(article)));
    wrap.appendChild(grid);
  }

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
    data.sections.forEach((section) => paper.appendChild(renderSection(section)));
  } catch (err) {
    status.textContent = "Couldn't load today's edition. Pull to refresh in a bit.";
    console.error(err);
  }
}

main();
