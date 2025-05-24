import { EmailEndpoint, Lettermint, LettermintClient } from '.';

jest.mock('./client');
jest.mock('./endpoints/email');

describe('Lettermint', () => {
  const apiToken = 'test-api-key';
  let lettermint: Lettermint;

  beforeEach(() => {
    jest.clearAllMocks();

    lettermint = new Lettermint({ apiToken });
  });

  it('should initialize with the provided API token', () => {
    // Verify that LettermintClient was initialized with the correct config
    expect(LettermintClient).toHaveBeenCalledWith({ apiToken });
  });

  it('should initialize with custom options', () => {
    const config = {
      apiToken,
      baseUrl: 'https://custom-api.example.com',
      timeout: 5000,
    };

    const customLettermint = new Lettermint(config);

    // Verify that LettermintClient was initialized with the correct config
    expect(LettermintClient).toHaveBeenCalledWith(config);
  });

  it('should initialize the email endpoint', () => {
    // Verify that EmailEndpoint was initialized with the client
    expect(EmailEndpoint).toHaveBeenCalledWith(expect.any(LettermintClient));

    // Verify that the email property is an instance of EmailEndpoint
    expect(lettermint.email).toBeInstanceOf(EmailEndpoint);
  });
});
