/**
 * Camera Handlers - Route to appropriate handler based on camera configuration
 * 
 * This index file exports SingleCameraHandler and MultiCameraHandler
 * functions that can be used conditionally based on camera configuration,
 * allowing separate maintenance of single vs multi-camera logic.
 */

export * from './SingleCameraHandler';
export * from './MultiCameraHandler';
export * from './SingleCameraShiftHandler';
export * from './MultiCameraShiftHandler';
export * from './SingleCameraDuplicateDetector';
export * from './MultiCameraDuplicateDetector';
export * from './deltaCalculator';
export * from './cameraConfigValidator';
export * from './handlerRouter';
export * from './types';
export * from './utils';
export * from './SoundHandler';
export { logger } from './logger';

// Re-export sequential shift functions
export {
  shiftSingleCameraFilesSequentially
} from './SingleCameraShiftHandler';
export {
  shiftMultiCameraFilesSequentially
} from './MultiCameraShiftHandler';

