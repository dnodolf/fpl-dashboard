// app/api/health/route.js
import { NextResponse } from 'next/server';
import { enhancedDataService } from '../../services/enhancedDataService';
import { cacheService } from '../../services/cacheService';

export async function GET() {
  try {
    console.log('Running system health check...');
    
    // Get comprehensive health check
    const health = await enhancedDataService.healthCheck();
    
    // Add cache statistics
    const cacheStats = cacheService.getStats();
    
    // Add environment check
    const envCheck = {
      hasFFHToken: !!process.env.FFH_BEARER_TOKEN,
      hasGoogleCreds: !!(process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL && process.env.GOOGLE_PRIVATE_KEY),
      hasSleeperConfig: !!process.env.SLEEPER_LEAGUE_ID,
      nodeEnv: process.env.NODE_ENV || 'unknown'
    };

    const overallStatus = health.overall === 'healthy' && 
                         envCheck.hasFFHToken && 
                         envCheck.hasSleeperConfig ? 'healthy' : 'degraded';

    const response = {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      services: health.checks,
      cache: {
        ...cacheStats,
        performance: cacheStats.totalEntries > 0 ? 'active' : 'empty'
      },
      environment: envCheck,
      version: process.env.NEXT_PUBLIC_APP_VERSION || '2.0.0'
    };

    const statusCode = overallStatus === 'healthy' ? 200 : 503;

    return NextResponse.json(response, { 
      status: statusCode,
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'X-Health-Status': overallStatus
      }
    });

  } catch (error) {
    console.error('Health check failed:', error);
    
    return NextResponse.json({
      status: 'error',
      timestamp: new Date().toISOString(),
      error: error.message,
      services: {
        sheets: { status: 'unknown', message: 'Health check failed' },
        ffh: { status: 'unknown', message: 'Health check failed' },
        cache: { status: 'unknown', message: 'Health check failed' }
      }
    }, { status: 503 });
  }
}