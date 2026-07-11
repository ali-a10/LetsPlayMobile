import {
  joinedCopy,
  leftCopy,
  eventCancelledCopy,
  refundProcessedCopy,
  payoutSentCopy,
  accountProblemCopy,
  disputeCopy,
  transferReversedCopy,
  reminder24Copy,
  hostReminder24Copy,
  reminder2Copy,
  postEventNudgeCopy,
} from '../../../supabase/functions/_shared/messages';

describe('push notification copy', () => {
  it('joinedCopy names the joiner, event, and spot count', () => {
    expect(joinedCopy('Sarah', 'Sunday Basketball', 6, 10)).toEqual({
      title: 'Sarah joined Sunday Basketball',
      body: '6 of 10 spots are now filled.',
    });
  });

  it('leftCopy names the leaver, event, and spot count', () => {
    expect(leftCopy('Sarah', 'Sunday Basketball', 5, 10)).toEqual({
      title: 'Sarah left Sunday Basketball',
      body: '5 of 10 spots are now filled.',
    });
  });

  it('eventCancelledCopy mentions the refund only for paid events', () => {
    expect(eventCancelledCopy('Sunday Basketball', true)).toEqual({
      title: 'Sunday Basketball was cancelled',
      body: 'The host cancelled this event. Your refund is on its way.',
    });
    expect(eventCancelledCopy('Sunday Basketball', false)).toEqual({
      title: 'Sunday Basketball was cancelled',
      body: 'The host cancelled this event.',
    });
  });

  it('refundProcessedCopy never contains a dollar sign', () => {
    const copy = refundProcessedCopy('Sunday Basketball');
    expect(copy.title).toBe('Refund processed');
    expect(copy.body).toBe(
      'Your refund for Sunday Basketball has been issued. It can take 5–10 business days to appear on your statement.'
    );
    expect(copy.title + copy.body).not.toContain('$');
  });

  it('payoutSentCopy never contains a dollar sign', () => {
    const copy = payoutSentCopy('Sunday Basketball');
    expect(copy).toEqual({
      title: 'Payout sent',
      body: 'Your earnings for Sunday Basketball are on their way to your bank.',
    });
    expect(copy.title + copy.body).not.toContain('$');
  });

  it('accountProblemCopy points at the Payouts screen', () => {
    expect(accountProblemCopy()).toEqual({
      title: 'Action needed for payouts',
      body: 'Stripe needs more information to keep sending your payouts. Open Payouts to fix it.',
    });
  });

  it('disputeCopy names the event', () => {
    expect(disputeCopy('Sunday Basketball')).toEqual({
      title: 'Payment disputed',
      body: "A payment for Sunday Basketball was disputed. That payout is on hold while it's reviewed.",
    });
  });

  it('transferReversedCopy names the event', () => {
    expect(transferReversedCopy('Sunday Basketball')).toEqual({
      title: 'Payout reversed',
      body: 'A payout for Sunday Basketball was reversed. Check the Payouts screen for details.',
    });
  });

  it('reminder copy contains no clock times', () => {
    expect(reminder24Copy('Sunday Basketball', 'Central Park Court 2')).toEqual({
      title: 'Sunday Basketball is tomorrow',
      body: 'See you at Central Park Court 2!',
    });
    expect(reminder2Copy('Sunday Basketball', 'Central Park Court 2')).toEqual({
      title: 'Sunday Basketball starts in about 2 hours',
      body: 'See you at Central Park Court 2!',
    });
  });

  it('hostReminder24Copy pluralizes correctly', () => {
    expect(hostReminder24Copy('Sunday Basketball', 1).body).toBe('1 person has joined so far.');
    expect(hostReminder24Copy('Sunday Basketball', 8)).toEqual({
      title: "You're hosting Sunday Basketball tomorrow",
      body: '8 people have joined so far.',
    });
  });

  it('postEventNudgeCopy asks about the event', () => {
    expect(postEventNudgeCopy('Sunday Basketball')).toEqual({
      title: 'How was Sunday Basketball?',
      body: 'Check your past events in My Events.',
    });
  });
});
