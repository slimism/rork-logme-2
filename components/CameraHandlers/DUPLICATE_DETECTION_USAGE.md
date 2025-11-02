# Duplicate Detection Usage Guide

## Overview

The duplicate detection system (`SingleCameraDuplicateDetector.ts` and `MultiCameraDuplicateDetector.ts`) handles comprehensive duplicate detection with support for insert-before logic.

## Detection Rules

### 1. Take Number Duplicate

Checks if the new record's take number already exists within the same shot (Scene + Shot).

**Response:**
- Shows notification with highest available take number
- Allows user to use the max take number + 1

### 2. File Duplicate Detection

Checks if camera file and/or sound file already exist in the project.

**Matching Criteria:**
- **Lower bound match**: New entry's lower bound matches existing entry's lower bound
- Works for both single values and ranges
- Example: New `001-005` matches existing `001` (lower bound 001)

**Insert-Before Logic:**
- Can insert before if lower bound matches existing entry's lower bound
- Can insert before if target has blank sound/camera, as long as the non-blank field matches

### 3. Blank Field Matching

**Single Camera:**
- If target camera is blank → allow insert if sound matches
- If target sound is blank → allow insert if camera matches

**Multi Camera:**
- Each camera must match independently (Camera 1 = Camera 1, Camera 2 = Camera 2)
- If target camera is blank → still allowed if new camera matches
- If target sound is blank → allowed if all cameras match

## Examples

### Example 1: Lower Bound Match

**Existing Take 1:**
- Camera: `001`
- Sound: `001`

**New Entry:**
- Camera: `001-005` (lower bound = 001)
- Sound: `001`

**Result:** ✅ Can insert before (lower bounds match)

**After Insert:**
- New Take 1: Camera `001-005`, Sound `001`
- Original (now Take 2): Camera `006` (005 + 1), Sound `002` (001 + 1)

### Example 2: Blank Sound Matching

**Existing Take 1:**
- Camera: `001`
- Sound: `WASTE` (blank)

**New Entry:**
- Camera: `001-005` (lower bound = 001)
- Sound: `001`

**Result:** ✅ Can insert before (camera lower bound matches, sound is blank in target)

**After Insert:**
- New Take 1: Camera `001-005`, Sound `001`
- Original (now Take 2): Camera `006` (005 + 1), Sound `WASTE` (stays blank)

### Example 3: Multi-Camera Matching

**Existing Take 1:**
- Camera 1: `001`
- Camera 2: `002`
- Sound: `001`

**New Entry:**
- Camera 1: `001-005` (lower bound = 001)
- Camera 2: `002-003` (lower bound = 002)
- Sound: `001`

**Result:** ✅ Can insert before (all lower bounds match)

**After Insert:**
- New Take 1: Camera 1 `001-005`, Camera 2 `002-003`, Sound `001`
- Original (now Take 2): Camera 1 `006`, Camera 2 `004`, Sound `002`

### Example 4: Multi-Camera with Blank

**Existing Take 1:**
- Camera 1: `001`
- Camera 2: `WASTE` (blank)
- Sound: `001`

**New Entry:**
- Camera 1: `001-005` (lower bound = 001)
- Camera 2: `002` (lower bound = 002)
- Sound: `001`

**Result:** ✅ Can insert before
- Camera 1 matches (lower bound 001)
- Camera 2 in target is blank → allowed
- Sound matches

**After Insert:**
- New Take 1: Camera 1 `001-005`, Camera 2 `002`, Sound `001`
- Original (now Take 2): Camera 1 `006`, Camera 2 `WASTE` (stays blank), Sound `002`

## Usage

### Single Camera

```typescript
import { detectDuplicates } from '@/components/CameraHandlers';

const context = {
  takeData,
  showRangeMode,
  rangeData,
  projectLogSheets,
  currentSceneNumber: takeData.sceneNumber,
  currentShotNumber: takeData.shotNumber,
  currentTakeNumber: takeData.takeNumber
};

const result = detectDuplicates(context);

if (result) {
  switch (result.type) {
    case 'take_number':
      // Show notification with highest available take number
      Alert.alert('Duplicate Take Number', result.message, [
        { text: 'Use Highest', onPress: () => {
          // Use result.highest + 1
        }},
        { text: 'Cancel', style: 'cancel' }
      ]);
      break;
    
    case 'insert_before':
      // Ask user if they want to insert before
      Alert.alert('Duplicate Found', result.message, [
        { text: 'Insert Before', onPress: () => {
          // Use shift handler to insert before
        }},
        { text: 'Cancel', style: 'cancel' }
      ]);
      break;
    
    case 'file_duplicate':
      // Blocking duplicate
      Alert.alert('Duplicate Detected', result.message);
      break;
  }
}
```

### Multi Camera

```typescript
import { detectDuplicates } from '@/components/CameraHandlers';

const context = {
  takeData,
  showRangeMode,
  rangeData,
  cameraRecState,
  projectLogSheets,
  cameraConfiguration: 3,
  currentSceneNumber: takeData.sceneNumber,
  currentShotNumber: takeData.shotNumber,
  currentTakeNumber: takeData.takeNumber
};

const result = detectDuplicates(context);

if (result) {
  if (result.type === 'insert_before') {
    console.log('Matched cameras:', result.matchedCameras); // e.g., [1, 2]
    console.log('Target blank cameras:', result.targetBlankCameras); // e.g., [3]
    console.log('Sound matched:', result.matchedSound);
    console.log('Target sound blank:', result.targetBlankSound);
  }
}
```

## Integration with Shift Handlers

When `insert_before` is detected:

```typescript
import { shiftSingleCameraFiles, shiftMultiCameraFiles } from '@/components/CameraHandlers';

if (result.type === 'insert_before' && result.canInsertBefore) {
  if (cameraConfiguration === 1) {
    const shiftResult = shiftSingleCameraFiles({
      insertedTakeData: takeData,
      insertedShowRangeMode: showRangeMode,
      insertedRangeData: rangeData,
      targetLogSheet: result.existingEntry,
      projectId,
      cameraConfiguration: 1,
      getPreviousTakeUpperBound,
      projectLogSheets
    });
    updateLogSheet(result.existingEntry.id, shiftResult.updatedData);
  } else {
    const shiftResult = shiftMultiCameraFiles({
      insertedTakeData: takeData,
      insertedShowRangeMode: showRangeMode,
      insertedRangeData: rangeData,
      insertedCameraRecState: cameraRecState,
      targetLogSheet: result.existingEntry,
      projectId,
      cameraConfiguration,
      getPreviousTakeUpperBound,
      projectLogSheets
    });
    updateLogSheet(result.existingEntry.id, shiftResult.updatedData);
  }
}
```

## Benefits

1. **Comprehensive Detection**: Handles take number, file duplicates, and insert-before scenarios
2. **Blank Field Support**: Intelligently handles waste/blank fields
3. **Multi-Camera Support**: Each camera checked independently
4. **Lower Bound Matching**: Works with both single values and ranges
5. **Clear Results**: Provides detailed information about what matched and what's blank

