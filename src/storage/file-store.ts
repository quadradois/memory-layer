import * as fs from "fs";
import * as path from "path";

export class FileStore {
  private basePath: string;

  constructor(basePath: string) {
    this.basePath = path.resolve(basePath);
    this.ensureDir();
  }

  save(key: string, data: any): void {
    this.ensureDir();
    const filePath = path.join(this.basePath, `${key}.json`);
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf-8");
  }

  load(key: string): any | null {
    const filePath = path.join(this.basePath, `${key}.json`);
    if (!fs.existsSync(filePath)) return null;
    try {
      const content = fs.readFileSync(filePath, "utf-8");
      return JSON.parse(content);
    } catch {
      return null;
    }
  }

  delete(key: string): void {
    const filePath = path.join(this.basePath, `${key}.json`);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  }

  list(): string[] {
    if (!fs.existsSync(this.basePath)) return [];
    return fs.readdirSync(this.basePath)
      .filter(f => f.endsWith(".json"))
      .map(f => f.replace(".json", ""));
  }

  private ensureDir(): void {
    if (!fs.existsSync(this.basePath)) {
      fs.mkdirSync(this.basePath, { recursive: true });
    }
  }
}
