/**
 * Multi Camera Shift Handler
 * 
 * Handles file number shifting when a new take is inserted before an existing take
 * for multi camera configuration.
 * 
 * Shifting Logic:
 * - For each camera field (cameraFile1, cameraFile2, etc.):
 *   1. Get upper bound of inserted log for that specific camera
 *   2. New lower bound = upper bound + 1
 *   3. New upper bound = new lower bound + delta (where delta = original upper - original lower)
 * 
 * - For sound file:
 *   1. Get upper bound of inserted log
 *   2. New lower bound = upper bound + 1
 *   3. New upper bound = new lower bound + delta
 * 
 * Special Cases:
 * - If target field is waste/blank, find last valid non-waste take before it for that specific camera
 * - Only shift camera fields that have values in the inserted log
 * - Each camera field is calculated independently based on its own previous log
 */

import { TakeData, LogSheet } from '@/types';
import { getRangeFromData } from './utils';

export interface MultiCameraShiftContext {
  // Inserted log data
  insertedTakeData: TakeData;
  insertedShowRangeMode: { [key: string]: boolean };
  insertedRangeData: { [key: string]: { from: string; to: string } };
  insertedCameraRecState?: { [key: string]: boolean };
  
  // Target log (the one being shifted)
  targetLogSheet: LogSheet;
  
  // Project context
  projectId: string;
  cameraConfiguration: number; // Should be > 1 for multi camera
  
  // Helper function to find previous valid take's upper bound
  getPreviousTakeUpperBound: (
    fieldId: string,
    currentTakeNumber: number,
    sceneNumber: string,
    shotNumber: string,
    excludeIds: Set<string>
  ) => number | null;
  
  // Project log sheets for finding previous takes
  projectLogSheets: LogSheet[];
  
  // Function to update a log sheet (needed for sequential shifting)
  updateLogSheet: (logSheetId: string, updatedData: Record<string, any>) => void;
}

export interface ShiftedFieldResult {
  fieldId: string;
  newLower: string; // Padded to 4 digits
  newUpper: string; // Padded to 4 digits
  isRange: boolean; // Whether the field was a range or single value
  wasShifted: boolean; // Whether this field was actually shifted
}

export interface MultiCameraShiftResult {
  sound: ShiftedFieldResult | null;
  cameras: { [fieldId: string]: ShiftedFieldResult };
  updatedData: Record<string, any>;
}

/**
 * Gets the upper bound of a field from inserted log data
 */
const getInsertedUpperBound = (
  fieldId: string,
  context: MultiCameraShiftContext
): number | null => {
  const { insertedTakeData, insertedShowRangeMode, insertedRangeData, insertedCameraRecState } = context;

  // For multi-camera, check if REC is active (if applicable)
  if (insertedCameraRecState && !insertedCameraRecState[fieldId]) {
    // REC is inactive for this camera, don't shift
    return null;
  }

  // Check if in range mode
  if (insertedShowRangeMode[fieldId] && insertedRangeData[fieldId]) {
    const range = insertedRangeData[fieldId];
    if (range.from && range.to) {
      const fromNum = parseInt(range.from, 10) || 0;
      const toNum = parseInt(range.to, 10) || 0;
      return Math.max(fromNum, toNum);
    }
  }

  // Check for range format in data
  const rangeFromData = getRangeFromData(insertedTakeData, fieldId);
  if (rangeFromData) {
    const fromNum = parseInt(rangeFromData.from, 10) || 0;
    const toNum = parseInt(rangeFromData.to, 10) || 0;
    return Math.max(fromNum, toNum);
  }

  // Check for inline range format
  const fieldValue = insertedTakeData[fieldId];
  if (fieldValue && typeof fieldValue === 'string' && fieldValue.includes('-')) {
    const parts = fieldValue.split('-').map(p => parseInt(p.trim(), 10) || 0);
    if (parts.length === 2) {
      return Math.max(parts[0], parts[1]);
    }
  }

  // Single value
  if (fieldValue && typeof fieldValue === 'string' && fieldValue.trim()) {
    return parseInt(fieldValue, 10) || null;
  }

  return null;
};


/**
 * Calculates shifted values for a single field
 */
const calculateFieldShift = (
  fieldId: string,
  context: MultiCameraShiftContext
): ShiftedFieldResult | null => {
  const { targetLogSheet, getPreviousTakeUpperBound, projectLogSheets } = context;
  const targetData = targetLogSheet.data || {};

  // Get upper bound of inserted log for this field
  const insertedUpperBound = getInsertedUpperBound(fieldId, context);
  
  // If inserted log doesn't have this field, don't shift
  if (insertedUpperBound === null) {
    return null;
  }

  // Check if target field exists and is not waste/blank
  const targetHasRange = getRangeFromData(targetData, fieldId);
  const targetSingleValue = targetData[fieldId];
  const targetIsBlank = !targetHasRange && (!targetSingleValue || !targetSingleValue.trim());

  if (targetIsBlank) {
    // Target is blank - find previous valid take's upper bound for THIS specific camera
    const sceneNumber = targetData.sceneNumber as string;
    const shotNumber = targetData.shotNumber as string;
    const takeNumber = parseInt(targetData.takeNumber as string || '0', 10);
    const excludeIds = new Set<string>([targetLogSheet.id]);

    const prevUpper = getPreviousTakeUpperBound(
      fieldId,
      takeNumber,
      sceneNumber || '',
      shotNumber || '',
      excludeIds
    );

    if (prevUpper === null) {
      // No previous valid take found, can't shift
      return null;
    }

    // When target is blank, don't shift it
    // The blank field should remain blank
    return null; // Don't shift blank fields
  } else {
    // Target has value - proceed with shifting
    // (baseUpperBound variable not needed, we use insertedUpperBound directly)
  }

  // Get delta of target field (upper - lower, not inclusive count)
  let targetDelta = 0;
  if (targetHasRange) {
    const fromNum = parseInt(targetHasRange.from, 10) || 0;
    const toNum = parseInt(targetHasRange.to, 10) || 0;
    const upper = Math.max(fromNum, toNum);
    const lower = Math.min(fromNum, toNum);
    targetDelta = Math.abs(upper - lower); // NOT +1, just the difference
  } else if (targetSingleValue && typeof targetSingleValue === 'string' && targetSingleValue.includes('-')) {
    const parts = targetSingleValue.split('-').map(p => parseInt(p.trim(), 10) || 0);
    if (parts.length === 2) {
      const upper = Math.max(parts[0], parts[1]);
      const lower = Math.min(parts[0], parts[1]);
      targetDelta = Math.abs(upper - lower);
    }
  }
  // If single value, targetDelta remains 0

  // Calculate new bounds
  // New lower = upper bound of inserted + 1
  const newLower = insertedUpperBound + 1;
  
  // New upper = new lower + targetDelta (to maintain target's range size)
  // If target was single value (delta = 0), newUpper = newLower (single value)
  // Example: If target had 001-003 (delta = 2), and inserted upper = 002
  //   newLower = 002 + 1 = 003
  //   newUpper = 003 + 2 = 005
  // Result: 003-005
  const newUpper = newLower + targetDelta;

  // Determine if original was a range
  const wasRange = !!targetHasRange || 
    (targetSingleValue && typeof targetSingleValue === 'string' && targetSingleValue.includes('-'));

  return {
    fieldId,
    newLower: String(newLower).padStart(4, '0'),
    newUpper: String(newUpper).padStart(4, '0'),
    isRange: wasRange || targetDelta > 0,
    wasShifted: true
  };
};

/**
 * Shifts file numbers for multi camera configuration
 * 
 * @param context - Shift context with all necessary data
 * @returns Shift result with new values for sound and all camera fields
 */
export const shiftMultiCameraFiles = (context: MultiCameraShiftContext): MultiCameraShiftResult => {
  const { targetLogSheet, cameraConfiguration } = context;
  const targetData = targetLogSheet.data || {};

  // Calculate shifted values for sound
  const soundShift = calculateFieldShift('soundFile', context);

  // Calculate shifted values for each camera
  const cameraShifts: { [fieldId: string]: ShiftedFieldResult } = {};
  for (let i = 1; i <= cameraConfiguration; i++) {
    const fieldId = `cameraFile${i}`;
    const shift = calculateFieldShift(fieldId, context);
    if (shift) {
      cameraShifts[fieldId] = shift;
    }
  }

  // Build updated data
  const updatedData: Record<string, any> = { ...targetData };

  // Update sound file
  if (soundShift) {
    if (soundShift.isRange) {
      updatedData['sound_from'] = soundShift.newLower;
      updatedData['sound_to'] = soundShift.newUpper;
      // Update inline format if it exists
      if (targetData.soundFile && typeof targetData.soundFile === 'string' && targetData.soundFile.includes('-')) {
        updatedData.soundFile = `${soundShift.newLower}-${soundShift.newUpper}`;
      } else {
        // Create inline format if original was range
        const originalRange = getRangeFromData(targetData, 'soundFile');
        if (originalRange) {
          updatedData.soundFile = `${soundShift.newLower}-${soundShift.newUpper}`;
        }
      }
    } else {
      // Single value - use new lower as the single value
      updatedData.soundFile = soundShift.newLower;
      // Clear range fields if they exist
      delete updatedData['sound_from'];
      delete updatedData['sound_to'];
    }
  }

  // Update each camera file
  for (let i = 1; i <= cameraConfiguration; i++) {
    const fieldId = `cameraFile${i}`;
    const shift = cameraShifts[fieldId];
    
    if (shift) {
      const fromKey = `camera${i}_from`;
      const toKey = `camera${i}_to`;

      if (shift.isRange) {
        updatedData[fromKey] = shift.newLower;
        updatedData[toKey] = shift.newUpper;
        // Update inline format if it exists
        if (targetData[fieldId] && typeof targetData[fieldId] === 'string' && (targetData[fieldId] as string).includes('-')) {
          updatedData[fieldId] = `${shift.newLower}-${shift.newUpper}`;
        } else {
          // Create inline format if original was range
          const originalRange = getRangeFromData(targetData, fieldId);
          if (originalRange) {
            updatedData[fieldId] = `${shift.newLower}-${shift.newUpper}`;
          }
        }
      } else {
        // Single value - use new lower as the single value
        updatedData[fieldId] = shift.newLower;
        // Clear range fields if they exist
        delete updatedData[fromKey];
        delete updatedData[toKey];
      }
    }
  }

  // Update take number (increment by 1)
  const currentTakeNum = parseInt(targetData.takeNumber as string || '0', 10);
  if (!isNaN(currentTakeNum)) {
    updatedData.takeNumber = String(currentTakeNum + 1);
  }

  return {
    sound: soundShift,
    cameras: cameraShifts,
    updatedData
  };
};

/**
 * Gets all subsequent takes after a target take (same scene/shot, ordered by take number)
 * 
 * Note: After the target has been shifted, its take number is incremented.
 * This function finds all takes with take number >= target's NEW take number.
 */
const getSubsequentTakes = (
  targetLogSheet: LogSheet,
  projectLogSheets: LogSheet[],
  excludeIds: Set<string> = new Set()
): LogSheet[] => {
  const targetData = targetLogSheet.data || {};
  const targetScene = targetData.sceneNumber as string;
  const targetShot = targetData.shotNumber as string;
  const targetTakeNum = parseInt(targetData.takeNumber as string || '0', 10);

  if (!targetScene || !targetShot || isNaN(targetTakeNum)) {
    return [];
  }

  return projectLogSheets
    .filter(sheet => {
      const data = sheet.data || {};
      return (
        sheet.projectId === targetLogSheet.projectId &&
        data.sceneNumber === targetScene &&
        data.shotNumber === targetShot &&
        sheet.id !== targetLogSheet.id &&
        !excludeIds.has(sheet.id)
      );
    })
    .map(sheet => {
      const data = sheet.data || {};
      const takeNum = parseInt(data.takeNumber as string || '0', 10);
      return { sheet, takeNum };
    })
    .filter(({ takeNum }) => !isNaN(takeNum) && takeNum >= targetTakeNum) // >= to include takes that might have same take number after shifting
    .sort((a, b) => a.takeNum - b.takeNum) // Sort ascending (Take 2, Take 3, Take 4...)
    .map(({ sheet }) => sheet);
};

/**
 * Shifts file numbers for multi camera configuration with sequential shifting of all subsequent takes
 * 
 * Process:
 * 1. Insert the new log (caller should do this first)
 * 2. Shift the target duplicate (this function)
 * 3. Shift all subsequent takes sequentially (this function)
 * 
 * @param context - Shift context with all necessary data
 * @returns Array of shift results (target + all subsequent takes)
 */
export const shiftMultiCameraFilesSequentially = (
  context: MultiCameraShiftContext
): MultiCameraShiftResult[] => {
  const { targetLogSheet, updateLogSheet, projectLogSheets, cameraConfiguration, insertedCameraRecState } = context;
  const results: MultiCameraShiftResult[] = [];

  // Get target's original take number BEFORE shifting
  const originalTargetData = targetLogSheet.data || {};
  const originalTargetTakeNum = parseInt(originalTargetData.takeNumber as string || '0', 10);
  const targetScene = originalTargetData.sceneNumber as string;
  const targetShot = originalTargetData.shotNumber as string;

  // Step 1: Shift the target duplicate
  const targetResult = shiftMultiCameraFiles(context);
  updateLogSheet(targetLogSheet.id, targetResult.updatedData);
  results.push(targetResult);

  // Step 2: Get all subsequent takes (ordered by take number)
  // Find takes with take number > original target take number (before shifting)
  // This finds the original Take 2, Take 3, etc., regardless of whether they've been shifted yet
  const subsequentTakes = projectLogSheets
    .filter(sheet => {
      const data = sheet.data || {};
      return (
        sheet.projectId === targetLogSheet.projectId &&
        data.sceneNumber === targetScene &&
        data.shotNumber === targetShot &&
        sheet.id !== targetLogSheet.id
      );
    })
    .map(sheet => {
      const data = sheet.data || {};
      const takeNum = parseInt(data.takeNumber as string || '0', 10);
      return { sheet, takeNum };
    })
    .filter(({ takeNum }) => !isNaN(takeNum) && takeNum > originalTargetTakeNum) // > original target take number
    .sort((a, b) => a.takeNum - b.takeNum) // Sort ascending (Take 2, Take 3, Take 4...)
    .map(({ sheet }) => sheet);

  // Step 3: Shift each subsequent take sequentially
  // Each shift is based on the PREVIOUS take's ACTUAL values (after it's been shifted)
  let previousTake = { ...targetLogSheet, data: targetResult.updatedData };

  for (const subsequentTake of subsequentTakes) {
    // Create context with previous take as the "inserted" log
    const subsequentContext: MultiCameraShiftContext = {
      ...context,
      insertedTakeData: previousTake.data || {},
      insertedShowRangeMode: {},
      insertedRangeData: {},
      insertedCameraRecState: insertedCameraRecState || {},
      targetLogSheet: subsequentTake
    };

    // Build range mode and range data from previous take's actual data
    const prevData = previousTake.data || {};
    
    // Sound file
    const soundRange = getRangeFromData(prevData, 'soundFile');
    if (soundRange) {
      subsequentContext.insertedShowRangeMode['soundFile'] = true;
      subsequentContext.insertedRangeData['soundFile'] = soundRange;
    } else if (prevData.soundFile && typeof prevData.soundFile === 'string' && !prevData.soundFile.includes('-')) {
      subsequentContext.insertedTakeData.soundFile = prevData.soundFile;
    }

    // Each camera file
    for (let i = 1; i <= cameraConfiguration; i++) {
      const fieldId = `cameraFile${i}`;
      const cameraRange = getRangeFromData(prevData, fieldId);
      if (cameraRange) {
        subsequentContext.insertedShowRangeMode[fieldId] = true;
        subsequentContext.insertedRangeData[fieldId] = cameraRange;
      } else if (prevData[fieldId] && typeof prevData[fieldId] === 'string' && !(prevData[fieldId] as string).includes('-')) {
        subsequentContext.insertedTakeData[fieldId] = prevData[fieldId];
      }
      
      // Preserve REC state
      if (insertedCameraRecState) {
        subsequentContext.insertedCameraRecState![fieldId] = insertedCameraRecState[fieldId] ?? true;
      }
    }

    // Shift this subsequent take
    const subsequentResult = shiftMultiCameraFiles(subsequentContext);
    updateLogSheet(subsequentTake.id, subsequentResult.updatedData);
    results.push(subsequentResult);

    // Update previous take for next iteration
    previousTake = { ...subsequentTake, data: subsequentResult.updatedData };
  }

  return results;
};

