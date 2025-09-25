import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Project, Folder, LogSheet, ProjectSettings } from '@/types';

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
  updateTakeNumbers: (projectId: string, sceneNumber: string, shotNumber: string, fromTakeNumber: number, increment: number) => void;
  updateFileNumbers: (projectId: string, fieldId: string, fromNumber: number, increment: number) => void;
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
        // Import token store dynamically to avoid circular dependency
        const { useTokenStore } = require('@/store/subscriptionStore');
        const tokenStore = useTokenStore.getState();
        
        // Check if this is the trial project and reset trial if so
        if (tokenStore.trialProjectId === id) {
          tokenStore.resetTrial();
        }
        
        // Clean up project log count tracking
        const currentCounts = { ...tokenStore.projectLogCounts };
        delete currentCounts[id];
        tokenStore.setProjectLogCount(id, 0);
        
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
        set((state) => ({
          logSheets: state.logSheets.map((logSheet) => 
            logSheet.id === id 
              ? { ...logSheet, data, updatedAt: new Date().toISOString() } 
              : logSheet
          ),
        }));
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
      
      updateTakeNumbers: (projectId: string, sceneNumber: string, shotNumber: string, fromTakeNumber: number, increment: number) => {
        set((state) => ({
          logSheets: state.logSheets.map((logSheet) => {
            if (logSheet.projectId === projectId && 
                logSheet.data?.sceneNumber === sceneNumber &&
                logSheet.data?.shotNumber === shotNumber) {
              const currentTakeNum = parseInt(logSheet.data.takeNumber);
              if (!isNaN(currentTakeNum) && currentTakeNum >= fromTakeNumber) {
                return {
                  ...logSheet,
                  data: {
                    ...logSheet.data,
                    takeNumber: (currentTakeNum + increment).toString()
                  },
                  updatedAt: new Date().toISOString()
                };
              }
            }
            return logSheet;
          })
        }));
      },

      updateFileNumbers: (projectId: string, fieldId: string, fromNumber: number, increment: number) => {
        set((state) => ({
          logSheets: state.logSheets.map((logSheet) => {
            if (logSheet.projectId === projectId) {
              const raw = logSheet.data?.[fieldId];
              if (typeof raw === 'string' && raw.length > 0) {
                if (raw.includes('-')) {
                  const [startStr, endStr] = raw.split('-');
                  const startNum = parseInt(startStr);
                  const endNum = parseInt(endStr);
                  if (!isNaN(startNum) && !isNaN(endNum)) {
                    const newStart = startNum >= fromNumber ? startNum + increment : startNum;
                    const newEnd = endNum >= fromNumber ? endNum + increment : endNum;
                    const formatted = `${String(newStart).padStart(4, '0')}-${String(newEnd).padStart(4, '0')}`;
                    return {
                      ...logSheet,
                      data: {
                        ...logSheet.data,
                        [fieldId]: formatted,
                      },
                      updatedAt: new Date().toISOString(),
                    };
                  }
                } else {
                  const currentNum = parseInt(raw);
                  if (!isNaN(currentNum) && currentNum >= fromNumber) {
                    const formatted = String(currentNum + increment).padStart(4, '0');
                    return {
                      ...logSheet,
                      data: {
                        ...logSheet.data,
                        [fieldId]: formatted,
                      },
                      updatedAt: new Date().toISOString(),
                    };
                  }
                }
              }
            }
            return logSheet;
          })
        }));
      },
    }),
    {
      name: 'film-log-storage',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);