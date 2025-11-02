import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Project, Folder, LogSheet, ProjectSettings } from '@/types';
import { useTokenStore } from './subscriptionStore';
import { normalizeProjectSettings } from '@/components/CameraHandlers/cameraConfigValidator';
import { logger } from '@/components/CameraHandlers/logger';
import { getSoundFileValueForSubsequentShift, getSoundFileInfo, calculateSoundFileDelta, SoundHandlerContext } from '@/components/CameraHandlers/SoundHandler';
import { calculateSoundDeltaForShifting, calculateCameraDeltaForShifting, DeltaCalculationInput } from '@/components/CameraHandlers/deltaCalculator';

interface ProjectState {
  projects: Project[];
  folders: Folder[];
  logSheets: LogSheet[];
  addProject: (name: string, settings?: ProjectSettings, logoUri?: string) => Project;
  updateProject: (id: string, name: string) => void;
  updateProjectLogo: (id: string, logoUri: string) => void;
  deleteProject: (id: string) => void;
  addFolder: (name: string, projectId: string) => Folder;
  updateFolder: (id: string, name: string) => void;
  deleteFolder: (id: string) => void;
  addLogSheet: (name: string, type: string, folderId: string, projectId: string) => LogSheet;
  updateLogSheet: (id: string, data: any) => void;
  updateLogSheetName: (id: string, name: string) => void;
  deleteLogSheet: (id: string) => void;
  updateTakeNumbers: (projectId: string, sceneNumber: string, shotNumber: string, fromTakeNumber: number, increment: number, excludeLogId?: string, maxTakeNumber?: number) => void;
  updateFileNumbers: (projectId: string, fieldId: string, fromNumber: number, increment: number, excludeLogId?: string) => void;
}

export const useProjectStore = create<ProjectState>()(
  persist(
    (set, get) => ({
      projects: [],
      folders: [],
      logSheets: [],
      
      addProject: (name: string, settings?: ProjectSettings, logoUri?: string) => {
        // Validate and normalize camera configuration
        const normalizedSettings = normalizeProjectSettings(settings);
        
        const newProject: Project = {
          id: Date.now().toString(),
          name,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          settings: normalizedSettings,
          logoUri,
        };
        
        const state = get();
        const tokenStore = useTokenStore.getState();
        
        // First project and no tokens = trial project
        if (state.projects.length === 0 && tokenStore.trialProjectId === null && tokenStore.tokens === 0) {
          useTokenStore.setState({ trialProjectId: newProject.id });
          logger.logDebug('Created trial project', { projectId: newProject.id });
        } 
        // Has tokens = use token and unlock project
        else if (tokenStore.tokens > 0) {
          const success = tokenStore.useToken();
          if (success) {
            // Add to unlocked projects immediately
            const updatedUnlockedProjects = [...tokenStore.unlockedProjects, newProject.id];
            useTokenStore.setState({ 
              unlockedProjects: updatedUnlockedProjects
            });
            logger.logDebug('Project unlocked with token', { projectId: newProject.id, unlockedProjects: updatedUnlockedProjects });
          }
        }
        
        set((state) => ({
          projects: [...state.projects, newProject],
        }));
        
        return newProject;
      },
      
      updateProject: (id: string, name: string) => {
        set((state) => ({
          projects: state.projects.map((project) => 
            project.id === id 
              ? { ...project, name, updatedAt: new Date().toISOString() } 
              : project
          ),
        }));
      },
      
      updateProjectLogo: (id: string, logoUri: string) => {
        set((state) => ({
          projects: state.projects.map((project) => 
            project.id === id 
              ? { ...project, logoUri, updatedAt: new Date().toISOString() } 
              : project
          ),
        }));
      },
      
      deleteProject: (id: string) => {
        set((state) => ({
          projects: state.projects.filter((project) => project.id !== id),
          folders: state.folders.filter((folder) => folder.projectId !== id),
          logSheets: state.logSheets.filter((logSheet) => logSheet.projectId !== id),
        }));
      },
      
      addFolder: (name: string, projectId: string) => {
        const newFolder: Folder = {
          id: Date.now().toString(),
          name,
          projectId,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        
        set((state) => ({
          folders: [...state.folders, newFolder],
        }));
        
        return newFolder;
      },
      
      updateFolder: (id: string, name: string) => {
        set((state) => ({
          folders: state.folders.map((folder) => 
            folder.id === id 
              ? { ...folder, name, updatedAt: new Date().toISOString() } 
              : folder
          ),
        }));
      },
      
      deleteFolder: (id: string) => {
        set((state) => ({
          folders: state.folders.filter((folder) => folder.id !== id),
          logSheets: state.logSheets.filter((logSheet) => logSheet.folderId !== id),
        }));
      },
      
      addLogSheet: (name: string, type: string, folderId: string, projectId: string) => {
        const newLogSheet: LogSheet = {
          id: Date.now().toString(),
          name,
          type: type as any,
          folderId,
          projectId,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          data: {},
        };
        
        set((state) => ({
          logSheets: [...state.logSheets, newLogSheet],
        }));
        
        return newLogSheet;
      },
      
      updateLogSheet: (id: string, data: any) => {
        // --- Field normalization fix ---
        ['sceneNumber', 'shotNumber', 'takeNumber'].forEach((key) => {
          if (data.hasOwnProperty(key)) {
            if (typeof data[key] === 'string') {
              const trimmed = data[key].trim();
              data[key] = trimmed.length > 0 ? trimmed : undefined;
            } else if (data[key] == null) {
              data[key] = undefined;
            }
          }
        });
        const existingLogSheet = get().logSheets.find(sheet => sheet.id === id);
        const previousData = existingLogSheet?.data || {};
        
        logger.logFunctionEntry({ logSheetId: id, operation: 'updateLogSheet' });
        
        set((state) => ({
          logSheets: state.logSheets.map((logSheet) => 
            logSheet.id === id 
              ? { ...logSheet, data, updatedAt: new Date().toISOString() } 
              : logSheet
          ),
        }));
        
        const updated = get().logSheets.find(sheet => sheet.id === id);
        logger.logSave('updateLogSheet', id, updated?.data || {}, previousData);
        logger.logFunctionExit(updated);
      },
      
      updateLogSheetName: (id: string, name: string) => {
        set((state) => ({
          logSheets: state.logSheets.map((logSheet) => 
            logSheet.id === id 
              ? { ...logSheet, name, updatedAt: new Date().toISOString() } 
              : logSheet
          ),
        }));
      },
      
      deleteLogSheet: (id: string) => {
        const state = get();
        const logSheetToDelete = state.logSheets.find(sheet => sheet.id === id);
        
        if (logSheetToDelete && logSheetToDelete.data) {
          const { sceneNumber, shotNumber, takeNumber } = logSheetToDelete.data;
          const takeNum = parseInt(takeNumber);
          
          // Update take numbers for subsequent takes in the same scene and shot
          if (sceneNumber && shotNumber && !isNaN(takeNum)) {
            const projectId = logSheetToDelete.projectId;
            
            set((state) => ({
              logSheets: state.logSheets
                .filter((logSheet) => logSheet.id !== id)
                .map((logSheet) => {
                  if (logSheet.projectId === projectId && 
                      logSheet.data?.sceneNumber === sceneNumber &&
                      logSheet.data?.shotNumber === shotNumber) {
                    const currentTakeNum = parseInt(logSheet.data.takeNumber);
                    if (!isNaN(currentTakeNum) && currentTakeNum > takeNum) {
                      return {
                        ...logSheet,
                        data: {
                          ...logSheet.data,
                          takeNumber: (currentTakeNum - 1).toString()
                        },
                        updatedAt: new Date().toISOString()
                      };
                    }
                  }
                  return logSheet;
                })
            }));
          } else {
            set((state) => ({
              logSheets: state.logSheets.filter((logSheet) => logSheet.id !== id),
            }));
          }
        } else {
          set((state) => ({
            logSheets: state.logSheets.filter((logSheet) => logSheet.id !== id),
          }));
        }
      },
      
      updateTakeNumbers: (projectId: string, sceneNumber: string, shotNumber: string, fromTakeNumber: number, increment: number, excludeLogId?: string, maxTakeNumber?: number) => {
        logger.logFunctionEntry({
          functionName: 'updateTakeNumbers',
          projectId,
          sceneNumber,
          shotNumber,
          fromTakeNumber,
          increment,
          excludeLogId,
          maxTakeNumber
        });
        
        set((state) => ({
          logSheets: state.logSheets.map((logSheet) => {
            try {
              if (logSheet.projectId !== projectId) return logSheet;
              
              // Skip the excluded log (the edited log being moved)
              if (excludeLogId && logSheet.id === excludeLogId) {
                logger.logDebug(`Skipping excluded log`, { logSheetId: logSheet.id, takeNumber: logSheet.data?.takeNumber });
                return logSheet;
              }

              const data = logSheet.data ?? {} as Record<string, unknown>;
              const lsScene = typeof data.sceneNumber === 'string' ? data.sceneNumber.trim() : '';
              const lsShot = typeof data.shotNumber === 'string' ? data.shotNumber.trim() : '';
              const targetScene = sceneNumber?.trim?.() ?? sceneNumber;
              const targetShot = shotNumber?.trim?.() ?? shotNumber;

              if (lsScene !== targetScene || lsShot !== targetShot) return logSheet;

              const takeRaw = (data as any).takeNumber as unknown;
              const currentTakeNum = typeof takeRaw === 'string' ? parseInt(takeRaw, 10) : Number.NaN;

              // Check if take should be shifted
              const shouldShift = !Number.isNaN(currentTakeNum) && 
                                 currentTakeNum >= fromTakeNumber &&
                                 (maxTakeNumber === undefined || currentTakeNum <= maxTakeNumber);
              
              if (shouldShift) {
                console.log(`  -> Shifting take ${currentTakeNum} to ${currentTakeNum + increment} (log ${logSheet.id})`);
                return {
                  ...logSheet,
                  data: {
                    ...logSheet.data,
                    takeNumber: (currentTakeNum + increment).toString(),
                  },
                  updatedAt: new Date().toISOString(),
                };
              } else if (!Number.isNaN(currentTakeNum) && currentTakeNum > fromTakeNumber && maxTakeNumber !== undefined) {
                console.log(`  -> Skipping take ${currentTakeNum} (beyond maxTakeNumber ${maxTakeNumber})`);
              }
              return logSheet;
            } catch (e) {
              console.log('[updateTakeNumbers] error while updating take numbers', e);
              return logSheet;
            }
          }),
        }));
      },

      updateFileNumbers: (projectId: string, fieldId: string, fromNumber: number, increment: number, excludeLogId?: string) => {
        logger.logFunctionEntry({
          functionName: 'updateFileNumbers',
          projectId,
          fieldId,
          fromNumber,
          increment,
          excludeLogId
        });
        
        set((state) => {
          // Helper to get field value and determine if blank
          const getFieldValue = (sheetData: any, fId: string): { value: number | null; isRange: boolean; upper: number; lower: number } | null => {
            if (fId === 'soundFile') {
              const soundFrom = sheetData['sound_from'];
              const soundTo = sheetData['sound_to'];
              if (soundFrom && soundTo) {
                const from = parseInt(soundFrom, 10) || 0;
                const to = parseInt(soundTo, 10) || 0;
                return { value: Math.max(from, to), isRange: true, upper: Math.max(from, to), lower: Math.min(from, to) };
              }
              const soundFile = sheetData['soundFile'];
              if (soundFile && typeof soundFile === 'string' && soundFile.trim()) {
                if (soundFile.includes('-')) {
                  const [s, e] = soundFile.split('-').map(x => parseInt(x.trim(), 10) || 0);
                  return { value: Math.max(s, e), isRange: true, upper: Math.max(s, e), lower: Math.min(s, e) };
                }
                const num = parseInt(soundFile, 10);
                if (!Number.isNaN(num)) {
                  return { value: num, isRange: false, upper: num, lower: num };
                }
              }
            } else if (fId.startsWith('cameraFile')) {
              const cameraNum = fId === 'cameraFile' ? 1 : (parseInt(fId.replace('cameraFile', ''), 10) || 1);
              const cameraFrom = sheetData[`camera${cameraNum}_from`];
              const cameraTo = sheetData[`camera${cameraNum}_to`];
              if (cameraFrom && cameraTo) {
                const from = parseInt(cameraFrom, 10) || 0;
                const to = parseInt(cameraTo, 10) || 0;
                return { value: Math.max(from, to), isRange: true, upper: Math.max(from, to), lower: Math.min(from, to) };
              }
              const cameraFile = sheetData[fId];
              if (cameraFile && typeof cameraFile === 'string' && cameraFile.trim()) {
                if (cameraFile.includes('-')) {
                  const [s, e] = cameraFile.split('-').map(x => parseInt(x.trim(), 10) || 0);
                  return { value: Math.max(s, e), isRange: true, upper: Math.max(s, e), lower: Math.min(s, e) };
                }
                const num = parseInt(cameraFile, 10);
                if (!Number.isNaN(num)) {
                  return { value: num, isRange: false, upper: num, lower: num };
                }
              }
            }
            return null; // Blank/waste field
          };

          // Helper to find last valid field value before a given take
          const getPreviousValidValue = (logSheets: LogSheet[], currentTakeNum: number, sceneNum: string, shotNum: string, fId: string, excludeIds: Set<string>): number | null => {
            for (const sheet of logSheets) {
              if (excludeIds.has(sheet.id)) continue;
              const data = sheet.data || {};
              if (data.sceneNumber !== sceneNum || data.shotNumber !== shotNum) continue;
              const takeNum = parseInt(data.takeNumber as string || '0', 10);
              if (takeNum >= currentTakeNum) continue;
              
              const fieldVal = getFieldValue(data, fId);
              if (fieldVal && fieldVal.value !== null) {
                return fieldVal.upper;
              }
            }
            return null;
          };

          // Get relevant log sheets for this project, scene, and shot
          const relevantSheets = state.logSheets
            .filter(sheet => sheet.projectId === projectId)
            .map(sheet => {
              const data = sheet.data || {};
              const takeNum = parseInt(data.takeNumber as string || '0', 10);
              return { sheet, takeNum, scene: data.sceneNumber as string, shot: data.shotNumber as string };
            })
            .filter(item => !Number.isNaN(item.takeNum))
            .sort((a, b) => {
              // Sort by scene, shot, then take number
              if (a.scene !== b.scene) return (a.scene || '').localeCompare(b.scene || '');
              if (a.shot !== b.shot) return (a.shot || '').localeCompare(b.shot || '');
              return a.takeNum - b.takeNum;
            });

          // Process sequentially - must process takes in order for correct sequential shifting
          // Group sheets by scene/shot and process each group sequentially
          const sheetsBySceneShot = new Map<string, LogSheet[]>();
          
          // Group sheets by scene:shot
          state.logSheets.forEach(logSheet => {
            if (logSheet.projectId !== projectId) return;
            const data = logSheet.data || {};
            const sceneNum = data.sceneNumber as string || '';
            const shotNum = data.shotNumber as string || '';
            const sceneShotKey = `${sceneNum}:${shotNum}`;
            
            if (!sheetsBySceneShot.has(sceneShotKey)) {
              sheetsBySceneShot.set(sceneShotKey, []);
            }
            sheetsBySceneShot.get(sceneShotKey)!.push(logSheet);
          });
          
          // Sort each group by take number
          sheetsBySceneShot.forEach((sheets, key) => {
            sheets.sort((a, b) => {
              const aTake = parseInt(a.data?.takeNumber as string || '0', 10);
              const bTake = parseInt(b.data?.takeNumber as string || '0', 10);
              return aTake - bTake;
            });
          });
          
          const updatedSheetsMap = new Map<string, LogSheet>();
          
          // Process each scene/shot group sequentially
          sheetsBySceneShot.forEach((sheets, sceneShotKey) => {
            const [sceneNum, shotNum] = sceneShotKey.split(':');
            
            // Separate temp variables for tracking upper bounds used in calculations
            // These persist across blank fields to ensure correct sequential shifting
            let tempSound: number | null = null; // Upper bound of sound file for next calculation
            let tempCamera: { [cameraNum: number]: number | null } = {}; // Upper bounds for each camera
            
            // Initialize temp variables from the inserted log
            // The inserted log is the one that was inserted before the target duplicate
            // When a log is inserted before Take N with file number X, the inserted log becomes Take N with file number X
            // Then we call updateFileNumbers with fromNumber = X to shift subsequent logs
            // So the inserted log should have file number = fromNumber, and it should be the one with the LOWEST take number
            // that matches fromNumber (to handle cases where multiple logs might have the same file number)
            
            // Strategy 1: Find log with file number matching fromNumber, prioritizing the LOWEST take number
            // This is the correct approach: inserted log has file number = fromNumber
            const matchingLogs = sheets
              .filter(sheet => {
                const sheetFieldVal = getFieldValue(sheet.data || {}, fieldId);
                if (sheetFieldVal && sheetFieldVal.value !== null) {
                  // Check if this log's file number matches fromNumber
                  return sheetFieldVal.lower === fromNumber || sheetFieldVal.upper === fromNumber;
                }
                return false;
              })
              .sort((a, b) => {
                // Sort by take number (ascending) to get the one with LOWEST take number
                // This ensures we get the inserted log, not a later log that also has the same file number
                const aTake = parseInt(a.data?.takeNumber as string || '0', 10);
                const bTake = parseInt(b.data?.takeNumber as string || '0', 10);
                return aTake - bTake; // Ascending order: lowest take number first
              });
            
            let insertedLog = matchingLogs[0]; // Get the one with lowest take number
            
            // Strategy 2: If not found, try fromNumber - 1 (fallback for edge cases)
            if (!insertedLog) {
              const fallbackLogs = sheets
                .filter(sheet => {
                  const sheetFieldVal = getFieldValue(sheet.data || {}, fieldId);
                  if (sheetFieldVal && sheetFieldVal.value !== null) {
                    const expectedInsertedFileNum = fromNumber - 1;
                    return sheetFieldVal.lower === expectedInsertedFileNum || sheetFieldVal.upper === expectedInsertedFileNum;
                  }
                  return false;
                })
                .sort((a, b) => {
                  const aTake = parseInt(a.data?.takeNumber as string || '0', 10);
                  const bTake = parseInt(b.data?.takeNumber as string || '0', 10);
                  return bTake - aTake; // Descending: highest take number first (closest to insertion point)
                });
              
              insertedLog = fallbackLogs[0];
            }
            
            if (insertedLog) {
              const insertedData = insertedLog.data || {};
              const insertedTakeNum = parseInt(insertedData.takeNumber as string || '0', 10);
              
              // Initialize the current field's temp variable
              const insertedFieldVal = getFieldValue(insertedData, fieldId);
              if (insertedFieldVal && insertedFieldVal.value !== null) {
                if (fieldId === 'soundFile') {
                  tempSound = insertedFieldVal.upper;
                  logger.logDebug(`Initialized tempSound from inserted log (Take ${insertedTakeNum}, file number ${insertedFieldVal.lower}/${insertedFieldVal.upper}): ${tempSound}`);
                } else if (fieldId.startsWith('cameraFile')) {
                  const cameraNum = fieldId === 'cameraFile' ? 1 : (parseInt(fieldId.replace('cameraFile', ''), 10) || 1);
                  tempCamera[cameraNum] = insertedFieldVal.upper;
                  logger.logDebug(`Initialized tempCamera[${cameraNum}] from inserted log (Take ${insertedTakeNum}, file number ${insertedFieldVal.lower}/${insertedFieldVal.upper}): ${tempCamera[cameraNum]}`);
                }
              } else {
                logger.logWarning(`Inserted log (Take ${insertedTakeNum}) found but field ${fieldId} is blank/null - temp variables not initialized for this field`);
              }
              
              // For multi-camera: Also initialize temp variables for ALL other camera fields from the same inserted log
              // This ensures all camera fields use the same inserted log's values, even if called separately
              if (fieldId.startsWith('cameraFile')) {
                // Find all camera fields in the inserted log and initialize their temp variables
                for (let camNum = 1; camNum <= 10; camNum++) { // Check up to 10 cameras
                  const camFieldId = camNum === 1 ? 'cameraFile' : `cameraFile${camNum}`;
                  if (camFieldId !== fieldId) { // Don't re-initialize the current field
                    const camFieldVal = getFieldValue(insertedData, camFieldId);
                    if (camFieldVal && camFieldVal.value !== null && (tempCamera[camNum] === null || tempCamera[camNum] === undefined)) {
                      tempCamera[camNum] = camFieldVal.upper;
                      logger.logDebug(`Initialized tempCamera[${camNum}] from inserted log (Take ${insertedTakeNum}, field ${camFieldId}, file number ${camFieldVal.lower}/${camFieldVal.upper}): ${tempCamera[camNum]}`);
                    }
                  }
                }
              }
            } else {
              logger.logWarning(`Inserted log with file number ${fromNumber} for field ${fieldId} not found - temp variables not initialized. This may cause incorrect shifting calculations.`);
            }
            
            sheets.forEach((logSheet, index) => {
              if (excludeLogId && logSheet.id === excludeLogId) {
                logger.logDebug(`Skipping excluded log`, { logSheetId: logSheet.id });
                updatedSheetsMap.set(logSheet.id, logSheet);
                return;
              }
              
              const data = logSheet.data || {};
              const takeNum = parseInt(data.takeNumber as string || '0', 10);
              
              if (Number.isNaN(takeNum)) {
                updatedSheetsMap.set(logSheet.id, logSheet);
                return;
              }
              
              let updated = false;
              const newData: Record<string, any> = { ...data };
              
              // Get current field value
              const currentFieldVal = getFieldValue(data, fieldId);
              // Note: We no longer skip the target duplicate
              // Instead, we process it through the normal shifting logic
              // The inserted log's upper bounds are used to initialize temp variables before processing
              // Then the target duplicate is processed like any other take, and temp variables are updated correctly

              // Check if field needs shifting
              if (currentFieldVal && currentFieldVal.value !== null) {
                // Field has a value
                if (currentFieldVal.lower >= fromNumber || currentFieldVal.upper >= fromNumber) {
                  // Needs shifting - use sequential logic: shift from the temp variable (previous take's upper bound) + 1
                  // For sequential shifting, we MUST use temp variables when available to ensure correct propagation
                  
                  // Determine shift base based on field type and temp variables
                  // For sequential shifting (takeNum > fromNumber), ALWAYS use temp variables
                  // They are automatically assigned from the inserted log's upper bounds
                  let shiftBase: number;
                  
                  // ALWAYS use temp variables when available for ALL takes that need shifting
                  // This includes the target duplicate - it should use tempCamera/tempSound just like subsequent takes
                  // The key: tempCamera/tempSound track the inserted log's upper bounds, which should be used
                  // for the FIRST shift (target duplicate), then updated, then used for subsequent shifts
                  
                  if (fieldId === 'soundFile') {
                    if (tempSound !== null) {
                      // ALWAYS use tempSound when available (including target duplicate)
                      shiftBase = tempSound;
                      logger.logDebug(`Using tempSound (${tempSound}) for take ${takeNum} - sequential shift`);
                    } else {
                      // tempSound not available - fallback to currentFieldVal
                      shiftBase = currentFieldVal.lower >= fromNumber ? currentFieldVal.lower : currentFieldVal.upper;
                      logger.logWarning(`tempSound not available for take ${takeNum} - using currentFieldVal (${shiftBase}) as fallback`);
                    }
                  } else if (fieldId.startsWith('cameraFile')) {
                    const cameraNum = fieldId === 'cameraFile' ? 1 : (parseInt(fieldId.replace('cameraFile', ''), 10) || 1);
                    if (tempCamera[cameraNum] !== null && tempCamera[cameraNum] !== undefined) {
                      // ALWAYS use tempCamera when available (including target duplicate)
                      shiftBase = tempCamera[cameraNum]!;
                      logger.logDebug(`Using tempCamera[${cameraNum}] (${shiftBase}) for take ${takeNum} - sequential shift`);
                    } else {
                      // tempCamera not available - fallback to currentFieldVal
                      shiftBase = currentFieldVal.lower >= fromNumber ? currentFieldVal.lower : currentFieldVal.upper;
                      logger.logWarning(`tempCamera[${cameraNum}] not available for take ${takeNum} - using currentFieldVal (${shiftBase}) as fallback`);
                    }
                  } else {
                    shiftBase = currentFieldVal.lower >= fromNumber ? currentFieldVal.lower : currentFieldVal.upper;
                  }
                  
                  // Calculate new bounds: newLower = shiftBase + 1, newUpper = newLower + delta
                  // Delta calculation rules:
                  // - For ranges: delta = upper - lower (difference between bounds)
                  // - For single values: delta = 1 (the field represents 1 file number, so span is 1)
                  // - For blank/waste: delta = 0 (field stays blank, temp variable unchanged)
                  // Formula: newLower = tempValue + 1, newUpper = newLower + delta
                  // For single values: newLower = tempValue + 1, newUpper = newLower + 1
                  //   (e.g., tempCamera = 4: newLower = 5, newUpper = 6, but we store 5 as single value, tempCamera = 5)
                  // For ranges: newLower = tempValue + 1, newUpper = newLower + (upper - lower)
                  //   (e.g., tempCamera = 4, range 001-003 (delta=2): newLower = 5, newUpper = 7)
                  let newLower = shiftBase + 1;
                  
                  // Use centralized delta calculator for consistency
                  let delta: number;
                  if (fieldId === 'soundFile') {
                    // Use sound delta calculator
                    const soundDeltaInput: DeltaCalculationInput = {
                      logSheetData: data
                    };
                    delta = calculateSoundDeltaForShifting(soundDeltaInput);
                  } else if (fieldId.startsWith('cameraFile')) {
                    // Use camera delta calculator
                    const cameraDeltaInput: DeltaCalculationInput = {
                      logSheetData: data
                    };
                    delta = calculateCameraDeltaForShifting(cameraDeltaInput, fieldId);
                  } else {
                    // Fallback to manual calculation
                    delta = currentFieldVal.isRange 
                      ? (currentFieldVal.upper - currentFieldVal.lower)  // Range: difference between upper and lower
                      : 1;  // Single value: delta is 1 (one file number has span of 1)
                  }
                  
                  let newUpper = newLower + delta;
                  
                  // Check if value is already correctly shifted (target duplicate case)
                  // This happens when the target duplicate was already shifted by duplicate insertion logic
                  // We still need to update temp variables to its current upper bound so subsequent takes are correct
                  // For single values, we only compare newLower with currentLower (single values have no range)
                  // For ranges, we compare both lower and upper bounds
                  const isAlreadyCorrectlyShifted = currentFieldVal.isRange
                    ? (newLower === currentFieldVal.lower && newUpper === currentFieldVal.upper)
                    : (newLower === currentFieldVal.lower);  // Single value: only compare lower bound
                  if (isAlreadyCorrectlyShifted) {
                    logger.logDebug(`Take ${takeNum} ${fieldId} is already correctly shifted (${currentFieldVal.lower}/${currentFieldVal.upper}) - will update temp variables to current upper bound`);
                    // For temp variables, use currentFieldVal.upper (the already-shifted value)
                    // This ensures subsequent takes shift from the correct base
                  }
                  
                  const tempValue = fieldId === 'soundFile' 
                    ? tempSound 
                    : (fieldId.startsWith('cameraFile') 
                      ? tempCamera[fieldId === 'cameraFile' ? 1 : (parseInt(fieldId.replace('cameraFile', ''), 10) || 1)] 
                      : null);
                  
                  logger.logCalculation(
                    'Sequential File Number Shift',
                    `Shifting ${fieldId} for take ${takeNum}`,
                    { 
                      tempValue: tempValue !== null && tempValue !== undefined ? tempValue : 'N/A',
                      currentLower: currentFieldVal.lower,
                      currentUpper: currentFieldVal.upper,
                      fromNumber,
                      takeNum,
                      shiftBase
                    },
                    tempValue !== null && tempValue !== undefined && takeNum > fromNumber 
                      ? `newLower = tempValue(${tempValue}) + 1 = ${newLower}, newUpper = ${newLower} + ${delta} = ${newUpper}`
                      : `newLower = shiftBase(${shiftBase}) + 1 = ${newLower}, newUpper = ${newLower} + ${delta} = ${newUpper}`,
                    { newLower, newUpper }
                  );

                  if (fieldId === 'soundFile') {
                    // Use centralized sound delta calculator for consistency
                    let soundDeltaForShift: number;
                    
                    // Calculate delta using centralized calculator
                    const soundDeltaInput: DeltaCalculationInput = {
                      logSheetData: data
                    };
                    soundDeltaForShift = calculateSoundDeltaForShifting(soundDeltaInput);
                    
                    // ALWAYS use tempSound when available (including target duplicate)
                    // This ensures consistent sequential shifting and temp variable updates
                    // tempSound tracks the previous take's upper bound (inserted log or previous shifted take)
                    const soundShiftBase = (tempSound !== null) ? tempSound : shiftBase;
                    
                    logger.logCalculation(
                      'Sound File Shift Base Selection',
                      `Selecting shift base for sound file shifting (take ${takeNum})`,
                      {
                        tempSound,
                        shiftBase,
                        takeNum,
                        fromNumber,
                        usingTemp: tempSound !== null,
                        currentLower: currentFieldVal.lower,
                        currentUpper: currentFieldVal.upper,
                        currentDelta: soundDeltaForShift
                      },
                      tempSound !== null
                        ? `Sequential shift: Using tempSound = ${tempSound} (from inserted log or previous take)`
                        : `Using shiftBase = ${shiftBase} (tempSound=${tempSound})`,
                      { selectedBase: soundShiftBase }
                    );
                    
                    // Calculate new bounds: newLower = tempSound + 1, newUpper = newLower + delta
                    const soundNewLower = soundShiftBase + 1;
                    const soundNewUpper = soundNewLower + soundDeltaForShift;
                    
                    logger.logCalculation(
                      'Sound File Shift Calculation',
                      `Calculate new sound file bounds for take ${takeNum}`,
                      {
                        tempSound: tempSound !== null ? tempSound : 'N/A',
                        shiftBase: soundShiftBase,
                        delta: soundDeltaForShift,
                        currentLower: currentFieldVal.lower,
                        currentUpper: currentFieldVal.upper
                      },
                      `newLower = tempSound(${tempSound !== null ? tempSound : shiftBase}) + 1 = ${soundNewLower}, newUpper = ${soundNewLower} + ${soundDeltaForShift} = ${soundNewUpper}`,
                      { newLower: soundNewLower, newUpper: soundNewUpper }
                    );
                    
                    if (currentFieldVal.isRange) {
                      newData['sound_from'] = String(soundNewLower).padStart(4, '0');
                      newData['sound_to'] = String(soundNewUpper).padStart(4, '0');
                      if (typeof data.soundFile === 'string' && data.soundFile.includes('-')) {
                        newData.soundFile = `${String(soundNewLower).padStart(4, '0')}-${String(soundNewUpper).padStart(4, '0')}`;
                      }
                    } else {
                      newData.soundFile = String(soundNewLower).padStart(4, '0');
                      delete newData['sound_from'];
                      delete newData['sound_to'];
                    }
                    // ALWAYS update tempSound with the correct upper bound
                    // For single values: soundNewUpper should equal soundNewLower (single file number)
                    // For ranges: soundNewUpper = soundNewLower + delta (range of file numbers)
                    // This ensures subsequent takes use the correct base value
                    // If the value is already correct (target duplicate already shifted), soundNewUpper will match currentUpper
                    // but we still update tempSound to maintain consistency
                    const previousTempSound = tempSound;
                    // For single values, we only compare soundNewLower with currentLower (single values have no range)
                    // For ranges, we compare both lower and upper bounds
                    const soundIsAlreadyCorrectlyShifted = currentFieldVal.isRange
                      ? (soundNewLower === currentFieldVal.lower && soundNewUpper === currentFieldVal.upper)
                      : (soundNewLower === currentFieldVal.lower);  // Single value: only compare lower bound
                    // For single values, the upper bound is the same as the lower bound (it's a single file, not a range)
                    // So tempSound should be set to soundNewLower, not soundNewUpper (which would be soundNewLower + 1)
                    const finalUpperForTempSound = currentFieldVal.isRange ? soundNewUpper : soundNewLower;
                    tempSound = finalUpperForTempSound;
                    logger.logDebug(`Updated tempSound from ${previousTempSound} to ${tempSound} after processing take ${takeNum} (sound: ${currentFieldVal.lower}/${currentFieldVal.upper} -> ${soundNewLower}/${soundNewUpper})`);
                    logger.logDebug(`tempSound is now ${tempSound} - next take will use this value + 1 for its lower bound`);
                    // Only mark as updated if data actually changed
                    if (soundIsAlreadyCorrectlyShifted) {
                      // Data didn't change but temp variable was updated - this is expected for target duplicate
                      logger.logDebug(`Take ${takeNum} ${fieldId} data unchanged but tempSound updated to ${tempSound} (target duplicate already shifted)`);
                    } else {
                      updated = true;
                    }
                  } else if (fieldId.startsWith('cameraFile')) {
                    const cameraNum = fieldId === 'cameraFile' ? 1 : (parseInt(fieldId.replace('cameraFile', ''), 10) || 1);
                    
                    // ALWAYS use tempCamera when available (including target duplicate)
                    // This ensures consistent sequential shifting and temp variable updates
                    // tempCamera tracks the previous take's upper bound (inserted log or previous shifted take)
                    // If tempCamera is available, ALWAYS use it: newLower = tempCamera + 1, newUpper = newLower + delta
                    // This way, temp variables are always updated through the same logic path
                    
                    if (tempCamera[cameraNum] !== null && tempCamera[cameraNum] !== undefined) {
                      // ALWAYS use tempCamera when available - this includes target duplicate
                      // Calculate what it should be based on tempCamera
                      newLower = tempCamera[cameraNum]! + 1;
                      newUpper = newLower + delta;
                      
                      logger.logCalculation(
                        'Camera File Sequential Shift',
                        `Using tempCamera[${cameraNum}] for sequential shifting (take ${takeNum})`,
                        {
                          tempCameraValue: tempCamera[cameraNum],
                          delta,
                          currentLower: currentFieldVal.lower,
                          currentUpper: currentFieldVal.upper,
                          fromNumber,
                          takeNum
                        },
                        `Sequential shift: newLower = tempCamera[${cameraNum}](${tempCamera[cameraNum]}) + 1 = ${newLower}, newUpper = ${newLower} + ${delta} = ${newUpper}`,
                        { newLower, newUpper }
                      );
                    } else {
                      // tempCamera not available - this shouldn't happen for sequential shifting
                      // But fallback to shiftBase if needed
                      logger.logWarning(`tempCamera[${cameraNum}] not available for take ${takeNum} - using shiftBase as fallback`);
                      // newLower and newUpper are already calculated from shiftBase above
                    }
                    
                    if (currentFieldVal.isRange) {
                      newData[`camera${cameraNum}_from`] = String(newLower).padStart(4, '0');
                      newData[`camera${cameraNum}_to`] = String(newUpper).padStart(4, '0');
                      if (typeof data[fieldId] === 'string' && data[fieldId].includes('-')) {
                        newData[fieldId] = `${String(newLower).padStart(4, '0')}-${String(newUpper).padStart(4, '0')}`;
                      }
                    } else {
                      newData[fieldId] = String(newLower).padStart(4, '0');
                      delete newData[`camera${cameraNum}_from`];
                      delete newData[`camera${cameraNum}_to`];
                    }
                    // ALWAYS update tempCamera with the correct upper bound
                    // For single values: newUpper should equal newLower (single file number)
                    // For ranges: newUpper = newLower + delta (range of file numbers)
                    // This ensures subsequent takes use the correct base value
                    // If the value is already correct (target duplicate already shifted), newUpper will match currentUpper
                    // but we still update tempCamera to maintain consistency
                    const previousTempCamera = tempCamera[cameraNum];
                    // For single values, the upper bound is the same as the lower bound (it's a single file, not a range)
                    // So tempCamera should be set to newLower, not newUpper (which would be newLower + 1)
                    const finalUpperForTemp = currentFieldVal.isRange ? newUpper : newLower;
                    tempCamera[cameraNum] = finalUpperForTemp;
                    logger.logDebug(`Updated tempCamera[${cameraNum}] from ${previousTempCamera} to ${tempCamera[cameraNum]} after processing take ${takeNum} (camera: ${currentFieldVal.lower}/${currentFieldVal.upper} -> ${newLower}/${newUpper})`);
                    logger.logDebug(`tempCamera[${cameraNum}] is now ${tempCamera[cameraNum]} - next take will use this value + 1 for its lower bound`);
                    // Only mark as updated if data actually changed
                    if (isAlreadyCorrectlyShifted) {
                      // Data didn't change but temp variable was updated - this is expected for target duplicate
                      logger.logDebug(`Take ${takeNum} ${fieldId} data unchanged but tempCamera[${cameraNum}] updated to ${tempCamera[cameraNum]} (target duplicate already shifted)`);
                    } else {
                      updated = true;
                    }
                  }
                } else if (currentFieldVal.upper < fromNumber) {
                  // Field exists but doesn't need shifting (take is before insertion point)
                  // Don't update temp variables - they should already be initialized from the inserted log
                  // Takes before insertion are not being shifted, so we don't need to track their values
                  logger.logDebug(`Take ${takeNum} is before insertion - skipping (temp variables initialized from inserted log)`);
                }
              } else {
                // Field is blank/waste
                if (takeNum > fromNumber) {
                  // Take comes after insertion point, but field is blank
                  // Blank fields stay blank - don't update them
                  // But we need to ensure temp variables are set correctly for next calculation
                  
                  if (fieldId === 'soundFile') {
                    // Sound is blank - tempSound stays as it is (from previous record)
                    // If tempSound is null, find previous valid sound file
                    if (tempSound === null) {
                      const soundHandlerContext: SoundHandlerContext = {
                        projectId,
                        projectLogSheets: state.logSheets.filter(s => s.projectId === projectId),
                        sceneNumber: sceneNum,
                        shotNumber: shotNum,
                        takeNumber: takeNum
                      };
                      
                      const previousSoundUpper = getSoundFileValueForSubsequentShift(
                        soundHandlerContext,
                        takeNum - 1 // Previous take number
                      );
                      
                      if (previousSoundUpper !== null) {
                        tempSound = previousSoundUpper;
                        logger.logCalculation(
                          'Sound File Blank - Setting tempSound from Previous Valid',
                          `Take ${takeNum} has blank sound file, setting tempSound from previous valid upper bound`,
                          {
                            takeNumber: takeNum,
                            previousTakeNumber: takeNum - 1,
                            previousSoundUpper,
                            tempSound
                          },
                          `tempSound = ${tempSound} (stays same for next calculation)`,
                          tempSound
                        );
                      } else {
                        logger.logWarning(`Take ${takeNum} has blank sound file and no previous valid sound file found - tempSound remains null`);
                      }
                    } else {
                      // tempSound already set - keep it for next calculation (add 0 = stays same)
                      logger.logCalculation(
                        'Sound File Blank - Keeping tempSound',
                        `Take ${takeNum} has blank sound file, tempSound stays unchanged`,
                        {
                          takeNumber: takeNum,
                          tempSound
                        },
                        `tempSound remains ${tempSound} (blank field adds 0, so temp variable stays same)`,
                        tempSound
                      );
                    }
                  } else if (fieldId.startsWith('cameraFile')) {
                    const cameraNum = fieldId === 'cameraFile' ? 1 : (parseInt(fieldId.replace('cameraFile', ''), 10) || 1);
                    // Camera is blank - tempCamera stays as it is (from previous record)
                    // If tempCamera is null, find previous valid camera file
                    if (tempCamera[cameraNum] === null || tempCamera[cameraNum] === undefined) {
                      const excludeIds = new Set<string>([logSheet.id]);
                      if (excludeLogId) excludeIds.add(excludeLogId);
                      const prevValid = getPreviousValidValue(state.logSheets, takeNum, sceneNum, shotNum, fieldId, excludeIds);
                      
                      if (prevValid !== null) {
                        tempCamera[cameraNum] = prevValid;
                        logger.logDebug(`Take ${takeNum} has blank ${fieldId} - tempCamera[${cameraNum}] set to ${prevValid} from previous valid value`);
                      } else {
                        logger.logWarning(`Take ${takeNum} has blank ${fieldId} and no previous valid value found - tempCamera[${cameraNum}] remains null`);
                      }
                    } else {
                      // tempCamera already set - keep it for next calculation (add 0 = stays same)
                      logger.logCalculation(
                        'Camera File Blank - Keeping tempCamera',
                        `Take ${takeNum} has blank ${fieldId}, tempCamera[${cameraNum}] stays unchanged`,
                        {
                          takeNumber: takeNum,
                          fieldId,
                          tempCameraValue: tempCamera[cameraNum]
                        },
                        `tempCamera[${cameraNum}] remains ${tempCamera[cameraNum]} (blank field adds 0, so temp variable stays same)`,
                        tempCamera[cameraNum]
                      );
                    }
                  }
                  // Blank fields stay blank - don't update them
                } else if (currentFieldVal === null && takeNum < fromNumber) {
                  // Field is blank and take is before insertion point
                  // Don't update temp variables - they should already be initialized from the inserted log
                  // Takes before insertion are not being shifted, so we don't need to track their values
                  logger.logDebug(`Take ${takeNum} is before insertion and field is blank - skipping (temp variables initialized from inserted log)`);
                }
              }

              if (updated) {
                logger.logSave('updateFileNumbers', logSheet.id, newData, data);
                updatedSheetsMap.set(logSheet.id, { ...logSheet, data: newData, updatedAt: new Date().toISOString() });
              } else {
                updatedSheetsMap.set(logSheet.id, logSheet);
              }
            });
          });

          // Convert map back to array, preserving non-project sheets
          const updatedSheets = state.logSheets.map(logSheet => {
            if (logSheet.projectId !== projectId) return logSheet;
            return updatedSheetsMap.get(logSheet.id) || logSheet;
          });

          logger.logFunctionExit({ shiftedCount: updatedSheets.filter((s, i) => s !== state.logSheets[i]).length });
          return { logSheets: updatedSheets };
        });
      },
    }),
    {
      name: 'film-log-storage',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);