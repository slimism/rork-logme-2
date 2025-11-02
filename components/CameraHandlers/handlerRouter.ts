/**
 * Handler Router
 * 
 * Provides utility functions to route to the correct camera handlers
 * based on project camera configuration settings.
 * 
 * This ensures type safety and consistency when choosing between
 * single camera and multi-camera handlers throughout the application.
 */

import { Project, ProjectSettings } from '@/types';
import { getProjectCameraConfig, getSettingsCameraConfig, CameraConfigurationInfo } from './cameraConfigValidator';

/**
 * Routes to appropriate handler function based on camera configuration
 * 
 * @param project - Project object
 * @param singleCameraHandler - Function to call for single camera
 * @param multiCameraHandler - Function to call for multi camera
 * @returns Result from the appropriate handler
 */
export function routeCameraHandlers<T>(
  project: Project | undefined | null,
  singleCameraHandler: () => T,
  multiCameraHandler: () => T
): T {
  const config = getProjectCameraConfig(project);
  
  if (config.isSingleCamera) {
    return singleCameraHandler();
  } else {
    return multiCameraHandler();
  }
}

/**
 * Routes to appropriate handler function based on camera configuration (async)
 * 
 * @param project - Project object
 * @param singleCameraHandler - Async function to call for single camera
 * @param multiCameraHandler - Async function to call for multi camera
 * @returns Promise with result from the appropriate handler
 */
export async function routeCameraHandlersAsync<T>(
  project: Project | undefined | null,
  singleCameraHandler: () => Promise<T>,
  multiCameraHandler: () => Promise<T>
): Promise<T> {
  const config = getProjectCameraConfig(project);
  
  if (config.isSingleCamera) {
    return await singleCameraHandler();
  } else {
    return await multiCameraHandler();
  }
}

/**
 * Routes to appropriate handler function based on settings
 * 
 * @param settings - Project settings
 * @param singleCameraHandler - Function to call for single camera
 * @param multiCameraHandler - Function to call for multi camera
 * @returns Result from the appropriate handler
 */
export function routeHandlersBySettings<T>(
  settings: ProjectSettings | undefined,
  singleCameraHandler: () => T,
  multiCameraHandler: () => T
): T {
  const config = getSettingsCameraConfig(settings);
  
  if (config.isSingleCamera) {
    return singleCameraHandler();
  } else {
    return multiCameraHandler();
  }
}

/**
 * Gets camera configuration info for conditional logic
 * 
 * @param project - Project object
 * @returns Camera configuration information
 */
export function getCameraConfig(project: Project | undefined | null): CameraConfigurationInfo {
  return getProjectCameraConfig(project);
}

/**
 * Gets camera count for a project
 * 
 * @param project - Project object
 * @returns Camera count (defaults to 1)
 */
export function getCameraCount(project: Project | undefined | null): number {
  return getProjectCameraConfig(project).cameraCount;
}

/**
 * Checks if project uses single camera
 * 
 * @param project - Project to check
 * @returns True if single camera
 */
export function isSingleCamera(project: Project | undefined | null): boolean {
  return getProjectCameraConfig(project).isSingleCamera;
}

/**
 * Checks if project uses multi camera
 * 
 * @param project - Project to check
 * @returns True if multi camera
 */
export function isMultiCamera(project: Project | undefined | null): boolean {
  return getProjectCameraConfig(project).isMultiCamera;
}

