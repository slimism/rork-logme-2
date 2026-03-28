# Camera Handlers Refactoring Guide

## What Has Been Created

### Core Structure
- ✅ `types.ts` - TypeScript interfaces and types
- ✅ `utils.ts` - Shared utility functions (formatFileNumber, getRangeFromData, etc.)
- ✅ `SingleCameraHandler.ts` - Single camera duplicate detection and validation
- ✅ `MultiCameraHandler.ts` - Multi camera duplicate detection and validation
- ✅ `index.ts` - Main export file

## What Still Needs to Be Done

### 1. Extract Remaining Logic to Handlers

The following logic still needs to be extracted from `app/add-take/[projectId].tsx`:

#### Single Camera (`SingleCameraHandler.ts`)
- [ ] File number shifting logic (lines ~1731-1810)
- [ ] Duplicate handling save logic (lines ~1906-2000+)
- [ ] `getPreviousTakeUpperBound` integration for single camera
- [ ] Camera file blank checking in duplicate scenarios

#### Multi Camera (`MultiCameraHandler.ts`)
- [ ] File number shifting logic for all cameras (lines ~1811-1900)
- [ ] Duplicate handling save logic for all cameras (lines ~2000+)
- [ ] `getPreviousTakeUpperBound` integration for each camera
- [ ] Camera file blank checking in duplicate scenarios

### 2. Create UI Components

#### For Add-Take Screen
- [ ] `SingleCameraFields.tsx` - Render single camera input field with range support
- [ ] `MultiCameraFields.tsx` - Render multi camera input fields with REC buttons

#### For Project Screen  
- [ ] `SingleCameraDisplay.tsx` - Display single camera file in project view
- [ ] `MultiCameraDisplay.tsx` - Display all camera files in project view

### 3. Update Main Files

#### `app/add-take/[projectId].tsx`
Replace camera-specific sections with:

```tsx
import { 
  checkSingleCameraDuplicate, 
  validateSingleCamera,
  checkMultiCameraDuplicate,
  validateMultiCamera 
} from '@/components/CameraHandlers';

// In findFirstDuplicateFile function:
const cameraConfiguration = project?.settings?.cameraConfiguration || 1;
if (cameraConfiguration === 1) {
  const duplicate = checkSingleCameraDuplicate({
    takeData,
    disabledFields,
    showRangeMode,
    rangeData,
    projectLogSheets
  });
  if (duplicate) return duplicate;
} else {
  const duplicate = checkMultiCameraDuplicate({
    takeData,
    disabledFields,
    showRangeMode,
    rangeData,
    cameraRecState,
    projectLogSheets,
    cameraConfiguration
  });
  if (duplicate) return duplicate;
}

// In validateMandatoryFields function:
if (cameraConfiguration === 1) {
  const { errors: camErrors, missingFields: camMissing } = validateSingleCamera(
    takeData,
    disabledFields
  );
  camErrors.forEach(e => errors.add(e));
  missingFields.push(...camMissing);
} else {
  const { errors: camErrors, missingFields: camMissing } = validateMultiCamera(
    takeData,
    disabledFields,
    cameraRecState,
    cameraConfiguration
  );
  camErrors.forEach(e => errors.add(e));
  missingFields.push(...camMissing);
}
```

#### `app/project/[id].tsx`
Replace the camera file rendering logic with conditional components.

## Migration Strategy

1. **Phase 1 (Current)**: Extract duplicate detection and validation ✅
2. **Phase 2**: Extract file shifting and duplicate save logic
3. **Phase 3**: Create UI components
4. **Phase 4**: Update main files to use handlers
5. **Phase 5**: Test and refine

## Benefits

- **Easier Debugging**: Camera-specific issues can be isolated to their handler file
- **Better Maintainability**: Changes to single vs multi-camera don't affect each other
- **Clearer Code**: Main files are less cluttered with conditional camera logic
- **Reusability**: Handlers can be used in other parts of the app

