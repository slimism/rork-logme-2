/**
 * Single Camera Duplicate Detector
 * 
 * Handles duplicate detection for single camera configuration:
 * 1. Take number duplication within same shot
 * 2. Camera file and sound file duplication
 * 3. Insert-before logic with blank field matching
 * 4. Lower bound matching for ranges
 */

import { TakeData, LogSheet } from '@/types';
import { getRangeFromData } from './utils';

export interface DuplicateDetectionResult {
  type: 'take_number' | 'file_duplicate' | 'insert_before' | 'none';
  existingEntry?: LogSheet;
  message?: string;
  canInsertBefore?: boolean;
  matchedField?: 'sound' | 'camera' | 'both';
  targetBlankField?: 'sound' | 'camera' | null;
  highestTakeNumber?: number; // Highest available take number in the shot
}

export interface SingleCameraDuplicateContext {
  takeData: TakeData;
  showRangeMode: { [key: string]: boolean };
  rangeData: { [key: string]: { from: string; to: string } };
  projectLogSheets: LogSheet[];
  currentSceneNumber?: string;
  currentShotNumber?: string;
  currentTakeNumber?: string;
}

/**
 * Gets the upper bound of a field from data
 */
const getUpperBound = (fieldId: string, data: any): number | null => {
  const range = getRangeFromData(data, fieldId);
  if (range) {
    const fromNum = parseInt(range.from, 10) || 0;
    const toNum = parseInt(range.to, 10) || 0;
    return Math.max(fromNum, toNum);
  }

  const fieldValue = data?.[fieldId];
  if (fieldValue && typeof fieldValue === 'string') {
    if (fieldValue.includes('-')) {
      const parts = fieldValue.split('-').map(p => parseInt(p.trim(), 10) || 0);
      if (parts.length === 2) {
        return Math.max(parts[0], parts[1]);
      }
    } else {
      return parseInt(fieldValue, 10) || null;
    }
  }

  return null;
};

/**
 * Gets the lower bound of a field from data
 */
const getLowerBound = (fieldId: string, data: any): number | null => {
  const range = getRangeFromData(data, fieldId);
  if (range) {
    const fromNum = parseInt(range.from, 10) || 0;
    const toNum = parseInt(range.to, 10) || 0;
    return Math.min(fromNum, toNum);
  }

  const fieldValue = data?.[fieldId];
  if (fieldValue && typeof fieldValue === 'string') {
    if (fieldValue.includes('-')) {
      const parts = fieldValue.split('-').map(p => parseInt(p.trim(), 10) || 0);
      if (parts.length === 2) {
        return Math.min(parts[0], parts[1]);
      }
    } else {
      return parseInt(fieldValue, 10) || null;
    }
  }

  return null;
};

/**
 * Checks if a field is blank/waste
 */
const isFieldBlank = (fieldId: string, data: any): boolean => {
  const range = getRangeFromData(data, fieldId);
  if (range) return false;

  const fieldValue = data?.[fieldId];
  if (!fieldValue) return true;
  if (typeof fieldValue === 'string' && !fieldValue.trim()) return true;

  return false;
};

/**
 * Checks if take number already exists in the same shot
 */
export const checkTakeNumberDuplicate = (
  context: SingleCameraDuplicateContext
): DuplicateDetectionResult | null => {
  const { takeData, projectLogSheets, currentSceneNumber, currentShotNumber } = context;
  
  const newTakeNumber = takeData.takeNumber;
  const newScene = takeData.sceneNumber || currentSceneNumber;
  const newShot = takeData.shotNumber || currentShotNumber;

  if (!newTakeNumber || !newScene || !newShot) {
    return null;
  }

  const duplicate = projectLogSheets.find(sheet => {
    const data = sheet.data || {};
    return (
      data.sceneNumber === newScene &&
      data.shotNumber === newShot &&
      data.takeNumber === newTakeNumber
    );
  });

  if (duplicate) {
    // Find highest take number in this shot
    const sameShotTakes = projectLogSheets.filter(sheet => {
      const data = sheet.data || {};
      return data.sceneNumber === newScene && data.shotNumber === newShot;
    });

    let maxTakeNumber = 0;
    sameShotTakes.forEach(sheet => {
      const takeNum = parseInt(sheet.data?.takeNumber || '0', 10);
      if (!isNaN(takeNum) && takeNum > maxTakeNumber) {
        maxTakeNumber = takeNum;
      }
    });

    return {
      type: 'take_number',
      existingEntry: duplicate,
      message: `Take number ${newTakeNumber} already exists in Scene ${newScene}, Shot ${newShot}. Highest available take number is ${maxTakeNumber + 1}.`,
      highestTakeNumber: maxTakeNumber
    };
  }

  return null;
};

/**
 * Detects file duplicates and determines if insert-before is possible
 * 
 * Matching Rules:
 * 1. Camera lower bound matches existing camera (single value or lower bound of range)
 * 2. Sound lower bound matches existing sound (single value or lower bound of range)
 * 3. If target has blank sound/camera, allow insert if the non-blank field matches
 */
export const detectFileDuplicates = (
  context: SingleCameraDuplicateContext
): DuplicateDetectionResult | null => {
  const { takeData, showRangeMode, rangeData, projectLogSheets } = context;

  // Build data with range info if in range mode
  const newEntryData: any = { ...takeData };
  if (showRangeMode['cameraFile'] && rangeData['cameraFile']) {
    newEntryData['camera1_from'] = rangeData['cameraFile'].from;
    newEntryData['camera1_to'] = rangeData['cameraFile'].to;
  }
  if (showRangeMode['soundFile'] && rangeData['soundFile']) {
    newEntryData['sound_from'] = rangeData['soundFile'].from;
    newEntryData['sound_to'] = rangeData['soundFile'].to;
  }

  // Get new entry's file numbers
  const newCameraLower = getLowerBound('cameraFile', newEntryData);
  const newSoundLower = getLowerBound('soundFile', newEntryData);

  for (const sheet of projectLogSheets) {
    const data = sheet.data || {};
    
    // Get existing entry's bounds
    const existingCameraLower = getLowerBound('cameraFile', data);
    const existingSoundLower = getLowerBound('soundFile', data);
    
    // Check if fields are blank
    const existingCameraBlank = isFieldBlank('cameraFile', data);
    const existingSoundBlank = isFieldBlank('soundFile', data);

    // Check for lower bound match
    // New entry's lower bound matches existing entry's lower bound (for single values or range lower bounds)
    const cameraLowerMatch = !existingCameraBlank && 
                            typeof newCameraLower === 'number' && 
                            typeof existingCameraLower === 'number' &&
                            newCameraLower === existingCameraLower;
    
    const soundLowerMatch = !existingSoundBlank && 
                           typeof newSoundLower === 'number' && 
                           typeof existingSoundLower === 'number' &&
                           newSoundLower === existingSoundLower;

    // Determine match type
    let matchedField: 'sound' | 'camera' | 'both' | undefined;
    let targetBlankField: 'sound' | 'camera' | null = null;
    let canInsert = false;

    // Determine match type
    // Case 1: Complete duplicate (both match, nothing blank) - blocking
    if (cameraLowerMatch && soundLowerMatch && !existingCameraBlank && !existingSoundBlank) {
      return {
        type: 'file_duplicate',
        existingEntry: sheet,
        message: 'Camera file and sound file already exist in another take.',
        canInsertBefore: false
      };
    }
    // Case 2: Both fields match (lower bound match) but at least one is blank - can insert
    else if (cameraLowerMatch && soundLowerMatch) {
      matchedField = 'both';
      if (existingSoundBlank) targetBlankField = 'sound';
      if (existingCameraBlank) targetBlankField = 'camera';
      canInsert = true;
    }
    // Case 3: Camera lower bound matches, sound is blank in target
    // Example: New Camera 001-005 matches existing Camera 001, existing Sound is blank
    else if (cameraLowerMatch && existingSoundBlank) {
      matchedField = 'camera';
      targetBlankField = 'sound';
      canInsert = true;
    }
    // Case 4: Sound lower bound matches, camera is blank in target
    else if (soundLowerMatch && existingCameraBlank) {
      matchedField = 'sound';
      targetBlankField = 'camera';
      canInsert = true;
    }

    if (canInsert) {
      return {
        type: 'insert_before',
        existingEntry: sheet,
        message: `File number(s) match existing take. Do you want to insert before it?`,
        canInsertBefore: true,
        matchedField,
        targetBlankField
      };
    }
  }

  return null;
};

/**
 * Main duplicate detection function
 * Checks both take number and file duplicates
 */
export const detectDuplicates = (
  context: SingleCameraDuplicateContext
): DuplicateDetectionResult | null => {
  // First check take number duplicate
  const takeNumberResult = checkTakeNumberDuplicate(context);
  if (takeNumberResult) {
    return takeNumberResult;
  }

  // Then check file duplicates
  const fileResult = detectFileDuplicates(context);
  if (fileResult) {
    return fileResult;
  }

  return null;
};

