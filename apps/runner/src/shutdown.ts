export interface SignalSource {
  once(signal: string, listener: () => void): void;
}

export function onceSignal(source: SignalSource, signals: string[], action: () => void): void {
  let started = false;
  for (const signal of signals) {
    source.once(signal, () => {
      if (started) {
        return;
      }
      started = true;
      action();
    });
  }
}
