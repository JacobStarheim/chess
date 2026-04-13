import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

export class JsonStore<T extends object> {
  constructor(
    private readonly filePath: string,
    private readonly initialState: T
  ) {}

  async read(): Promise<T> {
    try {
      const raw = await readFile(this.filePath, "utf8");
      return {
        ...this.initialState,
        ...JSON.parse(raw)
      } satisfies T;
    } catch (error) {
      return structuredClone(this.initialState);
    }
  }

  async write(value: T): Promise<void> {
    await mkdir(dirname(this.filePath), { recursive: true });
    await writeFile(this.filePath, JSON.stringify(value, null, 2), "utf8");
  }

  async update(
    producer: (current: T) => T | Promise<T>
  ): Promise<T> {
    const current = await this.read();
    const next = await producer(current);
    await this.write(next);
    return next;
  }
}
