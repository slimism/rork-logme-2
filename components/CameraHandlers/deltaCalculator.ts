/**
 * Delta Calculator
 * 
 * Centralized component for calculating delta values for file numbers.
 * This ensures delta calculation logic is in one place for easier debugging.
 * 
 * Delta Calculation Rules:
 * - Single value (not a range): delta = 1
 * - Range value: delta = Math.abs(upper - lower) + 1 (inclusive range)
 * 
 * Applies to:
 * - Sound file
 * - Camera file(s) (single or multiple depending on project settings)
 */

import { TakeData, LogSheet } from '@/types';
import { getRangeFromData } from './utils';
import { logger } from './logger';

export interface DeltaCalculationInput {
  // For takeData (new entry)
  takeData?: TakeData;
  showRangeMode?: { [key: string]: boolean };
  rangeData?: { [key: string]: { from: string; to: string } };
  
  // For existing logSheet data
  logSheetData?: any;
}

export interface DeltaCalculationResult {
  soundDelta: number;
  cameraDeltas: { [fieldId: string]: number };
  totalDelta: number; // Sum of all deltas
}

/**
 * Calculates delta for a single field (sound or camera)
 * 
 * @param fieldId - Field identifier (e.g., 'soundFile', 'cameraFile', 'cameraFile1')
 * @param input - Input data containing either takeData or logSheetData
 * @returns Delta value (1 for single value, upper - lower + 1 for range)
 */
export const calculateFieldDelta = (
  fieldId: string,
  input: DeltaCalculationInput
): number => {
  logger.logFunctionEntry({ fieldId, hasTakeData: !!input.takeData, hasLogSheetData: !!input.logSheetData });
  
  const { takeData, showRangeMode, rangeData, logSheetData } = input;

  // Check if we're calculating from takeData (new entry) or logSheetData (existing entry)
  const data = takeData || logSheetData;
  const isFromTakeData = !!takeData;

  let delta = 0;
  let calculationMethod = 'unknown';

  // If calculating from takeData, check range mode
  if (isFromTakeData && showRangeMode && rangeData) {
    const isRangeMode = showRangeMode[fieldId];
    const range = rangeData[fieldId];

    if (isRangeMode && range?.from && range?.to) {
      // Range mode: calculate delta from range
      const fromNum = parseInt(range.from, 10) || 0;
      const toNum = parseInt(range.to, 10) || 0;
      const upper = Math.max(fromNum, toNum);
      const lower = Math.min(fromNum, toNum);
      // For inclusive range: upper - lower + 1
      // Example: 001-003 includes 001, 002, 003 = 3 files
      delta = Math.abs(upper - lower) + 1;
      calculationMethod = 'rangeMode';
      
      logger.logCalculation(
        'Delta from Range Mode',
        `Calculate delta for ${fieldId} from rangeMode`,
        { from: range.from, to: range.to, upper, lower },
        `Math.abs(${upper} - ${lower}) + 1`,
        delta
      );
    }
  }

  // Check for range format in data (sound_from/sound_to, camera1_from/camera1_to, etc.)
  if (delta === 0) {
    const rangeFromData = getRangeFromData(data, fieldId);
    if (rangeFromData) {
      const fromNum = parseInt(rangeFromData.from, 10) || 0;
      const toNum = parseInt(rangeFromData.to, 10) || 0;
      const upper = Math.max(fromNum, toNum);
      const lower = Math.min(fromNum, toNum);
      delta = Math.abs(upper - lower) + 1;
      calculationMethod = 'rangeFromData';
      
      logger.logCalculation(
        'Delta from Range Data',
        `Calculate delta for ${fieldId} from getRangeFromData`,
        { from: rangeFromData.from, to: rangeFromData.to, upper, lower },
        `Math.abs(${upper} - ${lower}) + 1`,
        delta
      );
    }
  }

  // Check for inline range format (e.g., "001-003")
  if (delta === 0) {
    const fieldValue = data?.[fieldId];
    if (fieldValue && typeof fieldValue === 'string' && fieldValue.includes('-')) {
      const parts = fieldValue.split('-').map(p => parseInt(p.trim(), 10) || 0);
      if (parts.length === 2) {
        const upper = Math.max(parts[0], parts[1]);
        const lower = Math.min(parts[0], parts[1]);
        delta = Math.abs(upper - lower) + 1;
        calculationMethod = 'inlineRange';
        
        logger.logCalculation(
          'Delta from Inline Range',
          `Calculate delta for ${fieldId} from inline range string`,
          { fieldValue, upper, lower },
          `Math.abs(${upper} - ${lower}) + 1`,
          delta
        );
      }
    }
  }

  // Single value: delta is always 1
  if (delta === 0) {
    const fieldValue = data?.[fieldId];
    if (fieldValue && typeof fieldValue === 'string' && fieldValue.trim()) {
      delta = 1;
      calculationMethod = 'singleValue';
      
      logger.logCalculation(
        'Delta for Single Value',
        `Calculate delta for ${fieldId} (single value)`,
        { fieldValue },
        'delta = 1 (single value)',
        1
      );
    }
  }

  // No value or empty: delta is 0
  if (delta === 0 && calculationMethod === 'unknown') {
    logger.logWarning(`No delta calculated for ${fieldId}: field is empty or invalid`, { input });
  }

  logger.logFunctionExit(delta);
  return delta;
};

/**
 * Calculates delta for sound file (for shifting operations)
 * 
 * Delta Calculation Rules for Sound:
 * - Range: delta = upper - lower (just the difference, not inclusive count)
 * - Single value: delta = 1
 * 
 * This is different from calculateFieldDelta which adds +1 for ranges.
 * Sound delta for shifting uses just the difference to maintain range size.
 * 
 * @param input - Input data
 * @returns Delta value for sound file (upper - lower for ranges, 1 for single)
 */
export const calculateSoundDeltaForShifting = (input: DeltaCalculationInput): number => {
  logger.logFunctionEntry({ hasTakeData: !!input.takeData, hasLogSheetData: !!input.logSheetData });
  
  const { takeData, showRangeMode, rangeData, logSheetData } = input;
  const data = takeData || logSheetData;
  const isFromTakeData = !!takeData;

  let delta = 0;
  let calculationMethod = 'unknown';
  let calculationDetails: any = {};

  // If calculating from takeData, check range mode
  if (isFromTakeData && showRangeMode && rangeData) {
    const isRangeMode = showRangeMode['soundFile'];
    const range = rangeData['soundFile'];

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
        'Sound Delta from Range Mode',
        'Calculate sound delta from rangeMode (for shifting)',
        calculationDetails,
        `Math.abs(${upper} - ${lower}) = ${delta}`,
        delta
      );
    }
  }

  // Check for range format in data (sound_from/sound_to)
  if (delta === 0 && data) {
    const rangeFromData = getRangeFromData(data, 'soundFile');
    if (rangeFromData) {
      const fromNum = parseInt(rangeFromData.from, 10) || 0;
      const toNum = parseInt(rangeFromData.to, 10) || 0;
      const upper = Math.max(fromNum, toNum);
      const lower = Math.min(fromNum, toNum);
      // Delta = upper - lower (not +1, just the difference)
      delta = Math.abs(upper - lower);
      calculationMethod = 'rangeFromData';
      calculationDetails = { from: rangeFromData.from, to: rangeFromData.to, upper, lower };
      
      logger.logCalculation(
        'Sound Delta from Range Data',
        'Calculate sound delta from getRangeFromData (for shifting)',
        calculationDetails,
        `Math.abs(${upper} - ${lower}) = ${delta}`,
        delta
      );
    }
  }

  // Check for inline range format (e.g., "001-003")
  if (delta === 0 && data) {
    const soundFile = data?.soundFile;
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
          'Sound Delta from Inline Range',
          'Calculate sound delta from inline range string (for shifting)',
          calculationDetails,
          `Math.abs(${upper} - ${lower}) = ${delta}`,
          delta
        );
      }
    }
  }

  // Single value: delta is always 1
  if (delta === 0 && data) {
    const soundFile = data?.soundFile;
    if (soundFile && typeof soundFile === 'string' && soundFile.trim() && !soundFile.includes('-')) {
      const num = parseInt(soundFile, 10);
      if (!Number.isNaN(num)) {
        delta = 1;
        calculationMethod = 'singleValue';
        calculationDetails = { fieldValue: soundFile };
        
        logger.logCalculation(
          'Sound Delta for Single Value',
          'Calculate sound delta (single value, for shifting)',
          calculationDetails,
          'delta = 1 (single value)',
          1
        );
      }
    }
  }

  // If input sound field is blank, delta is 0
  if (delta === 0 && calculationMethod === 'unknown') {
    if (input.takeData && (!input.takeData.soundFile || !input.takeData.soundFile.trim())) {
      logger.logCalculation(
        'Sound Delta - Blank Field',
        'Sound file is blank, delta = 0',
        { hasSoundFile: false },
        'delta = 0 (blank field)',
        0
      );
    } else {
      logger.logWarning('Could not calculate sound delta for shifting', { input });
    }
  }

  logger.logDebug('Sound delta calculation result (for shifting)', {
    delta,
    calculationMethod,
    calculationDetails
  });

  logger.logFunctionExit(delta);
  return delta;
};

/**
 * Calculates delta for sound file (inclusive count - for file counting purposes)
 * 
 * Note: This uses the inclusive count formula (upper - lower + 1).
 * For shifting operations, use calculateSoundDeltaForShifting instead.
 * 
 * @param input - Input data
 * @returns Delta value for sound file (inclusive count)
 */
export const calculateSoundDelta = (input: DeltaCalculationInput): number => {
  return calculateFieldDelta('soundFile', input);
};

/**
 * Calculates delta for camera file (for shifting operations)
 * 
 * Delta Calculation Rules for Camera:
 * - Range: delta = upper - lower (just the difference, not inclusive count)
 * - Single value: delta = 1
 * - Blank/waste: delta = 0
 * 
 * This is different from calculateFieldDelta which adds +1 for ranges.
 * Camera delta for shifting uses just the difference to maintain range size.
 * 
 * @param input - Input data
 * @param fieldId - Camera field identifier (e.g., 'cameraFile', 'cameraFile1', 'cameraFile2')
 * @returns Delta value for camera file (upper - lower for ranges, 1 for single, 0 for blank)
 */
export const calculateCameraDeltaForShifting = (
  input: DeltaCalculationInput,
  fieldId: string
): number => {
  logger.logFunctionEntry({ fieldId, hasTakeData: !!input.takeData, hasLogSheetData: !!input.logSheetData });
  
  const { takeData, showRangeMode, rangeData, logSheetData } = input;
  const data = takeData || logSheetData;
  const isFromTakeData = !!takeData;

  let delta = 0;
  let calculationMethod = 'unknown';
  let calculationDetails: any = {};

  // If calculating from takeData, check range mode
  if (isFromTakeData && showRangeMode && rangeData) {
    const isRangeMode = showRangeMode[fieldId];
    const range = rangeData[fieldId];

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
        'Camera Delta from Range Mode',
        `Calculate camera delta from rangeMode (for shifting)`,
        calculationDetails,
        `Math.abs(${upper} - ${lower}) = ${delta}`,
        delta
      );
    }
  }

  // Check for range format in data (camera1_from/camera1_to, etc.)
  if (delta === 0 && data) {
    const rangeFromData = getRangeFromData(data, fieldId);
    if (rangeFromData) {
      const fromNum = parseInt(rangeFromData.from, 10) || 0;
      const toNum = parseInt(rangeFromData.to, 10) || 0;
      const upper = Math.max(fromNum, toNum);
      const lower = Math.min(fromNum, toNum);
      // Delta = upper - lower (not +1, just the difference)
      delta = Math.abs(upper - lower);
      calculationMethod = 'rangeFromData';
      calculationDetails = { from: rangeFromData.from, to: rangeFromData.to, upper, lower };
      
      logger.logCalculation(
        'Camera Delta from Range Data',
        `Calculate camera delta from getRangeFromData (for shifting)`,
        calculationDetails,
        `Math.abs(${upper} - ${lower}) = ${delta}`,
        delta
      );
    }
  }

  // Check for inline range format (e.g., "001-003")
  if (delta === 0 && data) {
    const fieldValue = data?.[fieldId];
    if (fieldValue && typeof fieldValue === 'string' && fieldValue.includes('-')) {
      const parts = fieldValue.split('-').map(p => parseInt(p.trim(), 10) || 0);
      if (parts.length === 2) {
        const upper = Math.max(parts[0], parts[1]);
        const lower = Math.min(parts[0], parts[1]);
        // Delta = upper - lower (not +1, just the difference)
        delta = Math.abs(upper - lower);
        calculationMethod = 'inlineRange';
        calculationDetails = { fieldValue, upper, lower };
        
        logger.logCalculation(
          'Camera Delta from Inline Range',
          `Calculate camera delta from inline range string (for shifting)`,
          calculationDetails,
          `Math.abs(${upper} - ${lower}) = ${delta}`,
          delta
        );
      }
    }
  }

  // Single value: delta is always 1
  if (delta === 0 && data) {
    const fieldValue = data?.[fieldId];
    if (fieldValue && typeof fieldValue === 'string' && fieldValue.trim() && !fieldValue.includes('-')) {
      const num = parseInt(fieldValue, 10);
      if (!Number.isNaN(num)) {
        delta = 1;
        calculationMethod = 'singleValue';
        calculationDetails = { fieldValue };
        
        logger.logCalculation(
          'Camera Delta for Single Value',
          `Calculate camera delta (single value, for shifting)`,
          calculationDetails,
          'delta = 1 (single value)',
          1
        );
      }
    }
  }

  // If input camera field is blank, delta is 0
  if (delta === 0 && calculationMethod === 'unknown') {
    if (input.takeData && (!input.takeData[fieldId] || !input.takeData[fieldId]?.toString().trim())) {
      logger.logCalculation(
        'Camera Delta - Blank Field',
        `Camera file ${fieldId} is blank, delta = 0`,
        { hasCameraFile: false },
        'delta = 0 (blank field)',
        0
      );
    } else if (input.logSheetData && (!input.logSheetData[fieldId] || !input.logSheetData[fieldId]?.toString().trim())) {
      logger.logCalculation(
        'Camera Delta - Blank Field',
        `Camera file ${fieldId} is blank, delta = 0`,
        { hasCameraFile: false },
        'delta = 0 (blank field)',
        0
      );
    } else {
      logger.logWarning(`Could not calculate camera delta for shifting`, { fieldId, input });
    }
  }

  logger.logDebug('Camera delta calculation result (for shifting)', {
    fieldId,
    delta,
    calculationMethod,
    calculationDetails
  });

  logger.logFunctionExit(delta);
  return delta;
};

/**
 * Calculates delta for camera file(s)
 * 
 * @param input - Input data
 * @param cameraConfiguration - Number of cameras (1 for single, >1 for multi)
 * @returns Object with deltas for each camera field
 */
export const calculateCameraDeltas = (
  input: DeltaCalculationInput,
  cameraConfiguration: number
): { [fieldId: string]: number } => {
  const deltas: { [fieldId: string]: number } = {};

  if (cameraConfiguration === 1) {
    // Single camera
    deltas['cameraFile'] = calculateFieldDelta('cameraFile', input);
  } else {
    // Multi camera
    for (let i = 1; i <= cameraConfiguration; i++) {
      const fieldId = `cameraFile${i}`;
      deltas[fieldId] = calculateFieldDelta(fieldId, input);
    }
  }

  return deltas;
};

/**
 * Calculates all deltas for a log entry (sound + all cameras)
 * 
 * @param input - Input data
 * @param cameraConfiguration - Number of cameras
 * @returns Complete delta calculation result
 */
export const calculateAllDeltas = (
  input: DeltaCalculationInput,
  cameraConfiguration: number
): DeltaCalculationResult => {
  const soundDelta = calculateSoundDelta(input);
  const cameraDeltas = calculateCameraDeltas(input, cameraConfiguration);

  // Calculate total delta (sum of all deltas)
  const totalDelta = Object.values(cameraDeltas).reduce((sum, delta) => sum + delta, 0) + soundDelta;

  return {
    soundDelta,
    cameraDeltas,
    totalDelta
  };
};

/**
 * Calculates delta from a log sheet entry
 * 
 * @param logSheet - Log sheet entry
 * @param cameraConfiguration - Number of cameras
 * @returns Complete delta calculation result
 */
export const calculateDeltaFromLogSheet = (
  logSheet: LogSheet,
  cameraConfiguration: number
): DeltaCalculationResult => {
  return calculateAllDeltas(
    { logSheetData: logSheet.data },
    cameraConfiguration
  );
};

/**
 * Calculates delta from take data (new entry)
 * 
 * @param takeData - Take data
 * @param showRangeMode - Range mode flags
 * @param rangeData - Range data
 * @param cameraConfiguration - Number of cameras
 * @returns Complete delta calculation result
 */
export const calculateDeltaFromTakeData = (
  takeData: TakeData,
  showRangeMode: { [key: string]: boolean },
  rangeData: { [key: string]: { from: string; to: string } },
  cameraConfiguration: number
): DeltaCalculationResult => {
  return calculateAllDeltas(
    { takeData, showRangeMode, rangeData },
    cameraConfiguration
  );
};

