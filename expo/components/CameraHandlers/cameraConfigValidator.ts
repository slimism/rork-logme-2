/**
 * Camera Configuration Validator
 * 
 * Validates and provides helper functions to route to the correct handlers
 * based on camera configuration settings.
 * 
 * Ensures that:
 * - Camera configuration is valid (1 or >1)
 * - Correct handlers are used based on settings
 * - Configuration is normalized (defaults to 1 if missing/invalid)
 */

import { Project, ProjectSettings } from '@/types';

export interface CameraConfigurationInfo {
  cameraCount: number;
  isSingleCamera: boolean;
  isMultiCamera: boolean;
  isValid: boolean;
}

/**
 * Validates camera configuration
 * 
 * @param cameraConfiguration - Camera configuration from settings
 * @returns Validation result with normalized value
 */
export const validateCameraConfiguration = (
  cameraConfiguration?: number
): CameraConfigurationInfo => {
  // Default to 1 if not provided or invalid
  const normalized = cameraConfiguration && cameraConfiguration > 0 
    ? cameraConfiguration 
    : 1;

  return {
    cameraCount: normalized,
    isSingleCamera: normalized === 1,
    isMultiCamera: normalized > 1,
    isValid: normalized >= 1
  };
};

/**
 * Gets camera configuration info from a project
 * 
 * @param project - Project object
 * @returns Camera configuration information
 */
export const getProjectCameraConfig = (project: Project | undefined | null): CameraConfigurationInfo => {
  if (!project || !project.settings) {
    return validateCameraConfiguration(1); // Default to single camera
  }

  return validateCameraConfiguration(project.settings.cameraConfiguration);
};

/**
 * Gets camera configuration info from settings
 * 
 * @param settings - Project settings
 * @returns Camera configuration information
 */
export const getSettingsCameraConfig = (settings?: ProjectSettings): CameraConfigurationInfo => {
  return validateCameraConfiguration(settings?.cameraConfiguration);
};

/**
 * Ensures camera configuration is valid when creating/updating project settings
 * 
 * @param settings - Project settings to validate
 * @returns Validated and normalized settings
 */
export const normalizeProjectSettings = (settings?: ProjectSettings): ProjectSettings => {
  const validated = validateCameraConfiguration(settings?.cameraConfiguration);
  
  return {
    ...settings,
    cameraConfiguration: validated.cameraCount
  } as ProjectSettings;
};

/**
 * Type guard to check if project uses single camera
 * 
 * @param project - Project to check
 * @returns True if single camera, false otherwise
 */
export const isSingleCameraProject = (project: Project | undefined | null): boolean => {
  return getProjectCameraConfig(project).isSingleCamera;
};

/**
 * Type guard to check if project uses multi camera
 * 
 * @param project - Project to check
 * @returns True if multi camera, false otherwise
 */
export const isMultiCameraProject = (project: Project | undefined | null): boolean => {
  return getProjectCameraConfig(project).isMultiCamera;
};

/**
 * Gets the camera configuration count with validation
 * 
 * @param project - Project to check
 * @returns Camera count (defaults to 1)
 */
export const getCameraCount = (project: Project | undefined | null): number => {
  return getProjectCameraConfig(project).cameraCount;
};

/**
 * Validates camera configuration and throws error if invalid
 * Useful for runtime validation in critical paths
 * 
 * @param cameraConfiguration - Camera configuration to validate
 * @throws Error if configuration is invalid
 */
export const assertValidCameraConfiguration = (cameraConfiguration?: number): void => {
  const validated = validateCameraConfiguration(cameraConfiguration);
  
  if (!validated.isValid || validated.cameraCount < 1) {
    throw new Error(
      `Invalid camera configuration: ${cameraConfiguration}. ` +
      `Must be a positive integer (>= 1). Defaulting to 1.`
    );
  }
};

