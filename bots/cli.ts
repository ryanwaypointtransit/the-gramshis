#!/usr/bin/env node
/**
 * Command Line Interface for the Grammy betting bot system
 */

import { Command } from 'commander';

const program = new Command();
import { initialize, startSystem, stopSystem, getStatus, shutdown, runBotTick } from './orchestrator';

// Set up CLI commands
program
  .name('grammybots')
  .description('Grammy Betting Bot System')
  .version('1.0.0');

// Initialize command
program
  .command('init')
  .description('Initialize the bot system')
  .action(async () => {
    console.log('Initializing bot system...');
    
    const success = await initialize();
    
    if (success) {
      console.log('Bot system initialized successfully');
    } else {
      console.log('Bot system initialization failed. Make sure the server is running.');
      process.exit(1);
    }
  });

// Start command
program
  .command('start')
  .description('Start the bot system')
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
      console.log('Bot system initialization failed. Make sure the server is running.');
      process.exit(1);
    }
  });

// Tick command - run a single tick for testing
program
  .command('tick')
  .description('Run a single bot tick (for testing)')
  .option('-n, --count <number>', 'Number of ticks to run', '1')
  .action(async (options) => {
    console.log('Running bot tick(s)...');
    
    const success = await initialize();
    if (!success) {
      console.log('Bot system initialization failed. Make sure the server is running.');
      process.exit(1);
    }
    
    const count = parseInt(options.count) || 1;
    for (let i = 0; i < count; i++) {
      console.log(`\n--- Tick ${i + 1}/${count} ---`);
      await runBotTick(true);
      
      // Small delay between ticks
      if (i < count - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    console.log('\nTick(s) completed');
    process.exit(0);
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
