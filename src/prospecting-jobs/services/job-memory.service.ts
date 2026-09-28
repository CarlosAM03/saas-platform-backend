import { Injectable } from '@nestjs/common';
import {
  BusinessResult,
  PipelineProgress,
} from '../../prospector-client/dto/job-event.request';

export interface JobMemory {
  persisted?: boolean;
  sequence: number;
  eventId: string | null;
  results: BusinessResult[] | null;
  progress: PipelineProgress | null;
}

@Injectable()
export class JobMemoryService {
  // ADR-002 §17 permits an implementation-defined temporary cache. This MVP
  // uses one process, a 24-hour TTL and a bounded number of retained jobs.
  private readonly entries = new Map<
    string,
    { expires: number; value: JobMemory }
  >();
  private readonly locks = new Map<string, Promise<void>>();
  readonly ttlMs = 24 * 60 * 60 * 1000;
  readonly capacity = 1000;

  get(id: string): JobMemory | undefined {
    this.purge();
    const entry = this.entries.get(id);
    return entry ? structuredClone(entry.value) : undefined;
  }

  set(id: string, value: JobMemory): void {
    this.purge();
    this.entries.delete(id);
    while (this.entries.size >= this.capacity) {
      const oldest = [...this.entries.keys()][0];
      if (oldest === undefined) break;
      this.entries.delete(oldest);
    }
    this.entries.set(id, {
      expires: Date.now() + this.ttlMs,
      value: structuredClone(value),
    });
  }

  async exclusive<T>(id: string, operation: () => Promise<T>): Promise<T> {
    const previous = this.locks.get(id) ?? Promise.resolve();
    let release!: () => void;
    const current = new Promise<void>((resolve) => {
      release = resolve;
    });
    this.locks.set(id, current);
    await previous;
    try {
      return await operation();
    } finally {
      release();
      if (this.locks.get(id) === current) this.locks.delete(id);
    }
  }

  private purge(): void {
    for (const [id, entry] of this.entries) {
      if (entry.expires <= Date.now()) this.entries.delete(id);
    }
  }
}
