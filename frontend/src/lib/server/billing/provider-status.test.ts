import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { __resetProviderSingleton } from '../payments/provider-singleton';
import { isBillingConfigured, isDevBillingFallbackEnabled } from './provider-status';

// The dev fallback grants Premium without a payment. It is the one place in
// this codebase where money can be bypassed, so its gate gets its own tests.

function configureBictorys() {
  vi.stubEnv('BICTORYS_API_URL', 'https://api.test.bictorys.example');
  vi.stubEnv('BICTORYS_API_KEY', 'test-key');
  vi.stubEnv('BICTORYS_WEBHOOK_SECRET', 'test-secret');
}
function unconfigureBictorys() {
  vi.stubEnv('BICTORYS_API_URL', '');
  vi.stubEnv('BICTORYS_API_KEY', '');
  vi.stubEnv('BICTORYS_WEBHOOK_SECRET', '');
}

beforeEach(() => {
  __resetProviderSingleton();
});
afterEach(() => {
  vi.unstubAllEnvs();
  __resetProviderSingleton();
});

describe('isBillingConfigured', () => {
  it('is false with no Bictorys credentials', () => {
    unconfigureBictorys();
    expect(isBillingConfigured()).toBe(false);
  });

  it('is true once the credentials are present', () => {
    configureBictorys();
    expect(isBillingConfigured()).toBe(true);
  });
});

describe('isDevBillingFallbackEnabled', () => {
  it('is open in development while no provider exists', () => {
    vi.stubEnv('NODE_ENV', 'development');
    unconfigureBictorys();
    expect(isDevBillingFallbackEnabled()).toBe(true);
  });

  it('CLOSES in production, even with no provider configured', () => {
    // The dangerous case: shipping a build that still hands out Premium.
    vi.stubEnv('NODE_ENV', 'production');
    unconfigureBictorys();
    expect(isDevBillingFallbackEnabled()).toBe(false);
  });

  it('CLOSES as soon as a real provider is configured, even in development', () => {
    // Self-removing: nobody has to remember to delete the hatch. The moment
    // real payments work, the free-Premium route stops existing.
    vi.stubEnv('NODE_ENV', 'development');
    configureBictorys();
    expect(isDevBillingFallbackEnabled()).toBe(false);
  });

  it('closes in production with a provider configured', () => {
    vi.stubEnv('NODE_ENV', 'production');
    configureBictorys();
    expect(isDevBillingFallbackEnabled()).toBe(false);
  });
});
