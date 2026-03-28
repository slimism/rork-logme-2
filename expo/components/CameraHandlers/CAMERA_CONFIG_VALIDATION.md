# Camera Configuration Validation Guide

## Overview

The camera configuration validation system ensures that projects are created with valid camera settings and that the correct handlers are used throughout the application.

## Validation on Project Creation

When a project is created:

1. **In `store/projectStore.ts`**: The `addProject` function automatically validates and normalizes camera configuration using `normalizeProjectSettings()`
2. **In `app/project-settings.tsx`**: The settings screen validates camera configuration before saving

### Validation Rules

- **Default Value**: If `cameraConfiguration` is missing, null, undefined, or invalid → defaults to `1` (single camera)
- **Minimum Value**: Must be `>= 1`
- **Type**: Must be a number

## Usage Examples

### Get Camera Configuration Info

```typescript
import { getProjectCameraConfig, isSingleCamera, isMultiCamera } from '@/components/CameraHandlers';

const project = projects.find(p => p.id === projectId);

// Get full configuration info
const config = getProjectCameraConfig(project);
console.log(config.cameraCount);      // e.g., 1 or 3
console.log(config.isSingleCamera);   // true or false
console.log(config.isMultiCamera);    // true or false
console.log(config.isValid);          // true

// Quick checks
if (isSingleCamera(project)) {
  // Use single camera handlers
} else if (isMultiCamera(project)) {
  // Use multi camera handlers
}
```

### Route to Correct Handlers

```typescript
import { routeCameraHandlers } from '@/components/CameraHandlers';
import { checkSingleCameraDuplicate, checkMultiCameraDuplicate } from '@/components/CameraHandlers';

const project = projects.find(p => p.id === projectId);

const duplicate = routeCameraHandlers(
  project,
  () => checkSingleCameraDuplicate({
    takeData,
    disabledFields,
    showRangeMode,
    rangeData,
    projectLogSheets
  }),
  () => checkMultiCameraDuplicate({
    takeData,
    disabledFields,
    showRangeMode,
    rangeData,
    cameraRecState,
    projectLogSheets,
    cameraConfiguration: getCameraCount(project)
  })
);
```

### Validate Settings Before Creating Project

```typescript
import { normalizeProjectSettings } from '@/components/CameraHandlers';

const settings = {
  cameraConfiguration: userInput, // might be invalid
  // ... other settings
};

// This ensures cameraConfiguration is valid
const normalized = normalizeProjectSettings(settings);
// normalized.cameraConfiguration will be >= 1, defaulting to 1 if invalid
```

## Benefits

1. **Type Safety**: Ensures camera configuration is always valid
2. **Default Handling**: Automatically defaults to single camera if invalid
3. **Consistent Logic**: Same validation logic used everywhere
4. **Easy Routing**: Helper functions make it easy to route to correct handlers
5. **Debugging**: Clear error messages if validation fails

## Integration Points

### Project Creation
- ✅ `store/projectStore.ts` - Validates on `addProject`
- ✅ `app/project-settings.tsx` - Validates before saving

### Usage in Code
Replace inline checks like:
```typescript
// Before
const camCount = project?.settings?.cameraConfiguration || 1;
if (camCount === 1) {
  // single camera logic
} else {
  // multi camera logic
}

// After
import { isSingleCamera, isMultiCamera } from '@/components/CameraHandlers';
if (isSingleCamera(project)) {
  // single camera logic
} else if (isMultiCamera(project)) {
  // multi camera logic
}
```

## Error Handling

If invalid configuration is detected:

1. **During Project Creation**: Automatically normalizes to default (1)
2. **Runtime Validation**: `assertValidCameraConfiguration()` throws error if needed
3. **Logging**: Console warnings if normalization occurs

## Best Practices

1. **Always use validator functions** instead of direct property access
2. **Use routeCameraHandlers** when choosing between single/multi handlers
3. **Validate early** in project creation flow
4. **Don't assume** cameraConfiguration exists - always validate

