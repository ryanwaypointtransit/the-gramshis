#!/usr/bin/env node
/**
 * Command Line Interface for the Grammy betting bot system
 * 
 * NOTE: Bot system is currently disabled during Postgres migration.
 */

import { Command } from 'commander';

const program = new Command();
import { initialize, startSystem, stopSystem, getStatus, shutdown } from './orchestrator';

// Set up CLI commands
program
  .name('grammybots')
  .description('Grammy Betting Bot System (currently disabled during Postgres migration)')
  .version('1.0.0');

// Initialize command
program
  .command('init')
  .description('Initialize the bot system (currently disabled)')
  .action(async () => {
    console.log('Initializing bot system...');
    
    const success = await initialize();
    if (success) {
      console.log('Bot system initialized successfully');
    } else {
      console.log('Bot system is currently disabled during Postgres migration');
      process.exit(1);
    }
  });

// Start command
program
  .command('start')
  .description('Start the bot system (currently disabled)')
  .action(async () => {
    // Initialize and start
    const success = await initialize();
    if (success) {
      startSystem();
      console.log('Bot system started');
      
      // Keep process alive
      process.stdin.resume();
      
      // Handle shutdown
      process.on('SIGINT', () => {
        console.log('\nStopping bot system...');
        shutdown();
        process.exit(0);
      });
    } else {
      console.log('Bot system is currently disabled during Postgres migration');
      process.exit(1);
    }
  });

// Stop command
program
  .command('stop')
  .description('Stop the bot system')
  .action(() => {
    const success = stopSystem();
    if (success) {
      console.log('Bot system stopped');
    } else {
      console.error('Bot system is not running');
    }
  });

// Status command
program
  .command('status')
  .description('Get the status of the bot system')
  .action(() => {
    const status = getStatus();
    console.log('Bot system status:');
    console.log(JSON.stringify(status, null, 2));
  });

// Parse arguments
program.parse(process.argv);

// If no command is provided, show help
if (!process.argv.slice(2).length) {
  program.outputHelp();
}
