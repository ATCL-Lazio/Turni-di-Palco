/**
 * Set to `true` before a `signInWithPassword` call used only for credential
 * verification (e.g. in `changePassword`). The `onAuthStateChange` listener
 * in `useAuth.ts` checks this flag and skips the SIGNED_IN navigation while
 * it is set, preventing the user from being redirected away mid-flow.
 * Must be reset to `false` immediately after the verification attempt completes.
 */
export let suppressSignedInNavigation = false;
export const setSuppressSignedInNavigation = (value: boolean) => {
  suppressSignedInNavigation = value;
};

export async function withSuppressSignedInNavigation<T>(
  operation: () => Promise<T> | T,
): Promise<T> {
  setSuppressSignedInNavigation(true);
  try {
    return await Promise.resolve(operation());
  } finally {
    setSuppressSignedInNavigation(false);
  }
}

export const ROLE_IDS = ['attore', 'luci', 'fonico', 'attrezzista', 'palco', 'rspp', 'dramaturg'] as const;
