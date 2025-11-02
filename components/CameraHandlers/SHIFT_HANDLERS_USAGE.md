# Shift Handlers Usage Guide

## Overview

The shift handlers (`SingleCameraShiftHandler.ts` and `MultiCameraShiftHandler.ts`) handle file number shifting when a new take is inserted before an existing take. This ensures all subsequent takes have their file numbers correctly updated.

## Shifting Logic

### Formula
For each field (sound, camera1, camera2, etc.):

1. **Get upper bound of inserted log** for that field
2. **New lower bound** = inserted upper bound + 1
3. **New upper bound** = new lower bound + target delta
   - Where `delta = upper - lower` (NOT inclusive count)
   - If target was single value (delta = 0), new upper = new lower

### Example

**Original Take 1:**
- Camera 1: 001-003 (delta = 3-1 = 2)
- Camera 2: 002-005 (delta = 5-2 = 3)
- Sound: 001 (delta = 0)

**Inserted Take (before Take 1):**
- Camera 1: 001-002
- Camera 2: 002-003
- Sound: 001

**Shifted Take 1 (now Take 2):**

For Camera 1:
- Inserted upper bound = 002
- New lower = 002 + 1 = 003
- Target delta = 2 (from 001-003)
- New upper = 003 + 2 = 005
- **Result: Camera 1: 003-005** ✓

For Camera 2:
- Inserted upper bound = 003
- New lower = 003 + 1 = 004
- Target delta = 3 (from 002-005)
- New upper = 004 + 3 = 007
- **Result: Camera 2: 004-007**

For Sound:
- Inserted upper bound = 001
- New lower = 001 + 1 = 002
- Target delta = 0 (single value)
- New upper = 002 + 0 = 002
- **Result: Sound: 002** ✓

## Special Cases

### Waste/Blank Fields

If the target field (the one being shifted) is waste/blank:
1. Find the **last valid non-waste take** before it
2. Use that take's upper bound as the base
3. Apply the same shifting formula

This ensures continuous numbering even when waste entries exist.

### Single Camera Handler

Use `shiftSingleCameraFiles()` for projects with `cameraConfiguration === 1`.

### Multi Camera Handler

Use `shiftMultiCameraFiles()` for projects with `cameraConfiguration > 1`.

Each camera field (cameraFile1, cameraFile2, etc.) is calculated **independently** based on:
- The inserted log's upper bound for that specific camera
- The target log's delta for that specific camera
- Previous valid take's upper bound for that specific camera (if target is blank)

## Usage

### Single Camera

```typescript
import { shiftSingleCameraFiles, SingleCameraShiftContext } from '@/components/CameraHandlers';

const context: SingleCameraShiftContext = {
  insertedTakeData: takeData,
  insertedShowRangeMode: showRangeMode,
  insertedRangeData: rangeData,
  targetLogSheet: existingEntry,
  projectId: projectId,
  cameraConfiguration: 1,
  getPreviousTakeUpperBound: getPreviousTakeUpperBound, // Your helper function
  projectLogSheets: projectLogSheets
};

const result = shiftSingleCameraFiles(context);

// Update the log sheet
updateLogSheet(existingEntry.id, result.updatedData);

// Check what was shifted
if (result.sound?.wasShifted) {
  console.log('Sound shifted:', result.sound.newLower, result.sound.newUpper);
}
if (result.camera?.wasShifted) {
  console.log('Camera shifted:', result.camera.newLower, result.camera.newUpper);
}
```

### Multi Camera

```typescript
import { shiftMultiCameraFiles, MultiCameraShiftContext } from '@/components/CameraHandlers';

const context: MultiCameraShiftContext = {
  insertedTakeData: takeData,
  insertedShowRangeMode: showRangeMode,
  insertedRangeData: rangeData,
  insertedCameraRecState: cameraRecState, // Important for multi-camera
  targetLogSheet: existingEntry,
  projectId: projectId,
  cameraConfiguration: 3, // e.g., 3 cameras
  getPreviousTakeUpperBound: getPreviousTakeUpperBound,
  projectLogSheets: projectLogSheets
};

const result = shiftMultiCameraFiles(context);

// Update the log sheet
updateLogSheet(existingEntry.id, result.updatedData);

// Check what was shifted
if (result.sound?.wasShifted) {
  console.log('Sound shifted:', result.sound.newLower, result.sound.newUpper);
}

// Check each camera
Object.keys(result.cameras).forEach(fieldId => {
  const shift = result.cameras[fieldId];
  console.log(`${fieldId} shifted:`, shift.newLower, shift.newUpper);
});
```

## Key Differences from Delta Calculator

The **delta calculator** (`deltaCalculator.ts`) returns the **inclusive count** of files:
- Range 001-003 → delta = 3 (includes 001, 002, 003)

The **shift handlers** use **range size** (upper - lower):
- Range 001-003 → delta = 2 (difference between upper and lower)
- This maintains the original range size when shifting

## Sequential Shifting (Recommended)

**Use `shiftSingleCameraFilesSequentially` or `shiftMultiCameraFilesSequentially`** for correct sequential shifting.

These functions ensure:
1. Insert happens first (caller responsibility)
2. Target duplicate is shifted
3. All subsequent takes are shifted one by one
4. Each shift uses the **actual values** from the previous take (after it's been shifted)

See `SEQUENTIAL_SHIFTING_USAGE.md` for detailed information.

## Integration with Existing Code

Replace the inline shifting logic in `addLogWithDuplicateHandling` with calls to these handlers:

```typescript
// Before: Inline shifting logic (hundreds of lines)

// After:
if (cameraConfiguration === 1) {
  const shiftResult = shiftSingleCameraFiles({
    insertedTakeData: takeData,
    insertedShowRangeMode: showRangeMode,
    insertedRangeData: rangeData,
    targetLogSheet: existingEntry,
    projectId,
    cameraConfiguration: 1,
    getPreviousTakeUpperBound,
    projectLogSheets
  });
  updateLogSheet(existingEntry.id, shiftResult.updatedData);
} else {
  const shiftResult = shiftMultiCameraFiles({
    insertedTakeData: takeData,
    insertedShowRangeMode: showRangeMode,
    insertedRangeData: rangeData,
    insertedCameraRecState: cameraRecState,
    targetLogSheet: existingEntry,
    projectId,
    cameraConfiguration,
    getPreviousTakeUpperBound,
    projectLogSheets
  });
  updateLogSheet(existingEntry.id, shiftResult.updatedData);
}
```

## Benefits

1. **Centralized Logic**: All shifting calculations in dedicated files
2. **Easy Debugging**: Find and fix shifting issues without searching through main files
3. **Consistent Calculations**: Same logic applied for single and multi-camera
4. **Type Safe**: TypeScript interfaces ensure correct usage
5. **Handles Edge Cases**: Waste/blank fields, ranges, single values

