import { Platform } from 'react-native';
import * as Sharing from 'expo-sharing';
// Minimal logging only; remove camera handler logs aggregation

interface LogEntry {
  timestamp: string;
  level: 'log' | 'warn' | 'error' | 'info' | 'debug';
  message: string;
  args: any[];
}

class ConsoleLogger {
  private logs: LogEntry[] = [];
  private maxLogs = 5000;
  private originalConsole: {
    log: typeof console.log;
    warn: typeof console.warn;
    error: typeof console.error;
    info: typeof console.info;
    debug: typeof console.debug;
  };

  constructor() {
    this.originalConsole = {
      log: console.log,
      warn: console.warn,
      error: console.error,
      info: console.info,
      debug: console.debug,
    };
    this.interceptConsole();
  }

  private interceptConsole() {
    console.log = (...args: any[]) => {
      this.addLog('log', args);
      this.originalConsole.log(...args);
    };

    console.warn = (...args: any[]) => {
      this.addLog('warn', args);
      this.originalConsole.warn(...args);
    };

    console.error = (...args: any[]) => {
      this.addLog('error', args);
      this.originalConsole.error(...args);
    };

    console.info = (...args: any[]) => {
      this.addLog('info', args);
      this.originalConsole.info(...args);
    };

    console.debug = (...args: any[]) => {
      this.addLog('debug', args);
      this.originalConsole.debug(...args);
    };
  }

  private addLog(level: LogEntry['level'], args: any[]) {
    const message = args
      .map(arg => {
        if (typeof arg === 'object') {
          try {
            return JSON.stringify(arg, null, 2);
          } catch {
            return String(arg);
          }
        }
        return String(arg);
      })
      .join(' ');

    this.logs.push({
      timestamp: new Date().toISOString(),
      level,
      message,
      args,
    });

    if (this.logs.length > this.maxLogs) {
      this.logs.shift();
    }
  }

  getLogs(): LogEntry[] {
    return [...this.logs];
  }

  clearLogs() {
    this.logs = [];
  }

  async exportLogs(): Promise<boolean> {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `comprehensive-logs-${timestamp}`;
      
      // Keep only ACTION logs with Project context
      const actionLogs = this.logs.filter(l =>
        typeof l.message === 'string' && l.message.includes('[ACTION]')
      );
      const logText = actionLogs
        .map(log => {
          const time = new Date(log.timestamp).toLocaleTimeString();
          return `[${time}] ${log.message}`;
        })
        .join('\n');

      // Minimal export content
      const content = `COMPREHENSIVE LOGS EXPORT
Generated: ${new Date().toLocaleString()}

${'='.repeat(80)}
SECTION: PROJECT ACTION LOGS
${'='.repeat(80)}
Total Action Logs: ${actionLogs.length}

${logText}

${'='.repeat(80)}
END OF COMPREHENSIVE LOGS EXPORT
${'='.repeat(80)}
This export includes:
- Minimal logs only
`;

      if (Platform.OS === 'web') {
        const blob = new Blob([content], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${filename}.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        return true;
      } else {
        // Use legacy API for compatibility
        const FileSystemLegacy = require('expo-file-system/legacy');
        const fileUri = `${FileSystemLegacy.documentDirectory}${filename}.txt`;
        await FileSystemLegacy.writeAsStringAsync(fileUri, content);
        
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(fileUri, {
            mimeType: 'text/plain',
            dialogTitle: 'Share Comprehensive Logs',
          });
        }
        return true;
      }
    } catch (error) {
      this.originalConsole.error('Failed to export logs:', error);
      return false;
    }
  }
}

export const consoleLogger = new ConsoleLogger();
