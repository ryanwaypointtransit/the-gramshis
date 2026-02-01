/**
 * Grammy Betting Bots - Main Entry Point
 * 
 * This module provides the API for starting, stopping, and monitoring
 * the bot system from other parts of the application.
 * 
 * NOTE: Bot system is currently disabled during Postgres migration.
 */

import { initialize, startSystem, stopSystem, getStatus, shutdown } from './orchestrator';

// Bot system API
export const BotSystem = {
  /**
   * Initialize the bot system
   */
  async initialize(): Promise<boolean> {
    return await initialize();
  },
  
  /**
   * Start the bot system
   */
  start(): boolean {
    return startSystem();
  },
  
  /**
   * Stop the bot system
   */
  stop(): boolean {
    return stopSystem();
  },
  
  /**
   * Get the current status of the bot system
   */
  getStatus(): ReturnType<typeof getStatus> {
    return getStatus();
  },
  
  /**
   * Shut down the bot system
   */
  shutdown(): void {
    return shutdown();
  }
};

// If this module is run directly, start the bot system
if (require.main === module) {
  (async () => {
    console.log('Initializing Grammy betting bots...');
    const success = await initialize();
    
    if (success) {
      console.log('Starting bot system...');
      startSystem();
      
      // Handle shutdown
      process.on('SIGINT', () => {
        console.log('Shutting down bot system...');
        shutdown();
        process.exit(0);
      });
    } else {
      console.error('Bot system is currently disabled during Postgres migration');
      process.exit(1);
    }
  })();
}
