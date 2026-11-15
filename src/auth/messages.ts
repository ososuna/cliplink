// Better Auth returns to the sign-in page with `?error=<code>` when a Provider sign-in fails.
const messages: Record<string, string> = {
  access_denied: 'Sign-in was cancelled. Choose a Provider to try again.',
  account_not_linked:
    'This email is already signed up through another Provider, and this Provider has not verified it. Sign in with the Provider you used before, or verify your email with this Provider first.',
};

export function signInErrorMessage(code: string) {
  return messages[code] ?? 'Sign-in failed. Please try again.';
}
