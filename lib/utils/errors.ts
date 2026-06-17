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
