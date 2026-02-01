/**
 * Grammy Betting Bots - Main Entry Point
 * 
 * This module provides the API for starting, stopping, and monitoring
 * the bot system from other parts of the application.
 */

import path from 'path';
import { initialize, startSystem, stopSystem, getStatus, shutdown } from './orchestrator';

// Bot system API
export const BotSystem = {
  /**
   * Initialize the bot system
   * @param dbPath Path to the database
   */
  async initialize(dbPath: string = path.join(process.cwd(), 'gramshis.db')): Promise<boolean> {
    return await initialize(dbPath);
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
  getStatus(): any {
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
      console.error('Failed to initialize bot system');
      process.exit(1);
    }
  })();
}