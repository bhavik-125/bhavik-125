const fs = require("fs");
const path = require("path");

const username = process.env.GITHUB_USERNAME || "bhavik-125";
const githubToken = process.env.GITHUB_TOKEN;

// ---------------- GitHub REST API Helper ----------------
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

// ---------------- Commit Count via GRAPHQL ----------------
// This gives REAL commit contributions (last 365 days)
async function getCommitCountGraphQL(username) {
  const query = {
    query: `
      query {
        user(login: "${username}") {
          contributionsCollection {
            contributionCalendar {
              totalContributions
            }
          }
        }
      }
    `,
  };

  const res = await fetch("https://api.github.com/graphql", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${githubToken}`,
    },
    body: JSON.stringify(query),
  });

  const json = await res.json();

  if (json.data?.user?.contributionsCollection?.contributionCalendar?.totalContributions) {
    return json.data.user.contributionsCollection.contributionCalendar.totalContributions;
  }

  return 0;
}

// ---------------- Search-Based Stats (PRs, Issues) ----------------
async function getSearchCount(query) {
  const data = await githubFetch(
    `https://api.github.com/search/issues?q=${encodeURIComponent(query)}`
  );
  return data.total_count || 0;
}

// ---------------- Collect all GitHub stats ----------------
async function getStats() {
  const user = await githubFetch(`https://api.github.com/users/${username}`);

  // Load repos for stars & forks
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

  const commitCount = await getCommitCountGraphQL(username);
  const totalIssues = await getSearchCount(`author:${username} is:issue`);
  const totalPRs = await getSearchCount(`author:${username} is:pr`);
  const totalReviews = 0; // GitHub REST doesn't expose easily → keep 0 like Vercel

  return {
    name: user.name || username,
    username,
    createdAt,
    publicRepos: user.public_repos,
    followers: user.followers,
    totalStars,
    totalForks,
    experienceYears: years,
    commitCount,
    totalIssues,
    totalPRs,
    totalReviews,
  };
}

// ---------------- Rank / Title Logic ----------------
function commitsTrophy(c) {
  if (c >= 200) return { rank: "A", title: "High Committer", points: c };
  if (c >= 50) return { rank: "B", title: "Active Committer", points: c };
  if (c > 0) return { rank: "C", title: "First Committer", points: c };
  return { rank: "?", title: "Unknown", points: 0 };
}

function reposTrophy(r) {
  if (r >= 30) return { rank: "A", title: "Repo Tycoon", points: r * 3 };
  if (r >= 10) return { rank: "B", title: "Middle Repo Creator", points: r * 2 };
  if (r > 0) return { rank: "C", title: "First Repo", points: r };
  return { rank: "?", title: "No Repos", points: 0 };
}

function experienceTrophy(y) {
  if (y >= 5) return { rank: "A", title: "Senior Dev", points: Math.round(y * 10) };
  if (y >= 2) return { rank: "B", title: "Intermediate Dev", points: Math.round(y * 8) };
  if (y > 0.2) return { rank: "C", title: "Junior Dev", points: Math.round(y * 5) };
  return { rank: "?", title: "Newbie", points: 0 };
}

function starsTrophy(s) {
  if (s >= 100) return { rank: "A", title: "Star Gazer", points: s };
  if (s >= 20) return { rank: "B", title: "Rising Star", points: s };
  if (s > 0) return { rank: "C", title: "First Star", points: s };
  return { rank: "?", title: "No Stars", points: 0 };
}

function followersTrophy(f) {
  if (f >= 50) return { rank: "A", title: "Influencer", points: f * 2 };
  if (f >= 10) return { rank: "B", title: "Popular Dev", points: f * 2 };
  if (f > 0) return { rank: "C", title: "First Friend", points: f };
  return { rank: "?", title: "No Followers", points: 0 };
}

function prsTrophy(p) {
  if (p >= 50) return { rank: "A", title: "PR Master", points: p * 2 };
  if (p >= 10) return { rank: "B", title: "PR Contributor", points: p * 2 };
  if (p > 0) return { rank: "C", title: "First Pull", points: p };
  return { rank: "?", title: "Unknown", points: 0 };
}

function issuesTrophy(i) {
  if (i >= 50) return { rank: "A", title: "Issue Tracker", points: i };
  if (i >= 10) return { rank: "B", title: "Bug Reporter", points: i };
  if (i > 0) return { rank: "C", title: "First Issue", points: i };
  return { rank: "?", title: "Unknown", points: 0 };
}

function reviewsTrophy(r) {
  if (r > 0) return { rank: "C", title: "Code Reviewer", points: r };
  return { rank: "?", title: "Unknown", points: 0 };
}

// ---------------- Build Trophy Cards ----------------
function buildSVG(stats) {
  const width = 1200;
  const height = 260;

  const bg = "#1f2228";
  const cardBg = "#343841";
  const cardBorder = "#f9d74c";
  const titleColor = "#f9d74c";
  const textColor = "#e5e7eb";
  const subColor = "#b0b3c3";
  const barBg = "#4b4f59";
  const barFill = "#e06c75";

  const trophies = [
    { label: "Commits", metric: stats.commitCount, ...commitsTrophy(stats.commitCount) },
    { label: "Repositories", metric: stats.publicRepos, ...reposTrophy(stats.publicRepos) },
    { label: "Experience", metric: stats.experienceYears, ...experienceTrophy(stats.experienceYears) },
    { label: "Stars", metric: stats.totalStars, ...starsTrophy(stats.totalStars) },
    { label: "Followers", metric: stats.followers, ...followersTrophy(stats.followers) },
    { label: "PullRequest", metric: stats.totalPRs, ...prsTrophy(stats.totalPRs) },
    { label: "Issues", metric: stats.totalIssues, ...issuesTrophy(stats.totalIssues) },
    { label: "Reviews", metric: stats.totalReviews, ...reviewsTrophy(stats.totalReviews) },
  ];

  const cardW = 120;
  const cardH = 170;
  const gap = 14;
  const left = 40;
  const top = 70;

  const cards = trophies
    .map((t, idx) => trophyCard(
      left + idx * (cardW + gap),
      top,
      cardW,
      cardH,
      t.label,
      t.rank,
      t.title,
      t.points,
      t.metric,
      cardBg,
      cardBorder,
      titleColor,
      textColor,
      subColor,
      barBg,
      barFill
    ))
    .join("\n");

  return `
<svg width="${width}" height="${height}"
     viewBox="0 0 ${width} ${height}"
     xmlns="http://www.w3.org/2000/svg">

  <rect x="0" y="0" width="${width}" height="${height}" rx="24" fill="${bg}" />

  <text x="${width/2}" y="40" text-anchor="middle"
        font-size="26" font-family="Segoe UI, system-ui"
        fill="${textColor}" font-weight="600">
    🏆 ${stats.name}'s GitHub Trophies
  </text>

  <text x="${width/2}" y="62" text-anchor="middle"
        font-size="13" font-family="Segoe UI, system-ui"
        fill="${subColor}">
    @${stats.username}
  </text>

  ${cards}
</svg>`;
}

// ---------------- Trophy Card Renderer ----------------
function trophyCard(x, y, w, h, label, rank, title, points, metric,
  cardBg, cardBorder, titleColor, textColor, subColor, barBg, barFill
) {
  const rankColor =
    rank === "A" ? "#ffd700" :
    rank === "B" ? "#c0c0c0" :
    rank === "C" ? "#cd7f32" : "#9ca3af";

  const pts = `${points || 0}pt`;
  let norm = Math.min(1, metric / 50);
  const barWidth = (w - 24) * norm;

  return `
  <g transform="translate(${x}, ${y})">
    <rect width="${w}" height="${h}" rx="10"
          fill="${cardBg}" stroke="${cardBorder}" stroke-width="1.5" />

    <text x="${w/2}" y="24" text-anchor="middle"
          fill="${titleColor}" font-size="13"
          font-family="Segoe UI, system-ui" font-weight="600">
      ${label}
    </text>

    <circle cx="${w/2}" cy="60" r="22"
            fill="#1f2228" stroke="${rankColor}" stroke-width="2" />

    <text x="${w/2}" y="56" text-anchor="middle"
          fill="${rankColor}" font-size="18" font-family="Segoe UI" font-weight="700">
      ${rank}
    </text>

    <text x="${w/2}" y="77" text-anchor="middle"
          font-family="Segoe UI Emoji, Segoe UI" font-size="18" fill="${rankColor}">
      🏆
    </text>

    <text x="${w/2}" y="104" text-anchor="middle"
          fill="${textColor}" font-size="11"
          font-family="Segoe UI" font-weight="600">
      ${title}
    </text>

    <text x="${w/2}" y="120" text-anchor="middle"
          fill="${subColor}" font-size="11" font-family="Segoe UI">
      ${pts}
    </text>

    <rect x="12" y="${h-20}" width="${w-24}" height="5" rx="2.5"
          fill="${barBg}" />
    <rect x="12" y="${h-20}" width="${barWidth}" height="5" rx="2.5"
          fill="${barFill}" />
  </g>`;
}

// ---------------- MAIN EXECUTION ----------------
async function main() {
  try {
    const stats = await getStats();
    const svg = buildSVG(stats);
    fs.writeFileSync("trophy.svg", svg, "utf8");
    console.log("🏆 trophy.svg generated successfully.");
  } catch (err) {
    console.error("❌ Error:", err);
    process.exit(1);
  }
}

main();
