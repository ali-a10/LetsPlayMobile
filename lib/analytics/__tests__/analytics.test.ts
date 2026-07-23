// Factory mock so jest never loads the real native-dependent module.
jest.mock('posthog-react-native', () => jest.fn());

import {
  track,
  identifyUser,
  resetAnalytics,
  _setClientForTesting,
} from '../index';

/** Builds a fake PostHog client whose methods are jest spies. */
function makeFakeClient() {
  return {
    capture: jest.fn(),
    identify: jest.fn(),
    reset: jest.fn(),
  };
}

afterEach(() => {
  _setClientForTesting(null);
  jest.clearAllMocks();
});

describe('analytics wrapper', () => {
  it('track is a silent no-op when no client is initialized', () => {
    expect(() =>
      track('share_tapped', { event_id: 'e1', sport: 'soccer' })
    ).not.toThrow();
  });

  it('track forwards event name and properties to the client', () => {
    const fake = makeFakeClient();
    _setClientForTesting(fake as never);
    track('event_join_confirmed', { event_id: 'e1', is_paid: false });
    expect(fake.capture).toHaveBeenCalledWith('event_join_confirmed', {
      event_id: 'e1',
      is_paid: false,
    });
  });

  it('identifyUser forwards the user id', () => {
    const fake = makeFakeClient();
    _setClientForTesting(fake as never);
    identifyUser('user-123');
    expect(fake.identify).toHaveBeenCalledWith('user-123');
  });

  it('resetAnalytics resets the client', () => {
    const fake = makeFakeClient();
    _setClientForTesting(fake as never);
    resetAnalytics();
    expect(fake.reset).toHaveBeenCalled();
  });

  it('identify and reset are silent no-ops without a client', () => {
    expect(() => identifyUser('user-123')).not.toThrow();
    expect(() => resetAnalytics()).not.toThrow();
  });
});
