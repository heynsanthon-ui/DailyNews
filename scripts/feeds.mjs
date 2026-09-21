// One entry per section. Each section lists the RSS feeds to pull from, and
// an optional `keywords` filter (case-insensitive, matched against title+summary)
// for feeds that cover more than the section's exact topic.
//
// If a feed URL goes stale, this is the only file that needs to change.
export const sections = [
  {
    id: "chess",
    title: "Chess",
    feeds: [
      { url: "https://www.chess.com/rss/news", source: "Chess.com" },
      { url: "https://en.chessbase.com/feed", source: "ChessBase" },
    ],
  },
  {
    id: "world",
    title: "World & Politics",
    feeds: [
      { url: "http://feeds.bbci.co.uk/news/world/rss.xml", source: "BBC News" },
      { url: "https://www.aljazeera.com/xml/rss/all.xml", source: "Al Jazeera" },
    ],
  },
  {
    id: "rugby",
    title: "Springboks",
    feeds: [
      {
        url: "https://www.sarugbymag.co.za/feed/",
        source: "SA Rugby Mag",
      },
      {
        url: "https://www.planetrugby.com/rss",
        source: "Planet Rugby",
        keywords: ["springbok", "south africa"],
      },
    ],
  },
  {
    id: "cricket",
    title: "Proteas",
    feeds: [
      {
        url: "https://www.espncricinfo.com/rss/content/story/feeds/3.xml",
        source: "ESPNcricinfo",
      },
      {
        url: "https://www.espncricinfo.com/rss/content/story/feeds/0.xml",
        source: "ESPNcricinfo",
        keywords: ["south africa", "proteas"],
      },
    ],
  },
];

export const ARTICLES_PER_SECTION = 5;
