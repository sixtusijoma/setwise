const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateCredentials(email: string, password: string): string | null {
  const trimmed = email.trim();
  if (!trimmed || !password) return 'Enter your email and password.';
  if (!EMAIL.test(trimmed)) return 'Enter a valid email address.';
  if (password.length < 8) return 'Use at least 8 characters.';
  return null;
}

export function authErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : '';
  const lower = message.toLowerCase();
  if (
    lower.includes('invalid login') ||
    lower.includes('invalid credentials') ||
    lower.includes('invalid_credentials')
  ) {
    return 'Wrong email or password';
  }
  if (
    lower.includes('already registered') ||
    lower.includes('already been registered') ||
    lower.includes('user already exists')
  ) {
    return 'An account with that email already exists. Sign in instead.';
  }
  if (lower.includes('confirmation')) return 'Check your email to confirm your account.';
  if (lower.includes('password') && (lower.includes('at least') || lower.includes('weak'))) {
    return 'Use at least 8 characters.';
  }
  if (lower.includes('rate limit') || lower.includes('too many')) {
    return 'Too many attempts. Wait a minute and try again.';
  }
  if (
    lower.includes('failed to fetch') ||
    lower.includes('network request failed') ||
    lower.includes('networkerror') ||
    lower.includes('load failed')
  ) {
    return "Couldn't reach Setwise. Check your connection.";
  }
  if (lower.includes('valid email') || lower.includes('unable to validate email')) {
    return 'Enter a valid email address.';
  }
  return 'Something went wrong. Try again.';
}
