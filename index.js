const fs = require("fs");
const path = require("path");

const username = process.env.GITHUB_USERNAME || "bhavik-125";
const githubToken = process.env.GITHUB_TOKEN;

// Helper to call GitHub API
async function githubFetch(url) {
  const headers = {
    "User-Agent": "bhavik-125-trophy-generator",
    "Accept": "application/vnd.github+json"
  };
  if (githubToken) {
    headers.Authorization = `Bearer ${githubToken}`;
  }
  const res = await fetch(url, { headers });
  if (!res.ok) {
    throw new Error(`GitHub API error ${res.status} for ${url}`);
  }
  return res.json();
}

async function getStats() {
  // Basic user info
  const user = await githubFetch(`https://api.github.com/users/${username}`);

  // Repos (for stars, languages, etc.)
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

  // Count languages
  const langCounts = {};
  for (const r of repos) {
    if (!r.language) continue;
    langCounts[r.language] = (langCounts[r.language] || 0) + 1;
  }
  const topLanguages = Object.entries(langCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([lang]) => lang);

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

function buildSVG(stats) {
  const width = 900;
  const height = 220;
  const padding = 20;
  const cardWidth = 260;
  const cardHeight = 80;
  const cardRadius = 18;

  const card = (x, y, title, value, subtitle) => `
    <g transform="translate(${x}, ${y})">
      <rect x="0" y="0" rx="${cardRadius}" ry="${cardRadius}" width="${cardWidth}" height="${cardHeight}"
        fill="#1f2933" stroke="#4fd1c5" stroke-width="2"/>
      <text x="16" y="28" font-size="16" fill="#e5e7eb" font-family="Segoe UI, system-ui, sans-serif">
        ${title}
      </text>
      <text x="16" y="52" font-size="24" fill="#fbbf24" font-family="Segoe UI, system-ui, sans-serif" font-weight="bold">
        ${value}
      </text>
      ${
        subtitle
          ? `<text x="16" y="70" font-size="12" fill="#9ca3af" font-family="Segoe UI, system-ui, sans-serif">
        ${subtitle}
      </text>`
          : ""
      }
    </g>
  `;

  const langs =
    stats.topLanguages.length > 0
      ? stats.topLanguages.join(" · ")
      : "No dominant language";

  return `
<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"
     xmlns="http://www.w3.org/2000/svg" role="img" aria-labelledby="title desc">
  <title id="title">${stats.username} GitHub Trophies</title>
  <desc id="desc">Self-hosted trophy style stats card for ${stats.username}</desc>

  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#0f172a"/>
      <stop offset="100%" stop-color="#1e293b"/>
    </linearGradient>
  </defs>

  <rect width="100%" height="100%" fill="url(#bg)" rx="24" ry="24"/>

  <text x="${width / 2}" y="40" text-anchor="middle"
        font-family="Segoe UI, system-ui, sans-serif"
        font-size="24" fill="#e5e7eb" font-weight="600">
    🏆 ${stats.name}'s GitHub Trophies
  </text>
  <text x="${width / 2}" y="64" text-anchor="middle"
        font-family="Segoe UI, system-ui, sans-serif"
        font-size="14" fill="#9ca3af">
    @${stats.username} • Top Languages: ${langs}
  </text>

  ${card(
    padding,
    90,
    "Total Stars",
    stats.totalStars,
    "Cumulative stars across public repos"
  )}
  ${card(
    padding + cardWidth + 30,
    90,
    "Public Repositories",
    stats.publicRepos,
    "Open source projects"
  )}
  ${card(
    padding + (cardWidth + 30) * 2,
    90,
    "Followers",
    stats.followers,
    "People following your work"
  )}

  ${card(
    padding,
    90 + cardHeight + 20,
    "Following",
    stats.following,
    "Developers you follow"
  )}
  ${card(
    padding + cardWidth + 30,
    90 + cardHeight + 20,
    "Total Forks",
    stats.totalForks,
    "Repos forked from you"
  )}
  ${card(
    padding + (cardWidth + 30) * 2,
    90 + cardHeight + 20,
    "Top Languages",
    stats.topLanguages.join(" • ") || "None",
    "Most-used repo languages"
  )}
</svg>
`;
}

async function main() {
  try {
    const stats = await getStats();
    const svg = buildSVG(stats);
    const outPath = path.join(__dirname, "trophy.svg");
    fs.writeFileSync(outPath, svg, "utf8");
    console.log("trophy.svg generated successfully.");
  } catch (err) {
    console.error("Error generating trophy:", err);
    process.exit(1);
  }
}

main();
