#!/usr/bin/env node

import 'dotenv/config';
import { FastMCP } from 'fastmcp';
import { AnyListService } from './services/anylist-service.js';
import { registerListTools } from './tools/list-tools.js';
import { registerRecipeTools } from './tools/recipe-tools.js';
import { registerMealTools } from './tools/meal-tools.js';
import { authManager } from './utils/auth.js';
import type { AnyListConfig } from './types/index.js';

/**
 * AnyList MCP Server
 * 
 * Provides Model Context Protocol (MCP) tools for interacting with AnyList:
 * - List management (create, add items, check/uncheck, etc.)
 * - Recipe management (create, update, delete, import from URL)
 * - Meal planning (create events, assign recipes, weekly planning)
 */

async function main(): Promise<void> {
  // Get current date for logging
  const currentDate = new Date().toISOString().split('T')[0];

  // Environment variables with proper handling
  const email = process.env['ANYLIST_EMAIL'];
  const password = process.env['ANYLIST_PASSWORD'];
  const credentialsFile = process.env['ANYLIST_CREDENTIALS_FILE'] || '.anylist_credentials';

  // Validate required environment variables
  if (!email || !password) {
    console.error('Error: ANYLIST_EMAIL and ANYLIST_PASSWORD environment variables are required');
    process.exit(1);
  }

  const config: AnyListConfig = {
    email,
    password,
    credentialsFile,
  };

  // Test connection
  console.log(`[${currentDate}] Testing AnyList connection...`);
  const anylistService = new AnyListService(config);

  try {
    await anylistService.connect();
    console.log(`[${currentDate}] AnyList connection successful`);
  } catch (error) {
    console.error(`[${currentDate}] AnyList connection failed:`, error);
    process.exit(1);
  }

  // Create FastMCP server
  const server = new FastMCP({
    name: 'AnyList MCP Server',
    version: '1.0.0',
    instructions: 'MCP server for AnyList integration - manage grocery lists, recipes, and meal planning through natural language interactions.',
  });

  // Register all tools
  registerListTools(server, anylistService);
  registerRecipeTools(server, anylistService);
  registerMealTools(server, anylistService);

  // Start the server
  console.log(`[${currentDate}] Starting AnyList MCP server...`);

  try {
    await server.start({
      transportType: 'stdio',
    });
    console.log(`[${currentDate}] AnyList MCP server started successfully`);
  } catch (error) {
    console.error(`[${currentDate}] Failed to start server:`, error);
    process.exit(1);
  }

  // Graceful shutdown
  process.on('SIGINT', async () => {
    console.log(`[${currentDate}] Shutting down AnyList MCP server...`);
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    console.log(`[${currentDate}] Shutting down AnyList MCP server...`);
    process.exit(0);
  });
}

// Only run if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error: unknown) => {
    console.error('Fatal error starting server:', error);
    process.exit(1);
  });
} 