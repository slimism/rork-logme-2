import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Project, Folder, LogSheet, ProjectSettings } from '@/types';
import { useTokenStore } from './subscriptionStore';
import { normalizeProjectSettings } from '@/components/CameraHandlers/cameraConfigValidator';
import { logger } from '@/components/CameraHandlers/logger';
import { getSoundFileValueForSubsequentShift, getSoundFileInfo, calculateSoundFileDelta, SoundHandlerContext } from '@/components/CameraHandlers/SoundHandler';
import { calculateSoundDeltaForShifting, DeltaCalculationInput } from '@/components/CameraHandlers/deltaCalculator';

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
          let skippedTarget = false;
          
          // Process each scene/shot group sequentially
          sheetsBySceneShot.forEach((sheets, sceneShotKey) => {
            const [sceneNum, shotNum] = sceneShotKey.split(':');
            
            // Separate temp variables for tracking upper bounds used in calculations
            // These persist across blank fields to ensure correct sequential shifting
            let tempSound: number | null = null; // Upper bound of sound file for next calculation
            let tempCamera: { [cameraNum: number]: number | null } = {}; // Upper bounds for each camera
            
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
              const isTarget = currentFieldVal && (
                currentFieldVal.lower === fromNumber || 
                currentFieldVal.upper === fromNumber ||
                (currentFieldVal.lower <= fromNumber && currentFieldVal.upper >= fromNumber)
              );

              if (isTarget && !skippedTarget) {
                skippedTarget = true;
                logger.logDebug(`Skipping target log`, { logSheetId: logSheet.id, fieldValue: currentFieldVal });
                // Track this as the last valid value (it's the inserted log's value)
                // Update temp variables based on the inserted log
                if (currentFieldVal && currentFieldVal.value !== null) {
                  if (fieldId === 'soundFile') {
                    tempSound = currentFieldVal.upper;
                    logger.logDebug(`Target log - tempSound set to ${tempSound}`, { logSheetId: logSheet.id });
                  } else if (fieldId.startsWith('cameraFile')) {
                    const cameraNum = fieldId === 'cameraFile' ? 1 : (parseInt(fieldId.replace('cameraFile', ''), 10) || 1);
                    tempCamera[cameraNum] = currentFieldVal.upper;
                    logger.logDebug(`Target log - tempCamera[${cameraNum}] set to ${tempCamera[cameraNum]}`, { logSheetId: logSheet.id });
                  }
                }
                updatedSheetsMap.set(logSheet.id, logSheet);
                return;
              }

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
                  
                  // For ALL takes that need shifting (including target duplicate), we need to determine shiftBase
                  // The key insight: temp variables track the LAST UPPER BOUND that was used/shifted
                  // - For the first take after insertion (target duplicate), it might have been shifted already
                  //   by duplicate insertion logic, so we should use its current value as the base
                  // - For subsequent takes, we use temp variables which track the previous take's upper bound
                  
                  if (fieldId === 'soundFile') {
                    if (tempSound !== null && takeNum > fromNumber) {
                      // Sequential shifting - use temp variable from previous take
                      shiftBase = tempSound;
                      logger.logDebug(`Sequential shift: Using tempSound (${tempSound}) for take ${takeNum}`);
                    } else {
                      // Target duplicate or tempSound not available - use currentFieldVal
                      shiftBase = currentFieldVal.lower >= fromNumber ? currentFieldVal.lower : currentFieldVal.upper;
                      logger.logDebug(`Target duplicate/Initial shift: Using currentFieldVal (${shiftBase}) for take ${takeNum} soundFile`);
                    }
                  } else if (fieldId.startsWith('cameraFile')) {
                    const cameraNum = fieldId === 'cameraFile' ? 1 : (parseInt(fieldId.replace('cameraFile', ''), 10) || 1);
                    if (tempCamera[cameraNum] !== null && tempCamera[cameraNum] !== undefined && takeNum > fromNumber) {
                      // Sequential shifting - use temp variable from previous take
                      shiftBase = tempCamera[cameraNum]!;
                      logger.logDebug(`Sequential shift: Using tempCamera[${cameraNum}] (${shiftBase}) for take ${takeNum}`);
                    } else {
                      // Target duplicate or tempCamera not available
                      // If target duplicate was already shifted by duplicate insertion logic, use its current value
                      // Otherwise, use currentFieldVal which should be >= fromNumber
                      shiftBase = currentFieldVal.lower >= fromNumber ? currentFieldVal.lower : currentFieldVal.upper;
                      logger.logDebug(`Target duplicate/Initial shift: Using currentFieldVal (${shiftBase}) for take ${takeNum} cameraFile`);
                      // IMPORTANT: If this is the target duplicate that was already shifted, we should update tempCamera
                      // to its current upper bound without shifting it again. But if it needs shifting, we'll shift it.
                    }
                  } else {
                    shiftBase = currentFieldVal.lower >= fromNumber ? currentFieldVal.lower : currentFieldVal.upper;
                  }
                  
                  // Calculate new bounds: newLower = shiftBase + 1, newUpper = newLower + delta
                  // If the target duplicate was already shifted correctly, newLower/newUpper might match currentFieldVal
                  // In that case, we still need to update temp variables but don't need to change the data
                  let newLower = shiftBase + 1;
                  const delta = currentFieldVal.isRange ? (currentFieldVal.upper - currentFieldVal.lower) : 0;
                  let newUpper = newLower + delta;
                  
                  // Check if value is already correctly shifted (target duplicate case)
                  // This happens when the target duplicate was already shifted by duplicate insertion logic
                  // We still need to update temp variables to its current upper bound so subsequent takes are correct
                  const isAlreadyCorrectlyShifted = (newLower === currentFieldVal.lower && newUpper === currentFieldVal.upper);
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
                    
                    // For sequential shifting (takeNum > fromNumber), ALWAYS use tempSound
                    // tempSound is automatically assigned from the inserted log's upper bounds
                    // For target duplicate itself (takeNum === fromNumber), use shiftBase (already calculated above)
                    const soundShiftBase = (takeNum > fromNumber && tempSound !== null) ? tempSound : shiftBase;
                    
                    logger.logCalculation(
                      'Sound File Shift Base Selection',
                      `Selecting shift base for sound file shifting (take ${takeNum})`,
                      {
                        tempSound,
                        shiftBase,
                        takeNum,
                        fromNumber,
                        usingTemp: (tempSound !== null && takeNum > fromNumber),
                        currentLower: currentFieldVal.lower,
                        currentUpper: currentFieldVal.upper,
                        currentDelta: soundDeltaForShift
                      },
                      (tempSound !== null && takeNum > fromNumber)
                        ? `Sequential shift: Using tempSound = ${tempSound} (from inserted log or previous take)`
                        : `Using shiftBase = ${shiftBase} (tempSound=${tempSound}, takeNum=${takeNum} <= fromNumber=${fromNumber})`,
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
                    // ALWAYS update tempSound with the upper bound for next calculation
                    // This ensures subsequent takes use the correct base value
                    // CRITICAL: This update must happen IMMEDIATELY after processing each take
                    // - If already correctly shifted: use currentFieldVal.upper (target duplicate case)
                    // - If was shifted: use soundNewUpper
                    // - For blank fields: tempSound persists (handled in blank field section)
                    const previousTempSound = tempSound;
                    const soundIsAlreadyCorrectlyShifted = (soundNewLower === currentFieldVal.lower && soundNewUpper === currentFieldVal.upper);
                    const finalUpperForTemp = soundIsAlreadyCorrectlyShifted
                      ? currentFieldVal.upper  // Already correct, use current upper bound
                      : soundNewUpper;  // Was shifted, use new upper bound
                    tempSound = finalUpperForTemp;
                    logger.logDebug(`Updated tempSound from ${previousTempSound} to ${tempSound} after processing take ${takeNum} (sound: ${currentFieldVal.lower}/${currentFieldVal.upper} -> ${soundNewLower}/${soundNewUpper}, finalUpperForTemp=${finalUpperForTemp})`);
                    logger.logDebug(`tempSound is now ${tempSound} - next take will use this value + 1 for its lower bound`);
                    // Only mark as updated if data actually changed
                    if (!soundIsAlreadyCorrectlyShifted) {
                      updated = true;
                    } else {
                      // Data didn't change but temp variable was updated - this is expected for target duplicate
                      logger.logDebug(`Take ${takeNum} ${fieldId} data unchanged but tempSound updated to ${tempSound} (target duplicate already shifted)`);
                    }
                  } else if (fieldId.startsWith('cameraFile')) {
                    const cameraNum = fieldId === 'cameraFile' ? 1 : (parseInt(fieldId.replace('cameraFile', ''), 10) || 1);
                    
                    // For ALL takes that need shifting, use tempCamera if available for sequential shifting
                    // The key: tempCamera tracks the previous take's upper bound
                    // - If tempCamera is available and takeNum > fromNumber, use it (sequential)
                    // - Otherwise, use shiftBase (which uses currentFieldVal for target duplicate)
                    // After shifting, ALWAYS update tempCamera to newUpper for next take
                    
                    if (takeNum > fromNumber && tempCamera[cameraNum] !== null && tempCamera[cameraNum] !== undefined) {
                      // Sequential shifting - use tempCamera from previous take
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
                      // Target duplicate or tempCamera not available - use shiftBase (already calculated above)
                      // newLower and newUpper are already calculated from shiftBase
                      logger.logDebug(`Using shiftBase (${shiftBase}) for take ${takeNum} cameraFile - tempCamera[${cameraNum}]=${tempCamera[cameraNum]}, takeNum=${takeNum}, fromNumber=${fromNumber}`);
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
                    // ALWAYS update tempCamera with the upper bound for next calculation
                    // This ensures subsequent takes use the correct base value
                    // CRITICAL: This update must happen IMMEDIATELY after processing each take
                    // - If already correctly shifted: use currentFieldVal.upper (target duplicate case)
                    // - If was shifted: use newUpper
                    // - For blank fields: tempCamera persists (handled in blank field section)
                    const previousTempCamera = tempCamera[cameraNum];
                    const finalUpperForTemp = isAlreadyCorrectlyShifted 
                      ? currentFieldVal.upper  // Already correct, use current upper bound
                      : newUpper;  // Was shifted, use new upper bound
                    tempCamera[cameraNum] = finalUpperForTemp;
                    logger.logDebug(`Updated tempCamera[${cameraNum}] from ${previousTempCamera} to ${tempCamera[cameraNum]} after processing take ${takeNum} (camera: ${currentFieldVal.lower}/${currentFieldVal.upper} -> ${newLower}/${newUpper}, finalUpperForTemp=${finalUpperForTemp})`);
                    logger.logDebug(`tempCamera[${cameraNum}] is now ${tempCamera[cameraNum]} - next take will use this value + 1 for its lower bound`);
                    // Only mark as updated if data actually changed
                    if (!isAlreadyCorrectlyShifted) {
                      updated = true;
                    } else {
                      // Data didn't change but temp variable was updated - this is expected for target duplicate
                      logger.logDebug(`Take ${takeNum} ${fieldId} data unchanged but tempCamera[${cameraNum}] updated to ${tempCamera[cameraNum]} (target duplicate already shifted)`);
                    }
                  }
                } else if (currentFieldVal.upper < fromNumber) {
                  // Field exists but doesn't need shifting (take is before insertion point)
                  // Update temp variable to track the upper bound for calculations after insertion
                  if (fieldId === 'soundFile') {
                    tempSound = currentFieldVal.upper;
                    logger.logDebug(`Take ${takeNum} is before insertion - tempSound set to ${tempSound} for future calculations`);
                  } else if (fieldId.startsWith('cameraFile')) {
                    const cameraNum = fieldId === 'cameraFile' ? 1 : (parseInt(fieldId.replace('cameraFile', ''), 10) || 1);
                    tempCamera[cameraNum] = currentFieldVal.upper;
                    logger.logDebug(`Take ${takeNum} is before insertion - tempCamera[${cameraNum}] set to ${tempCamera[cameraNum]} for future calculations`);
                  }
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
                  // Track last valid value for takes before insertion point
                  // Update temp variables to prepare for shifting after insertion
                  if (fieldId === 'soundFile') {
                    const soundInfo = getSoundFileInfo(data);
                    if (soundInfo && soundInfo.value !== null) {
                      tempSound = soundInfo.upper;
                      logger.logDebug(`Tracking sound file upper bound for take ${takeNum} (before insertion): tempSound = ${tempSound}`);
                    }
                  } else if (fieldId.startsWith('cameraFile')) {
                    const cameraNum = fieldId === 'cameraFile' ? 1 : (parseInt(fieldId.replace('cameraFile', ''), 10) || 1);
                    const cameraVal = getFieldValue(data, fieldId);
                    if (cameraVal && cameraVal.value !== null) {
                      tempCamera[cameraNum] = cameraVal.upper;
                      logger.logDebug(`Tracking camera file upper bound for take ${takeNum} (before insertion): tempCamera[${cameraNum}] = ${tempCamera[cameraNum]}`);
                    }
                  }
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