# Sequential Shifting Usage Guide

## Overview

The sequential shift functions (`shiftSingleCameraFilesSequentially` and `shiftMultiCameraFilesSequentially`) ensure that shifting happens **after insertion** and in the correct order, with each shift based on the **actual values** of the previous take (after it's been shifted).

## Problem Solved

**Before:** All shifts were calculated based on original values, which could lead to incorrect results when multiple takes needed shifting.

**After:** Shifts happen sequentially:
1. Insert new log (caller does this)
2. Shift target duplicate (based on inserted log)
3. Shift subsequent take 1 (based on shifted target)
4. Shift subsequent take 2 (based on shifted subsequent take 1)
5. And so on...

## Sequential Process

```
Step 1: Insert new log with Camera 001-005, Sound 001
Step 2: Shift target (original Take 1) → Camera 006, Sound 002
Step 3: Shift Take 2 (now Take 3) → Camera 007, Sound 003 (based on shifted Take 2's values)
Step 4: Shift Take 3 (now Take 4) → Camera 008, Sound 004 (based on shifted Take 3's values)
```

Each shift uses the **actual upper bound** from the previous take (after it's been shifted), ensuring correct sequential numbering.

## Usage

### Single Camera

```typescript
import { shiftSingleCameraFilesSequentially } from '@/components/CameraHandlers';
import { addLogSheet, updateLogSheet } from '@/store/projectStore';

// Step 1: Insert the new log first
const newLogSheet = addLogSheet(
  'Take 1',
  'camera_log',
  folderId,
  projectId,
  {
    ...takeData,
    takeNumber: targetTakeNumber, // Use target's take number
    // ... other data
  }
);

// Step 2: Shift target and all subsequent takes sequentially
const shiftResults = shiftSingleCameraFilesSequentially({
  insertedTakeData: takeData,
  insertedShowRangeMode: showRangeMode,
  insertedRangeData: rangeData,
  targetLogSheet: existingEntry, // The duplicate we're inserting before
  projectId,
  cameraConfiguration: 1,
  getPreviousTakeUpperBound,
  projectLogSheets,
  updateLogSheet // From store
});

// shiftResults[0] = target duplicate shift result
// shiftResults[1] = subsequent take 1 shift result
// shiftResults[2] = subsequent take 2 shift result
// etc.
```

### Multi Camera

```typescript
import { shiftMultiCameraFilesSequentially } from '@/components/CameraHandlers';

// Step 1: Insert the new log first
const newLogSheet = addLogSheet(...);

// Step 2: Shift target and all subsequent takes sequentially
const shiftResults = shiftMultiCameraFilesSequentially({
  insertedTakeData: takeData,
  insertedShowRangeMode: showRangeMode,
  insertedRangeData: rangeData,
  insertedCameraRecState: cameraRecState,
  targetLogSheet: existingEntry,
  projectId,
  cameraConfiguration: 3,
  getPreviousTakeUpperBound,
  projectLogSheets,
  updateLogSheet
});
```

## How It Works

### 1. Shift Target Duplicate
- Uses inserted log's upper bounds
- Calculates new values for target
- Updates target in store

### 2. Find Subsequent Takes
- Filters log sheets for same scene/shot
- Orders by take number (ascending)
- Only takes with take number > target take number

### 3. Sequential Shifting
- For each subsequent take:
  - Uses **previous take's actual values** (after it was shifted)
  - Builds context from previous take's data
  - Shifts based on previous take's upper bounds
  - Updates in store immediately
  - Updates `previousTake` for next iteration

## Example Walkthrough

**Initial State:**
- Take 1: Camera `001`, Sound `001`
- Take 2: Camera `002`, Sound `002`
- Take 3: Camera `003`, Sound `003`

**Insert New Take Before Take 1:**
- New Take: Camera `001-002`, Sound `001`

**After Sequential Shifting:**

**Step 1:** Shift target (original Take 1)
- Uses new take's upper bounds: Camera upper = 002, Sound upper = 001
- New lower = 002 + 1 = 003
- Target delta = 0 (single value)
- New upper = 003 + 0 = 003
- **Result:** Camera `003`, Sound `002` (001 + 1), Take number = 2

**Step 2:** Shift subsequent Take 2 (now Take 3)
- Uses **shifted Take 1's actual values**: Camera upper = 003, Sound upper = 002
- New lower for Camera = 003 + 1 = 004
- New lower for Sound = 002 + 1 = 003
- **Result:** Camera `004`, Sound `003`, Take number = 3

**Step 3:** Shift subsequent Take 3 (now Take 4)
- Uses **shifted Take 2's actual values**: Camera upper = 004, Sound upper = 003
- New lower for Camera = 004 + 1 = 005
- New lower for Sound = 003 + 1 = 004
- **Result:** Camera `005`, Sound `004`, Take number = 4

## Key Benefits

1. **Correct Calculations**: Each shift uses actual values from previous shift
2. **Sequential Order**: Shifts happen one by one in correct order
3. **Immediate Updates**: Each take is updated in store before next shift
4. **No Stale Data**: Always uses latest values, never stale original values

## Important Notes

1. **Must Insert First**: Caller must insert the new log before calling sequential shift
2. **Take Number Already Updated**: The `updateTakeNumbers` function should be called separately to update take numbers
3. **Context Update**: Each iteration updates `previousTake` with the newly shifted data
4. **Range Handling**: Correctly extracts range data from previous take's actual stored format

