# Delta Calculator Usage Guide

## Overview

The `deltaCalculator.ts` component provides centralized delta calculation for file numbers. This makes it easy to debug delta-related issues by having all calculation logic in one place.

## Delta Calculation Rules

### Single Value (Not a Range)
- **Delta = 1**
- Example: `cameraFile: "001"` → delta = 1

### Range Value
- **Delta = Math.abs(upper - lower) + 1** (inclusive range)
- Example: `cameraFile: "001-003"` → delta = |3 - 1| + 1 = 3
- Example: `camera1_from: "001"`, `camera1_to: "005"` → delta = |5 - 1| + 1 = 5

## Supported Fields

- **Sound File**: Always calculated
- **Camera Files**: 
  - Single camera: `cameraFile`
  - Multi camera: `cameraFile1`, `cameraFile2`, etc.

## Usage Examples

### Calculate Delta from New Take Data

```typescript
import { calculateDeltaFromTakeData } from '@/components/CameraHandlers';

const delta = calculateDeltaFromTakeData(
  takeData,           // Current take data
  showRangeMode,      // Range mode flags
  rangeData,          // Range data (from/to values)
  cameraConfiguration // 1 for single, >1 for multi
);

console.log(delta.soundDelta);        // Sound file delta
console.log(delta.cameraDeltas);      // { cameraFile: 1 } or { cameraFile1: 2, cameraFile2: 1, ... }
console.log(delta.totalDelta);        // Sum of all deltas
```

### Calculate Delta from Existing Log Sheet

```typescript
import { calculateDeltaFromLogSheet } from '@/components/CameraHandlers';

const delta = calculateDeltaFromLogSheet(
  logSheet,           // Existing log sheet entry
  cameraConfiguration // 1 for single, >1 for multi
);
```

### Calculate Delta for Specific Field

```typescript
import { calculateFieldDelta } from '@/components/CameraHandlers';

// From takeData
const soundDelta = calculateFieldDelta('soundFile', {
  takeData,
  showRangeMode,
  rangeData
});

// From existing logSheet data
const cameraDelta = calculateFieldDelta('cameraFile', {
  logSheetData: logSheet.data
});
```

### Calculate Only Sound Delta

```typescript
import { calculateSoundDelta } from '@/components/CameraHandlers';

const soundDelta = calculateSoundDelta({
  takeData,
  showRangeMode,
  rangeData
});
```

### Calculate Only Camera Deltas

```typescript
import { calculateCameraDeltas } from '@/components/CameraHandlers';

const cameraDeltas = calculateCameraDeltas(
  { takeData, showRangeMode, rangeData },
  cameraConfiguration
);

// Single camera result: { cameraFile: 1 }
// Multi camera result: { cameraFile1: 2, cameraFile2: 3, cameraFile3: 1 }
```

## Examples

### Example 1: Single Value Entry
```typescript
const takeData = {
  soundFile: "001",
  cameraFile: "002"
};

const delta = calculateDeltaFromTakeData(
  takeData,
  {},  // no range mode
  {},  // no range data
  1    // single camera
);

// Result:
// {
//   soundDelta: 1,
//   cameraDeltas: { cameraFile: 1 },
//   totalDelta: 2
// }
```

### Example 2: Range Entry
```typescript
const takeData = {};
const showRangeMode = { soundFile: true, cameraFile: true };
const rangeData = {
  soundFile: { from: "001", to: "003" },
  cameraFile: { from: "005", to: "007" }
};

const delta = calculateDeltaFromTakeData(
  takeData,
  showRangeMode,
  rangeData,
  1
);

// Result:
// {
//   soundDelta: 3,        // |3 - 1| + 1 = 3
//   cameraDeltas: { cameraFile: 3 }, // |7 - 5| + 1 = 3
//   totalDelta: 6
// }
```

### Example 3: Multi-Camera Entry
```typescript
const takeData = {
  cameraFile1: "001",
  cameraFile2: "002-004",  // inline range
  cameraFile3: "005"
};
const rangeData = {
  cameraFile2: { from: "002", to: "004" }
};

const delta = calculateDeltaFromTakeData(
  takeData,
  { cameraFile2: true },
  rangeData,
  3  // 3 cameras
);

// Result:
// {
//   soundDelta: 0,  // no sound file
//   cameraDeltas: {
//     cameraFile1: 1,  // single value
//     cameraFile2: 3, // range |4 - 2| + 1 = 3
//     cameraFile3: 1  // single value
//   },
//   totalDelta: 5
// }
```

## Migration from Inline Calculations

### Before (Inline)
```typescript
let soundIncrement = 1;
const newLogRange = rangeData['soundFile'];
if (showRangeMode['soundFile'] && newLogRange?.from && newLogRange?.to) {
  const newFrom = parseInt(newLogRange.from, 10) || 0;
  const newTo = parseInt(newLogRange.to, 10) || 0;
  soundIncrement = Math.abs(newTo - newFrom) + 1;
}
```

### After (Using Delta Calculator)
```typescript
import { calculateSoundDelta } from '@/components/CameraHandlers';

const soundIncrement = calculateSoundDelta({
  takeData,
  showRangeMode,
  rangeData
});
```

## Benefits

1. **Centralized Logic**: All delta calculations in one place
2. **Easy Debugging**: Find and fix delta issues without searching multiple files
3. **Consistent Calculations**: Same logic applied everywhere
4. **Type Safety**: TypeScript interfaces ensure correct usage
5. **Testable**: Can be easily unit tested

