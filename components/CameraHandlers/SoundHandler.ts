/**
 * Sound Handler
 * 
 * Centralized component for handling sound file operations.
 * This ensures sound file logic is in one place for easier debugging and maintenance.
 * 
 * Features:
 * - Calculate sound file delta
 * - Find previous available sound file
 * - Determine sound file start value for shifting
 * - Handle sound file shifting logic
 * 
 * Works for both single and multi-camera settings.
 */

import { TakeData, LogSheet } from '@/types';
import { getRangeFromData } from './utils';
import { calculateSoundDelta, DeltaCalculationInput } from './deltaCalculator';
import { logger } from './logger';

export interface SoundHandlerContext {
  // Project context
  projectId: string;
  projectLogSheets: LogSheet[];
  
  // Current operation data
  takeData?: TakeData;
  showRangeMode?: { [key: string]: boolean };
  rangeData?: { [key: string]: { from: string; to: string } };
  
  // Existing entry (target duplicate)
  existingEntry?: LogSheet;
  
  // Scene/Shot context
  sceneNumber?: string;
  shotNumber?: string;
  takeNumber?: number;
}

export interface SoundFileInfo {
  value: number | null;
  isRange: boolean;
  upper: number;
  lower: number;
  fieldValue: string | null;
}

export interface PreviousSoundFileResult {
  previousUpperBound: number | null;
  sourceTake: LogSheet | null;
  sourceTakeNumber: number | null;
}

/**
 * Gets sound file information from data
 */
export const getSoundFileInfo = (
  data: any
): SoundFileInfo | null => {
  logger.logFunctionEntry({ hasData: !!data });
  
  // Check for range format in separate fields
  const soundRange = getRangeFromData(data, 'soundFile');
  if (soundRange) {
    const fromNum = parseInt(soundRange.from, 10) || 0;
    const toNum = parseInt(soundRange.to, 10) || 0;
    const upper = Math.max(fromNum, toNum);
    const lower = Math.min(fromNum, toNum);
    
    const result: SoundFileInfo = {
      value: upper,
      isRange: true,
      upper,
      lower,
      fieldValue: `${soundRange.from}-${soundRange.to}`
    };
    
    logger.logDebug('Sound file info from range fields', { result });
    logger.logFunctionExit(result);
    return result;
  }
  
  // Check for inline range format (e.g., "001-003")
  const soundFile = data?.soundFile;
  if (soundFile && typeof soundFile === 'string') {
    if (soundFile.includes('-')) {
      const parts = soundFile.split('-').map(p => parseInt(p.trim(), 10) || 0);
      if (parts.length === 2) {
        const upper = Math.max(parts[0], parts[1]);
        const lower = Math.min(parts[0], parts[1]);
        
        const result: SoundFileInfo = {
          value: upper,
          isRange: true,
          upper,
          lower,
          fieldValue: soundFile
        };
        
        logger.logDebug('Sound file info from inline range', { result });
        logger.logFunctionExit(result);
        return result;
      }
    } else if (soundFile.trim()) {
      const num = parseInt(soundFile, 10);
      if (!Number.isNaN(num)) {
        const result: SoundFileInfo = {
          value: num,
          isRange: false,
          upper: num,
          lower: num,
          fieldValue: soundFile
        };
        
        logger.logDebug('Sound file info from single value', { result });
        logger.logFunctionExit(result);
        return result;
      }
    }
  }
  
  // Blank/waste field
  logger.logDebug('Sound file is blank/waste', { soundFile });
  logger.logFunctionExit(null);
  return null;
};

/**
 * Checks if a sound file is blank/waste
 */
export const isSoundFileBlank = (data: any): boolean => {
  const soundInfo = getSoundFileInfo(data);
  return soundInfo === null;
};

/**
 * Calculates sound file delta from context
 * 
 * Delta Calculation Rules:
 * - Range: delta = upper - lower (just the difference, not inclusive count)
 * - Single value: delta = 1
 */
export const calculateSoundFileDelta = (
  context: SoundHandlerContext
): number => {
  logger.logFunctionEntry({
    hasTakeData: !!context.takeData,
    hasExistingEntry: !!context.existingEntry,
    hasShowRangeMode: !!context.showRangeMode,
    hasRangeData: !!context.rangeData
  });
  
  let delta = 0;
  let calculationMethod = 'unknown';
  let calculationDetails: any = {};
  
  // Check if we're calculating from takeData (new entry) or existing entry
  const data = context.takeData || context.existingEntry?.data;
  
  // First, check range mode (for new entries)
  if (context.takeData && context.showRangeMode && context.rangeData) {
    const isRangeMode = context.showRangeMode['soundFile'];
    const range = context.rangeData['soundFile'];
    
    if (isRangeMode && range?.from && range?.to) {
      const fromNum = parseInt(range.from, 10) || 0;
      const toNum = parseInt(range.to, 10) || 0;
      const upper = Math.max(fromNum, toNum);
      const lower = Math.min(fromNum, toNum);
      // Delta = upper - lower (not +1, just the difference)
      delta = Math.abs(upper - lower);
      calculationMethod = 'rangeMode';
      calculationDetails = { from: range.from, to: range.to, upper, lower };
      
      logger.logCalculation(
        'Sound File Delta from Range Mode',
        'Calculate sound file delta from rangeMode',
        calculationDetails,
        `Math.abs(${upper} - ${lower}) = ${delta}`,
        delta
      );
    }
  }
  
  // Check for range format in data (sound_from/sound_to)
  if (delta === 0 && data) {
    const soundRange = getRangeFromData(data, 'soundFile');
    if (soundRange) {
      const fromNum = parseInt(soundRange.from, 10) || 0;
      const toNum = parseInt(soundRange.to, 10) || 0;
      const upper = Math.max(fromNum, toNum);
      const lower = Math.min(fromNum, toNum);
      // Delta = upper - lower (not +1, just the difference)
      delta = Math.abs(upper - lower);
      calculationMethod = 'rangeFromData';
      calculationDetails = { from: soundRange.from, to: soundRange.to, upper, lower };
      
      logger.logCalculation(
        'Sound File Delta from Range Data',
        'Calculate sound file delta from getRangeFromData',
        calculationDetails,
        `Math.abs(${upper} - ${lower}) = ${delta}`,
        delta
      );
    }
  }
  
  // Check for inline range format (e.g., "001-003")
  if (delta === 0 && data) {
    const soundFile = data.soundFile;
    if (soundFile && typeof soundFile === 'string' && soundFile.includes('-')) {
      const parts = soundFile.split('-').map(p => parseInt(p.trim(), 10) || 0);
      if (parts.length === 2) {
        const upper = Math.max(parts[0], parts[1]);
        const lower = Math.min(parts[0], parts[1]);
        // Delta = upper - lower (not +1, just the difference)
        delta = Math.abs(upper - lower);
        calculationMethod = 'inlineRange';
        calculationDetails = { fieldValue: soundFile, upper, lower };
        
        logger.logCalculation(
          'Sound File Delta from Inline Range',
          'Calculate sound file delta from inline range string',
          calculationDetails,
          `Math.abs(${upper} - ${lower}) = ${delta}`,
          delta
        );
      }
    }
  }
  
  // Single value: delta is always 1
  if (delta === 0 && data) {
    const soundFile = data.soundFile;
    if (soundFile && typeof soundFile === 'string' && soundFile.trim() && !soundFile.includes('-')) {
      const num = parseInt(soundFile, 10);
      if (!Number.isNaN(num)) {
        delta = 1;
        calculationMethod = 'singleValue';
        calculationDetails = { fieldValue: soundFile };
        
        logger.logCalculation(
          'Sound File Delta for Single Value',
          'Calculate sound file delta (single value)',
          calculationDetails,
          'delta = 1 (single value)',
          1
        );
      }
    }
  }
  
  // If input sound field is blank, delta is 0
  if (delta === 0 && calculationMethod === 'unknown') {
    if (context.takeData && (!context.takeData.soundFile || !context.takeData.soundFile.trim())) {
      logger.logCalculation(
        'Sound File Delta - Blank Field',
        'Sound file is blank, delta = 0',
        { hasSoundFile: false },
        'delta = 0 (blank field)',
        0
      );
    } else {
      logger.logWarning('Could not calculate sound file delta', { context });
    }
  }
  
  logger.logDebug('Sound file delta calculation result', {
    delta,
    calculationMethod,
    calculationDetails
  });
  
  logger.logFunctionExit(delta);
  return delta;
};

/**
 * Finds the previous available sound file upper bound
 * 
 * This function searches backwards through takes in the same scene/shot
 * to find the last valid (non-blank, non-waste) sound file value.
 */
export const getPreviousAvailableSoundFile = (
  context: SoundHandlerContext,
  currentTakeNumber: number,
  excludeIds: Set<string> = new Set()
): PreviousSoundFileResult => {
  logger.logFunctionEntry({
    currentTakeNumber,
    sceneNumber: context.sceneNumber,
    shotNumber: context.shotNumber,
    excludeIdsSize: excludeIds.size
  });
  
  const { projectLogSheets, sceneNumber, shotNumber } = context;
  
  if (!sceneNumber || !shotNumber) {
    logger.logWarning('Cannot find previous sound file: missing scene or shot number');
    logger.logFunctionExit({ previousUpperBound: null, sourceTake: null, sourceTakeNumber: null });
    return { previousUpperBound: null, sourceTake: null, sourceTakeNumber: null };
  }
  
  // Filter and sort takes in same scene/shot
  const relevantTakes = projectLogSheets
    .filter(sheet => {
      if (sheet.projectId !== context.projectId) return false;
      if (excludeIds.has(sheet.id)) return false;
      
      const data = sheet.data || {};
      return (
        data.sceneNumber === sceneNumber &&
        data.shotNumber === shotNumber
      );
    })
    .map(sheet => {
      const data = sheet.data || {};
      const takeNum = parseInt(data.takeNumber as string || '0', 10);
      return { sheet, takeNum };
    })
    .filter(({ takeNum }) => !Number.isNaN(takeNum) && takeNum < currentTakeNumber)
    .sort((a, b) => b.takeNum - a.takeNum); // Sort descending to get most recent first
  
  logger.logDebug('Searching for previous sound file', {
    relevantTakesCount: relevantTakes.length,
    takeNumbers: relevantTakes.map(t => t.takeNum)
  });
  
  // Search backwards through takes
  for (const { sheet, takeNum } of relevantTakes) {
    const data = sheet.data || {};
    
    // Skip waste, Ambience, and SFX classifications
    const classification = data.classification as string;
    if (classification === 'Waste' || classification === 'Ambience' || classification === 'SFX') {
      logger.logDebug(`Skipping take ${takeNum} (classification: ${classification})`);
      continue;
    }
    
    const soundInfo = getSoundFileInfo(data);
    
    if (soundInfo && soundInfo.value !== null) {
      logger.logCalculation(
        'Previous Sound File Found',
        `Found previous valid sound file at take ${takeNum}`,
        { takeNumber: takeNum, soundUpper: soundInfo.upper },
        undefined,
        soundInfo.upper
      );
      
      logger.logFunctionExit({
        previousUpperBound: soundInfo.upper,
        sourceTake: sheet,
        sourceTakeNumber: takeNum
      });
      
      return {
        previousUpperBound: soundInfo.upper,
        sourceTake: sheet,
        sourceTakeNumber: takeNum
      };
    }
  }
  
  logger.logWarning('No previous valid sound file found', {
    currentTakeNumber,
    sceneNumber,
    shotNumber,
    searchedTakesCount: relevantTakes.length
  });
  
  logger.logFunctionExit({ previousUpperBound: null, sourceTake: null, sourceTakeNumber: null });
  return { previousUpperBound: null, sourceTake: null, sourceTakeNumber: null };
};

/**
 * Determines the sound file start value for shifting operations
 * 
 * Priority:
 * 1. Existing entry's sound file (if it has one)
 * 2. Inserted log's sound file (if existing entry is blank)
 * 3. Previous available sound file (if both are blank)
 */
export const getSoundFileStartForShifting = (
  context: SoundHandlerContext,
  targetTakeNumber?: number
): number | null => {
  logger.logFunctionEntry({
    hasExistingEntry: !!context.existingEntry,
    hasTakeData: !!context.takeData,
    targetTakeNumber
  });
  
  let soundStart: number | null = null;
  let source = 'unknown';
  
  // Check if existing entry has sound file
  if (context.existingEntry) {
    const existingSoundInfo = getSoundFileInfo(context.existingEntry.data);
    if (existingSoundInfo && existingSoundInfo.value !== null) {
      soundStart = existingSoundInfo.lower; // Use lower bound for start
      source = 'existingEntry';
      
      logger.logCalculation(
        'Sound Start from Existing Entry',
        'Get sound start from existing entry',
        { existingSoundInfo },
        'existingSoundInfo.lower',
        soundStart
      );
    }
  }
  
  // If existing entry has blank sound, use inserted log's sound file
  if (soundStart === null && context.takeData) {
    const insertedSoundInfo = getSoundFileInfo(context.takeData);
    if (insertedSoundInfo && insertedSoundInfo.value !== null) {
      soundStart = insertedSoundInfo.lower; // Use lower bound for start
      source = 'insertedLog';
      
      logger.logCalculation(
        'Sound Start from Inserted Log',
        'Get sound start from inserted log (existing entry is blank)',
        { insertedSoundInfo },
        'insertedSoundInfo.lower',
        soundStart
      );
    }
  }
  
  // If both are blank, find previous available sound file
  if (soundStart === null && targetTakeNumber !== undefined) {
    const excludeIds = new Set<string>();
    if (context.existingEntry?.id) excludeIds.add(context.existingEntry.id);
    
    const previousSound = getPreviousAvailableSoundFile(
      context,
      targetTakeNumber,
      excludeIds
    );
    
    if (previousSound.previousUpperBound !== null) {
      soundStart = previousSound.previousUpperBound;
      source = 'previousAvailable';
      
      logger.logCalculation(
        'Sound Start from Previous Available',
        'Get sound start from previous available take',
        { 
          previousUpperBound: previousSound.previousUpperBound,
          sourceTakeNumber: previousSound.sourceTakeNumber
        },
        'previousSound.previousUpperBound',
        soundStart
      );
    }
  }
  
  if (soundStart === null) {
    logger.logWarning('Could not determine sound file start value', { context });
  } else {
    logger.logDebug('Sound file start determined', { soundStart, source });
  }
  
  logger.logFunctionExit({ soundStart, source });
  return soundStart;
};

/**
 * Checks if sound file needs shifting
 */
export const shouldShiftSoundFile = (
  context: SoundHandlerContext,
  fromNumber: number
): boolean => {
  logger.logFunctionEntry({ fromNumber, hasExistingEntry: !!context.existingEntry });
  
  if (!context.existingEntry) {
    logger.logFunctionExit(false);
    return false;
  }
  
  const soundInfo = getSoundFileInfo(context.existingEntry.data);
  
  if (!soundInfo || soundInfo.value === null) {
    // Blank sound file - don't shift it, but subsequent takes should be shifted
    logger.logDebug('Sound file is blank - will not shift, but subsequent takes will use previous valid value');
    logger.logFunctionExit(false);
    return false;
  }
  
  // Check if sound file value is >= fromNumber
  const needsShift = soundInfo.lower >= fromNumber || soundInfo.upper >= fromNumber;
  
  logger.logCalculation(
    'Should Shift Sound File',
    'Determine if sound file needs shifting',
    { soundInfo, fromNumber },
    `soundInfo.lower >= ${fromNumber} || soundInfo.upper >= ${fromNumber}`,
    needsShift
  );
  
  logger.logFunctionExit(needsShift);
  return needsShift;
};

/**
 * Gets the sound file value for shifting subsequent takes
 * 
 * This function finds the previous record's sound file upper bound.
 * If the previous record has a blank sound file, it looks further back.
 * 
 * Returns the upper bound value that should be used as the base for shifting.
 */
export const getSoundFileValueForSubsequentShift = (
  context: SoundHandlerContext,
  previousTakeNumber: number
): number | null => {
  logger.logFunctionEntry({
    previousTakeNumber,
    sceneNumber: context.sceneNumber,
    shotNumber: context.shotNumber
  });
  
  // Get the previous take
  const previousTake = context.projectLogSheets.find(sheet => {
    const data = sheet.data || {};
    const takeNum = parseInt(data.takeNumber as string || '0', 10);
    return (
      sheet.projectId === context.projectId &&
      data.sceneNumber === context.sceneNumber &&
      data.shotNumber === context.shotNumber &&
      takeNum === previousTakeNumber
    );
  });
  
  if (!previousTake) {
    logger.logWarning('Previous take not found', { previousTakeNumber });
    logger.logFunctionExit(null);
    return null;
  }
  
  const previousData = previousTake.data || {};
  const previousSoundInfo = getSoundFileInfo(previousData);
  
  // If previous take has a valid sound file, return its upper bound
  if (previousSoundInfo && previousSoundInfo.value !== null) {
    logger.logCalculation(
      'Sound File Value from Previous Take',
      `Previous take ${previousTakeNumber} has valid sound file`,
      { previousTakeNumber, soundInfo: previousSoundInfo },
      `previousSoundInfo.upper = ${previousSoundInfo.upper}`,
      previousSoundInfo.upper
    );
    
    logger.logFunctionExit(previousSoundInfo.upper);
    return previousSoundInfo.upper;
  }
  
  // Previous take has blank sound - find the last valid sound file before it
  logger.logDebug(`Previous take ${previousTakeNumber} has blank sound - finding last valid sound file`);
  const excludeIds = new Set<string>([previousTake.id]);
  
  const previousValid = getPreviousAvailableSoundFile(
    context,
    previousTakeNumber,
    excludeIds
  );
  
  if (previousValid.previousUpperBound !== null) {
    logger.logCalculation(
      'Sound File Value from Previous Valid Take',
      `Found last valid sound file before take ${previousTakeNumber}`,
      {
        previousTakeNumber,
        sourceTakeNumber: previousValid.sourceTakeNumber,
        previousUpperBound: previousValid.previousUpperBound
      },
      `previousValid.previousUpperBound = ${previousValid.previousUpperBound}`,
      previousValid.previousUpperBound
    );
    
    logger.logFunctionExit(previousValid.previousUpperBound);
    return previousValid.previousUpperBound;
  }
  
  logger.logWarning('No previous valid sound file found for subsequent shift', {
    previousTakeNumber
  });
  
  logger.logFunctionExit(null);
  return null;
};

/**
 * Main function to handle sound file operations for duplicate insertion
 * 
 * This function determines:
 * - Whether sound file should be shifted
 * - What the start value should be
 * - What the delta should be
 */
export const handleSoundFileForDuplicateInsertion = (
  context: SoundHandlerContext,
  targetTakeNumber: number
): {
  shouldShift: boolean;
  soundStart: number | null;
  soundDelta: number;
  shouldCallUpdateFileNumbers: boolean;
} => {
  logger.logFunctionEntry({
    targetTakeNumber,
    hasExistingEntry: !!context.existingEntry,
    hasTakeData: !!context.takeData
  });
  
  // Calculate delta (upper - lower for ranges, 1 for single values)
  const soundDelta = calculateSoundFileDelta(context);
  
  logger.logDebug('Sound file delta calculated', { soundDelta });
  
  // Get sound start value
  const soundStart = getSoundFileStartForShifting(context, targetTakeNumber);
  
  logger.logDebug('Sound file start determined', { soundStart });
  
  // Determine if we should shift
  let shouldShift = false;
  if (context.existingEntry && soundStart !== null) {
    const existingSoundInfo = getSoundFileInfo(context.existingEntry.data);
    if (existingSoundInfo && existingSoundInfo.value !== null) {
      // Existing entry has sound - check if it needs shifting
      shouldShift = existingSoundInfo.lower === soundStart || 
                   existingSoundInfo.upper === soundStart ||
                   (existingSoundInfo.lower <= soundStart && existingSoundInfo.upper >= soundStart);
      
      logger.logDebug('Existing entry has sound file', {
        existingSoundInfo,
        soundStart,
        shouldShift
      });
    } else {
      // Existing entry has blank sound - we still need to shift subsequent takes
      shouldShift = false; // Don't shift the blank field itself
      logger.logDebug('Existing entry has blank sound - will not shift blank field, but subsequent takes will be shifted');
    }
  }
  
  // Determine if we should call updateFileNumbers
  const shouldCallUpdateFileNumbers = soundStart !== null && soundDelta > 0;
  
  logger.logCalculations([
    {
      step: 'Sound File Delta Calculation',
      description: 'Calculate sound file delta (upper - lower for ranges, 1 for single)',
      input: { 
        hasTakeData: !!context.takeData, 
        hasExistingEntry: !!context.existingEntry,
        takeDataSoundFile: context.takeData?.soundFile,
        rangeData: context.rangeData?.['soundFile']
      },
      calculation: 'calculateSoundFileDelta(context)',
      output: soundDelta
    },
    {
      step: 'Sound File Start Determination',
      description: 'Get sound file start value for shifting',
      input: { targetTakeNumber, sceneNumber: context.sceneNumber, shotNumber: context.shotNumber },
      calculation: 'getSoundFileStartForShifting(context, targetTakeNumber)',
      output: soundStart
    },
    {
      step: 'Should Shift Existing Entry',
      description: 'Determine if existing entry sound file should be shifted',
      input: { shouldShift, soundStart, existingEntryHasSound: !!context.existingEntry },
      calculation: undefined,
      output: shouldShift
    },
    {
      step: 'Should Call UpdateFileNumbers',
      description: 'Determine if updateFileNumbers should be called',
      input: { soundStart, soundDelta },
      calculation: `soundStart !== null && soundDelta > 0`,
      output: shouldCallUpdateFileNumbers
    }
  ]);
  
  const result = {
    shouldShift,
    soundStart,
    soundDelta,
    shouldCallUpdateFileNumbers
  };
  
  logger.logFunctionExit(result);
  return result;
};

