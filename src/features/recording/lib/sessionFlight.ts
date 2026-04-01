export class SessionFlightController {
  private generation = 0;
  private processingSessionId: number | null = null;
  private insertedSessionId: number | null = null;

  createSession(): number {
    this.generation += 1;
    this.processingSessionId = null;
    this.insertedSessionId = null;
    return this.generation;
  }

  currentSessionId(): number {
    return this.generation;
  }

  invalidate(): number {
    this.generation += 1;
    this.processingSessionId = null;
    return this.generation;
  }

  isCurrent(sessionId: number): boolean {
    return sessionId === this.generation;
  }

  beginProcessing(sessionId: number): boolean {
    if (!this.isCurrent(sessionId) || this.processingSessionId === sessionId) {
      return false;
    }

    this.processingSessionId = sessionId;
    return true;
  }

  endProcessing(sessionId: number): void {
    if (this.processingSessionId === sessionId) {
      this.processingSessionId = null;
    }
  }

  markInserted(sessionId: number): boolean {
    if (!this.isCurrent(sessionId) || this.insertedSessionId === sessionId) {
      return false;
    }

    this.insertedSessionId = sessionId;
    return true;
  }
}
