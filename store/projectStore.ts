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
  updateTakeNumbers: (projectId: string, sceneNumber: string, shotNumber: string, fromTakeNumber: number, increment: number, excludeLogId?: string) => void;
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
        console.log('=== STORE updateLogSheet called ===');
        console.log('  id:', id);
        console.log('  data.camera1_from:', data.camera1_from);
        console.log('  data.camera1_to:', data.camera1_to);
        console.log('  data.cameraFile:', data.cameraFile);
        console.log('  data.classification:', data.classification);
        
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
      
      updateTakeNumbers: (projectId: string, sceneNumber: string, shotNumber: string, fromTakeNumber: number, increment: number, excludeLogId?: string) => {
        console.log('=== updateTakeNumbers called ===', {
          projectId,
          sceneNumber,
          shotNumber,
          fromTakeNumber,
          increment,
          excludeLogId
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

              if (!Number.isNaN(currentTakeNum) && currentTakeNum >= fromTakeNumber) {
                console.log(`  -> Shifting take ${currentTakeNum} to ${currentTakeNum + increment} (log ${logSheet.id})`);
                return {
                  ...logSheet,
                  data: {
                    ...logSheet.data,
                    takeNumber: (currentTakeNum + increment).toString(),
                  },
                  updatedAt: new Date().toISOString(),
                };
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
            let skippedTarget = false;
            const isTargetInRange = (start: number, end: number) => fromNumber >= Math.min(start, end) && fromNumber <= Math.max(start, end);
            return state.logSheets.map((logSheet) => {
              if (logSheet.projectId !== projectId) return logSheet;
              
              // Skip the excluded log (the edited log that was just saved)
              if (excludeLogId && logSheet.id === excludeLogId) {
                console.log(`  -> Explicitly skipping excluded log: ${logSheet.id}`);
                return logSheet;
              }
              const data = logSheet.data;
              if (!data) return logSheet;

              let updated = false;
              const newData: Record<string, any> = { ...data };

              const raw = data[fieldId] as unknown;
              if (typeof raw === 'string' && raw.length > 0) {
                if (raw.includes('-')) {
                  const [startStr, endStr] = raw.split('-');
                  const startNum = parseInt(startStr, 10);
                  const endNum = parseInt(endStr, 10);
                  if (!Number.isNaN(startNum) && !Number.isNaN(endNum)) {
                    if (!skippedTarget && isTargetInRange(startNum, endNum)) {
                      skippedTarget = true;
                    } else {
                      const newStart = startNum >= fromNumber ? startNum + increment : startNum;
                      const newEnd = endNum >= fromNumber ? endNum + increment : endNum;
                      newData[fieldId] = `${String(newStart).padStart(4, '0')}-${String(newEnd).padStart(4, '0')}`;
                      updated = true;
                    }
                  }
                } else {
                  const currentNum = parseInt(raw as string, 10);
                  if (!Number.isNaN(currentNum)) {
                    if (!skippedTarget && currentNum === fromNumber) {
                      skippedTarget = true;
                    } else if (currentNum >= fromNumber) {
                      newData[fieldId] = String(currentNum + increment).padStart(4, '0');
                      updated = true;
                    }
                  }
                }
              }

              if (fieldId === 'soundFile') {
                const soundFrom = data['sound_from'];
                const soundTo = data['sound_to'];
                if (typeof soundFrom === 'string' && typeof soundTo === 'string') {
                  const sFromNum = parseInt(soundFrom, 10);
                  const sToNum = parseInt(soundTo, 10);
                  if (!Number.isNaN(sFromNum) && !Number.isNaN(sToNum)) {
                    if (!skippedTarget && isTargetInRange(sFromNum, sToNum)) {
                      skippedTarget = true;
                    } else if (sFromNum >= fromNumber || sToNum >= fromNumber) {
                      newData['sound_from'] = String(sFromNum + increment).padStart(4, '0');
                      newData['sound_to'] = String(sToNum + increment).padStart(4, '0');
                      updated = true;
                    }
                  }
                }
              } else if (fieldId.startsWith('cameraFile')) {
                const cameraNum = fieldId === 'cameraFile' ? 1 : (parseInt(fieldId.replace('cameraFile', ''), 10) || 1);
                const cameraFrom = data[`camera${cameraNum}_from`];
                const cameraTo = data[`camera${cameraNum}_to`];
                if (typeof cameraFrom === 'string' && typeof cameraTo === 'string') {
                  const cFromNum = parseInt(cameraFrom, 10);
                  const cToNum = parseInt(cameraTo, 10);
                  if (!Number.isNaN(cFromNum) && !Number.isNaN(cToNum)) {
                    console.log(`DEBUG updateFileNumbers - Checking log ${logSheet.id}:`, {
                      fieldId,
                      cFromNum,
                      cToNum,
                      fromNumber,
                      increment,
                      skippedTarget,
                      'isTargetInRange': isTargetInRange(cFromNum, cToNum)
                    });
                    
                    if (!skippedTarget && isTargetInRange(cFromNum, cToNum)) {
                      console.log(`  -> Skipping target log (contains fromNumber ${fromNumber})`);
                      skippedTarget = true;
                    } else if (cFromNum >= fromNumber || cToNum >= fromNumber) {
                      const newStart = cFromNum + increment;
                      const newEnd = cToNum + increment;
                      newData[`camera${cameraNum}_from`] = String(newStart).padStart(4, '0');
                      newData[`camera${cameraNum}_to`] = String(newEnd).padStart(4, '0');
                      console.log(`  -> Shifting from ${cFromNum}-${cToNum} to ${newStart}-${newEnd}`);
                      updated = true;
                    }
                  }
                }
              }

              if (updated) {
                return { ...logSheet, data: newData, updatedAt: new Date().toISOString() };
              }
              return logSheet;
            });
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