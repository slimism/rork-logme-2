/**
 * Comprehensive Logging System for Camera Handlers
 * 
 * Provides detailed logging with:
 * - Function name and file location
 * - Step-by-step calculations
 * - Data being saved
 * - Helps identify outdated functions
 */

type LogLevel = 'info' | 'debug' | 'warn' | 'error';

interface LogContext {
  functionName: string;
  fileName: string;
  filePath: string;
  level?: LogLevel;
}

interface CalculationStep {
  step: string;
  description: string;
  input: any;
  calculation?: string;
  output?: any;
}

interface StoredLogEntry {
  timestamp: string;
  level: LogLevel;
  functionName: string;
  fileName: string;
  filePath: string;
  message?: string;
  data?: any;
  calculation?: {
    step: string;
    description: string;
    input: any;
    calculation?: string;
    output?: any;
  };
  saveOperation?: {
    operation: string;
    entityId: string;
    previousData?: any;
    newData: any;
    changes?: Record<string, { from: any; to: any }>;
  };
}

class CameraHandlerLogger {
  private isEnabled = true; // Set to false to disable all logging
  private logBuffer: StoredLogEntry[] = [];
  private maxBufferSize = 10000; // Maximum number of logs to keep in memory

  /**
   * Gets the caller's file name and function name from the stack trace
   */
  private getCallerInfo(): { fileName: string; functionName: string; filePath: string } {
    const stack = new Error().stack;
    if (!stack) {
      return { fileName: 'unknown', functionName: 'unknown', filePath: 'unknown' };
    }

    const stackLines = stack.split('\n');
    // Skip Error line and this function, look for actual caller
    const callerLine = stackLines[3] || stackLines[2] || '';
    
    // Extract file path (e.g., "at shiftSingleCameraFiles (C:\...\SingleCameraShiftHandler.ts:123:45)")
    const fileMatch = callerLine.match(/\((.+):(\d+):(\d+)\)/);
    const functionMatch = callerLine.match(/at (\w+)/);
    
    const functionName = functionMatch ? functionMatch[1] : 'unknown';
    let fileName = 'unknown';
    let filePath = 'unknown';
    
    if (fileMatch) {
      const fullPath = fileMatch[1];
      filePath = fullPath;
      // Extract just the file name
      const pathParts = fullPath.split(/[/\\]/);
      fileName = pathParts[pathParts.length - 1] || 'unknown';
    }

    return { fileName, functionName, filePath };
  }

  /**
   * Formats a value for logging (handles objects, arrays, etc.)
   */
  private formatValue(value: any, maxDepth = 3, currentDepth = 0): string {
    if (currentDepth >= maxDepth) {
      return '...';
    }

    if (value === null) return 'null';
    if (value === undefined) return 'undefined';
    if (typeof value === 'string') return `"${value}"`;
    if (typeof value === 'number') return String(value);
    if (typeof value === 'boolean') return String(value);

    if (Array.isArray(value)) {
      if (value.length === 0) return '[]';
      const items = value.slice(0, 5).map(item => this.formatValue(item, maxDepth, currentDepth + 1));
      const more = value.length > 5 ? `, ... (+${value.length - 5} more)` : '';
      return `[${items.join(', ')}${more}]`;
    }

    if (typeof value === 'object') {
      const keys = Object.keys(value);
      if (keys.length === 0) return '{}';
      const items = keys.slice(0, 5).map(key => {
        const val = this.formatValue(value[key], maxDepth, currentDepth + 1);
        return `${key}: ${val}`;
      });
      const more = keys.length > 5 ? `, ... (+${keys.length - 5} more)` : '';
      return `{${items.join(', ')}${more}}`;
    }

    return String(value);
  }

  /**
   * Stores a log entry in the buffer
   */
  private storeLog(entry: Omit<StoredLogEntry, 'timestamp'>): void {
    if (!this.isEnabled) return;
    
    const fullEntry: StoredLogEntry = {
      ...entry,
      timestamp: new Date().toISOString()
    };
    
    this.logBuffer.push(fullEntry);
    
    // Keep buffer size manageable
    if (this.logBuffer.length > this.maxBufferSize) {
      this.logBuffer.shift(); // Remove oldest entry
    }
  }

  /**
   * Logs function entry
   */
  public logFunctionEntry(params?: Record<string, any>): void {
    if (!this.isEnabled) return;
    
    const { fileName, functionName, filePath } = this.getCallerInfo();
    
    this.storeLog({
      level: 'info',
      functionName,
      fileName,
      filePath,
      message: `FUNCTION ENTRY: ${functionName}()`,
      data: params
    });
    
    console.log(`\n${'='.repeat(80)}`);
    console.log(`🔵 FUNCTION ENTRY: ${functionName}()`);
    console.log(`📁 Location: ${fileName}`);
    console.log(`📂 Path: ${filePath}`);
    if (params && Object.keys(params).length > 0) {
      console.log(`📥 Parameters:`);
      Object.entries(params).forEach(([key, value]) => {
        console.log(`   ${key}: ${this.formatValue(value)}`);
      });
    }
    console.log(`${'='.repeat(80)}\n`);
  }

  /**
   * Logs a calculation step
   */
  public logCalculation(step: string, description: string, input: any, calculation?: string, output?: any): void {
    if (!this.isEnabled) return;
    
    const { fileName, functionName } = this.getCallerInfo();
    
    this.storeLog({
      level: 'debug',
      functionName,
      fileName,
      filePath: this.getCallerInfo().filePath,
      message: `CALCULATION: ${step}`,
      calculation: {
        step,
        description,
        input,
        calculation,
        output
      }
    });
    
    console.log(`\n🧮 CALCULATION [${fileName}::${functionName}]`);
    console.log(`   Step: ${step}`);
    console.log(`   Description: ${description}`);
    console.log(`   Input: ${this.formatValue(input)}`);
    if (calculation) {
      console.log(`   Calculation: ${calculation}`);
    }
    if (output !== undefined) {
      console.log(`   Output: ${this.formatValue(output)}`);
    }
    console.log('');
  }

  /**
   * Logs multiple calculation steps
   */
  public logCalculations(steps: CalculationStep[]): void {
    if (!this.isEnabled) return;
    
    const { fileName, functionName } = this.getCallerInfo();
    
    console.log(`\n📊 CALCULATION STEPS [${fileName}::${functionName}]`);
    steps.forEach((calcStep, index) => {
      console.log(`\n   Step ${index + 1}: ${calcStep.step}`);
      console.log(`   Description: ${calcStep.description}`);
      console.log(`   Input: ${this.formatValue(calcStep.input)}`);
      if (calcStep.calculation) {
        console.log(`   Calculation: ${calcStep.calculation}`);
      }
      if (calcStep.output !== undefined) {
        console.log(`   Output: ${this.formatValue(calcStep.output)}`);
      }
    });
    console.log('');
  }

  /**
   * Logs data being saved
   */
  public logSave(operation: string, entityId: string, data: any, previousData?: any): void {
    if (!this.isEnabled) return;
    
    const { fileName, functionName, filePath } = this.getCallerInfo();
    
    let changes: Record<string, { from: any; to: any }> | undefined;
    if (previousData && typeof previousData === 'object' && typeof data === 'object') {
      changes = this.getChanges(previousData, data);
    }
    
    this.storeLog({
      level: 'info',
      functionName,
      fileName,
      filePath,
      message: `SAVE OPERATION: ${operation}`,
      saveOperation: {
        operation,
        entityId,
        previousData,
        newData: data,
        changes
      }
    });
    
    console.log(`\n💾 SAVE OPERATION [${fileName}::${functionName}]`);
    console.log(`   Operation: ${operation}`);
    console.log(`   Entity ID: ${entityId}`);
    if (previousData !== undefined) {
      console.log(`   Previous Data: ${this.formatValue(previousData)}`);
    }
    console.log(`   New Data: ${this.formatValue(data)}`);
    if (changes && Object.keys(changes).length > 0) {
      console.log(`   Changes:`);
      Object.entries(changes).forEach(([key, value]) => {
        console.log(`     ${key}: ${this.formatValue((value as any).from)} → ${this.formatValue((value as any).to)}`);
      });
    }
    console.log('');
  }

  /**
   * Gets the differences between two objects
   */
  private getChanges(previous: any, current: any): Record<string, { from: any; to: any }> {
    const changes: Record<string, { from: any; to: any }> = {};
    
    const allKeys = new Set([...Object.keys(previous || {}), ...Object.keys(current || {})]);
    
    allKeys.forEach(key => {
      const prevVal = previous?.[key];
      const currVal = current?.[key];
      
      if (JSON.stringify(prevVal) !== JSON.stringify(currVal)) {
        changes[key] = { from: prevVal, to: currVal };
      }
    });
    
    return changes;
  }

  /**
   * Logs function exit with result
   */
  public logFunctionExit(result?: any): void {
    if (!this.isEnabled) return;
    
    const { fileName, functionName, filePath } = this.getCallerInfo();
    
    this.storeLog({
      level: 'info',
      functionName,
      fileName,
      filePath,
      message: `FUNCTION EXIT: ${functionName}()`,
      data: result !== undefined ? { result } : undefined
    });
    
    console.log(`\n${'='.repeat(80)}`);
    console.log(`🟢 FUNCTION EXIT: ${functionName}()`);
    console.log(`📁 Location: ${fileName}`);
    if (result !== undefined) {
      console.log(`📤 Result: ${this.formatValue(result)}`);
    }
    console.log(`${'='.repeat(80)}\n`);
  }

  /**
   * Logs a warning
   */
  public logWarning(message: string, data?: any): void {
    if (!this.isEnabled) return;
    
    const { fileName, functionName, filePath } = this.getCallerInfo();
    
    this.storeLog({
      level: 'warn',
      functionName,
      fileName,
      filePath,
      message,
      data
    });
    
    console.warn(`\n⚠️  WARNING [${fileName}::${functionName}]`);
    console.warn(`   ${message}`);
    if (data !== undefined) {
      console.warn(`   Data: ${this.formatValue(data)}`);
    }
    console.warn('');
  }

  /**
   * Logs an error
   */
  public logError(error: Error | string, context?: any): void {
    if (!this.isEnabled) return;
    
    const { fileName, functionName, filePath } = this.getCallerInfo();
    
    const errorMessage = error instanceof Error ? error.message : error;
    const errorStack = error instanceof Error ? error.stack : undefined;
    
    this.storeLog({
      level: 'error',
      functionName,
      fileName,
      filePath,
      message: `ERROR: ${errorMessage}`,
      data: {
        error: errorMessage,
        stack: errorStack,
        context
      }
    });
    
    console.error(`\n❌ ERROR [${fileName}::${functionName}]`);
    if (error instanceof Error) {
      console.error(`   Message: ${error.message}`);
      console.error(`   Stack: ${error.stack}`);
    } else {
      console.error(`   Message: ${error}`);
    }
    if (context !== undefined) {
      console.error(`   Context: ${this.formatValue(context)}`);
    }
    console.error('');
  }

  /**
   * Logs a debug message
   */
  public logDebug(message: string, data?: any): void {
    if (!this.isEnabled) return;
    
    const { fileName, functionName, filePath } = this.getCallerInfo();
    
    this.storeLog({
      level: 'debug',
      functionName,
      fileName,
      filePath,
      message,
      data
    });
    
    console.log(`\n🔍 DEBUG [${fileName}::${functionName}]`);
    console.log(`   ${message}`);
    if (data !== undefined) {
      console.log(`   Data: ${this.formatValue(data)}`);
    }
    console.log('');
  }

  /**
   * Enables or disables logging
   */
  public setEnabled(enabled: boolean): void {
    this.isEnabled = enabled;
  }

  /**
   * Checks if logging is enabled
   */
  public isLoggingEnabled(): boolean {
    return this.isEnabled;
  }

  /**
   * Gets all stored logs
   */
  public getLogs(): StoredLogEntry[] {
    return [...this.logBuffer];
  }

  /**
   * Gets logs filtered by level
   */
  public getLogsByLevel(level: LogLevel): StoredLogEntry[] {
    return this.logBuffer.filter(log => log.level === level);
  }

  /**
   * Gets logs filtered by function name
   */
  public getLogsByFunction(functionName: string): StoredLogEntry[] {
    return this.logBuffer.filter(log => log.functionName === functionName);
  }

  /**
   * Gets logs filtered by file name
   */
  public getLogsByFile(fileName: string): StoredLogEntry[] {
    return this.logBuffer.filter(log => log.fileName === fileName);
  }

  /**
   * Clears the log buffer
   */
  public clearLogs(): void {
    this.logBuffer = [];
  }

  /**
   * Exports logs as JSON string
   */
  public exportLogsAsJSON(): string {
    return JSON.stringify({
      exportTimestamp: new Date().toISOString(),
      totalLogs: this.logBuffer.length,
      logs: this.logBuffer
    }, null, 2);
  }

  /**
   * Exports logs as formatted text
   */
  public exportLogsAsText(): string {
    const lines: string[] = [];
    lines.push('='.repeat(80));
    lines.push(`CAMERA HANDLER LOGS EXPORT`);
    lines.push(`Export Timestamp: ${new Date().toISOString()}`);
    lines.push(`Total Logs: ${this.logBuffer.length}`);
    lines.push('='.repeat(80));
    lines.push('');

    this.logBuffer.forEach((log, index) => {
      lines.push(`\n[${index + 1}] ${log.timestamp}`);
      lines.push(`Level: ${log.level.toUpperCase()}`);
      lines.push(`Function: ${log.functionName}()`);
      lines.push(`File: ${log.fileName}`);
      lines.push(`Path: ${log.filePath}`);
      
      if (log.message) {
        lines.push(`Message: ${log.message}`);
      }

      if (log.calculation) {
        lines.push(`\nCalculation:`);
        lines.push(`  Step: ${log.calculation.step}`);
        lines.push(`  Description: ${log.calculation.description}`);
        lines.push(`  Input: ${this.formatValue(log.calculation.input)}`);
        if (log.calculation.calculation) {
          lines.push(`  Calculation: ${log.calculation.calculation}`);
        }
        if (log.calculation.output !== undefined) {
          lines.push(`  Output: ${this.formatValue(log.calculation.output)}`);
        }
      }

      if (log.saveOperation) {
        lines.push(`\nSave Operation:`);
        lines.push(`  Operation: ${log.saveOperation.operation}`);
        lines.push(`  Entity ID: ${log.saveOperation.entityId}`);
        if (log.saveOperation.previousData) {
          lines.push(`  Previous Data: ${this.formatValue(log.saveOperation.previousData)}`);
        }
        lines.push(`  New Data: ${this.formatValue(log.saveOperation.newData)}`);
        if (log.saveOperation.changes && Object.keys(log.saveOperation.changes).length > 0) {
          lines.push(`  Changes:`);
          Object.entries(log.saveOperation.changes).forEach(([key, value]) => {
            lines.push(`    ${key}: ${this.formatValue(value.from)} → ${this.formatValue(value.to)}`);
          });
        }
      }

      if (log.data) {
        lines.push(`\nData: ${this.formatValue(log.data)}`);
      }

      lines.push('-'.repeat(80));
    });

    return lines.join('\n');
  }

  /**
   * Exports logs to a downloadable file (React Native compatible)
   */
  public async exportLogsToFile(format: 'json' | 'text' = 'json'): Promise<boolean> {
    try {
      const content = format === 'json' ? this.exportLogsAsJSON() : this.exportLogsAsText();
      const extension = format === 'json' ? 'json' : 'txt';
      const filename = `camera-handler-logs-${new Date().toISOString().replace(/[:.]/g, '-')}.${extension}`;
      const mimeType = format === 'json' ? 'application/json' : 'text/plain';

      // For web/browser environments
      if (typeof window !== 'undefined' && window.Blob) {
        const blob = new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        return true;
      } else {
        // For React Native - use FileSystem and Sharing
        const FileSystem = require('expo-file-system').default;
        const Sharing = require('expo-sharing').default;
        
        const fileUri = `${FileSystem.documentDirectory}${filename}`;
        await FileSystem.writeAsStringAsync(fileUri, content);
        
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(fileUri, {
            mimeType,
            dialogTitle: 'Export Camera Handler Logs',
          });
        }
        return true;
      }
    } catch (error) {
      console.error('Failed to export camera handler logs:', error);
      return false;
    }
  }
}

// Export singleton instance
export const logger = new CameraHandlerLogger();

// Export types for use in other modules
export type { StoredLogEntry, LogLevel };

