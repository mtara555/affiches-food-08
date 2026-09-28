export function useRegisterSW() {
  return { needRefresh: [false, () => undefined], offlineReady: [false, () => undefined], updateServiceWorker: async () => undefined };
}
