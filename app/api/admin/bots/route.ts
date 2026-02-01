import { NextRequest, NextResponse } from 'next/server';
import { BotSystem } from '../../../../bots';
import { verifyAdminHeader } from '../../../../lib/auth/session';

/**
 * API route for controlling the bot system
 * Only accessible via admin secret key
 */
export async function GET(req: NextRequest) {
  if (!verifyAdminHeader(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }
  
  // Get status
  const status = BotSystem.getStatus();
  
  return NextResponse.json({ status });
}

export async function POST(req: NextRequest) {
  if (!verifyAdminHeader(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }
  
  try {
    const { action, options } = await req.json();
    
    switch (action) {
      case 'initialize':
        const initResult = await BotSystem.initialize();
        return NextResponse.json({ success: initResult });
        
      case 'start':
        const startResult = BotSystem.start();
        return NextResponse.json({ success: startResult });
        
      case 'stop':
        const stopResult = BotSystem.stop();
        return NextResponse.json({ success: stopResult });
        
      default:
        return NextResponse.json(
          { error: 'Invalid action', validActions: ['initialize', 'start', 'stop'] },
          { status: 400 }
        );
    }
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Failed to process request', message: error.message },
      { status: 500 }
    );
  }
}