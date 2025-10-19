import { NextResponse } from 'next/server';

/**
 * API endpoint to expose relevant configuration settings to the client
 */
export async function GET() {
  return NextResponse.json({
    coverGenerationEnabled: process.env.ENABLE_COVER_GENERATION === 'true',
  });
}

