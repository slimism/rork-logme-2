/**
 * Multi Camera Handler
 * 
 * Contains all camera-specific logic for multi camera configuration.
 * This file handles:
 * - Duplicate detection for multiple cameras
 * - Validation for all camera files
 * - File number calculations
 * - Range handling for each camera
 */

import { LogSheet, TakeData } from '@/types';
import { DuplicateInfo } from './types';
import { getRangeFromData, isNumberInRange } from './utils';

export interface MultiCameraHandlerContext {
  takeData: TakeData;
  disabledFields: Set<string>;
  showRangeMode: { [key: string]: boolean };
  rangeData: { [key: string]: { from: string; to: string } };
  cameraRecState: { [key: string]: boolean };
  projectLogSheets: LogSheet[];
  cameraConfiguration: number;
}

/**
 * Checks for duplicate camera files in multi camera mode
 */
export const checkMultiCameraDuplicate = (context: MultiCameraHandlerContext): DuplicateInfo | null => {
  const { takeData, disabledFields, showRangeMode, rangeData, cameraRecState, projectLogSheets, cameraConfiguration } = context;

  for (let i = 1; i <= cameraConfiguration; i++) {
    const fieldId = `cameraFile${i}`;
    const val = takeData[fieldId] as string | undefined;
    const isRecActive = cameraRecState[fieldId] ?? true;
    
    if (val && !disabledFields.has(fieldId) && isRecActive) {
      const currentRange = rangeData[fieldId];
      const isCurrentRange = showRangeMode[fieldId] && currentRange?.from && currentRange?.to;

      if (isCurrentRange) {
        const currentFrom = parseInt(currentRange.from) || 0;
        const currentTo = parseInt(currentRange.to) || 0;
        const currentMin = Math.min(currentFrom, currentTo);
        const currentMax = Math.max(currentFrom, currentTo);

        for (const sheet of projectLogSheets) {
          const data = sheet.data;
          if (!data) continue;

          const existingRange = getRangeFromData(data, fieldId);
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
              } else if (currentFrom === existingMax) {
                conflictType = 'upper';
              } else if (currentMin < existingMin && currentMax >= existingMin) {
                conflictType = 'lower';
              } else {
                conflictType = 'within';
              }
              return {
                type: 'file',
                label: `Camera File ${i}`,
                fieldId,
                value: `${currentRange.from}–${currentRange.to}`,
                number: currentFrom,
                existingEntry: sheet,
                isRangeConflict: true,
                conflictType,
                rangeInfo: existingRange
              };
            }
          }

          if (data[fieldId] && typeof data[fieldId] === 'string' && !data[fieldId].includes('-')) {
            const existingNum = parseInt(data[fieldId]) || 0;
            if (existingNum >= currentMin && existingNum <= currentMax) {
              const conflictType = existingNum === currentMin ? 'lower' : 'within';
              return {
                type: 'file',
                label: `Camera File ${i}`,
                fieldId,
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
        const currentNum = parseInt(val) || 0;

        for (const sheet of projectLogSheets) {
          const data = sheet.data;
          if (!data) continue;

          const existingRange = getRangeFromData(data, fieldId);
          if (existingRange) {
            if (isNumberInRange(currentNum, existingRange.from, existingRange.to)) {
              const existingFrom = parseInt(existingRange.from) || 0;
              const conflictType = currentNum === existingFrom ? 'lower' : 'within';
              return {
                type: 'file',
                label: `Camera File ${i}`,
                fieldId,
                value: val,
                number: currentNum,
                existingEntry: sheet,
                isRangeConflict: true,
                conflictType,
                rangeInfo: existingRange
              };
            }
          }

          if (data[fieldId] === val) {
            return {
              type: 'file',
              label: `Camera File ${i}`,
              fieldId,
              value: val,
              number: currentNum,
              existingEntry: sheet
            };
          }
        }
      }
    }
  }

  return null;
};

/**
 * Validates all camera file fields in multi camera mode
 */
export const validateMultiCamera = (
  takeData: TakeData,
  disabledFields: Set<string>,
  cameraRecState: { [key: string]: boolean },
  cameraConfiguration: number
): { errors: Set<string>; missingFields: string[] } => {
  const errors = new Set<string>();
  const missingFields: string[] = [];

  for (let i = 1; i <= cameraConfiguration; i++) {
    const fieldId = `cameraFile${i}`;
    const isRecActive = cameraRecState[fieldId] ?? true;
    // Only validate if field is not disabled AND REC is active
    if (!disabledFields.has(fieldId) && isRecActive && !takeData[fieldId]?.trim()) {
      errors.add(fieldId);
      missingFields.push(`Camera File ${i}`);
    }
  }

  return { errors, missingFields };
};

/**
 * Checks if all camera files are blank for multi camera
 */
export const isMultiCameraBlank = (data: any, cameraConfiguration: number): boolean => {
  let anyCamPresent = false;
  for (let i = 1; i <= cameraConfiguration; i++) {
    const val = data?.[`cameraFile${i}`];
    const fromVal = data?.[`camera${i}_from`];
    const toVal = data?.[`camera${i}_to`];
    if ((typeof val === 'string' && val.trim().length > 0) || 
        (typeof fromVal === 'string' && fromVal.trim().length > 0) || 
        (typeof toVal === 'string' && toVal.trim().length > 0)) {
      anyCamPresent = true;
      break;
    }
  }
  return !anyCamPresent;
};

