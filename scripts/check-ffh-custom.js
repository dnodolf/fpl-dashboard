const https = require('https');
const fs = require('fs');
const path = require('path');

// Read .env.local manually (no dotenv dependency)
const envPath = path.join(__dirname, '..', '.env.local');
const envContent = fs.readFileSync(envPath, 'utf-8');
const env = {};
envContent.split('\n').forEach(line => {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) return;
  const eqIdx = trimmed.indexOf('=');
  if (eqIdx > 0) {
    env[trimmed.slice(0, eqIdx).trim()] = trimmed.slice(eqIdx + 1).trim();
  }
});

function fetchJSON(url, headers) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const options = {
      hostname: parsed.hostname,
      path: parsed.pathname + parsed.search,
      headers: {
        ...headers,
        'accept': '*/*',
        'content-type': 'application/json',
        'origin': 'https://www.fantasyfootballhub.co.uk',
        'referer': 'https://www.fantasyfootballhub.co.uk/',
        'user-agent': 'Mozilla/5.0'
      }
    };
    https.get(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch (e) { reject(new Error(`JSON parse failed: ${data.slice(0, 200)}`)); }
      });
    }).on('error', reject);
  });
}

function printFields(player, label) {
  const keys = Object.keys(player).sort();
  console.log(`\n--- ${label} (${keys.length} fields) ---`);
  keys.forEach(k => {
    const val = player[k];
    let display;
    if (val === null || val === undefined) {
      display = String(val);
    } else if (Array.isArray(val)) {
      display = `Array(${val.length}) ${JSON.stringify(val.slice(0, 2)).slice(0, 120)}...`;
    } else if (typeof val === 'object') {
      display = JSON.stringify(val).slice(0, 120);
    } else {
      display = String(val).slice(0, 80);
    }
    console.log(`  ${k}: ${display}`);
  });
}

async function main() {
  const authStatic = env.FFH_AUTH_STATIC;
  const bearerToken = env.FFH_BEARER_TOKEN;

  if (!authStatic || !bearerToken) {
    console.error('Missing FFH credentials in .env.local');
    process.exit(1);
  }

  // Token already has "Bearer " prefix in .env.local
  const tokenHeader = bearerToken.startsWith('Bearer ') ? bearerToken : `Bearer ${bearerToken}`;
  const headers = {
    'authorization': authStatic,
    'token': tokenHeader
  };

  console.log('=== Comparing FFH Endpoints ===\n');

  // 1. players-custom endpoint
  console.log('Fetching players-custom (2 players)...');
  const customUrl = 'https://data.fantasyfootballhub.co.uk/api/players-custom/?mingw=1&maxgw=29&type=total&venue=all&season=2025&sortOn=appearance&qty=2&sortOrder=desc&playerSearch=&minCost=37&maxCost=146&positions=1,2,3,4&min_fdr=1&max_fdr=5&page_No=1&lowMins=false&ppm=0';
  const customData = await fetchJSON(customUrl, headers);

  let customPlayer = null;
  if (Array.isArray(customData) && customData.length > 0) {
    customPlayer = customData[0];
    console.log(`Got ${customData.length} players from players-custom`);
    printFields(customPlayer, 'players-custom first player');
  } else if (typeof customData === 'object') {
    console.log('Response is object with keys:', Object.keys(customData));
    // Try to find array in response
    for (const key of Object.keys(customData)) {
      if (Array.isArray(customData[key]) && customData[key].length > 0) {
        customPlayer = customData[key][0];
        console.log(`Found array at key "${key}" with ${customData[key].length} items`);
        printFields(customPlayer, `players-custom.${key}[0]`);
        break;
      }
    }
    if (!customPlayer) {
      console.log('Full response:', JSON.stringify(customData).slice(0, 500));
    }
  }

  // 2. player-predictions endpoint (what we currently use)
  console.log('\n\nFetching player-predictions (2 players)...');
  const predUrl = 'https://data.fantasyfootballhub.co.uk/api/player-predictions/?orderBy=points&focus=range&positions=1,2,3,4&min_cost=40&max_cost=145&search_term=&gw_start=1&gw_end=38&first=0&last=2&use_predicted_fixtures=false&selected_players=';
  const predData = await fetchJSON(predUrl, headers);

  let predPlayer = null;
  if (Array.isArray(predData) && predData.length > 0) {
    predPlayer = predData[0];
    console.log(`Got ${predData.length} players from player-predictions`);
    printFields(predPlayer, 'player-predictions first player');
  } else if (typeof predData === 'object') {
    console.log('Response keys:', Object.keys(predData));
  }

  // 3. Compare field sets
  if (customPlayer && predPlayer) {
    const customKeys = new Set(Object.keys(customPlayer));
    const predKeys = new Set(Object.keys(predPlayer));

    const onlyInCustom = [...customKeys].filter(k => !predKeys.has(k)).sort();
    const onlyInPred = [...predKeys].filter(k => !customKeys.has(k)).sort();
    const shared = [...customKeys].filter(k => predKeys.has(k)).sort();

    console.log('\n\n=== FIELD COMPARISON ===');
    console.log(`\nShared fields (${shared.length}): ${shared.join(', ')}`);
    console.log(`\nOnly in players-custom (${onlyInCustom.length}):`);
    onlyInCustom.forEach(k => {
      const val = customPlayer[k];
      const display = typeof val === 'object' ? JSON.stringify(val)?.slice(0, 80) : val;
      console.log(`  + ${k}: ${display}`);
    });
    console.log(`\nOnly in player-predictions (${onlyInPred.length}):`);
    onlyInPred.forEach(k => {
      const val = predPlayer[k];
      const display = typeof val === 'object' ? JSON.stringify(val)?.slice(0, 80) : val;
      console.log(`  + ${k}: ${display}`);
    });
  }
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
