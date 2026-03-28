# Camera Handlers

This directory contains separated logic for single-camera and multi-camera scenarios to improve maintainability and make debugging easier.

## Structure

- `SingleCameraHandler.ts` - All single camera logic (duplicate detection, validation)
- `MultiCameraHandler.ts` - All multi camera logic (duplicate detection, validation)
- `SingleCameraDuplicateDetector.ts` - **Duplicate detection** for single camera (take number + file duplicates)
- `MultiCameraDuplicateDetector.ts` - **Duplicate detection** for multi camera (take number + file duplicates with per-camera matching)
- `SingleCameraShiftHandler.ts` - **File number shifting** for single camera configuration
- `MultiCameraShiftHandler.ts` - **File number shifting** for multi camera configuration
- `deltaCalculator.ts` - **Centralized delta calculation** for all file numbers (sound + cameras)
- `cameraConfigValidator.ts` - **Camera configuration validation** - ensures valid settings and routes to correct handlers
- `handlerRouter.ts` - **Handler routing utilities** - helper functions to route to correct handlers
- `utils.ts` - Shared utility functions
- `types.ts` - TypeScript types and interfaces

## Usage

The main `add-take/[projectId].tsx` file should conditionally use these handlers:

```tsx
const cameraConfiguration = project?.settings?.cameraConfiguration || 1;

{cameraConfiguration === 1 ? (
  <SingleCameraHandler {...singleCameraProps} />
) : (
  <MultiCameraHandler {...multiCameraProps} />
)}
```

## Key Components

### Delta Calculator (`deltaCalculator.ts`)
**Centralized delta calculation** - All delta calculations are now in one place for easy debugging.

**Delta Rules:**
- Single value (not range): delta = 1
- Range value: delta = Math.abs(upper - lower) + 1 (inclusive)

**Applies to:**
- Sound file
- All camera files (single or multi-camera)

See `DELTA_CALCULATOR_USAGE.md` for detailed usage examples.

### Shift Handlers (`SingleCameraShiftHandler.ts`, `MultiCameraShiftHandler.ts`)
**File number shifting** - Centralized logic for shifting file numbers when a new take is inserted before an existing take.

**Shifting Formula:**
- New lower bound = inserted upper bound + 1
- New upper bound = new lower bound + target delta
- Delta = upper - lower (NOT inclusive count)

**Handles:**
- Single camera file shifting
- Multi-camera file shifting (each camera independently)
- Sound file shifting
- Waste/blank field handling (finds previous valid take)

See `SHIFT_HANDLERS_USAGE.md` for detailed usage examples.

### Camera Configuration Validator (`cameraConfigValidator.ts`, `handlerRouter.ts`)
**Camera configuration validation** - Ensures projects are created with valid camera settings and routes to the correct handlers.

**Features:**
- Validates camera configuration on project creation
- Normalizes invalid configurations (defaults to 1 if invalid)
- Provides type-safe helper functions (`isSingleCamera`, `isMultiCamera`)
- Routes to correct handlers based on configuration

**Integration:**
- ✅ `store/projectStore.ts` - Validates on `addProject`
- ✅ `app/project-settings.tsx` - Validates before saving

See `CAMERA_CONFIG_VALIDATION.md` for detailed usage examples.

### Duplicate Detectors (`SingleCameraDuplicateDetector.ts`, `MultiCameraDuplicateDetector.ts`)
**Comprehensive duplicate detection** - Detects take number and file duplicates with insert-before support.

**Features:**
- Take number duplicate detection (within same shot)
- File duplicate detection (camera + sound)
- Lower bound matching for ranges
- Blank field matching (allows insert before when target has blank fields)
- Per-camera matching for multi-camera (Camera 1 = Camera 1, Camera 2 = Camera 2)

**Detection Rules:**
- Lower bound match: New entry's lower bound matches existing entry's lower bound
- Blank field support: Can insert if target has blank sound/camera, as long as non-blank matches
- Multi-camera: Each camera checked independently

See `DUPLICATE_DETECTION_USAGE.md` for detailed usage examples.

## Migration Status

This is an ongoing refactoring. The components will gradually extract camera-specific logic from the main add-take screen.

- ✅ Delta calculator created and ready to use
- ✅ Shift handlers created (single and multi-camera)
- ✅ Sequential shifting implemented (ensures correct shifting order)
- ✅ Duplicate detectors created (single and multi-camera)
- ✅ Camera configuration validator created and integrated
- ✅ Project creation validates camera configuration
- ⏳ Remaining: Update add-take screen to use sequential shift handlers
- ⏳ Remaining: Create UI components
- ⏳ Remaining: Update main files to use all handlers

