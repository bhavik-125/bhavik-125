// index.js — Bhavik's Perfect Theme GitHub Trophy (Glow Removed + Theme Matched)

const fs = require("fs");
const path = require("path");

const username = process.env.GITHUB_USERNAME || "bhavik-125";
const githubToken = process.env.GITHUB_TOKEN;

async function githubFetch(url) {
  const headers = {
    "User-Agent": "bhavik-125-trophy-generator",
    "Accept": "application/vnd.github+json"
  };
  if (githubToken) headers.Authorization = `Bearer ${githubToken}`;
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`GitHub error ${res.status}`);
  return res.json();
}

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

  const totalStars = repos.reduce((a, r) => a + (r.stargazers_count || 0), 0);
  const totalForks = repos.reduce((a, r) => a + (r.forks_count || 0), 0);

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
    topLanguages
  };
}

// =====================================================
// FINAL PERFECT THEME — NO GLOW, CLEAN TEAL BORDERS
// =====================================================

function buildSVG(stats) {
  const width = 1000;
  const height = 350;

  return `
<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"
     xmlns="http://www.w3.org/2000/svg">

  <defs>
    <!-- Smooth dark gradient (matches your GitHub UI) -->
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#111827"/>
      <stop offset="100%" stop-color="#0f172a"/>
    </linearGradient>

    <!-- Card background -->
    <linearGradient id="card" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#0f172a"/>
      <stop offset="100%" stop-color="#1e293b"/>
    </linearGradient>
  </defs>

  <!-- Main Background -->
  <rect width="100%" height="100%" fill="url(#bg)" rx="32"/>

  <!-- Header -->
  <text x="50%" y="60" text-anchor="middle"
        font-size="32" fill="#e2e8f0"
        font-family="Segoe UI, system-ui"
        font-weight="700">
    🏆 ${stats.name}'s GitHub Trophies
  </text>

  <text x="50%" y="95" text-anchor="middle"
        font-size="16" fill="#94a3b8"
        font-family="Segoe UI, system-ui">
    @${stats.username} • Top Languages: ${stats.topLanguages.join(" • ") || "None"}
  </text>

  ${card(60, 130, "Total Stars", stats.totalStars, "Cumulative stars")}
  ${card(370, 130, "Public Repositories", stats.publicRepos, "Open-source projects")}
  ${card(680, 130, "Followers", stats.followers, "People following your work")}

  ${card(60, 250, "Following", stats.following, "Developers you follow")}
  ${card(370, 250, "Total Forks", stats.totalForks, "Forks on your repos")}
  ${card(680, 250, "Top Languages", fit(stats.topLanguages.join(" • ")), "Most-used languages")}
</svg>
`;

  // ===== Card Component =====
  function card(x, y, title, value, desc) {
    return `
    <g transform="translate(${x}, ${y})">
      <rect width="260" height="100" rx="22"
        fill="url(#card)"
        stroke="#38bdf8"
        stroke-width="2"/>

      <text x="18" y="32" font-size="16" fill="#e2e8f0"
        font-family="Segoe UI, system-ui">${title}</text>

      <text x="18" y="68" font-size="28" fill="#fbbf24"
        font-family="Segoe UI, system-ui" font-weight="700">${value}</text>

      <text x="18" y="88" font-size="12" fill="#94a3b8"
        font-family="Segoe UI, system-ui">${desc}</text>
    </g>
    `;
  }

  // Fix overflow text
  function fit(text) {
    if (text.length > 22) {
      return text.slice(0, 19) + "...";
    }
    return text;
  }
}

async function main() {
  try {
    const stats = await getStats();
    const svg = buildSVG(stats);
    fs.writeFileSync(path.join(__dirname, "trophy.svg"), svg, "utf8");
    console.log("🏆 trophy.svg updated.");
  } catch (err) {
    console.error("❌ Error generating trophy:", err);
    process.exit(1);
  }
}

main();
