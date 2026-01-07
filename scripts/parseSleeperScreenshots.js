// Script to manually enter Sleeper historical scoring data from screenshots
// Screenshots: IMG_0333.PNG onwards (2 per week - starters + bench)
// Week 1 = IMG_0333 (starters) + IMG_0334 (bench)
// Week 2 = IMG_0335 (starters) + IMG_0336 (bench), etc.

const fs = require('fs');
const path = require('path');

// Historical Sleeper scoring data extracted from screenshots
// Format: { week, player_name, position, points, starting }
const sleeperHistoricalData = {
  weeks: [
    // WEEK 1 (IMG_0333.PNG + IMG_0334.PNG)
    {
      week: 1,
      players: [
        // Starters
        { name: 'Mambo', position: 'GKP', points: 4, starting: true },
        { name: 'Fernandez', position: 'DEF', points: 0.75, starting: true },
        { name: 'Kudus', position: 'MID', points: 8.25, starting: true },
        { name: 'Davidson', position: 'DEF', points: 3.25, starting: true },
        { name: 'Fernandes', position: 'MID', points: 0.5, starting: true },
        { name: 'Mitoma', position: 'FWD', points: 1.5, starting: true },
        { name: 'Romero', position: 'DEF', points: 8, starting: true },
        { name: 'Cacicedo', position: 'MID', points: 9, starting: true },
        { name: 'Mbeumo', position: 'FWD', points: 10.5, starting: true },
        { name: 'Andersen', position: 'DEF', points: 3.75, starting: true },
        // Bench
        { name: 'Ederson', position: 'GKP', points: 0, starting: false },
        { name: 'Robinson', position: 'DEF', points: 0, starting: false },
        { name: 'Havertz', position: 'MID', points: 1.25, starting: false },
        { name: 'Babos', position: 'FWD', points: 5, starting: false },
        { name: 'Hunt', position: 'DEF', points: 10, starting: false },
        { name: 'Mbete', position: 'MID', points: 10, starting: false },
        { name: 'Strand Larsen', position: 'FWD', points: 5.25, starting: false },
        { name: 'Alexandar', position: 'FWD', points: 8, starting: false },
        { name: 'Lamptey', position: 'DEF', points: 5.5, starting: false }
      ]
    },

    // WEEK 2 (IMG_0335.PNG + IMG_0336.PNG) - TO BE FILLED IN
    {
      week: 2,
      players: [
        // TODO: Fill in from screenshots
      ]
    },

    // Add weeks 3-20 following same pattern...
    // Each week needs data from 2 screenshots (starters + bench)
  ]
};

// Export as JSON for training
const outputPath = path.join(__dirname, '..', 'app', 'data', 'sleeper_historical_gw1-20.json');
fs.writeFileSync(outputPath, JSON.stringify(sleeperHistoricalData, null, 2));

console.log(`✅ Sleeper historical data exported to: ${outputPath}`);
console.log(`📊 Weeks parsed: ${sleeperHistoricalData.weeks.filter(w => w.players.length > 0).length}`);
console.log(`📋 Total player-week records: ${sleeperHistoricalData.weeks.reduce((sum, w) => sum + w.players.length, 0)}`);
