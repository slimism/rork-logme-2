/**
 * Single Camera Handler
 * 
 * Contains all camera-specific logic for single camera configuration.
 * This file handles:
 * - Duplicate detection
 * - Validation
 * - File number calculations
 * - Range handling
 */

import { LogSheet, TakeData } from '@/types';
import { DuplicateInfo } from './types';
import { getRangeFromData, isNumberInRange } from './utils';

export interface SingleCameraHandlerContext {
  takeData: TakeData;
  disabledFields: Set<string>;
  showRangeMode: { [key: string]: boolean };
  rangeData: { [key: string]: { from: string; to: string } };
  projectLogSheets: LogSheet[];
}

/**
 * Checks for duplicate camera files in single camera mode
 */
export const checkSingleCameraDuplicate = (context: SingleCameraHandlerContext): DuplicateInfo | null => {
  const { takeData, disabledFields, showRangeMode, rangeData, projectLogSheets } = context;

  if (takeData.cameraFile && !disabledFields.has('cameraFile')) {
    const currentRange = rangeData['cameraFile'];
    const isCurrentRange = showRangeMode['cameraFile'] && currentRange?.from && currentRange?.to;

    if (isCurrentRange) {
      const currentFrom = parseInt(currentRange.from) || 0;
      const currentTo = parseInt(currentRange.to) || 0;
      const currentMin = Math.min(currentFrom, currentTo);
      const currentMax = Math.max(currentFrom, currentTo);

      for (const sheet of projectLogSheets) {
        const data = sheet.data;
        if (!data) continue;

        const existingRange = getRangeFromData(data, 'cameraFile');
        if (existingRange) {
          const existingFrom = parseInt(existingRange.from) || 0;
          const existingTo = parseInt(existingRange.to) || 0;
          const existingMin = Math.min(existingFrom, existingTo);
          const existingMax = Math.max(existingFrom, existingTo);
          if (!(currentMax < existingMin || currentMin > existingMax)) {
            let conflictType: 'lower' | 'upper' | 'within';
            if (currentFrom === existingMin) {
              conflictType = 'lower';
            } else if (currentFrom > existingMin && currentFrom <= existingMax) {
              conflictType = 'within';
            } else {
              conflictType = 'upper';
            }
            return {
              type: 'file',
              label: 'Camera File',
              fieldId: 'cameraFile',
              value: `${currentRange.from}–${currentRange.to}`,
              number: currentFrom,
              existingEntry: sheet,
              isRangeConflict: true,
              conflictType,
              rangeInfo: existingRange
            };
          }
        }

        if (data.cameraFile && typeof data.cameraFile === 'string' && !data.cameraFile.includes('-')) {
          const existingNum = parseInt(data.cameraFile) || 0;
          if (existingNum >= currentMin && existingNum <= currentMax) {
            const conflictType = existingNum === currentMin ? 'lower' : 'within';
            return {
              type: 'file',
              label: 'Camera File',
              fieldId: 'cameraFile',
              value: `${currentRange.from}–${currentRange.to}`,
              number: currentFrom,
              existingEntry: sheet,
              isRangeConflict: true,
              conflictType
            };
          }
        }
      }
    } else {
      const val = takeData.cameraFile as string;
      const currentNum = parseInt(val) || 0;

      for (const sheet of projectLogSheets) {
        const data = sheet.data;
        if (!data) continue;

        const existingRange = getRangeFromData(data, 'cameraFile');
        if (existingRange) {
          if (isNumberInRange(currentNum, existingRange.from, existingRange.to)) {
            const existingFrom = parseInt(existingRange.from) || 0;
            const conflictType = currentNum === existingFrom ? 'lower' : 'within';
            return {
              type: 'file',
              label: 'Camera File',
              fieldId: 'cameraFile',
              value: val,
              number: currentNum,
              existingEntry: sheet,
              isRangeConflict: true,
              conflictType,
              rangeInfo: existingRange
            };
          }
        }

        if (data.cameraFile === val) {
          return {
            type: 'file',
            label: 'Camera File',
            fieldId: 'cameraFile',
            value: val,
            number: currentNum,
            existingEntry: sheet
          };
        }
      }
    }
  }

  return null;
};

/**
 * Validates single camera file field
 */
export const validateSingleCamera = (
  takeData: TakeData,
  disabledFields: Set<string>,
  cameraRecState?: { [key: string]: boolean }
): { errors: Set<string>; missingFields: string[] } => {
  const errors = new Set<string>();
  const missingFields: string[] = [];

  if (!disabledFields.has('cameraFile') && !takeData.cameraFile?.trim()) {
    errors.add('cameraFile');
    missingFields.push('Camera File');
  }

  return { errors, missingFields };
};

/**
 * Checks if camera file is blank for single camera
 */
export const isSingleCameraBlank = (data: any): boolean => {
  const hasSingle = typeof data?.cameraFile === 'string' && data.cameraFile.trim().length > 0;
  const hasRange = typeof data?.camera1_from === 'string' || typeof data?.camera1_to === 'string';
  return !(hasSingle || hasRange);
};

