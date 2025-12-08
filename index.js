const fs = require("fs");
const path = require("path");

const username = process.env.GITHUB_USERNAME || "bhavik-125";
const githubToken = process.env.GITHUB_TOKEN;

// ---------- GitHub API helper ----------
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

// ---------- Collect stats ----------
async function getStats() {
  const user = await githubFetch(`https://api.github.com/users/${username}`);

  // get all repos (for stars, forks, languages)
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
  for (const r of repos) {
    if (!r.language) continue;
    langCounts[r.language] = (langCounts[r.language] || 0) + 1;
  }
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

// ---------- Build classic badge-style SVG ----------
function buildSVG(stats) {
  const width = 900;
  const height = 260;

  // onedark-ish colors
  const bg = "#282c34";
  const panel = "#21252b";
  const border = "#c678dd";   // purple-ish border
  const textMain = "#e5c07b"; // yellow-ish value
  const textTitle = "#abb2bf";
  const textSub = "#5c6370";

  // trophies (similar spirit to original)
  const topLang = stats.topLanguages[0] || "None";
  const trophies = [
    {
      icon: "⭐",
      title: "Star Collector",
      value: stats.totalStars,
      sub: "Total Stars",
    },
    {
      icon: "📦",
      title: "Repository Master",
      value: stats.publicRepos,
      sub: "Public Repos",
    },
    {
      icon: "👥",
      title: "People's Choice",
      value: stats.followers,
      sub: "Followers",
    },
    {
      icon: "🧑‍💻",
      title: "Social Coder",
      value: stats.following,
      sub: "Following",
    },
    {
      icon: "🍴",
      title: "Fork Forge",
      value: stats.totalForks,
      sub: "Total Forks",
    },
    {
      icon: "🧠",
      title: "Polyglot",
      value: topLang,
      sub: "Top Language",
    },
  ];

  // layout: 3 columns x 2 rows
  const cols = 3;
  const badgeW = 260;
  const badgeH = 90;
  const hGap = 30;
  const vGap = 25;
  const leftMargin = 40;
  const topMargin = 90;

  const badgesSVG = trophies
    .map((t, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const x = leftMargin + col * (badgeW + hGap);
      const y = topMargin + row * (badgeH + vGap);
      return badge(x, y, badgeW, badgeH, t.icon, t.title, t.value, t.sub);
    })
    .join("\n");

  return `
<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"
     xmlns="http://www.w3.org/2000/svg" role="img" aria-labelledby="title desc">
  <title id="title">${stats.username} GitHub Trophies</title>
  <desc id="desc">Classic trophy badges generated from GitHub stats</desc>

  <defs>
    <linearGradient id="panel-bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#2c313a"/>
      <stop offset="100%" stop-color="${panel}"/>
    </linearGradient>
  </defs>

  <!-- Background -->
  <rect width="100%" height="100%" fill="${bg}" rx="16" />

  <!-- Header -->
  <text x="${width / 2}" y="40" text-anchor="middle"
        font-family="Segoe UI, system-ui"
        font-size="22" fill="${textTitle}" font-weight="600">
    🏆 ${stats.name}'s GitHub Trophies
  </text>
  <text x="${width / 2}" y="64" text-anchor="middle"
        font-family="Segoe UI, system-ui"
        font-size="13" fill="${textSub}">
    @${stats.username} • Top Languages: ${stats.topLanguages.join(" • ") || "None"}
  </text>

  ${badgesSVG}
</svg>
`;

  // Single badge (classic trophy style)
  function badge(x, y, w, h, icon, title, value, sub) {
    // Limit text for long language names
    let valText = String(value);
    if (valText.length > 12) valText = valText.slice(0, 11) + "…";

    return `
    <g transform="translate(${x}, ${y})">
      <rect width="${w}" height="${h}" rx="14"
        fill="url(#panel-bg)"
        stroke="${border}" stroke-width="1.8" />

      <text x="18" y="30"
        font-family="Segoe UI, system-ui"
        font-size="18" fill="${textTitle}">
        ${icon} ${title}
      </text>

      <text x="22" y="57"
        font-family="Segoe UI, system-ui"
        font-size="22" fill="${textMain}" font-weight="700">
        ${valText}
      </text>

      <text x="22" y="76"
        font-family="Segoe UI, system-ui"
        font-size="11" fill="${textSub}">
        ${sub}
      </text>
    </g>
    `;
  }
}

// ---------- main ----------
async function main() {
  try {
    const stats = await getStats();
    const svg = buildSVG(stats);
    const outPath = path.join(__dirname, "trophy.svg");
    fs.writeFileSync(outPath, svg, "utf8");
    console.log("🏆 trophy.svg generated (classic badge style).");
  } catch (err) {
    console.error("❌ Error generating trophy:", err);
    process.exit(1);
  }
}

main();
