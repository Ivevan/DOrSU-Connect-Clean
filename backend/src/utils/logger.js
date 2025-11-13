export class Logger {
    static formatMessage(level, message, ...args) {
      const timestamp = new Date().toISOString();
      const formattedArgs = args.length > 0 ? ' ' + args.map(arg => 
        typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
      ).join(' ') : '';
      return `[${timestamp}] ${level}: ${message}${formattedArgs}`;
    }
  
    static info(message, ...args) {
      console.log(this.formatMessage('INFO', message, ...args));
    }
  
    static success(message, ...args) {
      console.log(`\x1b[32m${this.formatMessage('SUCCESS', message, ...args)}\x1b[0m`);
    }
  
    static warn(message, ...args) {
      console.warn(`\x1b[33m${this.formatMessage('WARN', message, ...args)}\x1b[0m`);
    }
  
    static error(message, error, ...args) {
      const errorInfo = error instanceof Error ? `\nError: ${error.message}\nStack: ${error.stack}` : 
                       error ? `\nError: ${String(error)}` : '';
      console.error(`\x1b[31m${this.formatMessage('ERROR', message, ...args)}${errorInfo}\x1b[0m`);
    }
  
    static debug(message, ...args) {
      if (process.env.NODE_ENV === 'development') {
        console.debug(`\x1b[36m${this.formatMessage('DEBUG', message, ...args)}\x1b[0m`);
      }
    }
  }
  