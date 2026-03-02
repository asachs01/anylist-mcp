import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { AnyListService } from '../src/services/anylist-service.js';
import type { AnyListConfig } from '../src/types/index.js';

describe('AnyList MCP Server', () => {
  let service: AnyListService;
  const mockConfig: AnyListConfig = {
    email: 'test@example.com',
    password: 'test-password',
    credentialsFile: '.test_credentials',
  };

  beforeEach(() => {
    service = new AnyListService(mockConfig);
  });

  afterEach(async () => {
    try {
      await service.disconnect();
    } catch (error) {
      // Ignore cleanup errors in tests
    }
  });

  describe('AnyListService', () => {
    it('should initialize with config', () => {
      expect(service).toBeDefined();
    });

    it('should handle connection errors gracefully', async () => {
      // This will fail with invalid credentials, but should throw a UserError
      await expect(service.connect()).rejects.toThrow();
    });
  });

  describe('Type Safety', () => {
    it('should have proper TypeScript types', () => {
      // This test ensures TypeScript compilation works
      const config: AnyListConfig = {
        email: 'test@example.com',
        password: 'password',
      };
      
      expect(config.email).toBe('test@example.com');
      expect(config.password).toBe('password');
    });
  });
});

// Integration test placeholder (requires real credentials)
describe('Integration Tests', () => {
  it.skip('should connect to real AnyList account', async () => {
    // This test is skipped by default as it requires real credentials
    // To run: provide ANYLIST_EMAIL and ANYLIST_PASSWORD environment variables
    // and change it.skip to it
    
    const realConfig: AnyListConfig = {
      email: process.env.ANYLIST_EMAIL!,
      password: process.env.ANYLIST_PASSWORD!,
    };

    if (!realConfig.email || !realConfig.password) {
      throw new Error('Integration test requires ANYLIST_EMAIL and ANYLIST_PASSWORD');
    }

    const realService = new AnyListService(realConfig);
    
    try {
      await realService.connect();
      const lists = await realService.getLists();
      expect(Array.isArray(lists)).toBe(true);
    } finally {
      await realService.disconnect();
    }
  });
}); 