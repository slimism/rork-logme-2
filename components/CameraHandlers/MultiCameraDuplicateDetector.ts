/**
 * Multi Camera Duplicate Detector
 * 
 * Handles duplicate detection for multi camera configuration:
 * 1. Take number duplication within same shot
 * 2. Camera file (each camera independently) and sound file duplication
 * 3. Insert-before logic with blank field matching
 * 4. Lower bound matching for ranges
 * 
 * For multi-camera, each camera must match independently:
 * - Camera 1 matches Camera 1
 * - Camera 2 matches Camera 2
 * - Sound matches Sound
 * Only then can insert before
 */

import { TakeData, LogSheet } from '@/types';
import { getRangeFromData } from './utils';

export interface MultiCameraDuplicateDetectionResult {
  type: 'take_number' | 'file_duplicate' | 'insert_before' | 'none';
  existingEntry?: LogSheet;
  message?: string;
  canInsertBefore?: boolean;
  matchedCameras?: number[]; // Which camera numbers matched
  matchedSound?: boolean;
  targetBlankCameras?: number[]; // Which cameras are blank in target
  targetBlankSound?: boolean;
  cameraConfiguration: number;
  highestTakeNumber?: number; // Highest available take number in the shot
}

export interface MultiCameraDuplicateContext {
  takeData: TakeData;
  showRangeMode: { [key: string]: boolean };
  rangeData: { [key: string]: { from: string; to: string } };
  cameraRecState: { [key: string]: boolean };
  projectLogSheets: LogSheet[];
  cameraConfiguration: number;
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
  context: MultiCameraDuplicateContext
): MultiCameraDuplicateDetectionResult | null => {
  const { takeData, projectLogSheets, currentSceneNumber, currentShotNumber, cameraConfiguration } = context;
  
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
      cameraConfiguration,
      highestTakeNumber: maxTakeNumber
    };
  }

  return null;
};

/**
 * Detects file duplicates for multi-camera and determines if insert-before is possible
 */
export const detectFileDuplicates = (
  context: MultiCameraDuplicateContext
): MultiCameraDuplicateDetectionResult | null => {
  const { takeData, showRangeMode, rangeData, cameraRecState, projectLogSheets, cameraConfiguration } = context;

  // Build new entry data with range info if in range mode
  const newEntryData: any = { ...takeData };
  for (let i = 1; i <= cameraConfiguration; i++) {
    const fieldId = `cameraFile${i}`;
    if (showRangeMode[fieldId] && rangeData[fieldId]) {
      newEntryData[`camera${i}_from`] = rangeData[fieldId].from;
      newEntryData[`camera${i}_to`] = rangeData[fieldId].to;
    }
  }
  if (showRangeMode['soundFile'] && rangeData['soundFile']) {
    newEntryData['sound_from'] = rangeData['soundFile'].from;
    newEntryData['sound_to'] = rangeData['soundFile'].to;
  }

  for (const sheet of projectLogSheets) {
    const data = sheet.data || {};
    
    // Check sound file match (lower bound)
    const newSoundLower = getLowerBound('soundFile', newEntryData);
    const existingSoundLower = getLowerBound('soundFile', data);
    const existingSoundBlank = isFieldBlank('soundFile', data);
    
    const soundLowerMatch = !existingSoundBlank && 
                           typeof newSoundLower === 'number' && 
                           typeof existingSoundLower === 'number' &&
                           newSoundLower === existingSoundLower;

    // Check each camera independently
    const matchedCameras: number[] = [];
    const targetBlankCameras: number[] = [];
    let hasActiveCameras = false;
    let allActiveCamerasOk = true;

    for (let i = 1; i <= cameraConfiguration; i++) {
      const fieldId = `cameraFile${i}`;
      const isRecActive = cameraRecState[fieldId] ?? true;

      // Only check cameras that are active in the new entry
      if (!isRecActive) {
        continue;
      }

      hasActiveCameras = true;

      const newCameraLower = getLowerBound(fieldId, newEntryData);
      const existingCameraLower = getLowerBound(fieldId, data);
      const existingCameraBlank = isFieldBlank(fieldId, data);

      // Check for lower bound match
      const cameraLowerMatch = !existingCameraBlank && 
                              typeof newCameraLower === 'number' && 
                              typeof existingCameraLower === 'number' &&
                              newCameraLower === existingCameraLower;

      if (existingCameraBlank) {
        targetBlankCameras.push(i);
      } else if (cameraLowerMatch) {
        matchedCameras.push(i);
      } else {
        // Camera doesn't match and isn't blank - can't insert
        allActiveCamerasOk = false;
        break; // Exit early since we can't insert
      }
    }

    // Determine if we can insert before
    // Requirement for multi-camera:
    // - Each active camera must match its corresponding camera (Camera 1 = Camera 1, Camera 2 = Camera 2)
    // - OR target camera is blank (waste)
    // - Sound must match OR target sound is blank
    
    // Count how many active cameras we have
    let activeCameraCount = 0;
    for (let i = 1; i <= cameraConfiguration; i++) {
      const fieldId = `cameraFile${i}`;
      if (cameraRecState[fieldId] ?? true) {
        activeCameraCount++;
      }
    }

    // Skip if cameras don't all match (unless they're blank)
    if (!allActiveCamerasOk && !hasActiveCameras) {
      continue;
    }

    // Check if all active cameras are OK (match or target is blank)
    const allCamerasOk = hasActiveCameras && allActiveCamerasOk && 
                        (matchedCameras.length + targetBlankCameras.length === activeCameraCount);
    
    const soundOk = soundLowerMatch || existingSoundBlank;

    // Case 1: Complete duplicate (all match, nothing blank) - blocking
    if (allCamerasOk && soundLowerMatch && !existingSoundBlank && 
        matchedCameras.length === activeCameraCount && targetBlankCameras.length === 0) {
      return {
        type: 'file_duplicate',
        existingEntry: sheet,
        message: 'All camera files and sound file already exist in another take.',
        canInsertBefore: false,
        cameraConfiguration
      };
    }

    // Case 2: All active cameras OK AND sound OK (can insert)
    if (allCamerasOk && soundOk) {
      return {
        type: 'insert_before',
        existingEntry: sheet,
        message: `File number(s) match existing take. Do you want to insert before it?`,
        canInsertBefore: true,
        matchedCameras,
        matchedSound: soundLowerMatch,
        targetBlankCameras,
        targetBlankSound: existingSoundBlank,
        cameraConfiguration
      };
    }

    // Case 3: Some cameras don't match and aren't blank - blocking duplicate
    if (!allCamerasOk && !soundOk && !existingSoundBlank) {
      return {
        type: 'file_duplicate',
        existingEntry: sheet,
        message: 'Some camera files and sound file conflict.',
        canInsertBefore: false,
        cameraConfiguration
      };
    }

    // Case 4: Cameras OK but sound conflicts (and not blank)
    if (allCamerasOk && !soundOk && !existingSoundBlank) {
      return {
        type: 'file_duplicate',
        existingEntry: sheet,
        message: 'Camera files match but sound file conflicts.',
        canInsertBefore: false,
        cameraConfiguration
      };
    }

    // Case 5: Sound OK but cameras don't match (and not all blank)
    if (soundOk && !allCamerasOk) {
      return {
        type: 'file_duplicate',
        existingEntry: sheet,
        message: 'Sound file matches but some camera files conflict.',
        canInsertBefore: false,
        cameraConfiguration
      };
    }
  }

  return null;
};

/**
 * Main duplicate detection function for multi-camera
 * Checks both take number and file duplicates
 */
export const detectDuplicates = (
  context: MultiCameraDuplicateContext
): MultiCameraDuplicateDetectionResult | null => {
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

