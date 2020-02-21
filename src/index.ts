interface Batch<T> {
    run(action: (item: T, index: number) => void): void;
}

class ArrayBatch<T> implements Batch<T> {
    private items: T[];
    private start: number;
    private end: number;

    public constructor(items: T[], start: number, end: number) {
        this.items = items;
        this.start = start;
        this.end = end;
    }

    public run(action: (item: T, index: number) => void) {
        for (let i = this.start; i < this.end; i++) {
            action(this.items[i], i);
        }
    }
}

export class BatchTasks<T> {
    private _generator: () => Generator<Batch<T>>;

    public constructor(generator: () => Generator<Batch<T>>) {
        this._generator = generator;
    }

    public static fromArray<T>(items: T[], batchSize: number) {
        return new BatchTasks(function* () {
            for (let i = 0; i < items.length; i += batchSize) {
                const start = i;
                const end = Math.min(i + batchSize, items.length);
                yield new ArrayBatch(items, start, end);
            }
        });
    }

    public batches() {
        return this._generator();
    }
}

export class Sequential {
    public static async runAll<T>(batches: Generator<Batch<T>>, action: (item: T, index: number) => void, abortSignal: AbortSignal) {
        for (const batch of batches) {
            if (abortSignal.aborted) {
                break;
            }
            batch.run(action);
            await new Promise((resolve) => setTimeout(resolve, 0));
        }
    }
}
