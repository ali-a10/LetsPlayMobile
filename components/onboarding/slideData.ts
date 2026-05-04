/** Static content for each onboarding carousel slide. */

export interface SlideData {
  kind: 'welcome' | 'step';
  step?: number;
  eyebrow: string;
  headline: string;
  body: string;
}

export const slides: SlideData[] = [
  {
    kind: 'welcome',
    eyebrow: 'WELCOME',
    headline: 'Pickup games, made simple',
    body: 'Find local sports events, join with a tap, and start playing.',
  },
  {
    kind: 'step',
    step: 1,
    eyebrow: 'STEP 1',
    headline: 'Discover games near you',
    body: 'Browse pickup games by sport, location, and time — all in one place.',
  },
  {
    kind: 'step',
    step: 2,
    eyebrow: 'STEP 2',
    headline: 'Join in — or host your own',
    body: 'See the details, check who\'s going, and join instantly. Or create your own game.',
  },
  {
    kind: 'step',
    step: 3,
    eyebrow: 'STEP 3',
    headline: 'Pay securely — or play for free',
    body: 'Payments are handled through Stripe. No-show protection keeps games fair.',
  },
  {
    kind: 'step',
    step: 4,
    eyebrow: 'STEP 4',
    headline: 'Track everything in one place',
    body: 'See your upcoming games, manage events you\'re hosting, and never miss a match.',
  },
];
