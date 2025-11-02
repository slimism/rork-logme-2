import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { logger } from '@/components/CameraHandlers/logger';

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
      
      // Format console logs
      const logText = this.logs
        .map(log => {
          const time = new Date(log.timestamp).toLocaleTimeString();
          return `[${time}] [${log.level.toUpperCase()}] ${log.message}`;
        })
        .join('\n\n');

      // Get comprehensive camera handler logs
      const cameraHandlerLogs = logger.getLogs();
      const cameraHandlerLogText = logger.exportLogsAsText();

      // Combine both log sources
      const content = `COMPREHENSIVE LOGS EXPORT
Generated: ${new Date().toLocaleString()}

${'='.repeat(80)}
SECTION 1: CONSOLE LOGS
${'='.repeat(80)}
Total Console Logs: ${this.logs.length}

${logText}

${'='.repeat(80)}
SECTION 2: CAMERA HANDLER LOGS (COMPREHENSIVE)
${'='.repeat(80)}
Total Camera Handler Logs: ${cameraHandlerLogs.length}

${cameraHandlerLogText}

${'='.repeat(80)}
END OF COMPREHENSIVE LOGS EXPORT
${'='.repeat(80)}
This export includes:
- Console logs: General application logs
- Camera Handler logs: Detailed function-level logs with calculations, save operations, and file locations
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
        const fileUri = `${FileSystem.documentDirectory}${filename}.txt`;
        await FileSystem.writeAsStringAsync(fileUri, content);
        
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(fileUri, {
            mimeType: 'text/plain',
            dialogTitle: 'Share Console Logs',
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
