export interface LogEntry {
  timestamp: string;
  level: string;
  message: string;
}

class LoggerBuffer {
  private buffer: LogEntry[] = [];
  private readonly maxSize = 100;
  private isIntercepting = false;
  
  private originalStdoutWrite = process.stdout.write.bind(process.stdout);
  private originalStderrWrite = process.stderr.write.bind(process.stderr);

  startIntercept() {
    if (this.isIntercepting) return;
    this.isIntercepting = true;

    const intercept = (defaultLevel: string, originalWrite: (...args: unknown[]) => unknown) => {
      return (chunk: unknown, encoding?: unknown, callback?: unknown) => {
        const raw = String(chunk);
        this.add({
          timestamp: new Date().toISOString(),
          level: defaultLevel,
          message: raw.trim(),
        });
        return originalWrite(chunk, encoding, callback);
      };
    };

    process.stdout.write = intercept('INFO', this.originalStdoutWrite as unknown as (...args: unknown[]) => unknown) as unknown as typeof process.stdout.write;
    process.stderr.write = intercept('ERROR', this.originalStderrWrite as unknown as (...args: unknown[]) => unknown) as unknown as typeof process.stderr.write;
  }

  private add(entry: LogEntry) {
    if (!entry.message) return;
    
    // Attempt to extract level if it's formatted
    let level = entry.level;
    const msgUpper = entry.message.toUpperCase();
    if (msgUpper.includes('ERROR')) level = 'ERROR';
    else if (msgUpper.includes('WARN')) level = 'WARN';
    else if (msgUpper.includes('INFO')) level = 'INFO';
    else if (msgUpper.includes('DEBUG')) level = 'DEBUG';
    else if (msgUpper.includes('META')) level = 'META';
    else if (msgUpper.includes('AUTH')) level = 'AUTH';
    else if (msgUpper.includes('SSE')) level = 'SSE';

    entry.level = level;
    
    this.buffer.unshift(entry);
    if (this.buffer.length > this.maxSize) {
      this.buffer.pop();
    }
  }

  getLogs() {
    return this.buffer;
  }
}

export const logBuffer = new LoggerBuffer();
