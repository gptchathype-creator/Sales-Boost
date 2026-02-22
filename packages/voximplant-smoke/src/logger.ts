import * as fs from "node:fs";
import * as path from "node:path";

export class JsonlLogger {
  private readonly outDir: string;
  private readonly streams = new Map<string, fs.WriteStream>();

  constructor(outDir: string = "./out") {
    this.outDir = outDir;
    fs.mkdirSync(outDir, { recursive: true });
  }

  append(filename: string, record: unknown): void {
    const stream = this.getStream(filename);
    stream.write(JSON.stringify(record) + "\n");
  }

  private getStream(filename: string): fs.WriteStream {
    let stream = this.streams.get(filename);
    if (!stream) {
      const filePath = path.join(this.outDir, filename);
      stream = fs.createWriteStream(filePath, { flags: "a" });
      this.streams.set(filename, stream);
    }
    return stream;
  }

  close(): void {
    for (const stream of this.streams.values()) {
      stream.end();
    }
    this.streams.clear();
  }
}
