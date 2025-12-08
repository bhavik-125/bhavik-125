// index.js — Bhavik's Custom GitHub Trophy Generator

const fs = require("fs");
const path = require("path");

const username = process.env.GITHUB_USERNAME || "bhavik-125";
const githubToken = process.env.GITHUB_TOKEN;

// ---- Helper to call GitHub API ----
async function githubFetch(url) {
  const headers = {
    "User-Agent": "bhavik-125-trophy-generator",
    "Accept": "application/vnd.github+json",
  };

  if (githubToken) headers.Authorization = `Bearer ${githubToken}`;

  const res = await fetch(url, { headers });

  if (!res.ok) {
    console.error(`GitHub API Error ${res.status}: ${await res.text()}`);
    throw new Error(`API error fetching ${url}`);
  }

  return res.json();
}

// ---- Get all GitHub Stats ----
async function getStats() {
  const user = await githubFetch(`https://api.github.com/users/${username}`);

  let repos = [];
  let page = 1;

  while (true) {
    const chunk = await githubFetch(
      `https://api.github.com/users/${username}/repos?per_page=100&page=${page}`
    );
    if (chunk.length === 0) break;

    repos = repos.concat(chunk);
    page++;
  }

  const totalStars = repos.reduce((sum, r) => sum + (r.stargazers_count || 0), 0);
  const totalForks = repos.reduce((sum, r) => sum + (r.forks_count || 0), 0);

  const langCounts = {};
  repos.forEach((r) => {
    if (!r.language) return;
    langCounts[r.language] = (langCounts[r.language] || 0) + 1;
  });

  const topLanguages = Object.entries(langCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([lang]) => lang)
    .slice(0, 3);

  return {
    name: user.name || username,
    username,
    publicRepos: user.public_repos,
    followers: user.followers,
    following: user.following,
    totalStars,
    totalForks,
    topLanguages,
  };
}

// ---- Build the SVG with Dark + Neon Cyan Theme ----
function buildSVG(stats) {
  const width = 940;
  const height = 320;

  return `
<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"
     xmlns="http://www.w3.org/2000/svg">

  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#0d1117"/>
      <stop offset="100%" stop-color="#0b0f14"/>
    </linearGradient>

    <linearGradient id="card-bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#111827"/>
      <stop offset="100%" stop-color="#0f172a"/>
    </linearGradient>

    <filter id="neon">
      <feDropShadow dx="0" dy="0" stdDeviation="3" flood-color="#00f5ff"/>
    </filter>
  </defs>

  <rect width="100%" height="100%" fill="url(#bg)" rx="24"/>

  <text x="50%" y="50" text-anchor="middle"
        font-family="Segoe UI, system-ui"
        font-size="28" fill="#e5e7eb" font-weight="700">
    🏆 ${stats.name}'s GitHub Trophies
  </text>

  <text x="50%" y="80" text-anchor="middle"
        font-family="Segoe UI, system-ui"
        font-size="16" fill="#9ca3af">
    @${stats.username} • Top Languages: ${stats.topLanguages.join(" • ") || "None"}
  </text>

  ${card(40, 110, "Total Stars", stats.totalStars, "Cumulative stars across repos")}
  ${card(340, 110, "Public Repositories", stats.publicRepos, "Open-source projects")}
  ${card(640, 110, "Followers", stats.followers, "People following your work")}

  ${card(40, 220, "Following", stats.following, "Developers you follow")}
  ${card(340, 220, "Total Forks", stats.totalForks, "Forks on your repos")}
  ${card(640, 220, "Top Languages", stats.topLanguages.join(" • ") || "None", "Most-used languages")}
</svg>
`;

  function card(x, y, title, value, description) {
    return `
      <g transform="translate(${x}, ${y})">
        <rect width="260" height="90" rx="18"
          fill="url(#card-bg)"
          stroke="#00f5ff"
          stroke-width="2"
          filter="url(#neon)"
        />

        <text x="16" y="32" font-size="16" fill="#cbd5e1"
          font-family="Segoe UI, system-ui">${title}</text>

        <text x="16" y="60" font-size="28" fill="#fbbf24"
          font-family="Segoe UI, system-ui" font-weight="700">${value}</text>

        <text x="16" y="80" font-size="12" fill="#64748b"
          font-family="Segoe UI, system-ui">${description}</text>
      </g>
    `;
  }
}

// ---- Main Runner ----
async function main() {
  try {
    const stats = await getStats();
    const svg = buildSVG(stats);

    const outPath = path.join(__dirname, "trophy.svg");
    fs.writeFileSync(outPath, svg, "utf8");

    console.log("✅ trophy.svg generated successfully.");
  } catch (err) {
    console.error("❌ Error generating trophy:", err);
    process.exit(1);
  }
}

main();
