/**
 * Single Camera Shift Handler
 * 
 * Handles file number shifting when a new take is inserted before an existing take
 * for single camera configuration.
 * 
 * Shifting Logic:
 * - For each field (sound, camera):
 *   1. Get upper bound of inserted log for that field
 *   2. New lower bound = upper bound + 1
 *   3. New upper bound = new lower bound + delta - 1 (to maintain same number of files)
 * 
 * Special Cases:
 * - If target field is waste/blank, find last valid non-waste take before it
 * - Only shift fields that have values in the inserted log
 */

import { TakeData, LogSheet } from '@/types';
import { getRangeFromData } from './utils';
import { logger } from './logger';

export interface SingleCameraShiftContext {
  // Inserted log data
  insertedTakeData: TakeData;
  insertedShowRangeMode: { [key: string]: boolean };
  insertedRangeData: { [key: string]: { from: string; to: string } };
  
  // Target log (the one being shifted)
  targetLogSheet: LogSheet;
  
  // Project context
  projectId: string;
  cameraConfiguration: number; // Should be 1 for single camera
  
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

export interface ShiftResult {
  sound: ShiftedFieldResult | null;
  camera: ShiftedFieldResult | null;
  updatedData: Record<string, any>;
}

/**
 * Gets the upper bound of a field from inserted log data
 */
const getInsertedUpperBound = (
  fieldId: string,
  context: SingleCameraShiftContext
): number | null => {
  logger.logFunctionEntry({ fieldId });
  
  const { insertedTakeData, insertedShowRangeMode, insertedRangeData } = context;

  let upperBound: number | null = null;
  let source = 'unknown';

  // Check if in range mode
  if (insertedShowRangeMode[fieldId] && insertedRangeData[fieldId]) {
    const range = insertedRangeData[fieldId];
    if (range.from && range.to) {
      const fromNum = parseInt(range.from, 10) || 0;
      const toNum = parseInt(range.to, 10) || 0;
      upperBound = Math.max(fromNum, toNum);
      source = 'rangeData';
      
      logger.logCalculation(
        'Range Mode Upper Bound',
        `Extracted upper bound from rangeData for ${fieldId}`,
        { from: range.from, to: range.to },
        `Math.max(${fromNum}, ${toNum})`,
        upperBound
      );
    }
  }

  // Check for range format in data
  if (upperBound === null) {
    const rangeFromData = getRangeFromData(insertedTakeData, fieldId);
    if (rangeFromData) {
      const fromNum = parseInt(rangeFromData.from, 10) || 0;
      const toNum = parseInt(rangeFromData.to, 10) || 0;
      upperBound = Math.max(fromNum, toNum);
      source = 'rangeFromData';
      
      logger.logCalculation(
        'Range From Data Upper Bound',
        `Extracted upper bound from getRangeFromData for ${fieldId}`,
        { from: rangeFromData.from, to: rangeFromData.to },
        `Math.max(${fromNum}, ${toNum})`,
        upperBound
      );
    }
  }

  // Check for inline range format
  if (upperBound === null) {
    const fieldValue = insertedTakeData[fieldId];
    if (fieldValue && typeof fieldValue === 'string' && fieldValue.includes('-')) {
      const parts = fieldValue.split('-').map(p => parseInt(p.trim(), 10) || 0);
      if (parts.length === 2) {
        upperBound = Math.max(parts[0], parts[1]);
        source = 'inlineRange';
        
        logger.logCalculation(
          'Inline Range Upper Bound',
          `Extracted upper bound from inline range string for ${fieldId}`,
          { fieldValue },
          `Math.max(${parts[0]}, ${parts[1]})`,
          upperBound
        );
      }
    }
  }

  // Single value
  if (upperBound === null) {
    const fieldValue = insertedTakeData[fieldId];
    if (fieldValue && typeof fieldValue === 'string' && fieldValue.trim()) {
      upperBound = parseInt(fieldValue, 10) || null;
      source = 'singleValue';
      
      if (upperBound !== null) {
        logger.logCalculation(
          'Single Value Upper Bound',
          `Extracted upper bound from single value for ${fieldId}`,
          { fieldValue },
          `parseInt("${fieldValue}", 10)`,
          upperBound
        );
      }
    }
  }

  if (upperBound === null) {
    logger.logWarning(`No upper bound found for ${fieldId}`, { insertedTakeData, insertedShowRangeMode, insertedRangeData });
  } else {
    logger.logDebug(`Upper bound for ${fieldId}`, { upperBound, source });
  }

  logger.logFunctionExit(upperBound);
  return upperBound;
};


/**
 * Calculates shifted values for a single field
 */
const calculateFieldShift = (
  fieldId: string,
  context: SingleCameraShiftContext
): ShiftedFieldResult | null => {
  logger.logFunctionEntry({ fieldId, targetLogSheetId: context.targetLogSheet.id });
  
  const { targetLogSheet, getPreviousTakeUpperBound, projectLogSheets } = context;
  const targetData = targetLogSheet.data || {};

  // Get upper bound of inserted log for this field
  const insertedUpperBound = getInsertedUpperBound(fieldId, context);
  
  // If inserted log doesn't have this field, don't shift
  if (insertedUpperBound === null) {
    logger.logWarning(`Cannot shift ${fieldId}: inserted log has no value for this field`);
    logger.logFunctionExit(null);
    return null;
  }

  // Check if target field exists and is not waste/blank
  const targetHasRange = getRangeFromData(targetData, fieldId);
  const targetSingleValue = targetData[fieldId];
  const targetIsBlank = !targetHasRange && (!targetSingleValue || !targetSingleValue.trim());

  if (targetIsBlank) {
    logger.logDebug(`Target ${fieldId} is blank/waste - finding previous valid take`);
    
    // Target is blank - find previous valid take's upper bound
    const sceneNumber = targetData.sceneNumber as string;
    const shotNumber = targetData.shotNumber as string;
    const takeNumber = parseInt(targetData.takeNumber as string || '0', 10);
    const excludeIds = new Set<string>([targetLogSheet.id]);

    logger.logCalculation(
      'Finding Previous Valid Take',
      `Looking for previous valid ${fieldId} before blank target`,
      { sceneNumber, shotNumber, takeNumber },
      `getPreviousTakeUpperBound(${fieldId}, ${takeNumber}, "${sceneNumber}", "${shotNumber}")`
    );

    const prevUpper = getPreviousTakeUpperBound(
      fieldId,
      takeNumber,
      sceneNumber || '',
      shotNumber || '',
      excludeIds
    );

    if (prevUpper === null) {
      logger.logWarning(`No previous valid take found for ${fieldId}, cannot shift blank field`);
      logger.logFunctionExit(null);
      return null;
    }

    logger.logCalculation(
      'Previous Valid Take Found',
      `Previous valid ${fieldId} upper bound`,
      { prevUpper },
      undefined,
      prevUpper
    );

    // Don't shift blank fields - they stay blank
    logger.logDebug(`Target ${fieldId} is blank - returning null (field stays blank)`);
    logger.logFunctionExit(null);
    return null;
  }

  // Get target's delta (upper - lower, not inclusive count)
  // This is used to maintain the range size when shifting
  let targetDelta = 0;
  let deltaCalculation: string | undefined;
  
  if (targetHasRange) {
    const fromNum = parseInt(targetHasRange.from, 10) || 0;
    const toNum = parseInt(targetHasRange.to, 10) || 0;
    const upper = Math.max(fromNum, toNum);
    const lower = Math.min(fromNum, toNum);
    targetDelta = Math.abs(upper - lower); // NOT +1, just the difference
    deltaCalculation = `Math.abs(${upper} - ${lower}) = ${targetDelta}`;
    
    logger.logCalculation(
      'Target Delta from Range',
      `Calculate target delta for ${fieldId} from range`,
      { from: targetHasRange.from, to: targetHasRange.to, upper, lower },
      deltaCalculation,
      targetDelta
    );
  } else if (targetSingleValue && typeof targetSingleValue === 'string' && targetSingleValue.includes('-')) {
    const parts = targetSingleValue.split('-').map(p => parseInt(p.trim(), 10) || 0);
    if (parts.length === 2) {
      const upper = Math.max(parts[0], parts[1]);
      const lower = Math.min(parts[0], parts[1]);
      targetDelta = Math.abs(upper - lower);
      deltaCalculation = `Math.abs(${upper} - ${lower}) = ${targetDelta}`;
      
      logger.logCalculation(
        'Target Delta from Inline Range',
        `Calculate target delta for ${fieldId} from inline range`,
        { fieldValue: targetSingleValue, upper, lower },
        deltaCalculation,
        targetDelta
      );
    }
  } else {
    // Single value, delta remains 0
    logger.logCalculation(
      'Target Delta for Single Value',
      `Target ${fieldId} is single value`,
      { targetSingleValue },
      'delta = 0 (single value)',
      0
    );
  }

  // Calculate new bounds
  // New lower = upper bound of inserted + 1
  const newLower = insertedUpperBound + 1;
  
  // New upper = new lower + targetDelta (to maintain target's range size)
  // If target was single value (delta = 0), newUpper = newLower (single value)
  const newUpper = newLower + targetDelta;

  logger.logCalculations([
    {
      step: 'Calculate New Lower Bound',
      description: `New lower bound for ${fieldId}`,
      input: { insertedUpperBound },
      calculation: `${insertedUpperBound} + 1`,
      output: newLower
    },
    {
      step: 'Calculate New Upper Bound',
      description: `New upper bound for ${fieldId} (maintains target range size)`,
      input: { newLower, targetDelta },
      calculation: `${newLower} + ${targetDelta}`,
      output: newUpper
    }
  ]);

  // Determine if original was a range
  const wasRange = !!targetHasRange || 
    (targetSingleValue && typeof targetSingleValue === 'string' && targetSingleValue.includes('-'));
  const isRange = wasRange || targetDelta > 1;

  const result = {
    fieldId,
    newLower: String(newLower).padStart(4, '0'),
    newUpper: String(newUpper).padStart(4, '0'),
    isRange,
    wasShifted: true
  };

  logger.logDebug(`${fieldId} shift result`, {
    original: targetHasRange ? `${targetHasRange.from}-${targetHasRange.to}` : targetSingleValue,
    shifted: result.isRange ? `${result.newLower}-${result.newUpper}` : result.newLower
  });

  logger.logFunctionExit(result);
  return result;
};

/**
 * Shifts file numbers for single camera configuration
 * 
 * @param context - Shift context with all necessary data
 * @returns Shift result with new values for sound and camera fields
 */
export const shiftSingleCameraFiles = (context: SingleCameraShiftContext): ShiftResult => {
  logger.logFunctionEntry({
    targetLogSheetId: context.targetLogSheet.id,
    targetTakeNumber: context.targetLogSheet.data?.takeNumber,
    cameraConfiguration: context.cameraConfiguration
  });
  
  const { targetLogSheet, insertedTakeData, insertedShowRangeMode, insertedRangeData } = context;
  const targetData = targetLogSheet.data || {};

  logger.logDebug('Starting shift calculation', {
    insertedTakeData: {
      cameraFile: insertedTakeData.cameraFile,
      soundFile: insertedTakeData.soundFile
    },
    targetData: {
      cameraFile: targetData.cameraFile,
      soundFile: targetData.soundFile
    }
  });

  // Calculate shifted values
  const soundShift = calculateFieldShift('soundFile', context);
  const cameraShift = calculateFieldShift('cameraFile', context);

  // Build updated data
  const updatedData: Record<string, any> = { ...targetData };
  const previousData = { ...targetData };

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

  // Update camera file
  if (cameraShift) {
    if (cameraShift.isRange) {
      updatedData['camera1_from'] = cameraShift.newLower;
      updatedData['camera1_to'] = cameraShift.newUpper;
      // Update inline format if it exists
      if (targetData.cameraFile && typeof targetData.cameraFile === 'string' && targetData.cameraFile.includes('-')) {
        updatedData.cameraFile = `${cameraShift.newLower}-${cameraShift.newUpper}`;
      } else {
        // Create inline format if original was range
        const originalRange = getRangeFromData(targetData, 'cameraFile');
        if (originalRange) {
          updatedData.cameraFile = `${cameraShift.newLower}-${cameraShift.newUpper}`;
        }
      }
    } else {
      // Single value - use new lower as the single value
      updatedData.cameraFile = cameraShift.newLower;
      // Clear range fields if they exist
      delete updatedData['camera1_from'];
      delete updatedData['camera1_to'];
    }
  }

  // Update take number (increment by 1)
  const currentTakeNum = parseInt(targetData.takeNumber as string || '0', 10);
  if (!isNaN(currentTakeNum)) {
    const newTakeNum = currentTakeNum + 1;
    updatedData.takeNumber = String(newTakeNum);
    
    logger.logCalculation(
      'Take Number Increment',
      'Increment take number for shifted log',
      { currentTakeNum },
      `${currentTakeNum} + 1`,
      newTakeNum
    );
  }

  const result = {
    sound: soundShift,
    camera: cameraShift,
    updatedData
  };

  logger.logSave(
    'shiftSingleCameraFiles',
    targetLogSheet.id,
    updatedData,
    previousData
  );

  logger.logFunctionExit(result);
  return result;
};

/**
 * Gets all subsequent takes after a target take (same scene/shot, ordered by take number)
 * 
 * Note: After the target has been shifted, its take number is incremented.
 * This function finds all takes with take number > target's NEW take number.
 */
const getSubsequentTakes = (
  targetLogSheet: LogSheet,
  projectLogSheets: LogSheet[],
  excludeIds: Set<string> = new Set()
): LogSheet[] => {
  logger.logFunctionEntry({ targetLogSheetId: targetLogSheet.id });
  
  const targetData = targetLogSheet.data || {};
  const targetScene = targetData.sceneNumber as string;
  const targetShot = targetData.shotNumber as string;
  const targetTakeNum = parseInt(targetData.takeNumber as string || '0', 10);

  if (!targetScene || !targetShot || isNaN(targetTakeNum)) {
    logger.logWarning('Cannot find subsequent takes: missing scene/shot/take number', {
      targetScene, targetShot, targetTakeNum
    });
    logger.logFunctionExit([]);
    return [];
  }

  const subsequentTakes = projectLogSheets
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
    .filter(({ takeNum }) => !isNaN(takeNum) && takeNum >= targetTakeNum)
    .sort((a, b) => a.takeNum - b.takeNum)
    .map(({ sheet }) => sheet);

  logger.logDebug('Found subsequent takes', {
    count: subsequentTakes.length,
    takeNumbers: subsequentTakes.map(s => s.data?.takeNumber)
  });

  logger.logFunctionExit(subsequentTakes);
  return subsequentTakes;
};

/**
 * Shifts file numbers for single camera configuration with sequential shifting of all subsequent takes
 * 
 * Process:
 * 1. Insert the new log (caller should do this first)
 * 2. Shift the target duplicate (this function)
 * 3. Shift all subsequent takes sequentially (this function)
 * 
 * @param context - Shift context with all necessary data
 * @returns Array of shift results (target + all subsequent takes)
 */
export const shiftSingleCameraFilesSequentially = (
  context: SingleCameraShiftContext
): ShiftResult[] => {
  logger.logFunctionEntry({
    targetLogSheetId: context.targetLogSheet.id,
    targetTakeNumber: context.targetLogSheet.data?.takeNumber,
    projectId: context.projectId
  });
  
  const { targetLogSheet, updateLogSheet, projectLogSheets } = context;
  const results: ShiftResult[] = [];

  // Get target's original take number BEFORE shifting
  const originalTargetData = targetLogSheet.data || {};
  const originalTargetTakeNum = parseInt(originalTargetData.takeNumber as string || '0', 10);
  const targetScene = originalTargetData.sceneNumber as string;
  const targetShot = originalTargetData.shotNumber as string;

  logger.logDebug('Starting sequential shift', {
    originalTargetTakeNum,
    targetScene,
    targetShot
  });

  // Step 1: Shift the target duplicate
  logger.logDebug('Step 1: Shifting target duplicate');
  const targetResult = shiftSingleCameraFiles(context);
  logger.logSave(
    'shiftSingleCameraFilesSequentially - Target',
    targetLogSheet.id,
    targetResult.updatedData,
    originalTargetData
  );
  updateLogSheet(targetLogSheet.id, targetResult.updatedData);
  results.push(targetResult);

  // Step 2: Get all subsequent takes (ordered by take number)
  logger.logDebug('Step 2: Finding subsequent takes');
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
    .filter(({ takeNum }) => !isNaN(takeNum) && takeNum > originalTargetTakeNum)
    .sort((a, b) => a.takeNum - b.takeNum)
    .map(({ sheet }) => sheet);

  logger.logDebug(`Found ${subsequentTakes.length} subsequent takes`, {
    takeNumbers: subsequentTakes.map(s => s.data?.takeNumber)
  });

  // Step 3: Shift each subsequent take sequentially
  logger.logDebug(`Step 3: Shifting ${subsequentTakes.length} subsequent takes sequentially`);
  let previousTake = { ...targetLogSheet, data: targetResult.updatedData };

  for (let i = 0; i < subsequentTakes.length; i++) {
    const subsequentTake = subsequentTakes[i];
    logger.logDebug(`Shifting subsequent take ${i + 1}/${subsequentTakes.length}`, {
      takeId: subsequentTake.id,
      takeNumber: subsequentTake.data?.takeNumber
    });

    // Create context with previous take as the "inserted" log
    const subsequentContext: SingleCameraShiftContext = {
      ...context,
      insertedTakeData: previousTake.data || {},
      insertedShowRangeMode: {},
      insertedRangeData: {},
      targetLogSheet: subsequentTake
    };

    // Build range mode and range data from previous take's actual data
    const prevData = previousTake.data || {};
    const subsequentTakeData = subsequentTake.data || {};
    const sceneNumber = subsequentTakeData.sceneNumber as string;
    const shotNumber = subsequentTakeData.shotNumber as string;
    const takeNumber = parseInt(subsequentTakeData.takeNumber as string || '0', 10);
    const excludeIds = new Set<string>([subsequentTake.id, previousTake.id]);
    
    // Handle sound file
    const soundRange = getRangeFromData(prevData, 'soundFile');
    const prevSoundValue = prevData.soundFile;
    const prevSoundIsBlank = !soundRange && (!prevSoundValue || !prevSoundValue.trim() || 
                        (typeof prevSoundValue === 'string' && prevSoundValue.trim().toUpperCase() === 'WASTE'));
    
    if (soundRange) {
      subsequentContext.insertedShowRangeMode['soundFile'] = true;
      subsequentContext.insertedRangeData['soundFile'] = soundRange;
    } else if (!prevSoundIsBlank && prevSoundValue && typeof prevSoundValue === 'string' && !prevSoundValue.includes('-')) {
      // Previous take has valid sound file - use it
      subsequentContext.insertedTakeData.soundFile = prevSoundValue;
    } else if (prevSoundIsBlank) {
      // Previous take has blank sound - find last valid sound file before it
      logger.logDebug(`Previous take has blank sound - finding last valid sound file`);
      const prevSoundUpper = context.getPreviousTakeUpperBound(
        'soundFile',
        takeNumber,
        sceneNumber || '',
        shotNumber || '',
        excludeIds
      );
      if (prevSoundUpper !== null) {
        // Use the last valid sound file value
        subsequentContext.insertedTakeData.soundFile = String(prevSoundUpper).padStart(4, '0');
        logger.logDebug(`Using last valid sound file: ${prevSoundUpper}`);
      } else {
        logger.logWarning(`No previous valid sound file found for subsequent take ${i + 1}`);
      }
    }

    // Handle camera file
    const cameraRange = getRangeFromData(prevData, 'cameraFile');
    const prevCameraValue = prevData.cameraFile;
    const prevCameraIsBlank = !cameraRange && (!prevCameraValue || !prevCameraValue.trim() ||
                          (typeof prevCameraValue === 'string' && prevCameraValue.trim().toUpperCase() === 'WASTE'));
    
    if (cameraRange) {
      subsequentContext.insertedShowRangeMode['cameraFile'] = true;
      subsequentContext.insertedRangeData['cameraFile'] = cameraRange;
    } else if (!prevCameraIsBlank && prevCameraValue && typeof prevCameraValue === 'string' && !prevCameraValue.includes('-')) {
      // Previous take has valid camera file - use it
      subsequentContext.insertedTakeData.cameraFile = prevCameraValue;
    } else if (prevCameraIsBlank) {
      // Previous take has blank camera - find last valid camera file before it
      logger.logDebug(`Previous take has blank camera - finding last valid camera file`);
      const prevCameraUpper = context.getPreviousTakeUpperBound(
        'cameraFile',
        takeNumber,
        sceneNumber || '',
        shotNumber || '',
        excludeIds
      );
      if (prevCameraUpper !== null) {
        // Use the last valid camera file value
        subsequentContext.insertedTakeData.cameraFile = String(prevCameraUpper).padStart(4, '0');
        logger.logDebug(`Using last valid camera file: ${prevCameraUpper}`);
      } else {
        logger.logWarning(`No previous valid camera file found for subsequent take ${i + 1}`);
      }
    }

    // Shift this subsequent take
    const subsequentResult = shiftSingleCameraFiles(subsequentContext);
    const previousSubsequentData = subsequentTake.data || {};
    
    logger.logSave(
      `shiftSingleCameraFilesSequentially - Subsequent Take ${i + 1}`,
      subsequentTake.id,
      subsequentResult.updatedData,
      previousSubsequentData
    );
    
    updateLogSheet(subsequentTake.id, subsequentResult.updatedData);
    results.push(subsequentResult);

    // Update previous take for next iteration
    previousTake = { ...subsequentTake, data: subsequentResult.updatedData };
  }

  logger.logDebug('Sequential shifting complete', {
    totalShifts: results.length,
    targetShifted: true,
    subsequentShifts: results.length - 1
  });

  logger.logFunctionExit(results);
  return results;
};

