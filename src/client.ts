import { isNativeError } from 'node:util/types';
import { version } from '../package.json';
import { ClientError, HttpRequestError, TimeoutError, ValidationError } from './utils/errors';

/**
 * Request configuration options
 */
export interface RequestConfig {
  /**
   * Request headers
   */
  headers?: Record<string, string>;

  /**
   * Request timeout in milliseconds
   */
  timeout?: number;

  /**
   * Query parameters
   */
  params?: Record<string, string>;
}

/**
 * Configuration options for the Lettermint client
 */
export interface LettermintClientConfig {
  /**
   * API token for authentication
   */
  apiToken: string;

  /**
   * Base URL for the API (optional, defaults to https://api.lettermint.co/v1)
   */
  baseUrl?: string;

  /**
   * Timeout in milliseconds (optional, defaults to 30000)
   */
  timeout?: number;
}

/**
 * Client for making HTTP requests to the Lettermint API
 */
export class LettermintClient {
  private readonly baseUrl: string;
  private readonly apiToken: string;
  private readonly timeout: number;
  private readonly defaultHeaders: Record<string, string>;

  /**
   * Create a new Lettermint client
   *
   * @param config Configuration options
   */
  constructor(config: LettermintClientConfig) {
    this.apiToken = config.apiToken;
    this.baseUrl = config.baseUrl || 'https://api.lettermint.co/v1';
    this.timeout = config.timeout || 30000;

    const nodeVersion = process.version.replace(/^v/, '');

    this.defaultHeaders = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'x-lettermint-token': this.apiToken,
      'User-Agent': `Lettermint/${version} (Node.js; Node ${nodeVersion})`,
    };
  }

  /**
   * Make a request to the API with timeout support
   *
   * @param url The full URL to request
   * @param options Fetch options
   * @returns Promise resolving to the response
   */
  private async fetchWithTimeout(url: string, options: RequestInit): Promise<Response> {
    const controller = new AbortController();
    const { signal } = controller;

    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(url, { ...options, signal });
      clearTimeout(timeoutId);

      if (!response.ok) {
        const responseBody = await response.json();

        if (response.status === 422) {
          const errorType = responseBody?.error || 'ValidationError';
          throw new ValidationError(`Validation error: ${errorType}`, errorType, responseBody);
        }

        // Handle 400 client errors
        if (response.status === 400) {
          throw new ClientError(
            `Client error: ${responseBody?.error || 'Unknown client error'}`,
            responseBody
          );
        }

        throw new HttpRequestError(
          `HTTP error ${response.status} ${response.statusText}`,
          response.status,
          responseBody
        );
      }

      return response;
    } catch (error) {
      clearTimeout(timeoutId);

      if (isNativeError(error) && error.name === 'AbortError') {
        throw new TimeoutError(`Request timeout after ${this.timeout}ms`);
      }

      throw error;
    }
  }

  /**
   * Build the full URL including query parameters
   *
   * @param path API endpoint path
   * @param params Query parameters
   * @returns The full URL
   */
  private buildUrl(path: string, params?: Record<string, string>): string {
    const pathSegment = path.startsWith('/') ? path.substring(1) : path;
    const effectiveBaseUrl = this.baseUrl.endsWith('/') ? this.baseUrl : `${this.baseUrl}/`;
    const url = new URL(pathSegment, effectiveBaseUrl);

    if (params) {
      for (const [key, value] of Object.entries(params)) {
        url.searchParams.append(key, value);
      }
    }

    return url.toString();
  }

  /**
   * Make a GET request to the API
   *
   * @param path API endpoint path
   * @param config Optional request configuration
   * @returns Promise resolving to the response data
   */
  public async get<T>(path: string, config?: RequestConfig): Promise<T> {
    const url = this.buildUrl(path, config?.params);

    const headers = {
      ...this.defaultHeaders,
      ...config?.headers,
    };

    const response = await this.fetchWithTimeout(url, {
      method: 'GET',
      headers,
    });

    return response.json();
  }

  /**
   * Make a POST request to the API
   *
   * @param path API endpoint path
   * @param data Request payload
   * @param config Optional request configuration
   * @returns Promise resolving to the response data
   */
  public async post<T>(path: string, data?: unknown, config?: RequestConfig): Promise<T> {
    const url = this.buildUrl(path, config?.params);

    const headers = {
      ...this.defaultHeaders,
      ...config?.headers,
    };

    const response = await this.fetchWithTimeout(url, {
      method: 'POST',
      headers,
      body: data ? JSON.stringify(data) : undefined,
    });

    return response.json();
  }

  /**
   * Make a PUT request to the API
   *
   * @param path API endpoint path
   * @param data Request payload
   * @param config Optional request configuration
   * @returns Promise resolving to the response data
   */
  public async put<T>(path: string, data?: unknown, config?: RequestConfig): Promise<T> {
    const url = this.buildUrl(path, config?.params);

    const headers = {
      ...this.defaultHeaders,
      ...config?.headers,
    };

    const response = await this.fetchWithTimeout(url, {
      method: 'PUT',
      headers,
      body: data ? JSON.stringify(data) : undefined,
    });

    return response.json();
  }

  /**
   * Make a DELETE request to the API
   *
   * @param path API endpoint path
   * @param config Optional request configuration
   * @returns Promise resolving to the response data
   */
  public async delete<T>(path: string, config?: RequestConfig): Promise<T> {
    const url = this.buildUrl(path, config?.params);

    const headers = {
      ...this.defaultHeaders,
      ...config?.headers,
    };

    const response = await this.fetchWithTimeout(url, {
      method: 'DELETE',
      headers,
    });

    return response.json();
  }
}
