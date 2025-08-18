// app/services/googleSheetsService.js
import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';

class GoogleSheetsService {
  constructor() {
    this.doc = null;
    this.isInitialized = false;
  }

  async initialize() {
    if (this.isInitialized) return;

    try {
      const serviceAccountAuth = new JWT({
        email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
        key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
        scopes: ['https://www.googleapis.com/auth/spreadsheets'],
      });

      this.doc = new GoogleSpreadsheet(process.env.GOOGLE_SHEETS_SPREADSHEET_ID, serviceAccountAuth);
      await this.doc.loadInfo();
      
      console.log(`Connected to sheet: ${this.doc.title}`);
      this.isInitialized = true;
    } catch (error) {
      console.error('Failed to initialize Google Sheets:', error);
      throw new Error('Google Sheets connection failed');
    }
  }

  async getSheet(sheetName) {
    await this.initialize();
    
    let sheet = this.doc.sheetsByTitle[sheetName];
    if (!sheet) {
      console.log(`Creating new sheet: ${sheetName}`);
      sheet = await this.doc.addSheet({ title: sheetName });
    }
    
    return sheet;
  }

  // Get player data from "Player Ownership" sheet
  async getPlayerData() {
    try {
      const sheet = await this.getSheet('Player Ownership');
      const rows = await sheet.getRows();
      
      return rows.map(row => ({
        name: row.get('Name') || row.get('full_name') || '',
        position: row.get('Position') || row.get('fantasy_positions') || '',
        team: row.get('Team') || row.get('team_abbr') || '',
        ownership: row.get('Ownership') || '0%',
        price: parseFloat(row.get('Price') || row.get('cost') || 0),
        predicted_points: parseFloat(row.get('FPL_Points') || row.get('predicted_points') || 0),
        sleeper_points: parseFloat(row.get('Sleeper_Points') || row.get('sleeper_points') || 0),
        form: row.get('Form') || '',
        owned_by: row.get('Owned_By') || row.get('owned_by') || '',
        is_available: !row.get('Owned_By') || row.get('Owned_By').trim() === '',
        // Additional fields from your Apps Script
        opta_id: row.get('opta_id') || '',
        match_method: row.get('match_method') || '',
        confidence: row.get('confidence') || '',
        conversion_ratio: parseFloat(row.get('conversion_ratio') || 1.0)
      }));
    } catch (error) {
      console.error('Error fetching player data from sheets:', error);
      throw error;
    }
  }

  // Save player data to "Player Ownership" sheet
  async savePlayerData(players) {
    try {
      const sheet = await this.getSheet('Player Ownership');
      
      // Clear existing data
      await sheet.clear();
      
      // Set headers
      const headers = [
        'Name', 'Position', 'Team', 'Ownership', 'Price', 
        'FPL_Points', 'Sleeper_Points', 'Form', 'Owned_By',
        'opta_id', 'match_method', 'confidence', 'conversion_ratio'
      ];
      
      await sheet.setHeaderRow(headers);
      
      // Add player data
      const rows = players.map(player => ({
        Name: player.name || '',
        Position: player.position || '',
        Team: player.team || '',
        Ownership: player.ownership || '0%',
        Price: player.price || 0,
        FPL_Points: player.predicted_points || 0,
        Sleeper_Points: player.sleeper_points || 0,
        Form: player.form || '',
        Owned_By: player.owned_by || '',
        opta_id: player.opta_id || '',
        match_method: player.match_method || '',
        confidence: player.confidence || '',
        conversion_ratio: player.conversion_ratio || 1.0
      }));
      
      if (rows.length > 0) {
        await sheet.addRows(rows);
      }
      
      console.log(`Saved ${rows.length} players to Google Sheets`);
      return { success: true, count: rows.length };
    } catch (error) {
      console.error('Error saving to Google Sheets:', error);
      throw error;
    }
  }

  // Get match map for player matching persistence
  async getMatchMap() {
    try {
      const sheet = await this.getSheet('Match Map');
      const rows = await sheet.getRows();
      
      const matchMap = {};
      rows.forEach(row => {
        const sleeperKey = row.get('Sleeper_Key');
        const ffhKey = row.get('FFH_Key');
        if (sleeperKey && ffhKey) {
          matchMap[sleeperKey] = ffhKey;
        }
      });
      
      return matchMap;
    } catch (error) {
      console.error('Error fetching match map:', error);
      return {};
    }
  }

  // Save match map
  async saveMatchMap(matchMap) {
    try {
      const sheet = await this.getSheet('Match Map');
      await sheet.clear();
      
      await sheet.setHeaderRow(['Sleeper_Key', 'FFH_Key', 'Notes']);
      
      const rows = Object.entries(matchMap).map(([sleeperKey, ffhKey]) => ({
        Sleeper_Key: sleeperKey,
        FFH_Key: ffhKey,
        Notes: 'Auto-matched'
      }));
      
      if (rows.length > 0) {
        await sheet.addRows(rows);
      }
      
      console.log(`Saved ${rows.length} matches to Google Sheets`);
    } catch (error) {
      console.error('Error saving match map:', error);
      throw error;
    }
  }

  // Log diagnostics
  async logDiagnostics(diagnostics) {
    try {
      const sheet = await this.getSheet('Diagnostics');
      
      // Clear old diagnostics (keep last 1000 entries)
      const existingRows = await sheet.getRows();
      if (existingRows.length > 1000) {
        await sheet.clear();
        await sheet.setHeaderRow(['Timestamp', 'Sleeper_Player', 'FFH_Player', 'Method', 'Confidence', 'Score']);
      } else if (existingRows.length === 0) {
        await sheet.setHeaderRow(['Timestamp', 'Sleeper_Player', 'FFH_Player', 'Method', 'Confidence', 'Score']);
      }
      
      const rows = diagnostics.map(d => ({
        Timestamp: new Date().toISOString(),
        Sleeper_Player: d.sleeper || '',
        FFH_Player: d.ffh || '',
        Method: d.method || '',
        Confidence: d.confidence || '',
        Score: d.score || ''
      }));
      
      if (rows.length > 0) {
        await sheet.addRows(rows);
      }
      
      console.log(`Logged ${rows.length} diagnostics`);
    } catch (error) {
      console.error('Error logging diagnostics:', error);
    }
  }

  // Health check
  async healthCheck() {
    try {
      await this.initialize();
      return {
        success: true,
        sheetTitle: this.doc.title,
        sheetCount: this.doc.sheetCount,
        lastUpdated: new Date().toISOString()
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }
}

// Export singleton instance
export const googleSheetsService = new GoogleSheetsService();