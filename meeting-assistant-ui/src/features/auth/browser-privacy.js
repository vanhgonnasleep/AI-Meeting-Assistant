// Discard credentials/preferences left by the former single-user connector UI.
export function discardLegacyConnectorSettings(storage) {
  try {
    const target = storage || (typeof window === 'undefined' ? null : window.localStorage);
    target?.removeItem('ma_github_token');
    target?.removeItem('ma_github_repo');
  } catch {
    // Storage may be unavailable; connector credentials are memory-only now.
  }
}
