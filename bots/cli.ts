#!/usr/bin/env node
/**
 * Command Line Interface for the Grammy betting bot system
 * 
 * This script provides a CLI for starting, stopping, and monitoring
 * the bot system.
 */

import path from 'path';
import { program } from 'commander';
import { initialize, startSystem, stopSystem, getStatus, shutdown } from './orchestrator';

// Set up CLI commands
program
  .name('grammybots')
  .description('Grammy Betting Bot System')
  .version('1.0.0');

// Initialize command
program
  .command('init')
  .description('Initialize the bot system')
  .option('-d, --db <path>', 'Path to database file')
  .action(async (options) => {
    const dbPath = options.db || path.join(process.cwd(), 'gramshis.db');
    console.log(`Initializing bot system with database: ${dbPath}`);
    
    const success = await initialize(dbPath);
    if (success) {
      console.log('Bot system initialized successfully');
    } else {
      console.error('Failed to initialize bot system');
      process.exit(1);
    }
  });

// Start command
program
  .command('start')
  .description('Start the bot system')
  .option('-d, --db <path>', 'Path to database file')
  .option('-p, --period <ms>', 'Period between bets in milliseconds')
  .action(async (options) => {
    const dbPath = options.db || path.join(process.cwd(), 'gramshis.db');
    
    // Set period if provided
    if (options.period) {
      const { BOT_CONFIG } = await import('./config');
      BOT_CONFIG.PERIOD = parseInt(options.period);
    }
    
    // Initialize and start
    const success = await initialize(dbPath);
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
      console.error('Failed to initialize bot system');
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