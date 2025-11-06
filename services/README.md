# Services Architecture

This directory contains the refactored services for handling duplicate detection and file number management in the LogMe app.

## Architecture Overview

The new architecture separates concerns into distinct, maintainable services:

### 1. DuplicateService (`duplicateService.ts`)
**Purpose**: Handles all duplicate detection logic
**Responsibilities**:
- Check for duplicates in sound and camera fields
- Determine blank field status for input and target entries
- Provide duplicate handling strategies
- Generate location strings for user display

**Key Methods**:
- `checkDuplicates()` - Main method to detect duplicates
- `checkBlankFields()` - Determine which fields are blank
- `getDuplicateHandlingStrategy()` - Determine the appropriate handling strategy

### 2. DuplicateHandlerService (`duplicateHandlerService.ts`)
**Purpose**: Coordinates duplicate handling and user interactions
**Responsibilities**:
- Orchestrate the duplicate detection and handling process
- Show appropriate alerts to users
- Handle different duplicate scenarios
- Coordinate between services

**Key Methods**:
- `checkAndHandleDuplicates()` - Main entry point for duplicate handling
- `handleDuplicateStrategy()` - Route to appropriate handling method
- Various specific handlers for different scenarios

## Benefits of This Architecture

### 1. **Separation of Concerns**
- Each service has a single, well-defined responsibility
- Business logic is separated from UI logic
- Data manipulation is isolated from user interaction

### 2. **Testability**
- Services can be unit tested independently
- Mock dependencies easily
- Clear interfaces between components

### 3. **Maintainability**
- Changes to duplicate logic only affect DuplicateService
- Easy to add new duplicate handling strategies

### 4. **Reusability**
- Services can be used across different components
- Logic is not tied to specific UI components
- Easy to extend for new features

### 5. **Readability**
- Clear method names and responsibilities
- Well-documented interfaces
- Reduced complexity in main components

## Integration Example

```typescript
// In your component
const handleSaveTake = async () => {
  if (!logSheet || !project) return;

  const duplicateHandlerParams: DuplicateHandlingParams = {
    logSheet,
    project,
    takeData,
    rangeData,
    showRangeMode,
    cameraRecState,
    disabledFields,
    classification,
    shotDetails,
    isGoodTake,
    wasteOptions,
    insertSoundSpeed,
    updateTakeNumbers,
    updateLogSheet,
    router
  };

  const duplicateHandler = new DuplicateHandlerService(duplicateHandlerParams);
  const hasDuplicates = await duplicateHandler.checkAndHandleDuplicates(logSheets);
  
  if (hasDuplicates) {
    return; // Duplicate handling is in progress
  }

  saveNormally();
};
```

## Migration Strategy

1. **Phase 1**: Create services alongside existing code
2. **Phase 2**: Gradually replace complex functions with service calls
3. **Phase 3**: Remove old code once services are fully integrated
4. **Phase 4**: Add comprehensive tests for services

## Testing Strategy

Each service should have:
- Unit tests for all public methods
- Integration tests for service interactions
- Mock implementations for dependencies
- Edge case coverage

## Future Enhancements

- Add logging service for debugging
- Create validation service for data integrity
- Add caching service for performance optimization
- Implement service layer for API interactions
