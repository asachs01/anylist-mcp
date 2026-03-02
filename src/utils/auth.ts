import { UserError } from 'fastmcp';
import { configManager, type AnyListConfig } from './config.js';

export interface AuthenticationResult {
  isAuthenticated: boolean;
  config: AnyListConfig;
  error?: string;
}

export interface AuthenticationOptions {
  email?: string;
  password?: string;
  credentialsFile?: string;
  saveCredentials?: boolean;
}

export class AuthenticationManager {
  private static instance: AuthenticationManager;
  private isAuthenticated = false;
  private currentConfig: AnyListConfig | null = null;
  private authPromise: Promise<AuthenticationResult> | null = null;

  private constructor() {}

  static getInstance(): AuthenticationManager {
    if (!AuthenticationManager.instance) {
      AuthenticationManager.instance = new AuthenticationManager();
    }
    return AuthenticationManager.instance;
  }

  /**
   * Authenticate with AnyList using various credential sources
   */
  async authenticate(options: AuthenticationOptions = {}): Promise<AuthenticationResult> {
    // Return existing authentication if already in progress
    if (this.authPromise) {
      return this.authPromise;
    }

    // Return cached authentication if already authenticated
    if (this.isAuthenticated && this.currentConfig) {
      return {
        isAuthenticated: true,
        config: this.currentConfig,
      };
    }

    this.authPromise = this._authenticate(options);
    return this.authPromise;
  }

  private async _authenticate(options: AuthenticationOptions): Promise<AuthenticationResult> {
    try {
      // Load configuration from all sources
      const config = await configManager.loadConfig({
        email: options.email,
        password: options.password,
        credentialsFile: options.credentialsFile,
      });

      // Validate that we have required credentials
      if (!config.email || !config.password) {
        throw new UserError('Email and password are required for authentication');
      }

      // Save credentials if requested
      if (options.saveCredentials && options.email && options.password) {
        await configManager.saveCredentials(
          { email: options.email, password: options.password },
          options.credentialsFile
        );
      }

      // Store successful authentication
      this.isAuthenticated = true;
      this.currentConfig = config;
      this.authPromise = null;

      return {
        isAuthenticated: true,
        config,
      };
    } catch (error) {
      this.isAuthenticated = false;
      this.currentConfig = null;
      this.authPromise = null;

      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        isAuthenticated: false,
        config: {} as AnyListConfig,
        error: errorMessage,
      };
    }
  }

  /**
   * Check if currently authenticated
   */
  isAuthenticatedSync(): boolean {
    return this.isAuthenticated;
  }

  /**
   * Get current authentication configuration
   */
  getCurrentConfig(): AnyListConfig | null {
    return this.currentConfig;
  }

  /**
   * Clear authentication state
   */
  clearAuthentication(): void {
    this.isAuthenticated = false;
    this.currentConfig = null;
    this.authPromise = null;
    configManager.clearConfig();
  }

  /**
   * Refresh authentication with current or new credentials
   */
  async refreshAuthentication(options: AuthenticationOptions = {}): Promise<AuthenticationResult> {
    this.clearAuthentication();
    return this.authenticate(options);
  }

  /**
   * Get authentication status with detailed information
   */
  getAuthenticationStatus(): {
    isAuthenticated: boolean;
    hasCredentialsFile: boolean;
    hasEnvironmentVars: boolean;
    configSource: string;
  } {
    const hasCredentialsFile = configManager.credentialsFileExists();
    const hasEnvironmentVars = !!(process.env.ANYLIST_EMAIL && process.env.ANYLIST_PASSWORD);
    
    let configSource = 'none';
    if (this.currentConfig) {
      if (hasEnvironmentVars) {
        configSource = 'environment';
      } else if (hasCredentialsFile) {
        configSource = 'credentials_file';
      } else {
        configSource = 'runtime';
      }
    }

    return {
      isAuthenticated: this.isAuthenticated,
      hasCredentialsFile,
      hasEnvironmentVars,
      configSource,
    };
  }

  /**
   * Validate credentials without saving authentication state
   */
  async validateCredentials(email: string, password: string): Promise<{ isValid: boolean; error?: string }> {
    try {
      const config = configManager.validateConfig({ email, password });
      return { isValid: true };
    } catch (error) {
      return {
        isValid: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }
}

/**
 * Singleton instance for easy access
 */
export const authManager = AuthenticationManager.getInstance();