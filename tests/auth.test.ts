import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { join } from 'path';
import { existsSync, unlinkSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { ConfigurationManager } from '../src/utils/config.js';
import { AuthenticationManager } from '../src/utils/auth.js';
import { CredentialsManager } from '../src/utils/credentials.js';

describe('Authentication System', () => {
  let configManager: ConfigurationManager;
  let authManager: AuthenticationManager;
  let credentialsManager: CredentialsManager;
  let testCredentialsFile: string;

  beforeEach(() => {
    configManager = ConfigurationManager.getInstance();
    authManager = AuthenticationManager.getInstance();
    credentialsManager = CredentialsManager.getInstance();
    testCredentialsFile = join(tmpdir(), `test_anylist_credentials_${Date.now()}`);
    
    // Clear any cached state
    configManager.clearConfig();
    authManager.clearAuthentication();
  });

  afterEach(() => {
    // Clean up test credentials file
    if (existsSync(testCredentialsFile)) {
      unlinkSync(testCredentialsFile);
    }
    
    // Clear environment variables
    delete process.env.ANYLIST_EMAIL;
    delete process.env.ANYLIST_PASSWORD;
    delete process.env.ANYLIST_CREDENTIALS_FILE;
  });

  describe('ConfigurationManager', () => {
    it('should validate valid configuration', () => {
      const validConfig = {
        email: 'test@example.com',
        password: 'password123',
        timeout: 30000,
        retryAttempts: 3,
        retryDelay: 1000,
      };

      expect(() => configManager.validateConfig(validConfig)).not.toThrow();
    });

    it('should reject invalid email', () => {
      const invalidConfig = {
        email: 'invalid-email',
        password: 'password123',
      };

      expect(() => configManager.validateConfig(invalidConfig)).toThrow('Invalid email address');
    });

    it('should reject missing password', () => {
      const invalidConfig = {
        email: 'test@example.com',
        password: '',
      };

      expect(() => configManager.validateConfig(invalidConfig)).toThrow('Password is required');
    });

    it('should load configuration from environment variables', async () => {
      process.env.ANYLIST_EMAIL = 'env@example.com';
      process.env.ANYLIST_PASSWORD = 'envpassword';

      const config = await configManager.loadConfig();

      expect(config.email).toBe('env@example.com');
      expect(config.password).toBe('envpassword');
    });

    it('should load configuration from credentials file', async () => {
      const credentialsData = {
        email: 'file@example.com',
        password: 'filepassword',
      };

      writeFileSync(testCredentialsFile, JSON.stringify(credentialsData));

      const config = await configManager.loadConfig({
        credentialsFile: testCredentialsFile,
      });

      expect(config.email).toBe('file@example.com');
      expect(config.password).toBe('filepassword');
    });

    it('should prioritize passed options over environment variables', async () => {
      process.env.ANYLIST_EMAIL = 'env@example.com';
      process.env.ANYLIST_PASSWORD = 'envpassword';

      const config = await configManager.loadConfig({
        email: 'override@example.com',
        password: 'overridepassword',
      });

      expect(config.email).toBe('override@example.com');
      expect(config.password).toBe('overridepassword');
    });
  });

  describe('CredentialsManager', () => {
    it('should save and load credentials', async () => {
      const credentials = {
        email: 'test@example.com',
        password: 'testpassword',
      };

      await credentialsManager.saveCredentials(credentials, {
        filePath: testCredentialsFile,
      });

      expect(existsSync(testCredentialsFile)).toBe(true);

      const loaded = await credentialsManager.loadCredentials({
        filePath: testCredentialsFile,
      });

      expect(loaded?.email).toBe(credentials.email);
      expect(loaded?.password).toBe(credentials.password);
      expect(loaded?.timestamp).toBeDefined();
    });

    it('should validate credentials on save', async () => {
      const invalidCredentials = {
        email: 'invalid-email',
        password: 'password',
      };

      await expect(
        credentialsManager.saveCredentials(invalidCredentials, {
          filePath: testCredentialsFile,
        })
      ).rejects.toThrow('Invalid email format');
    });

    it('should handle missing credentials file gracefully', async () => {
      const loaded = await credentialsManager.loadCredentials({
        filePath: '/nonexistent/file',
      });

      expect(loaded).toBeNull();
    });

    it('should update existing credentials', async () => {
      const initialCredentials = {
        email: 'initial@example.com',
        password: 'initialpassword',
      };

      await credentialsManager.saveCredentials(initialCredentials, {
        filePath: testCredentialsFile,
      });

      await credentialsManager.updateCredentials(
        { email: 'updated@example.com' },
        { filePath: testCredentialsFile }
      );

      const loaded = await credentialsManager.loadCredentials({
        filePath: testCredentialsFile,
      });

      expect(loaded?.email).toBe('updated@example.com');
      expect(loaded?.password).toBe('initialpassword');
    });

    it('should verify credentials file exists', () => {
      expect(credentialsManager.credentialsExist(testCredentialsFile)).toBe(false);

      writeFileSync(testCredentialsFile, JSON.stringify({ email: 'test@example.com', password: 'password' }));

      expect(credentialsManager.credentialsExist(testCredentialsFile)).toBe(true);
    });

    it('should remove credentials file', async () => {
      writeFileSync(testCredentialsFile, JSON.stringify({ email: 'test@example.com', password: 'password' }));

      expect(existsSync(testCredentialsFile)).toBe(true);

      await credentialsManager.removeCredentials(testCredentialsFile);

      expect(existsSync(testCredentialsFile)).toBe(false);
    });
  });

  describe('AuthenticationManager', () => {
    it('should authenticate with valid credentials', async () => {
      const authResult = await authManager.authenticate({
        email: 'test@example.com',
        password: 'testpassword',
      });

      expect(authResult.isAuthenticated).toBe(true);
      expect(authResult.config.email).toBe('test@example.com');
      expect(authResult.config.password).toBe('testpassword');
    });

    it('should fail authentication with missing credentials', async () => {
      const authResult = await authManager.authenticate({});

      expect(authResult.isAuthenticated).toBe(false);
      expect(authResult.error).toContain('Invalid configuration');
    });

    it('should validate credentials without authentication', async () => {
      const validation = await authManager.validateCredentials('test@example.com', 'password');

      expect(validation.isValid).toBe(true);
    });

    it('should reject invalid email in validation', async () => {
      const validation = await authManager.validateCredentials('invalid-email', 'password');

      expect(validation.isValid).toBe(false);
      expect(validation.error).toContain('Invalid email address');
    });

    it('should provide authentication status', async () => {
      // Mock credentialsFileExists to avoid depending on local machine state
      vi.spyOn(configManager, 'credentialsFileExists').mockReturnValue(false);

      // Initially not authenticated
      let status = authManager.getAuthenticationStatus();
      expect(status.isAuthenticated).toBe(false);

      // Authenticate
      await authManager.authenticate({
        email: 'test@example.com',
        password: 'testpassword',
      });

      // Now authenticated
      status = authManager.getAuthenticationStatus();
      expect(status.isAuthenticated).toBe(true);
      expect(status.configSource).toBe('runtime');
    });

    it('should clear authentication', async () => {
      await authManager.authenticate({
        email: 'test@example.com',
        password: 'testpassword',
      });

      expect(authManager.isAuthenticatedSync()).toBe(true);

      authManager.clearAuthentication();

      expect(authManager.isAuthenticatedSync()).toBe(false);
      expect(authManager.getCurrentConfig()).toBeNull();
    });

    it('should refresh authentication', async () => {
      // Initial authentication
      await authManager.authenticate({
        email: 'test1@example.com',
        password: 'password1',
      });

      let config = authManager.getCurrentConfig();
      expect(config?.email).toBe('test1@example.com');

      // Refresh with new credentials
      const refreshResult = await authManager.refreshAuthentication({
        email: 'test2@example.com',
        password: 'password2',
      });

      expect(refreshResult.isAuthenticated).toBe(true);
      
      config = authManager.getCurrentConfig();
      expect(config?.email).toBe('test2@example.com');
    });

    it('should detect environment variables', async () => {
      process.env.ANYLIST_EMAIL = 'env@example.com';
      process.env.ANYLIST_PASSWORD = 'envpassword';

      const status = authManager.getAuthenticationStatus();
      expect(status.hasEnvironmentVars).toBe(true);
    });

    it('should detect credentials file', async () => {
      // Mock the default credentials file check so it doesn't depend on local machine
      vi.spyOn(configManager, 'credentialsFileExists').mockReturnValue(false);

      const credentials = {
        email: 'file@example.com',
        password: 'filepassword',
      };

      await credentialsManager.saveCredentials(credentials, {
        filePath: testCredentialsFile,
      });

      // The default location check returns false (mocked)
      const status = authManager.getAuthenticationStatus();
      expect(status.hasCredentialsFile).toBe(false);

      // But the credentials manager should detect it at the custom path
      expect(credentialsManager.credentialsExist(testCredentialsFile)).toBe(true);
    });
  });

  describe('Integration Tests', () => {
    it('should handle complete authentication flow', async () => {
      const credentials = {
        email: 'integration@example.com',
        password: 'integrationpassword',
      };

      // 1. Save credentials to file
      await credentialsManager.saveCredentials(credentials, {
        filePath: testCredentialsFile,
      });

      // 2. Authenticate using the file
      const authResult = await authManager.authenticate({
        credentialsFile: testCredentialsFile,
      });

      expect(authResult.isAuthenticated).toBe(true);
      expect(authResult.config.email).toBe(credentials.email);

      // 3. Check status
      const status = authManager.getAuthenticationStatus();
      expect(status.isAuthenticated).toBe(true);

      // 4. Clear authentication
      authManager.clearAuthentication();
      expect(authManager.isAuthenticatedSync()).toBe(false);

      // 5. Re-authenticate should work
      const reAuthResult = await authManager.authenticate({
        credentialsFile: testCredentialsFile,
      });
      expect(reAuthResult.isAuthenticated).toBe(true);
    });
  });
});