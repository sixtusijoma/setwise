import { getRepo } from '../../data/repo';

declare global {
  interface Window {
    __setwise?: {
      getRepo: typeof getRepo;
    };
  }
}

let installed = false;

export function installTestBridge() {
  if (installed || typeof window === 'undefined') return;
  installed = true;
  window.__setwise = { getRepo };
}
