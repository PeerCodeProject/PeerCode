
export abstract class BaseObservable<T> {
    private listeners: T[] = [];

    async notify(f: (listener: T) => Promise<void>) {
        this.listeners.forEach(l => f(l));
    }

    async regiterListener(listener: T) {
        this.listeners.push(listener);
    }
}