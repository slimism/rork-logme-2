import { LogSheet, Project } from '@/types';

export interface FileNumberUpdateParams {
  projectId: string;
  fieldId: string;
  fromNumber: number;
  increment: number;
}

export interface RangeData {
  [key: string]: {
    from: string;
    to: string;
  };
}

export class FileNumberService {
  private updateFileNumbers: (projectId: string, fieldId: string, fromNumber: number, increment: number) => void;
  private updateLogSheet: (id: string, data: any) => void;

  constructor(
    updateFileNumbers: (projectId: string, fieldId: string, fromNumber: number, increment: number) => void,
    updateLogSheet: (id: string, data: any) => void
  ) {
    this.updateFileNumbers = updateFileNumbers;
    this.updateLogSheet = updateLogSheet;
  }

  /**
   * Calculate the delta for range data
   */
  calculateRangeDelta(rangeData: RangeData, fieldId: string, showRangeMode: any): number {
    const r = rangeData[fieldId];
    if (showRangeMode[fieldId] && r?.from && r?.to) {
      const a = parseInt(r.from, 10) || 0;
      const b = parseInt(r.to, 10) || 0;
      return Math.abs(b - a) + 1;
    }
    return 1;
  }

  /**
   * Get the starting number for file shifting
   */
  getFileStartNumber(existingEntry: LogSheet, fieldId: string, targetTakeNumber: number): number {
    if (fieldId === 'soundFile') {
      if (typeof existingEntry.data?.sound_from === 'string') {
        const n = parseInt(existingEntry.data.sound_from, 10);
        if (!Number.isNaN(n)) return n;
      } else if (typeof existingEntry.data?.soundFile === 'string') {
        const n = parseInt(existingEntry.data.soundFile, 10);
        if (!Number.isNaN(n)) return n;
      }
    } else if (fieldId.startsWith('cameraFile')) {
      if (fieldId === 'cameraFile') {
        if (typeof existingEntry.data?.camera1_from === 'string') {
          const n = parseInt(existingEntry.data.camera1_from, 10);
          if (!Number.isNaN(n)) return n;
        } else if (typeof existingEntry.data?.cameraFile === 'string') {
          const n = parseInt(existingEntry.data.cameraFile, 10);
          if (!Number.isNaN(n)) return n;
        }
      } else {
        const cameraNum = parseInt(fieldId.replace('cameraFile', '')) || 1;
        const fromKey = `camera${cameraNum}_from`;
        if (typeof existingEntry.data?.[fromKey] === 'string') {
          const n = parseInt(existingEntry.data[fromKey], 10);
          if (!Number.isNaN(n)) return n;
        } else if (typeof existingEntry.data?.[fieldId] === 'string') {
          const n = parseInt(existingEntry.data[fieldId], 10);
          if (!Number.isNaN(n)) return n;
        }
      }
    }
    return targetTakeNumber;
  }

  /**
   * Check if a string represents a range
   */
  isRangeString(value: string): boolean {
    return value.includes('-') && value.split('-').length === 2;
  }

  /**
   * Get range data from existing entry
   */
  getRangeFromData(data: any, fieldId: string): { from: string; to: string } | null {
    if (fieldId === 'soundFile') {
      if (data.sound_from && data.sound_to) {
        return { from: data.sound_from, to: data.sound_to };
      }
    } else if (fieldId.startsWith('cameraFile')) {
      const cameraNum = fieldId === 'cameraFile' ? 1 : (parseInt(fieldId.replace('cameraFile', '')) || 1);
      const fromKey = `camera${cameraNum}_from`;
      const toKey = `camera${cameraNum}_to`;
      if (data[fromKey] && data[toKey]) {
        return { from: data[fromKey], to: data[toKey] };
      }
    }
    return null;
  }

  /**
   * Shift file numbers for a specific field
   */
  shiftFileNumbers(
    projectId: string,
    fieldId: string,
    existingEntry: LogSheet,
    rangeData: RangeData,
    showRangeMode: any,
    disabledFields: Set<string>,
    targetTakeNumber: number
  ): void {
    if (disabledFields.has(fieldId)) return;

    const delta = this.calculateRangeDelta(rangeData, fieldId, showRangeMode);

    const insertedRange = showRangeMode[fieldId] && rangeData[fieldId]
      ? {
          from: parseInt(rangeData[fieldId].from, 10) || 0,
          to: parseInt(rangeData[fieldId].to, 10) || 0,
        }
      : null;

    const insertedMin = insertedRange ? Math.min(insertedRange.from, insertedRange.to) : undefined;
    const insertedMax = insertedRange ? Math.max(insertedRange.from, insertedRange.to) : undefined;

    const targetRange = this.getRangeFromData(existingEntry.data, fieldId);

    // Determine where to start shifting subsequent logs to avoid double-shifting the target
    const subsequentStart = targetRange
      ? (parseInt(targetRange.to, 10) + 1)
      : this.getFileStartNumber(existingEntry, fieldId, targetTakeNumber);

    this.updateFileNumbers(projectId, fieldId, subsequentStart, delta);

    // If target has a range, adjust it hugging the inserted range: 
    // new lower = insertedUpper + 1, new upper = oldUpper + delta
    if (targetRange) {
      const oldToNum = parseInt(targetRange.to, 10) || 0;
      const newFromNum = (insertedMax ?? (parseInt(targetRange.from, 10) || 0)) + 1;
      const newToNum = oldToNum + delta;

      const newFrom = String(newFromNum).padStart(4, '0');
      const newTo = String(newToNum).padStart(4, '0');

      const updated: Record<string, any> = { ...existingEntry.data };

      if (fieldId === 'soundFile') {
        updated.sound_from = newFrom;
        updated.sound_to = newTo;
        const hadInline = typeof existingEntry.data?.soundFile === 'string' && this.isRangeString(existingEntry.data.soundFile);
        if (hadInline) {
          updated.soundFile = `${newFrom}-${newTo}`;
        }
      } else if (fieldId.startsWith('cameraFile')) {
        const cameraNum = fieldId === 'cameraFile' ? 1 : (parseInt(fieldId.replace('cameraFile', '')) || 1);
        updated[`camera${cameraNum}_from`] = newFrom;
        updated[`camera${cameraNum}_to`] = newTo;
        const hadInline = typeof existingEntry.data?.[fieldId] === 'string' && this.isRangeString(existingEntry.data[fieldId]);
        if (hadInline) {
          updated[fieldId] = `${newFrom}-${newTo}`;
        }
      }

      this.updateLogSheet(existingEntry.id, updated);
    }
  }

  /**
   * Apply range persistence to log data
   */
  applyRangePersistence(data: Record<string, any>, rangeData: RangeData, showRangeMode: any): Record<string, any> {
    const result = { ...data };

    // Handle sound file ranges
    if (showRangeMode['soundFile'] && rangeData['soundFile']?.from && rangeData['soundFile']?.to) {
      const from = rangeData['soundFile'].from;
      const to = rangeData['soundFile'].to;
      result.sound_from = String(from).padStart(4, '0');
      result.sound_to = String(to).padStart(4, '0');
      delete result.soundFile;
    }

    // Handle camera file ranges
    Object.keys(rangeData).forEach(key => {
      if (key.startsWith('cameraFile') && showRangeMode[key] && rangeData[key]?.from && rangeData[key]?.to) {
        const from = rangeData[key].from;
        const to = rangeData[key].to;
        const cameraNum = key === 'cameraFile' ? 1 : (parseInt(key.replace('cameraFile', '')) || 1);
        result[`camera${cameraNum}_from`] = String(from).padStart(4, '0');
        result[`camera${cameraNum}_to`] = String(to).padStart(4, '0');
        delete result[key];
      }
    });

    return result;
  }
}
