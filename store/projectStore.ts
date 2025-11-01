import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Project, Folder, LogSheet, ProjectSettings } from '@/types';
import { useTokenStore } from './subscriptionStore';

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
  updateFileNumbers: (projectId: string, fieldId: string, fromNumber: number, increment: number, excludeLogId?: string | string[]) => void;
}

export const useProjectStore = create<ProjectState>()(
  persist(
    (set, get) => ({
      projects: [],
      folders: [],
      logSheets: [],
      
      addProject: (name: string, settings?: ProjectSettings, logoUri?: string) => {
        const newProject: Project = {
          id: Date.now().toString(),
          name,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          settings,
          logoUri,
        };
        
        const state = get();
        const tokenStore = useTokenStore.getState();
        
        // First project and no tokens = trial project
        if (state.projects.length === 0 && tokenStore.trialProjectId === null && tokenStore.tokens === 0) {
          useTokenStore.setState({ trialProjectId: newProject.id });
          console.log('[addProject] Created trial project:', newProject.id);
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
            console.log('[addProject] Project unlocked with token:', newProject.id, 'Unlocked projects:', updatedUnlockedProjects);
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
        const state = get();
        const projectLogSheets = state.logSheets.filter(s => s.projectId === projectId);
        const maxUniqueId = projectLogSheets.reduce((max, sheet) => {
          const uid = sheet.data?.uniqueId ? parseInt(sheet.data.uniqueId, 10) : 0;
          return Math.max(max, isNaN(uid) ? 0 : uid);
        }, 0);
        
        const newLogSheet: LogSheet = {
          id: Date.now().toString(),
          name,
          type: type as any,
          folderId,
          projectId,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          data: {
            uniqueId: (maxUniqueId + 1).toString(),
          },
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
        
        // Preserve uniqueId if it already exists, or create one if missing
        const state = get();
        const existingSheet = state.logSheets.find(sheet => sheet.id === id);
        if (existingSheet) {
          if (!data.uniqueId && existingSheet.data?.uniqueId) {
            data.uniqueId = existingSheet.data.uniqueId;
          } else if (!data.uniqueId) {
            // Create uniqueId if missing (for backward compatibility)
            const projectLogSheets = state.logSheets.filter(s => s.projectId === existingSheet.projectId);
            const maxUniqueId = projectLogSheets.reduce((max, sheet) => {
              const uid = sheet.data?.uniqueId ? parseInt(sheet.data.uniqueId, 10) : 0;
              return Math.max(max, isNaN(uid) ? 0 : uid);
            }, 0);
            data.uniqueId = (maxUniqueId + 1).toString();
          }
          
          // Calculate and store delta for camera and sound files
          // Sound file delta
          if (data.sound_from && data.sound_to) {
            const from = parseInt(data.sound_from, 10) || 0;
            const to = parseInt(data.sound_to, 10) || 0;
            data.sound_delta = Math.abs(to - from) + 1;
          } else {
            data.sound_delta = 1;
          }
          
          // Camera file delta - need to get camera configuration from project
          const project = state.projects.find(p => p.id === existingSheet.projectId);
          const cameraConfiguration = project?.settings?.cameraConfiguration || 1;
          
          if (cameraConfiguration === 1) {
            if (data.camera1_from && data.camera1_to) {
              const from = parseInt(data.camera1_from, 10) || 0;
              const to = parseInt(data.camera1_to, 10) || 0;
              data.camera_delta = Math.abs(to - from) + 1;
            } else {
              data.camera_delta = 1;
            }
          } else {
            // Multi-camera: calculate delta for each camera
            for (let i = 1; i <= cameraConfiguration; i++) {
              const fromKey = `camera${i}_from`;
              const toKey = `camera${i}_to`;
              if (data[fromKey] && data[toKey]) {
                const from = parseInt(data[fromKey], 10) || 0;
                const to = parseInt(data[toKey], 10) || 0;
                data[`camera${i}_delta`] = Math.abs(to - from) + 1;
              } else {
                data[`camera${i}_delta`] = 1;
              }
            }
          }
        }
        
        console.log('=== STORE updateLogSheet called ===');
        console.log('  id:', id);
        console.log('  data.camera1_from:', data.camera1_from);
        console.log('  data.camera1_to:', data.camera1_to);
        console.log('  data.cameraFile:', data.cameraFile);
        console.log('  data.classification:', data.classification);
        console.log('  data.uniqueId:', data.uniqueId);
        console.log('  data.sound_delta:', data.sound_delta);
        console.log('  data.camera_delta:', data.camera_delta);
        
        set((state) => ({
          logSheets: state.logSheets.map((logSheet) => 
            logSheet.id === id 
              ? { ...logSheet, data, updatedAt: new Date().toISOString() } 
              : logSheet
          ),
        }));
        
        const updated = get().logSheets.find(sheet => sheet.id === id);
        console.log('=== After store update ===');
        console.log('  Updated data.camera1_from:', updated?.data?.camera1_from);
        console.log('  Updated data.camera1_to:', updated?.data?.camera1_to);
        console.log('  Updated data.cameraFile:', updated?.data?.cameraFile);
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
        console.log('=== updateTakeNumbers called ===', {
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
                console.log(`  -> Explicitly skipping excluded log: ${logSheet.id} (take ${logSheet.data?.takeNumber})`);
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

      updateFileNumbers: (projectId: string, fieldId: string, fromNumber: number, increment: number, excludeLogId?: string | string[]) => {
        // Convert excludeLogId to array if it's a single string
        const excludeIds = Array.isArray(excludeLogId) ? excludeLogId : (excludeLogId ? [excludeLogId] : []);
        
        console.log('=== updateFileNumbers called ===', {
          projectId,
          fieldId,
          fromNumber,
          increment,
          excludeLogId,
          excludeIds
        });
        
        set((state) => ({
          logSheets: (() => {
            const isTargetInRange = (start: number, end: number) => fromNumber >= Math.min(start, end) && fromNumber <= Math.max(start, end);
            
            // Helper to get file range bounds
            const getFileBounds = (sheet: LogSheet, fid: string): { lower: number; upper: number; delta: number } | null => {
              const data = sheet.data;
              if (!data) return null;
              
              if (fid === 'soundFile') {
                console.log(`[SOUND getFileBounds] Processing sheet ${sheet.id}, uniqueId: ${sheet.data?.uniqueId}, take: ${sheet.data?.takeNumber}`);
                // Check single value first (soundFile takes precedence)
                const raw = data[fid] as unknown;
                if (typeof raw === 'string' && raw.length > 0 && !raw.includes('-')) {
                  const num = parseInt(raw, 10);
                  if (!isNaN(num)) {
                    console.log(`[SOUND getFileBounds] Found single soundFile: ${raw} → ${num}, delta: 1`);
                    return { lower: num, upper: num, delta: 1 };
                  }
                }
                // Check range second
                const soundFrom = data['sound_from'];
                const soundTo = data['sound_to'];
                if (typeof soundFrom === 'string' && typeof soundTo === 'string') {
                  const lower = parseInt(soundFrom, 10);
                  const upper = parseInt(soundTo, 10);
                  if (!isNaN(lower) && !isNaN(upper)) {
                    const delta = upper - lower + 1;
                    console.log(`[SOUND getFileBounds] Found range sound_from/to: ${soundFrom}-${soundTo} → ${lower}-${upper}, delta: ${delta}`);
                    return { lower, upper, delta };
                  }
                }
                console.log(`[SOUND getFileBounds] No sound file data found for sheet ${sheet.id}`);
              } else if (fid.startsWith('cameraFile')) {
                const cameraNum = fid === 'cameraFile' ? 1 : (parseInt(fid.replace('cameraFile', ''), 10) || 1);
                const cameraFrom = data[`camera${cameraNum}_from`];
                const cameraTo = data[`camera${cameraNum}_to`];
                if (typeof cameraFrom === 'string' && typeof cameraTo === 'string') {
                  const lower = parseInt(cameraFrom, 10);
                  const upper = parseInt(cameraTo, 10);
                  if (!isNaN(lower) && !isNaN(upper)) {
                    return { lower, upper, delta: upper - lower + 1 };
                  }
                }
                const raw = data[fid] as unknown;
                if (typeof raw === 'string' && raw.length > 0 && !raw.includes('-')) {
                  const num = parseInt(raw, 10);
                  if (!isNaN(num)) return { lower: num, upper: num, delta: 1 };
                }
              }
              return null;
            };
            
            // Sort sheets by uniqueId to ensure correct cascade order
            const projectSheets = state.logSheets
              .filter(s => s.projectId === projectId)
              .sort((a, b) => {
                const uidA = parseInt(a.data?.uniqueId || '0', 10) || 0;
                const uidB = parseInt(b.data?.uniqueId || '0', 10) || 0;
                return uidA - uidB;
              });
            
            // Track cascade state
            let insertedLogUpperBound: number | null = null;
            const updatedSheets = new Map<string, LogSheet>();
            
            console.log('[updateFileNumbers] Starting cascade shift from', fromNumber, 'with increment', increment);
            
            // If we have excluded logs, the first one is the one that was just inserted/edited
            // The inserted log's upper bound is fromNumber + increment - 1
            if (excludeIds.length > 0) {
              insertedLogUpperBound = fromNumber + increment - 1;
              console.log(`  -> Excluded logs ${excludeIds.join(', ')} (first is the inserted log), upper bound: ${insertedLogUpperBound} (fromNumber: ${fromNumber}, increment: ${increment})`);
            }
            
            // Group sheets that need shifting (all sheets with lower >= fromNumber, excluding inserted log)
            const sheetsToShift: Array<{ sheet: LogSheet; bounds: { lower: number; upper: number; delta: number } }> = [];
            
            for (const sheet of projectSheets) {
              // Skip excluded logs
              if (excludeIds.includes(sheet.id)) {
                console.log(`  -> Skipping excluded log: ${sheet.id} (take ${sheet.data?.takeNumber})`);
                updatedSheets.set(sheet.id, sheet);
                continue;
              }
              
              const bounds = getFileBounds(sheet, fieldId);
              if (!bounds) {
                if (fieldId === 'soundFile') {
                  console.log(`[SOUND] Skipping sheet ${sheet.id} (take ${sheet.data?.takeNumber}) - no bounds found`);
                }
                updatedSheets.set(sheet.id, sheet);
                continue;
              }
              
              let { lower, upper, delta } = bounds;
              
              // Use stored delta if available (more accurate), otherwise calculate it
              if (fieldId === 'soundFile' && sheet.data.sound_delta) {
                const oldDelta = delta;
                delta = parseInt(sheet.data.sound_delta, 10) || delta;
                console.log(`[SOUND delta] Sheet ${sheet.id} (take ${sheet.data?.takeNumber}): using stored sound_delta ${sheet.data.sound_delta}, delta changed from ${oldDelta} to ${delta}`);
              } else if (fieldId.startsWith('cameraFile')) {
                const cameraNum = fieldId === 'cameraFile' ? 1 : (parseInt(fieldId.replace('cameraFile', ''), 10) || 1);
                const storedDelta = sheet.data[`camera${cameraNum}_delta`];
                if (storedDelta) {
                  delta = parseInt(storedDelta, 10) || delta;
                }
              }
              
              // Only consider sheets where the lower bound is >= fromNumber
              // These are the sheets that come after the inserted log
              if (lower >= fromNumber) {
                console.log(`  -> Found sheet to shift: ${sheet.id} (uniqueId: ${sheet.data?.uniqueId}) with bounds ${lower}-${upper}, delta: ${delta}`);
                sheetsToShift.push({ sheet, bounds: { lower, upper, delta } });
              } else {
                updatedSheets.set(sheet.id, sheet);
              }
            }
            
            // Sort sheets to shift by uniqueId to ensure correct order
            sheetsToShift.sort((a, b) => {
              const uidA = parseInt(a.sheet.data?.uniqueId || '0', 10) || 0;
              const uidB = parseInt(b.sheet.data?.uniqueId || '0', 10) || 0;
              return uidA - uidB;
            });
            
            console.log(`  -> Found ${sheetsToShift.length} sheets to shift`);
            if (fieldId === 'soundFile') {
              console.log('[SOUND] Sheets to shift:', sheetsToShift.map(s => `Sheet ${s.sheet.id} (take ${s.sheet.data?.takeNumber}, uid ${s.sheet.data?.uniqueId}): bounds ${s.bounds.lower}-${s.bounds.upper}, delta ${s.bounds.delta}`).join('; '));
            }
            
            // Find the target log (the one that originally had fromNumber)
            // This should be the first in the sorted list (by uniqueId)
            let targetLogIndex = -1;
            for (let i = 0; i < sheetsToShift.length; i++) {
              const { lower, upper } = sheetsToShift[i].bounds;
              if (isTargetInRange(lower, upper)) {
                targetLogIndex = i;
                console.log(`  -> Target log (original duplicate) found at index ${i}: ${sheetsToShift[i].sheet.id}`);
                break;
              }
            }
            
            // Start shifting from the target log (if found), otherwise shift all
            const startIndex = targetLogIndex >= 0 ? targetLogIndex : 0;
            let previousUpper = insertedLogUpperBound !== null ? insertedLogUpperBound : (fromNumber - 1);
            
            console.log(`  -> Starting consecutive shifts from index ${startIndex}, previousUpper: ${previousUpper}`);
            if (fieldId === 'soundFile') {
              console.log(`[SOUND] Starting cascade: startIndex=${startIndex}, previousUpper=${previousUpper}, insertedLogUpperBound=${insertedLogUpperBound}, fromNumber=${fromNumber}, increment=${increment}`);
            }
            
            for (let i = startIndex; i < sheetsToShift.length; i++) {
              const { sheet, bounds } = sheetsToShift[i];
              const { lower, upper, delta } = bounds;
              
              // Calculate new position based on previous upper bound
              const newLower = previousUpper + 1;
              const newUpper = newLower + delta - 1;
              
              console.log(`  -> Shifting log ${sheet.id}: ${lower}-${upper} (delta=${delta}) → ${newLower}-${newUpper}`);
              console.log(`     UniqueId: ${sheet.data?.uniqueId}, Previous upper was: ${previousUpper}`);
              if (fieldId === 'soundFile') {
                console.log(`[SOUND] Shifting sheet ${sheet.id} (take ${sheet.data?.takeNumber}): previousUpper=${previousUpper} + 1 = newLower ${newLower}, newLower ${newLower} + delta ${delta} - 1 = newUpper ${newUpper}`);
              }
              
              const newData: Record<string, any> = { ...sheet.data };
              
              if (fieldId === 'soundFile') {
                // Check if the original entry had a range to determine what to update
                const hadRange = typeof sheet.data.soundFile === 'string' && sheet.data.soundFile.includes('-');
                const hadFromTo = sheet.data.sound_from && sheet.data.sound_to;
                
                console.log(`[SOUND assignment] Sheet ${sheet.id} (take ${sheet.data?.takeNumber}): hadRange=${hadRange}, hadFromTo=${!!hadFromTo}`);
                if (hadRange || hadFromTo) {
                  // Entry had a range - preserve range format
                  newData['sound_from'] = String(newLower).padStart(4, '0');
                  newData['sound_to'] = String(newUpper).padStart(4, '0');
                  if (hadRange) {
                    newData['soundFile'] = `${String(newLower).padStart(4, '0')}-${String(newUpper).padStart(4, '0')}`;
                  }
                  console.log(`[SOUND assignment] Set range: sound_from=${newData['sound_from']}, sound_to=${newData['sound_to']}, soundFile=${newData['soundFile'] || 'N/A'}`);
                } else {
                  // Entry was a single value - keep as single value
                  newData['soundFile'] = String(newLower).padStart(4, '0');
                  // Delete any stale range fields
                  delete newData['sound_from'];
                  delete newData['sound_to'];
                  console.log(`[SOUND assignment] Set single value: soundFile=${newData['soundFile']}`);
                }
              } else if (fieldId.startsWith('cameraFile')) {
                const cameraNum = fieldId === 'cameraFile' ? 1 : (parseInt(fieldId.replace('cameraFile', ''), 10) || 1);
                newData[`camera${cameraNum}_from`] = String(newLower).padStart(4, '0');
                newData[`camera${cameraNum}_to`] = String(newUpper).padStart(4, '0');
                // Update inline string if it exists
                if (typeof sheet.data[fieldId] === 'string' && sheet.data[fieldId].includes('-')) {
                  newData[fieldId] = `${String(newLower).padStart(4, '0')}-${String(newUpper).padStart(4, '0')}`;
                } else {
                  newData[fieldId] = String(newLower).padStart(4, '0');
                }
              }
              
              // Update previousUpper for the next iteration
              previousUpper = newUpper;
              updatedSheets.set(sheet.id, { ...sheet, data: newData, updatedAt: new Date().toISOString() });
              if (fieldId === 'soundFile') {
                console.log(`[SOUND] Updated previousUpper to ${previousUpper} for next iteration`);
              }
            }
            
            // Keep all other sheets that weren't shifted
            for (let i = 0; i < startIndex; i++) {
              if (i < sheetsToShift.length) {
                updatedSheets.set(sheetsToShift[i].sheet.id, sheetsToShift[i].sheet);
              }
            }
            
            // Merge back into all logSheets
            return state.logSheets.map(sheet => updatedSheets.get(sheet.id) || sheet);
          })(),
        }));
      },
    }),
    {
      name: 'film-log-storage',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);