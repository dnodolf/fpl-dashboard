// app/api/ffh/debug/route.js
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const authStatic = process.env.FFH_AUTH_STATIC;
    const bearerToken = process.env.FFH_BEARER_TOKEN;
    
    // Check if environment variables exist
    const envCheck = {
      hasAuthStatic: !!authStatic,
      hasBearer: !!bearerToken,
      authStaticLength: authStatic ? authStatic.length : 0,
      bearerLength: bearerToken ? bearerToken.length : 0,
      bearerPrefix: bearerToken ? bearerToken.substring(0, 20) + '...' : 'missing'
    };
    
    // Test a simple FFH API call
    let testResult = { status: 'not tested', error: null };
    
    if (authStatic && bearerToken) {
      try {
        const testUrl = 'https://data.fantasyfootballhub.co.uk/api/player-predictions/?first=0&last=1';
        const response = await fetch(testUrl, {
          method: 'GET',
          headers: {
            'Accept-Language': 'en-US',
            'Authorization': authStatic,
            'Content-Type': 'application/json',
            'Token': bearerToken
          }
        });
        
        testResult = {
          status: response.status,
          statusText: response.statusText,
          ok: response.ok,
          headers: Object.fromEntries(response.headers.entries())
        };
        
        if (response.ok) {
          const data = await response.json();
          testResult.dataReceived = !!data;
          testResult.resultsCount = data.results ? data.results.length : 0;
        } else {
          const errorText = await response.text();
          testResult.errorBody = errorText.substring(0, 200);
        }
        
      } catch (fetchError) {
        testResult = {
          status: 'fetch_error',
          error: fetchError.message
        };
      }
    }
    
    return NextResponse.json({
      environment: envCheck,
      testResult,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    return NextResponse.json({
      error: error.message,
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}