# File Shifting Explanation: Insert Before Existing Log

## Overview

When a new log is inserted before an existing log, the camera and sound file numbers for logs that come after the inserted log need to be shifted to maintain sequential numbering and avoid conflicts. This document explains the shifting mechanism.

## Process Flow

### 1. Insert Before Operation (`handleSaveWithInsertBefore`)

Located in `app/take/[id].tsx` (lines 1651-1977), this function handles the complete insertion process:

1. **Save the inserted log** - The new log is saved with its file numbers (preserving ranges if in range mode)
2. **Move log position** - `moveExistingLogBefore` updates the `projectLocalId` to position the log correctly
3. **Shift file numbers** - Calls `updateFileNumbers` for each field (sound and camera files)

### 2. File Number Shifting (`updateFileNumbers`)

Located in `store/projectStore.ts` (lines 575-1704), this function implements the sequential shifting logic.

## Shifting Mechanism

### Core Concept: Sequential Shifting with Temporary Variables

The system uses **temporary variables** (`tempSound` and `tempCamera`) to track the upper bound of file numbers from the previous log. This ensures sequential, gap-free numbering.

### Sound File Shifting

**Processing Order:**
- Logs are processed **by `projectLocalId`** in ascending order
- Only logs with `projectLocalId > targetLocalId` are shifted (logs after the insertion point)
- Works uniformly for SFX, Ambience, and regular logs

**Initialization:**
1. Find the inserted log (using `excludeLogId` or by matching file number)
2. Initialize `tempSound` = upper bound of inserted log's sound file
3. If inserted log not found, use `fromNumber` as fallback

**Shifting Formula:**
```
For each subsequent log (projectLocalId > targetLocalId):
  If log has blank sound (Waste):
    - Delta = 0
    - tempSound remains unchanged
    - No file number update
  
  If log has sound file:
    - Calculate delta = original range span of the log
      * Range: delta = upper - lower
      * Single value: delta = 1
    - Calculate new bounds:
      * Range: newLower = tempSound + 1, newUpper = newLower + delta
      * Single: newLower = tempSound + delta, newUpper = newLower
    - Update tempSound = newUpper (for single values: newLower)
    - Update log's sound file numbers
```

**Example:**
```
Initial state:
- Inserted log: soundFile = 0001-0003 (tempSound = 3)
- Log A (after): soundFile = 0004 (single value)
- Log B (after): soundFile = 0005-0007 (range)

After shifting:
- Inserted log: soundFile = 0001-0003 (unchanged, tempSound = 3)
- Log A: soundFile = 0004 (tempSound = 3, delta = 1)
  → newLower = 3 + 1 = 4, newUpper = 4
  → tempSound = 4
- Log B: soundFile = 0005-0007 (tempSound = 4, delta = 2)
  → newLower = 4 + 1 = 5, newUpper = 5 + 2 = 7
  → tempSound = 7
```

### Camera File Shifting

**Processing Order:**
- Logs are grouped by **scene/shot** combinations
- Within each group, logs are sorted by `projectLocalId` (if provided) or `takeNumber`
- Only logs with file numbers >= `fromNumber` or `projectLocalId > targetLocalId` are shifted

**Initialization:**
1. Find the inserted log (same strategy as sound files)
2. For each camera (1 to `cameraConfiguration`):
   - Initialize `tempCamera[cameraNum]` = upper bound of inserted log's camera file
   - If inserted log not found, use `fromNumber` as fallback

**Shifting Formula:**
```
For each camera field (cameraFile, cameraFile1, cameraFile2, etc.):
  For each log in scene/shot group:
    If log has blank camera (Waste):
      - Delta = 0
      - tempCamera[cameraNum] remains unchanged
      - No file number update
    
    If log has camera file:
      - Calculate delta = original range span of the log
        * Range: delta = upper - lower
        * Single value: delta = 1
      - Calculate new bounds:
        * Range: newLower = tempCamera[cameraNum] + 1, newUpper = newLower + delta
        * Single: newLower = tempCamera[cameraNum] + 1, newUpper = newLower
      - Update tempCamera[cameraNum] = newUpper (for single values: newLower)
      - Update log's camera file numbers
```

**Example (Single Camera):**
```
Initial state:
- Inserted log: cameraFile = 0001-0003 (tempCamera[1] = 3)
- Log A (after): cameraFile = 0004 (single value)
- Log B (after): cameraFile = 0005-0007 (range)

After shifting:
- Inserted log: cameraFile = 0001-0003 (unchanged, tempCamera[1] = 3)
- Log A: cameraFile = 0004 (tempCamera[1] = 3, delta = 1)
  → newLower = 3 + 1 = 4, newUpper = 4
  → tempCamera[1] = 4
- Log B: cameraFile = 0005-0007 (tempCamera[1] = 4, delta = 2)
  → newLower = 4 + 1 = 5, newUpper = 5 + 2 = 7
  → tempCamera[1] = 7
```

**Example (Multi-Camera):**
```
Initial state:
- Inserted log: cameraFile1 = 0001-0003, cameraFile2 = 0001-0003
  (tempCamera[1] = 3, tempCamera[2] = 3)
- Log A (after): cameraFile1 = 0004, cameraFile2 = 0004

After shifting:
- Inserted log: unchanged
- Log A: cameraFile1 = 0004, cameraFile2 = 0004
  → Camera1: newLower = 3 + 1 = 4, tempCamera[1] = 4
  → Camera2: newLower = 3 + 1 = 4, tempCamera[2] = 4
```

## Key Differences: Sound vs Camera

| Aspect | Sound Files | Camera Files |
|--------|------------|--------------|
| **Processing Order** | By `projectLocalId` (all logs) | By scene/shot groups, then `projectLocalId` or `takeNumber` |
| **Scope** | All project logs after insertion | Only logs in same scene/shot group |
| **SFX/Ambience** | Handled uniformly | Grouped with regular logs |
| **Single Value Formula** | `newLower = tempSound + delta` | `newLower = tempCamera + 1` |
| **Range Formula** | `newLower = tempSound + 1` | `newLower = tempCamera + 1` |

## Delta Calculation

Delta represents the **span** of file numbers used by a log:
- **Range**: `delta = upper - lower` (e.g., 0001-0003 → delta = 2)
- **Single value**: `delta = 1` (one file number)
- **Blank/Waste**: `delta = 0` (no shift, temp variable unchanged)

Each log uses its **own original delta** when being shifted, ensuring that ranges maintain their size.

## Important Notes

1. **Sequential Processing**: Logs are processed in order, and `tempSound`/`tempCamera` are updated after each log to ensure correct sequential numbering.

2. **Blank Fields (Waste)**: When a log has a blank field, it doesn't consume file numbers, so:
   - Delta = 0
   - Temp variable remains unchanged
   - Next log shifts from the previous valid file number

3. **Target Duplicate**: The log that was originally at the insertion point (the "target duplicate") is also shifted using the same logic, using `tempSound`/`tempCamera` initialized from the inserted log.

4. **Multi-Camera Independence**: Each camera field has its own `tempCamera[cameraNum]` variable, so cameras can shift independently.

5. **Project Local ID**: The `projectLocalId` is used to determine which logs come "after" the insertion point. Only logs with `projectLocalId > targetLocalId` are shifted.

## Code References

- **Insert Before Handler**: `app/take/[id].tsx` lines 1651-1977 (`handleSaveWithInsertBefore`)
- **File Shifting Logic**: `store/projectStore.ts` lines 575-1704 (`updateFileNumbers`)
- **Delta Calculators**: `store/projectStore.ts` (search for `calculateSoundDeltaForShifting`, `calculateCameraDeltaForShifting`)

