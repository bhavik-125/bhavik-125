const fs = require("fs");
const path = require("path");

const username = process.env.GITHUB_USERNAME || "bhavik-125";
const githubToken = process.env.GITHUB_TOKEN;

// ---------------- GitHub API helper ----------------
async function githubFetch(url) {
  const headers = {
    "User-Agent": "bhavik-125-trophy-generator",
    "Accept": "application/vnd.github+json",
  };
  if (githubToken) headers.Authorization = `Bearer ${githubToken}`;

  const res = await fetch(url, { headers });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    console.error(`GitHub error ${res.status}: ${body}`);
    throw new Error(`GitHub API error for ${url}`);
  }
  return res.json();
}

// Count recent commits from public events (approx, last 90 days)
async function getRecentCommits() {
  let commits = 0;
  for (let page = 1; page <= 3; page++) {
    const events = await githubFetch(
      `https://api.github.com/users/${username}/events/public?per_page=100&page=${page}`
    );
    if (!events.length) break;
    for (const ev of events) {
      if (ev.type === "PushEvent" && ev.payload && Array.isArray(ev.payload.commits)) {
        commits += ev.payload.commits.length;
      }
    }
  }
  return commits;
}

// Get total issues / PRs created (using search API)
// NOTE: this is approximate and rate-limited, but fine for once-per-day.
async function getSearchCount(query) {
  const data = await githubFetch(
    `https://api.github.com/search/issues?q=${encodeURIComponent(query)}`
  );
  return data.total_count || 0;
}

// --------------- Collect all stats -----------------
async function getStats() {
  const user = await githubFetch(`https://api.github.com/users/${username}`);

  // repos for stars/forks
  let repos = [];
  let page = 1;
  while (true) {
    const chunk = await githubFetch(
      `https://api.github.com/users/${username}/repos?per_page=100&page=${page}`
    );
    if (!chunk.length) break;
    repos = repos.concat(chunk);
    page++;
  }

  const totalStars = repos.reduce((s, r) => s + (r.stargazers_count || 0), 0);
  const totalForks = repos.reduce((s, r) => s + (r.forks_count || 0), 0);

  const createdAt = new Date(user.created_at);
  const years = Math.max(
    0,
    (Date.now() - createdAt.getTime()) / (1000 * 60 * 60 * 24 * 365)
  );

  const recentCommits = await getRecentCommits();
  const totalIssues = await getSearchCount(`author:${username} is:issue`);
  const totalPRs = await getSearchCount(`author:${username} is:pr`);
  // Reviews are hard to get via REST; show Unknown 0pt like original screenshot.
  const totalReviews = 0;

  return {
    name: user.name || username,
    username,
    createdAt,
    publicRepos: user.public_repos,
    followers: user.followers,
    following: user.following,
    totalStars,
    totalForks,
    experienceYears: years,
    recentCommits,
    totalIssues,
    totalPRs,
    totalReviews,
  };
}

// ---------- helpers for ranks / titles / points ----------
function commitsTrophy(commits) {
  if (commits >= 200)
    return { rank: "A", title: "High Committer", points: commits };
  if (commits >= 50)
    return { rank: "B", title: "Active Committer", points: commits };
  if (commits > 0)
    return { rank: "C", title: "First Committer", points: commits };
  return { rank: "?", title: "Unknown", points: 0 };
}

function reposTrophy(repos) {
  if (repos >= 30)
    return { rank: "A", title: "Repo Tycoon", points: repos * 3 };
  if (repos >= 10)
    return { rank: "B", title: "Middle Repo Creator", points: repos * 2 };
  if (repos > 0)
    return { rank: "C", title: "First Repo", points: repos };
  return { rank: "?", title: "No Repos", points: 0 };
}

function experienceTrophy(years) {
  if (years >= 5)
    return { rank: "A", title: "Senior Dev", points: Math.round(years * 10) };
  if (years >= 2)
    return { rank: "B", title: "Intermediate Dev", points: Math.round(years * 8) };
  if (years > 0.2)
    return { rank: "C", title: "Junior Dev", points: Math.round(years * 5) };
  return { rank: "?", title: "Newbie", points: 0 };
}

function starsTrophy(stars) {
  if (stars >= 100)
    return { rank: "A", title: "Star Gazer", points: stars };
  if (stars >= 20)
    return { rank: "B", title: "Rising Star", points: stars };
  if (stars > 0)
    return { rank: "C", title: "First Star", points: stars };
  return { rank: "?", title: "No Stars", points: 0 };
}

function followersTrophy(followers) {
  if (followers >= 50)
    return { rank: "A", title: "Influencer", points: followers * 2 };
  if (followers >= 10)
    return { rank: "B", title: "Popular Dev", points: followers * 2 };
  if (followers > 0)
    return { rank: "C", title: "First Friend", points: followers };
  return { rank: "?", title: "No Followers", points: 0 };
}

function prsTrophy(prs) {
  if (prs >= 50)
    return { rank: "A", title: "PR Master", points: prs * 2 };
  if (prs >= 10)
    return { rank: "B", title: "PR Contributor", points: prs * 2 };
  if (prs > 0)
    return { rank: "C", title: "First Pull", points: prs };
  return { rank: "?", title: "Unknown", points: 0 };
}

function issuesTrophy(issues) {
  if (issues >= 50)
    return { rank: "A", title: "Issue Tracker", points: issues };
  if (issues >= 10)
    return { rank: "B", title: "Bug Reporter", points: issues };
  if (issues > 0)
    return { rank: "C", title: "First Issue", points: issues };
  return { rank: "?", title: "Unknown", points: 0 };
}

function reviewsTrophy(reviews) {
  if (reviews > 0)
    return { rank: "C", title: "Code Reviewer", points: reviews };
  return { rank: "?", title: "Unknown", points: 0 };
}

// ---------- Build SVG: 8 trophies in a row ----------
function buildSVG(stats) {
  const width = 1200;
  const height = 260;

  const bg = "#1f2228";       // dark background
  const cardBg = "#343841";   // card background
  const cardBorder = "#f9d74c"; // border / header accent
  const titleColor = "#f9d74c";
  const textColor = "#e5e7eb";
  const subColor = "#b0b3c3";
  const barBg = "#4b4f59";
  const barFill = "#e06c75";

  const trophies = [
    {
      key: "commits",
      label: "Commits",
      metric: stats.recentCommits,
      ...commitsTrophy(stats.recentCommits),
    },
    {
      key: "repos",
      label: "Repositories",
      metric: stats.publicRepos,
      ...reposTrophy(stats.publicRepos),
    },
    {
      key: "experience",
      label: "Experience",
      metric: stats.experienceYears,
      ...experienceTrophy(stats.experienceYears),
    },
    {
      key: "stars",
      label: "Stars",
      metric: stats.totalStars,
      ...starsTrophy(stats.totalStars),
    },
    {
      key: "followers",
      label: "Followers",
      metric: stats.followers,
      ...followersTrophy(stats.followers),
    },
    {
      key: "pulls",
      label: "PullRequest",
      metric: stats.totalPRs,
      ...prsTrophy(stats.totalPRs),
    },
    {
      key: "issues",
      label: "Issues",
      metric: stats.totalIssues,
      ...issuesTrophy(stats.totalIssues),
    },
    {
      key: "reviews",
      label: "Reviews",
      metric: stats.totalReviews,
      ...reviewsTrophy(stats.totalReviews),
    },
  ];

  const cardW = 120;
  const cardH = 170;
  const gap = 14;
  const left = 40;
  const top = 70;

  const cardsSVG = trophies
    .map((t, i) => {
      const x = left + i * (cardW + gap);
      return trophyCard(
        x,
        top,
        cardW,
        cardH,
        t.label,
        t.rank,
        t.title,
        t.points,
        t.metric,
        bg,
        cardBg,
        cardBorder,
        titleColor,
        textColor,
        subColor,
        barBg,
        barFill
      );
    })
    .join("\n");

  return `
<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"
     xmlns="http://www.w3.org/2000/svg" role="img" aria-labelledby="title desc">
  <title id="title">${stats.username} GitHub Trophies</title>
  <desc id="desc">Vercel-style trophy row showing commits, repos, stars, followers and more</desc>

  <!-- background panel -->
  <rect x="0" y="0" width="${width}" height="${height}" rx="24" fill="${bg}" />

  <!-- header -->
  <text x="${width / 2}" y="40" text-anchor="middle"
        font-family="Segoe UI, system-ui"
        font-size="26" fill="${textColor}" font-weight="600">
    🏆 ${stats.name}'s GitHub Trophies
  </text>
  <text x="${width / 2}" y="62" text-anchor="middle"
        font-family="Segoe UI, system-ui"
        font-size="13" fill="${subColor}">
    @${stats.username}
  </text>

  ${cardsSVG}
</svg>
`;
}

function trophyCard(
  x,
  y,
  w,
  h,
  label,
  rank,
  title,
  points,
  metric,
  bg,
  cardBg,
  cardBorder,
  titleColor,
  textColor,
  subColor,
  barBg,
  barFill
) {
  const rankColor =
    rank === "A" ? "#ffd700" : rank === "B" ? "#c0c0c0" : rank === "C" ? "#cd7f32" : "#9ca3af";

  const pts = `${points || 0}pt`;

  // progress width (0–1)
  let norm = 0;
  if (typeof metric === "number" && metric > 0) {
    norm = Math.min(1, metric / 50); // arbitrary scaling
  }

  const barWidth = (w - 24) * norm;

  return `
  <g transform="translate(${x}, ${y})">
    <rect x="0" y="0" width="${w}" height="${h}" rx="10"
          fill="${cardBg}" stroke="${cardBorder}" stroke-width="1.5" />

    <!-- category label -->
    <text x="${w / 2}" y="24" text-anchor="middle"
          font-family="Segoe UI, system-ui"
          font-size="13" fill="${titleColor}" font-weight="600">
      ${label}
    </text>

    <!-- trophy + rank circle -->
    <circle cx="${w / 2}" cy="60" r="22" fill="${bg}" stroke="${rankColor}" stroke-width="2"/>
    <text x="${w / 2}" y="56" text-anchor="middle"
          font-family="Segoe UI, system-ui"
          font-size="18" fill="${rankColor}" font-weight="700">
      ${rank}
    </text>
    <text x="${w / 2}" y="77" text-anchor="middle"
          font-family="Segoe UI Emoji, Segoe UI, system-ui"
          font-size="18" fill="${rankColor}">
      🏆
    </text>

    <!-- title & points -->
    <text x="${w / 2}" y="104" text-anchor="middle"
          font-family="Segoe UI, system-ui"
          font-size="11" fill="${textColor}" font-weight="600">
      ${title}
    </text>

    <text x="${w / 2}" y="120" text-anchor="middle"
          font-family="Segoe UI, system-ui"
          font-size="11" fill="${subColor}">
      ${pts}
    </text>

    <!-- progress bar -->
    <rect x="12" y="${h - 20}" width="${w - 24}" height="5" rx="2.5" fill="${barBg}" />
    <rect x="12" y="${h - 20}" width="${barWidth}" height="5" rx="2.5" fill="${barFill}" />
  </g>
  `;
}

// ------------ main ------------
async function main() {
  try {
    const stats = await getStats();
    const svg = buildSVG(stats);
    const outPath = path.join(__dirname, "trophy.svg");
    fs.writeFileSync(outPath, svg, "utf8");
    console.log("🏆 trophy.svg generated (Vercel-style row).");
  } catch (err) {
    console.error("❌ Error generating trophy:", err);
    process.exit(1);
  }
}

main();
