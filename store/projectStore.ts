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
  updateFileNumbers: (projectId: string, fieldId: string, fromNumber: number, increment: number, excludeLogId?: string) => void;
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

      updateFileNumbers: (projectId: string, fieldId: string, fromNumber: number, increment: number, excludeLogId?: string) => {
        console.log('=== updateFileNumbers called ===', {
          projectId,
          fieldId,
          fromNumber,
          increment,
          excludeLogId
        });
        
        set((state) => ({
          logSheets: (() => {
            const isTargetInRange = (start: number, end: number) => fromNumber >= Math.min(start, end) && fromNumber <= Math.max(start, end);
            
            // Helper to get file range bounds
            const getFileBounds = (sheet: LogSheet, fid: string): { lower: number; upper: number; delta: number } | null => {
              const data = sheet.data;
              if (!data) return null;
              
              if (fid === 'soundFile') {
                const soundFrom = data['sound_from'];
                const soundTo = data['sound_to'];
                if (typeof soundFrom === 'string' && typeof soundTo === 'string') {
                  const lower = parseInt(soundFrom, 10);
                  const upper = parseInt(soundTo, 10);
                  if (!isNaN(lower) && !isNaN(upper)) {
                    return { lower, upper, delta: upper - lower + 1 };
                  }
                }
                const raw = data[fid] as unknown;
                if (typeof raw === 'string' && raw.length > 0 && !raw.includes('-')) {
                  const num = parseInt(raw, 10);
                  if (!isNaN(num)) return { lower: num, upper: num, delta: 1 };
                }
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
            let skippedFirstOccurrence = false;
            let previousUpper = fromNumber - 1;
            
            console.log('[updateFileNumbers] Starting cascade shift from', fromNumber, 'with increment', increment);
            
            const updatedSheets = new Map<string, LogSheet>();
            
            for (const sheet of projectSheets) {
              // Skip the excluded log (the edited log that was just saved)
              if (excludeLogId && sheet.id === excludeLogId) {
                console.log(`  -> Skipping excluded log: ${sheet.id}`);
                updatedSheets.set(sheet.id, sheet);
                continue;
              }
              
              const bounds = getFileBounds(sheet, fieldId);
              if (!bounds) {
                updatedSheets.set(sheet.id, sheet);
                continue;
              }
              
              let { lower, upper, delta } = bounds;
              
              // Use stored delta if available (more accurate), otherwise calculate it
              if (fieldId === 'soundFile' && sheet.data.sound_delta) {
                delta = parseInt(sheet.data.sound_delta, 10) || delta;
              } else if (fieldId.startsWith('cameraFile')) {
                const cameraNum = fieldId === 'cameraFile' ? 1 : (parseInt(fieldId.replace('cameraFile', ''), 10) || 1);
                const storedDelta = sheet.data[`camera${cameraNum}_delta`];
                if (storedDelta) {
                  delta = parseInt(storedDelta, 10) || delta;
                }
              }
              
              // Skip the first occurrence that contains fromNumber
              if (!skippedFirstOccurrence && isTargetInRange(lower, upper)) {
                console.log(`  -> Skipping first occurrence at ${lower}-${upper} (contains fromNumber ${fromNumber})`);
                skippedFirstOccurrence = true;
                previousUpper = upper;
                updatedSheets.set(sheet.id, sheet);
                continue;
              }
              
              // Only shift entries that come after fromNumber
              if (lower >= fromNumber && skippedFirstOccurrence) {
                // Calculate new position: previous upper + 1
                const newLower = previousUpper + 1;
                const newUpper = newLower + delta - 1;
                
                console.log(`  -> Shifting log ${sheet.id}: ${lower}-${upper} (delta=${delta}) → ${newLower}-${newUpper}`);
                console.log(`     UniqueId: ${sheet.data?.uniqueId}, Previous upper: ${previousUpper}`);
                
                const newData: Record<string, any> = { ...sheet.data };
                
                if (fieldId === 'soundFile') {
                  newData['sound_from'] = String(newLower).padStart(4, '0');
                  newData['sound_to'] = String(newUpper).padStart(4, '0');
                  // Update inline string if it exists
                  if (typeof sheet.data.soundFile === 'string' && sheet.data.soundFile.includes('-')) {
                    newData['soundFile'] = `${String(newLower).padStart(4, '0')}-${String(newUpper).padStart(4, '0')}`;
                  } else {
                    newData['soundFile'] = String(newLower).padStart(4, '0');
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
                
                previousUpper = newUpper;
                updatedSheets.set(sheet.id, { ...sheet, data: newData, updatedAt: new Date().toISOString() });
              } else {
                updatedSheets.set(sheet.id, sheet);
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