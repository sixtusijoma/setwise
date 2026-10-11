import { describe, expect, test } from '@jest/globals';

import { authErrorMessage, validateCredentials } from './messages';

describe('sign-in validation', () => {
  test('requires both fields, a real email, and 8 characters', () => {
    expect(validateCredentials('', '')).toBe('Enter your email and password.');
    expect(validateCredentials('ada@example.com', '')).toBe('Enter your email and password.');
    expect(validateCredentials('not-an-email', 'long-enough')).toBe('Enter a valid email address.');
    expect(validateCredentials('ada@example.com', 'short')).toBe('Use at least 8 characters.');
    expect(validateCredentials('  ada@example.com  ', 'long-enough')).toBeNull();
  });

  test('maps auth failures to the sign-in copy', () => {
    expect(authErrorMessage(new Error('Invalid login credentials'))).toBe(
      'Wrong email or password',
    );
    expect(authErrorMessage(new Error('User already registered'))).toBe(
      'An account with that email already exists. Sign in instead.',
    );
    expect(authErrorMessage(new Error('Email confirmation is required'))).toBe(
      'Check your email to confirm your account.',
    );
    expect(authErrorMessage(new Error('Failed to fetch'))).toBe(
      "Couldn't reach Setwise. Check your connection.",
    );
    expect(authErrorMessage(new Error('password should be at least 8 characters'))).toBe(
      'Use at least 8 characters.',
    );
    expect(authErrorMessage(new Error('unexpected'))).toBe('Something went wrong. Try again.');
  });
});
