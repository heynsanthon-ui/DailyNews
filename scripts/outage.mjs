// Power outage forecast/history for a suburb.
//
// This currently returns realistic MOCK data — there's no live outage feed
// wired up yet. The shape below is deliberately the same shape a real
// integration would return, so swapping this out later (e.g. for
// EskomSePush or a municipal service-interruptions API) only means
// rewriting the body of `fetchOutageData`; nothing in build.mjs or the
// frontend needs to change.

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function addDays(base, days) {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return d;
}

function dateKey(d) {
  return d.toISOString().slice(0, 10);
}

function buildForecast(now) {
  // Today has a planned outage later this afternoon; day 3 has another.
  const windows = {
    0: { start: "14:00", end: "16:30", infrastructure: "Wapadrand Substation Upgrades" },
    3: { start: "09:00", end: "12:00", infrastructure: "Die Wilgers Feeder Cable Replacement" },
  };

  return Array.from({ length: 7 }, (_, i) => {
    const d = addDays(now, i);
    const outage = windows[i] || null;
    return {
      date: dateKey(d),
      day: DAY_NAMES[d.getDay()],
      dayOfMonth: d.getDate(),
      hasOutage: Boolean(outage),
      window: outage ? `${outage.start}–${outage.end}` : null,
      infrastructure: outage ? outage.infrastructure : null,
    };
  });
}

function deriveStatus(now, todayForecast) {
  if (!todayForecast?.hasOutage) {
    return { level: "operational", label: "🟢 Grid Operational" };
  }

  const [startH, startM] = todayForecast.window.split("–")[0].split(":").map(Number);
  const [endH, endM] = todayForecast.window.split("–")[1].split(":").map(Number);
  const start = new Date(now);
  start.setHours(startH, startM, 0, 0);
  const end = new Date(now);
  end.setHours(endH, endM, 0, 0);

  if (now < start) {
    const mins = Math.round((start - now) / 60000);
    const hrs = Math.floor(mins / 60);
    const rem = mins % 60;
    const inText = hrs > 0 ? `${hrs}h ${rem}m` : `${rem}m`;
    return { level: "planned", label: `🟡 Planned Maintenance In ${inText}` };
  }
  if (now >= start && now <= end) {
    return { level: "active", label: "🔴 Planned Maintenance In Progress" };
  }
  return { level: "operational", label: "🟢 Grid Operational" };
}

function buildMaintenanceRegistry(now, forecast) {
  const registry = [];

  const today = forecast[0];
  if (today.hasOutage) {
    registry.push({
      date: today.date,
      infrastructure: today.infrastructure,
      status: "Scheduled",
      etr: `Today, ${today.window}`,
    });
  }

  registry.push({
    date: dateKey(now),
    infrastructure: "Garsfontein Rd Transformer Repair",
    status: "In Progress",
    etr: "~45 min remaining",
  });

  const laterOutage = forecast.find((f, i) => i > 0 && f.hasOutage);
  if (laterOutage) {
    registry.push({
      date: laterOutage.date,
      infrastructure: laterOutage.infrastructure,
      status: "Scheduled",
      etr: `${laterOutage.day} ${laterOutage.dayOfMonth}, ${laterOutage.window}`,
    });
  }

  return registry;
}

function round1(n) {
  return Math.round(n * 10) / 10;
}

function median(sortedValues) {
  const n = sortedValues.length;
  const mid = Math.floor(n / 2);
  return n % 2 === 0 ? (sortedValues[mid - 1] + sortedValues[mid]) / 2 : sortedValues[mid];
}

// Standard Tukey box-and-whisker: quartiles from sorted halves, whiskers
// extend to the most extreme values still within 1.5x IQR of the box,
// anything beyond that is reported as an outlier rather than stretching
// the whisker to it.
function boxPlotStats(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const n = sorted.length;
  const mid = Math.floor(n / 2);
  const lowerHalf = sorted.slice(0, mid);
  const upperHalf = n % 2 === 0 ? sorted.slice(mid) : sorted.slice(mid + 1);

  const q1 = median(lowerHalf);
  const q3 = median(upperHalf);
  const iqr = q3 - q1;
  const lowFence = q1 - 1.5 * iqr;
  const highFence = q3 + 1.5 * iqr;

  const nonOutliers = sorted.filter((v) => v >= lowFence && v <= highFence);
  const outliers = sorted.filter((v) => v < lowFence || v > highFence);
  const mean = sorted.reduce((a, b) => a + b, 0) / n;

  return {
    min: round1(sorted[0]),
    max: round1(sorted[n - 1]),
    q1: round1(q1),
    median: round1(median(sorted)),
    q3: round1(q3),
    whiskerLow: round1(nonOutliers[0]),
    whiskerHigh: round1(nonOutliers[nonOutliers.length - 1]),
    outliers: outliers.map(round1),
    mean: round1(mean),
    sampleCount: n,
  };
}

function buildDurationStats() {
  // Individual outage durations (hours) over the last 6 months. One severe
  // storm-related outage sits well outside the typical range on purpose,
  // so the box plot has a real outlier to show.
  const samples = [2.1, 2.4, 2.8, 3.0, 3.2, 3.3, 3.5, 3.6, 3.8, 3.9, 4.1, 4.3, 4.6, 5.2, 14.0];
  return boxPlotStats(samples);
}

function buildMonthlyHistory(now) {
  // Last 6 months of unplanned-failure vs scheduled-maintenance hours.
  const sample = [5, 2, 8, 3, 6, 4]; // unplanned hours, oldest -> newest
  const scheduled = [3, 4, 2, 5, 3, 4]; // scheduled hours, oldest -> newest

  return sample.map((unplannedHours, i) => {
    const monthsAgo = 5 - i;
    const d = addDays(now, 0);
    d.setMonth(d.getMonth() - monthsAgo);
    return {
      month: MONTH_NAMES[d.getMonth()],
      unplannedHours,
      scheduledHours: scheduled[i],
    };
  });
}

export async function fetchOutageData({ suburb, municipality, source }) {
  const now = new Date();
  const forecast = buildForecast(now);
  const status = deriveStatus(now, forecast[0]);
  const durationStats = buildDurationStats();

  return {
    suburb,
    municipality,
    source,
    generatedAt: now.toISOString(),
    status,
    forecast,
    maintenance: buildMaintenanceRegistry(now, forecast),
    reliability: {
      daysSinceLastUnplannedOutage: 12,
      avgOutageDurationHours: durationStats.mean,
      monthly: buildMonthlyHistory(now),
      durationStats,
    },
  };
}
