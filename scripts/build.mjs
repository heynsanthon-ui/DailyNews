import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Parser from "rss-parser";
import { sections, ARTICLES_PER_SECTION } from "./feeds.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(__dirname, "..", "docs");
const OUT_FILE = path.join(OUT_DIR, "data.json");
const SUMMARY_MAX_LEN = 220;

const parser = new Parser({
  timeout: 15000,
  headers: { "User-Agent": "Mozilla/5.0 (compatible; DailyNewsBot/1.0)" },
  customFields: {
    item: [
      ["media:content", "mediaContent"],
      ["media:thumbnail", "mediaThumbnail"],
      ["content:encoded", "contentEncoded"],
    ],
  },
});

function stripHtml(html) {
  if (!html) return "";
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

function truncate(text, maxLen) {
  if (text.length <= maxLen) return text;
  const cut = text.slice(0, maxLen);
  return cut.slice(0, cut.lastIndexOf(" ")) + "…";
}

function firstImgSrc(html) {
  if (!html) return null;
  const match = html.match(/<img[^>]+src=["']([^"']+)["']/i);
  return match ? match[1] : null;
}

function extractImage(item) {
  const mediaContent = item.mediaContent;
  if (mediaContent) {
    const node = Array.isArray(mediaContent) ? mediaContent[0] : mediaContent;
    const url = node?.$?.url || node?.url;
    if (url) return url;
  }
  const mediaThumbnail = item.mediaThumbnail;
  if (mediaThumbnail) {
    const node = Array.isArray(mediaThumbnail) ? mediaThumbnail[0] : mediaThumbnail;
    const url = node?.$?.url || node?.url;
    if (url) return url;
  }
  if (item.enclosure?.url && /^image\//.test(item.enclosure.type || "")) {
    return item.enclosure.url;
  }
  const fromContentEncoded = firstImgSrc(item.contentEncoded);
  if (fromContentEncoded) return fromContentEncoded;
  const fromContent = firstImgSrc(item.content);
  if (fromContent) return fromContent;
  return null;
}

function matchesKeywords(item, keywords) {
  if (!keywords || keywords.length === 0) return true;
  const haystack = `${item.title || ""} ${item.contentSnippet || item.content || ""}`.toLowerCase();
  return keywords.some((kw) => haystack.includes(kw.toLowerCase()));
}

async function fetchFeed(feed) {
  try {
    const parsed = await Promise.race([
      parser.parseURL(feed.url),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("hard timeout after 20s")), 20000)
      ),
    ]);
    const items = (parsed.items || []).filter((item) => matchesKeywords(item, feed.keywords));
    console.log(`  ok   ${feed.url} (${items.length} items)`);
    return items.map((item) => ({
      title: (item.title || "").trim(),
      link: item.link,
      summary: truncate(stripHtml(item.contentSnippet || item.content || item.summary || ""), SUMMARY_MAX_LEN),
      image: extractImage(item),
      source: feed.source || parsed.title || "",
      publishedAt: item.isoDate || item.pubDate || null,
    }));
  } catch (err) {
    console.warn(`  FAIL ${feed.url} — ${err.message}`);
    return [];
  }
}

async function buildSection(section) {
  console.log(`Fetching section: ${section.title}`);
  const results = await Promise.all(section.feeds.map(fetchFeed));
  const all = results.flat().filter((a) => a.title && a.link);

  const seen = new Set();
  const deduped = [];
  for (const article of all) {
    const key = article.link;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(article);
  }

  deduped.sort((a, b) => {
    const dateA = a.publishedAt ? Date.parse(a.publishedAt) : 0;
    const dateB = b.publishedAt ? Date.parse(b.publishedAt) : 0;
    return dateB - dateA;
  });

  return {
    id: section.id,
    title: section.title,
    articles: deduped.slice(0, ARTICLES_PER_SECTION),
  };
}

function editionLabel(now) {
  // SAST is UTC+2, no daylight saving.
  const sast = new Date(now.getTime() + 2 * 60 * 60 * 1000);
  const hour = sast.getUTCHours();
  const dateStr = sast.toLocaleDateString("en-ZA", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
  if (hour < 8) {
    return `Morning Edition — ${dateStr}`;
  }
  const timeStr = sast.toISOString().slice(11, 16);
  return `Updated ${timeStr} SAST — ${dateStr}`;
}

async function main() {
  const now = new Date();
  const builtSections = await Promise.all(sections.map(buildSection));

  const data = {
    generatedAt: now.toISOString(),
    edition: editionLabel(now),
    sections: builtSections,
  };

  await mkdir(OUT_DIR, { recursive: true });
  await writeFile(OUT_FILE, JSON.stringify(data, null, 2), "utf-8");

  const total = builtSections.reduce((sum, s) => sum + s.articles.length, 0);
  console.log(`\nWrote ${OUT_FILE} — ${total} articles across ${builtSections.length} sections.`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
