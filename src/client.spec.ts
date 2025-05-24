import { LettermintClient } from './client';

const mockFetch = jest.fn();

describe('LettermintClient', () => {
  const apiToken = 'test-api-key';
  let client: LettermintClient;

  beforeEach(() => {
    jest.clearAllMocks();

    global.fetch = mockFetch;

    client = new LettermintClient({ apiToken });

    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({}),
    } as Response);
  });

  it('should initialize with default options', () => {
    // No need to test initialization directly since we're not creating an instance
    // of anything like Axios. Instead, we'll test the behavior in the HTTP method tests.
    expect(client).toBeInstanceOf(LettermintClient);
  });

  it('should initialize with custom options', () => {
    const customClient = new LettermintClient({
      apiToken,
      baseUrl: 'https://custom-api.example.com',
      timeout: 5000,
    });

    expect(customClient).toBeInstanceOf(LettermintClient);
  });

  it('should make a GET request', async () => {
    const mockData = { test: 'data' };
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockData,
    } as Response);

    const result = await client.get('/test');

    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.lettermint.co/v1/test',
      expect.objectContaining({
        method: 'GET',
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
          Accept: 'application/json',
          'x-lettermint-token': apiToken,
        }),
      })
    );
    expect(result).toEqual(mockData);
  });

  it('should make a GET request with query params', async () => {
    const mockData = { test: 'data' };
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockData,
    } as Response);

    const result = await client.get('/test', {
      params: {
        foo: 'bar',
      },
    });

    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.lettermint.co/v1/test?foo=bar',
      expect.objectContaining({
        method: 'GET',
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
          Accept: 'application/json',
          'x-lettermint-token': apiToken,
        }),
      })
    );
    expect(result).toEqual(mockData);
  });

  it('should make a POST request', async () => {
    const mockData = { id: '123' };
    const requestData = { name: 'Test' };
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockData,
    } as Response);

    const result = await client.post('/test', requestData);

    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.lettermint.co/v1/test',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
          Accept: 'application/json',
          'x-lettermint-token': apiToken,
        }),
        body: JSON.stringify(requestData),
      })
    );
    expect(result).toEqual(mockData);
  });

  it('should make a PUT request', async () => {
    const mockData = { updated: true };
    const requestData = { name: 'Updated Test' };
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockData,
    } as Response);

    const result = await client.put('/test/123', requestData);

    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.lettermint.co/v1/test/123',
      expect.objectContaining({
        method: 'PUT',
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
          Accept: 'application/json',
          'x-lettermint-token': apiToken,
        }),
        body: JSON.stringify(requestData),
      })
    );
    expect(result).toEqual(mockData);
  });

  it('should make a DELETE request', async () => {
    const mockData = { deleted: true };
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockData,
    } as Response);

    const result = await client.delete('/test/123');

    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.lettermint.co/v1/test/123',
      expect.objectContaining({
        method: 'DELETE',
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
          Accept: 'application/json',
          'x-lettermint-token': apiToken,
        }),
      })
    );
    expect(result).toEqual(mockData);
  });

  it('should use custom baseUrl', async () => {
    const customClient = new LettermintClient({
      apiToken,
      baseUrl: 'https://custom-api.example.com',
    });

    const mockData = { test: 'custom' };
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockData,
    } as Response);

    await customClient.get('/test');

    expect(mockFetch).toHaveBeenCalledWith(
      'https://custom-api.example.com/test',
      expect.any(Object)
    );
  });

  it('should handle HTTP errors', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 404,
      statusText: 'Not Found',
      json: async () => ({ message: 'Resource not found' }),
    } as Response);

    await expect(client.get('/not-found')).rejects.toThrow('HTTP error 404 Not Found');
  });

  it('should handle 422 validation errors', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 422,
      statusText: 'Unprocessable Entity',
      json: async () => ({ error: 'DailyLimitExceeded', message: 'Daily limit exceeded' }),
    } as Response);

    try {
      await client.post('/send', { to: 'test@example.com' });
      fail('Expected ValidationError to be thrown');
    } catch (error) {
      expect(error).toHaveProperty('name', 'ValidationError');
      expect(error).toHaveProperty('statusCode', 422);
      expect(error).toHaveProperty('errorType', 'DailyLimitExceeded');
      expect(error).toHaveProperty(
        'responseBody',
        expect.objectContaining({
          error: 'DailyLimitExceeded',
          message: 'Daily limit exceeded',
        })
      );
    }
  });

  it('should handle 400 client errors', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 400,
      statusText: 'Bad Request',
      json: async () => ({ error: 'InvalidRequest', message: 'Invalid request parameters' }),
    } as Response);

    try {
      await client.post('/send', { invalid: 'data' });
      fail('Expected ClientError to be thrown');
    } catch (error) {
      expect(error).toHaveProperty('name', 'ClientError');
      expect(error).toHaveProperty('statusCode', 400);
      expect(error).toHaveProperty(
        'responseBody',
        expect.objectContaining({
          error: 'InvalidRequest',
          message: 'Invalid request parameters',
        })
      );
    }
  });

  it('should handle timeout errors', async () => {
    const abortControllerMock = {
      abort: jest.fn(),
      signal: {},
    };

    // @ts-expect-error - Mock implementation
    global.AbortController = jest.fn(() => abortControllerMock);

    // Simulate timeout by rejecting with AbortError
    const abortError = new Error('The operation was aborted');
    abortError.name = 'AbortError';
    mockFetch.mockRejectedValueOnce(abortError);

    await expect(client.get('/timeout')).rejects.toThrow('Request timeout after 30000ms');
  });
});
