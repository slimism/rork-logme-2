# Comprehensive Logging Implementation Plan

## Overview
Replace all console.log statements with comprehensive logging system that includes:
- Function name and file location
- Step-by-step calculations
- Data being saved
- Identifies outdated functions

## Files to Update

1. ✅ `logger.ts` - Created comprehensive logging utility
2. 🔄 `SingleCameraShiftHandler.ts` - Add logging to all functions
3. 🔄 `MultiCameraShiftHandler.ts` - Add logging to all functions
4. 🔄 `deltaCalculator.ts` - Add logging to all calculation functions
5. 🔄 `SingleCameraDuplicateDetector.ts` - Add logging to detection functions
6. 🔄 `MultiCameraDuplicateDetector.ts` - Add logging to detection functions
7. 🔄 `projectStore.ts` - Remove old console.log, add logger

## Logging Points

### Shift Handlers
- Function entry/exit
- getInsertedUpperBound: Show each calculation step (range mode, range from data, inline range, single value)
- calculateFieldShift: Show target delta calculation, new bounds calculation
- shiftSingleCameraFiles: Show sound/camera shifts, updated data
- shiftSingleCameraFilesSequentially: Show sequential shifting steps

### Delta Calculator
- Function entry/exit
- calculateFieldDelta: Show range vs single value logic
- calculateDeltaFromTakeData: Show all field calculations
- calculateDeltaFromLogSheet: Show all field calculations

### Duplicate Detectors
- Function entry/exit
- checkTakeNumberDuplicate: Show duplicate detection logic
- detectFileDuplicates: Show matching logic, insert-before decisions

### Project Store
- Remove old console.log statements
- Add logger.logSave for updateLogSheet
- Add logger.logFunctionEntry/Exit for key functions

