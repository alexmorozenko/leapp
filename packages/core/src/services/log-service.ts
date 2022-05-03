import { ILogger } from "../interfaces/i-logger";

export enum LogLevel {
  success,
  info,
  warn,
  error,
}

export class LoggedEntry extends Error {
  constructor(message: string, public context: any, public level: LogLevel, public display: boolean = false, public customStack?: string) {
    super(message);
  }
}

export class LoggedException extends LoggedEntry {
  constructor(message: string, public context: any, public level: LogLevel, public display: boolean = true, public customStack?: string) {
    super(message, context, level, display, customStack);
  }
}

export class LogService {
  constructor(private logger: ILogger) {}

  log(loggedEntry: LoggedEntry): void {
    const contextPart = this.getContextPart(loggedEntry);
    this.logger.log(this.getLogMessage(contextPart, loggedEntry), loggedEntry.level);
    if (loggedEntry.display) {
      this.logger.show(loggedEntry.message, loggedEntry.level);
    }
  }

  private getLogMessage(contextPart: string[], loggedEntry: LoggedEntry) {
    return [...contextPart, loggedEntry.customStack ?? loggedEntry.stack].join(" ");
  }

  private getContextPart(loggedEntry: LoggedEntry) {
    return loggedEntry.context ? [`[${loggedEntry.context.constructor["name"]}]`] : [];
  }
}
