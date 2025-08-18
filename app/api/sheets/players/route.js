// app/api/sheets/players/route.js
import { NextResponse } from 'next/server';
import { googleSheetsService } from '../../../services/googleSheetsService';

export async function GET() {
  try {
    const players = await googleSheetsService.getPlayerData();
    
    return NextResponse.json({
      success: true,
      players,
      count: players.length,
      lastUpdated: new Date().toISOString()
    });
  } catch (error) {
    console.error('Sheets API error:', error);
    
    return NextResponse.json({
      success: false,
      error: error.message,
      players: []
    }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const { players } = await request.json();
    
    if (!Array.isArray(players)) {
      return NextResponse.json({
        success: false,
        error: 'Players data must be an array'
      }, { status: 400 });
    }
    
    const result = await googleSheetsService.savePlayerData(players);
    
    return NextResponse.json({
      success: true,
      message: `Saved ${result.count} players to Google Sheets`,
      count: result.count
    });
  } catch (error) {
    console.error('Save players error:', error);
    
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}

// Health check endpoint
export async function HEAD() {
  try {
    const health = await googleSheetsService.healthCheck();
    
    if (health.success) {
      return new NextResponse(null, { status: 200 });
    } else {
      return new NextResponse(null, { status: 503 });
    }
  } catch (error) {
    return new NextResponse(null, { status: 503 });
  }
}