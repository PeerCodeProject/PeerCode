
type CB<T> = (listener: T) => void;
export abstract class BaseObservable<T> {
    private listeners: T[] = [];
    private notifications: CB<T>[] = [];
    notify(f: CB<T>) {
        if (this.listeners.length === 0) {
            console.warn("No listeners registered: " + this.constructor.name + ", function:" + f);
            this.notifications.push(f);
        }
        this.listeners.forEach(l => f(l));
    }

    regiterListener(listener: T) {
        if (this.listeners.length === 0 && this.notifications.length !== 0) {
            console.log("regiterListener later: " + this.constructor.name);
            this.notifications.forEach(f => f(listener));
            this.notifications = [];
        }
        this.listeners.push(listener);
    }
}