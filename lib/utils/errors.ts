/** Maps Supabase and network errors to user-friendly messages. */
export function friendlyErrorMessage(error: { message: string; code?: string }): string {
  const msg = error.message.toLowerCase();

  if (error.code === 'P0002') {
    return 'This event no longer exists.';
  }
  if (error.code === 'P0003') {
    return 'This event is now full.';
  }
  if (error.code === 'P0004') {
    return 'You are not a participant of this event.';
  }
  if (error.code === 'P0005') {
    return "You can't cancel your spot within 12 hours of the event start.";
  }
  if (error.code === 'P0006') {
    return "As the host, you can't leave your own event — cancel the event instead.";
  }

  // create-payment-intent (Stripe paid-join, §4.7)
  if (error.code === 'EVENT_NOT_FOUND') {
    return 'This event no longer exists.';
  }
  if (error.code === 'EVENT_NOT_PAID') {
    return 'This event is free — no payment is needed.';
  }
  if (error.code === 'EVENT_CANCELLED') {
    return 'This event has been cancelled.';
  }
  if (error.code === 'EVENT_FULL') {
    return 'This event is now full.';
  }
  if (error.code === 'EVENT_PAST') {
    return 'This event has already started.';
  }
  if (error.code === 'USER_BLOCKED') {
    return "You can't join this event.";
  }

  // confirm-payment-join (Stripe paid-join, §4.7)
  if (error.code === 'PAYMENT_NOT_CONFIRMED') {
    return "We couldn't confirm your payment. If you were charged, you'll be refunded automatically.";
  }
  if (error.code === 'EVENT_FULL_REFUNDED') {
    return 'This event filled up before your spot was confirmed, so your payment was refunded.';
  }
  if (error.code === 'EVENT_CANCELLED_REFUNDED') {
    return 'The host cancelled this event, so your payment was refunded.';
  }
  if (error.code === 'REFUND_WINDOW_CLOSED') {
    return "You can't cancel your spot within 12 hours of the event start.";
  }
  if (error.code === 'CANCEL_WINDOW_CLOSED') {
    return "You can't cancel an event within 12 hours of its start.";
  }
  if (error.code === 'REFUND_FAILED') {
    return "Something went wrong and we couldn't refund you automatically. Please contact support.";
  }
  if (error.code === 'PAYMENT_DISPUTED') {
    return 'This payment is being disputed through your bank, so it cannot be cancelled here. Please contact support.';
  }
  if (msg.includes('jwt') || msg.includes('token')) {
    return 'Your session has expired. Please log in again.';
  }
  if (msg.includes('row-level security') || msg.includes('rls')) {
    return 'You do not have permission to perform this action.';
  }
  if (msg.includes('network') || msg.includes('fetch') || msg.includes('timeout')) {
    return 'Network error. Please check your internet connection and try again.';
  }
  if (error.code === '23505' && msg.includes('participants')) {
    return 'You have already joined this event.';
  }
  if (msg.includes('duplicate key') || error.code === '23505') {
    return 'This record already exists. Please refresh and try again.';
  }

  return 'Something went wrong. Please try again later.';
}

/** Reads a Supabase FunctionsHttpError's { code, message } body and maps it to friendly copy. */
export async function functionErrorMessage(err: any): Promise<string> {
  try {
    const body = await err.context.json();
    return friendlyErrorMessage({ message: body.message ?? '', code: body.code });
  } catch {
    return friendlyErrorMessage({ message: err?.message ?? '' });
  }
}
