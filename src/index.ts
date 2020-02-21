interface Batch<T> {
    run(action: (item: T, index: number) => void): void;
}

class ArrayBatch<T> implements Batch<T> {
    public readonly items: T[];
    public readonly start: number;
    public readonly end: number;

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

class DurationBatch<T> implements Batch<T> {
    public readonly items: T[];
    public readonly duration: number;
    private _start: number;
    private _end: number;

    public constructor(items: T[], start: number, duration: number) {
        this.items = items;
        this.duration = duration;
        this._start = start;
        this._end = start;
    }

    public run(action: (item: T, index: number) => void) {
        let index = this._start;
        const start = Date.now(); // TODO: should use performance.now() but in a browser+NodeJS friendly way.
        while (Date.now() < start + this.duration && index < this.items.length) {
            action(this.items[index], index);
            index += 1;
        }
        this._end = index;
    }

    public get end() {
        return this._end;
    }
}

export class BatchTasks<T> {
    private _generator: () => Generator<Batch<T>>;

    public constructor(generator: () => Generator<Batch<T>>) {
        this._generator = generator;
    }

    public static fromArrayAndSize<T>(items: T[], batchSize: number) {
        return new BatchTasks(function* () {
            for (let i = 0; i < items.length; i += batchSize) {
                const start = i;
                const end = Math.min(i + batchSize, items.length);
                yield new ArrayBatch(items, start, end);
            }
        });
    }

    public static fromArrayAndDuration<T>(items: T[], batchDuration: number) {
        return new BatchTasks(function* () {
            let lastBatch: DurationBatch<T> | null = null;
            while (lastBatch === null || lastBatch.end < items.length) {
                lastBatch = new DurationBatch(items, lastBatch === null ? 0 : lastBatch.end, batchDuration);
                yield lastBatch;
            }
        });
    }

    public batches() {
        return this._generator();
    }
}

export class Sequential {
    public static async runAllBatches<T>(batches: Generator<Batch<T>>, action: (batch: Batch<T>) => void, abortSignal: AbortSignal) {
        for (const batch of batches) {
            if (abortSignal.aborted) {
                break;
            }
            action(batch);
            await new Promise((resolve) => setTimeout(resolve, 0));
        }
    }

    public static async runAllTasks<T>(batches: Generator<Batch<T>>, action: (item: T, index: number) => void, abortSignal: AbortSignal) {
        for (const batch of batches) {
            if (abortSignal.aborted) {
                break;
            }
            batch.run(action);
            await new Promise((resolve) => setTimeout(resolve, 0));
        }
    }
}
