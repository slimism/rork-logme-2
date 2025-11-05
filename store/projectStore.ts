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
  nextLogId: number;
  projectLocalCounters: Record<string, number>;
  // ID shifting utilities
  insertNewLogBefore: (projectId: string, targetLogId: string, name: string, type: string, folderId: string, buildData?: () => any) => LogSheet | null;
  moveExistingLogBefore: (projectId: string, movingLogId: string, targetLogId: string) => void;
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
  updateFileNumbers: (projectId: string, fieldId: string, fromNumber: number, increment: number, excludeLogId?: string, targetLocalId?: string) => void;
}

export const useProjectStore = create<ProjectState>()(
  persist(
    (set, get) => ({
      projects: [],
      folders: [],
      logSheets: [],
      nextLogId: 1,
      projectLocalCounters: {},
      insertNewLogBefore: (projectId: string, targetLogId: string, name: string, type: string, folderId: string, buildData?: () => any) => {
        const targetNumeric = parseInt(targetLogId, 10);
        if (Number.isNaN(targetNumeric)) return null;

        const state = get();
        const projectLogs = state.logSheets.filter(s => s.projectId === projectId);
        // Snapshot before
        const beforeOrder = [...projectLogs]
          .sort((a, b) => (parseInt(a.id as string, 10) || 0) - (parseInt(b.id as string, 10) || 0))
          .map(s => ({
            id: s.id,
            scene: (s.data as any)?.sceneNumber,
            shot: (s.data as any)?.shotNumber,
            take: (s.data as any)?.takeNumber,
            camera: (s.data as any)?.cameraFile || (s.data as any)?.camera1_from ? `${(s.data as any)?.camera1_from}-${(s.data as any)?.camera1_to}` : undefined,
            sound: (s.data as any)?.soundFile || (s.data as any)?.sound_from ? `${(s.data as any)?.sound_from}-${(s.data as any)?.sound_to}` : undefined,
          }));
        // Determine nextLogId baseline as max(existing)+1
        const maxExistingId = projectLogs.reduce((m, s) => Math.max(m, parseInt(s.id as string, 10) || 0), 0);
        if (state.nextLogId <= maxExistingId) {
          set({ nextLogId: maxExistingId + 1 });
        }
        // Determine next project-local id baseline
        const maxLocalId = projectLogs.reduce((m, s) => Math.max(m, parseInt(s.projectLocalId as string, 10) || 0), 0);
        if ((state.projectLocalCounters[projectId] ?? 1) <= maxLocalId) {
          set({ projectLocalCounters: { ...state.projectLocalCounters, [projectId]: maxLocalId + 1 } });
        }

        // Create the new log with temporary unique id (nextLogId), then we'll reassign
        const tempId = (get().nextLogId).toString();
        const newLog: LogSheet = {
          id: tempId,
          name,
          type: type as any,
          folderId,
          projectId,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          data: buildData ? buildData() : {},
        };

        // Prepare shifted logs: increment ids of logs with id >= targetNumeric, descending to avoid collisions
        // Resolve target by projectLocalId first, fallback to id
        const targetLog = projectLogs.find(s => parseInt(s.projectLocalId as string, 10) === targetNumeric) ||
                          projectLogs.find(s => parseInt(s.id as string, 10) === targetNumeric);
        const targetLocal = targetLog ? (parseInt(targetLog.projectLocalId as string, 10) || targetNumeric) : targetNumeric;

        set((prev) => {
          const updated: LogSheet[] = prev.logSheets.map(s => {
            if (s.projectId !== projectId) return s;
            const nLocal = parseInt(s.projectLocalId as string, 10) || 0;
            if (nLocal >= targetLocal) {
              const newLocal = (nLocal + 1).toString();
              return { ...s, projectLocalId: newLocal, updatedAt: new Date().toISOString() };
            }
            return s;
          });
          // Place new log with the target id
          const inserted: LogSheet = { ...newLog, projectLocalId: targetLocal.toString() };
          updated.push(inserted);
          // ACTION: log inserted-before event
          try {
            const collectCameraFields = (d: any): Record<string, string> => {
              const out: Record<string, string> = {};
              // single-cam fallback
              if (typeof d?.camera1_from === 'string' && typeof d?.camera1_to === 'string') out.camera1 = `${d.camera1_from}-${d.camera1_to}`;
              else if (typeof d?.cameraFile === 'string' && d.cameraFile.trim()) out.camera1 = d.cameraFile;
              for (let i = 1; i <= 10; i++) {
                const fromK = `camera${i}_from` as const;
                const toK = `camera${i}_to` as const;
                const fileK = `cameraFile${i}` as const;
                if (typeof d?.[fromK] === 'string' && typeof d?.[toK] === 'string') out[`camera${i}`] = `${d[fromK]}-${d[toK]}`;
                else if (typeof d?.[fileK] === 'string' && d[fileK].trim()) out[`camera${i}`] = d[fileK];
              }
              return out;
            };
            const d: any = inserted.data || {};
            const camera = (d.camera1_from && d.camera1_to) ? `${d.camera1_from}-${d.camera1_to}` : (d.cameraFile || '');
            const sound = (d.sound_from && d.sound_to) ? `${d.sound_from}-${d.sound_to}` : (d.soundFile || '');
            const classification = d.classification || '';
            const camerasObj = collectCameraFields(d);
            console.log(`[ACTION] Insert New Before -> projectId=${projectId} targetLocalId=${targetLocal} insertedLocalId=${inserted.projectLocalId} scene=${d.sceneNumber || ''} shot=${d.shotNumber || ''} take=${d.takeNumber || ''} camera="${camera}" sound="${sound}" classification=${classification} cameras=${JSON.stringify(camerasObj)}`);
          } catch {}
          // Snapshot after
          const afterOrder = updated
            .filter(s => s.projectId === projectId)
            .sort((a, b) => (parseInt(a.projectLocalId as string, 10) || 0) - (parseInt(b.projectLocalId as string, 10) || 0))
            .map(s => ({
              id: s.projectLocalId || s.id,
              scene: (s.data as any)?.sceneNumber,
              shot: (s.data as any)?.shotNumber,
              take: (s.data as any)?.takeNumber,
              camera: ((s.data as any)?.camera1_from && (s.data as any)?.camera1_to) ? `${(s.data as any)?.camera1_from}-${(s.data as any)?.camera1_to}` : ((s.data as any)?.cameraFile || undefined),
              sound: ((s.data as any)?.sound_from && (s.data as any)?.sound_to) ? `${(s.data as any)?.sound_from}-${(s.data as any)?.sound_to}` : ((s.data as any)?.soundFile || undefined),
              ...(() => { const d:any=(s as any).data||{}; const o:Record<string,string>={}; for(let i=1;i<=10;i++){const fk=`camera${i}_from`;const tk=`camera${i}_to`;const ck=`cameraFile${i}`; if (d[fk]&&d[tk]) o[`camera${i}`]=`${d[fk]}-${d[tk]}`; else if (d[ck]) o[`camera${i}`]=d[ck];} return o;})()
            }));
          console.log(`[ACTION] ORDER BEFORE -> projectId=${projectId}`, beforeOrder);
          console.log(`[ACTION] ORDER AFTER -> projectId=${projectId}`, afterOrder);
          return {
            logSheets: updated,
            nextLogId: prev.nextLogId + 1,
          };
        });

        return { ...newLog, projectLocalId: targetLocal.toString() };
      },

      moveExistingLogBefore: (projectId: string, movingLogId: string, targetLogId: string) => {
        const moving = parseInt(movingLogId, 10);
        const target = parseInt(targetLogId, 10);
        if (Number.isNaN(moving) || Number.isNaN(target)) return;
        if (moving === target) return;

        const state = get();
        const projectLogs = state.logSheets.filter(s => s.projectId === projectId);
        const beforeOrder = [...projectLogs]
          .sort((a, b) => (parseInt((a.projectLocalId as string) || '0', 10) || 0) - (parseInt((b.projectLocalId as string) || '0', 10) || 0))
          .map(s => ({
            id: s.projectLocalId || s.id,
            scene: (s.data as any)?.sceneNumber,
            shot: (s.data as any)?.shotNumber,
            take: (s.data as any)?.takeNumber,
            camera: (s.data as any)?.cameraFile || (s.data as any)?.camera1_from ? `${(s.data as any)?.camera1_from}-${(s.data as any)?.camera1_to}` : undefined,
            sound: (s.data as any)?.soundFile || (s.data as any)?.sound_from ? `${(s.data as any)?.sound_from}-${(s.data as any)?.sound_to}` : undefined,
          }));
        
        set((prev) => {
          // Find the moving log by projectLocalId or id
          const movingLog = prev.logSheets.find(s => 
            s.projectId === projectId && 
            (parseInt((s as any).projectLocalId as string || '0', 10) === moving || s.id === movingLogId)
          );
          
          if (!movingLog) return { logSheets: prev.logSheets };
          
          // Save the moving log's current projectLocalId in a temp variable
          const tempProjectLocalId = moving;
          
          const updated = prev.logSheets.map(s => {
            if (s.projectId !== projectId) return s;
            
            // Skip the moving log itself - we'll handle it separately
            if (s.id === movingLog.id) return s;
            
            const nLocal = parseInt((s as any).projectLocalId as string || '0', 10) || 0;
            
            // Increment all logs with projectLocalId >= target and < tempProjectLocalId (including the target duplicate)
            // This shifts all logs in the range [target, tempProjectLocalId) to make room for the moved log
            if (nLocal >= target && nLocal < tempProjectLocalId) {
              return { ...s, projectLocalId: (nLocal + 1).toString(), updatedAt: new Date().toISOString() };
            }
            
            return s;
          }).map(s => {
            // Update the moving log to take the target's projectLocalId
            if (s.projectId === projectId && s.id === movingLog.id) {
              return { ...s, projectLocalId: target.toString(), updatedAt: new Date().toISOString() };
            }
            return s;
          });
          
          const afterOrder = updated
            .filter(s => s.projectId === projectId)
            .sort((a, b) => (parseInt((a.projectLocalId as string) || '0', 10) || 0) - (parseInt((b.projectLocalId as string) || '0', 10) || 0))
            .map(s => ({
              id: s.projectLocalId || s.id,
              scene: (s.data as any)?.sceneNumber,
              shot: (s.data as any)?.shotNumber,
              take: (s.data as any)?.takeNumber,
              camera: (s.data as any)?.cameraFile || (s.data as any)?.camera1_from ? `${(s.data as any)?.camera1_from}-${(s.data as any)?.camera1_to}` : undefined,
              sound: (s.data as any)?.soundFile || (s.data as any)?.sound_from ? `${(s.data as any)?.sound_from}-${(s.data as any)?.sound_to}` : undefined,
            }));
          console.log(`[ACTION] Move Existing Before -> projectId=${projectId} movingLocalId=${moving} targetLocalId=${target} tempProjectLocalId=${tempProjectLocalId}`);
          console.log(`[ACTION] ORDER BEFORE -> projectId=${projectId}`, beforeOrder);
          console.log(`[ACTION] ORDER AFTER -> projectId=${projectId}`, afterOrder);
          return { logSheets: updated };
        });
      },

      
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
          projectLocalCounters: { ...state.projectLocalCounters, [newProject.id]: 1 },
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
          projectLocalCounters: Object.fromEntries(Object.entries(state.projectLocalCounters).filter(([k]) => k !== id)),
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
        const currentId = get().nextLogId;
        const localCounters = get().projectLocalCounters;
        const nextLocal = (localCounters[projectId] ?? 1);
        const newLogSheet: LogSheet = {
          id: currentId.toString(),
          projectLocalId: nextLocal.toString(),
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
          nextLogId: state.nextLogId + 1,
          projectLocalCounters: { ...state.projectLocalCounters, [projectId]: nextLocal + 1 },
        }));
        // ACTION: log inserted (initial creation) and ORDER AFTER snapshot
        try {
          const collectCameraFields = (d: any): Record<string, string> => {
            const out: Record<string, string> = {};
            if (typeof d?.camera1_from === 'string' && typeof d?.camera1_to === 'string') out.camera1 = `${d.camera1_from}-${d.camera1_to}`;
            else if (typeof d?.cameraFile === 'string' && d.cameraFile.trim()) out.camera1 = d.cameraFile;
            for (let i = 1; i <= 10; i++) {
              const fk = `camera${i}_from` as const; const tk = `camera${i}_to` as const; const ck = `cameraFile${i}` as const;
              if (typeof d?.[fk] === 'string' && typeof d?.[tk] === 'string') out[`camera${i}`] = `${d[fk]}-${d[tk]}`;
              else if (typeof d?.[ck] === 'string' && d[ck].trim()) out[`camera${i}`] = d[ck];
            }
            return out;
          };
          const d: any = newLogSheet.data || {};
          const camera = (d.camera1_from && d.camera1_to) ? `${d.camera1_from}-${d.camera1_to}` : (d.cameraFile || '');
          const sound = (d.sound_from && d.sound_to) ? `${d.sound_from}-${d.sound_to}` : (d.soundFile || '');
          const classification = d.classification || '';
          const camerasObj = collectCameraFields(d);
          console.log(`[ACTION] Log Inserted -> projectId=${projectId} projectLocalId=${newLogSheet.projectLocalId} scene=${d.sceneNumber || ''} shot=${d.shotNumber || ''} take=${d.takeNumber || ''} camera="${camera}" sound="${sound}" classification=${classification} cameras=${JSON.stringify(camerasObj)}`);
          const stateAfter = get();
          const orderAfter = stateAfter.logSheets
            .filter(s => s.projectId === projectId)
            .sort((a, b) => (parseInt(a.projectLocalId as string, 10) || 0) - (parseInt(b.projectLocalId as string, 10) || 0))
            .map(s => ({
              id: s.projectLocalId || s.id,
              scene: (s.data as any)?.sceneNumber,
              shot: (s.data as any)?.shotNumber,
              take: (s.data as any)?.takeNumber,
              camera: ((s.data as any)?.camera1_from && (s.data as any)?.camera1_to) ? `${(s.data as any)?.camera1_from}-${(s.data as any)?.camera1_to}` : ((s.data as any)?.cameraFile || undefined),
              sound: ((s.data as any)?.sound_from && (s.data as any)?.sound_to) ? `${(s.data as any)?.sound_from}-${(s.data as any)?.sound_to}` : ((s.data as any)?.soundFile || undefined),
              classification: (s.data as any)?.classification || undefined,
              ...(() => { const d:any=(s as any).data||{}; const o:Record<string,string>={}; for(let i=1;i<=10;i++){const fk=`camera${i}_from`;const tk=`camera${i}_to`;const ck=`cameraFile${i}`; if (d[fk]&&d[tk]) o[`camera${i}`]=`${d[fk]}-${d[tk]}`; else if (d[ck]) o[`camera${i}`]=d[ck];} return o;})()
            }));
          console.log(`[ACTION] ORDER AFTER -> projectId=${projectId}`, orderAfter);
        } catch {}
        
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
        // ACTION LOG: Always log finalized snapshot after updates
        try {
          const collectCameraFields = (d: any): Record<string, string> => {
            const out: Record<string, string> = {};
            if (typeof d?.camera1_from === 'string' && typeof d?.camera1_to === 'string') out.camera1 = `${d.camera1_from}-${d.camera1_to}`;
            else if (typeof d?.cameraFile === 'string' && d.cameraFile.trim()) out.camera1 = d.cameraFile;
            for (let i = 1; i <= 10; i++) {
              const fk = `camera${i}_from` as const; const tk = `camera${i}_to` as const; const ck = `cameraFile${i}` as const;
              if (typeof d?.[fk] === 'string' && typeof d?.[tk] === 'string') out[`camera${i}`] = `${d[fk]}-${d[tk]}`;
              else if (typeof d?.[ck] === 'string' && d[ck].trim()) out[`camera${i}`] = d[ck];
            }
            return out;
          };
          const before: any = previousData || {};
          const after: any = updated?.data || {};
          if (updated) {
            const camera = (after.camera1_from && after.camera1_to) ? `${after.camera1_from}-${after.camera1_to}` : (after.cameraFile || '');
            const sound = (after.sound_from && after.sound_to) ? `${after.sound_from}-${after.sound_to}` : (after.soundFile || '');
            const classification = after.classification || '';
            const camerasObj = collectCameraFields(after);
            console.log(`[ACTION] Log Finalized -> projectId=${updated.projectId} projectLocalId=${updated.projectLocalId || ''} scene=${after.sceneNumber || ''} shot=${after.shotNumber || ''} take=${after.takeNumber || ''} camera="${camera}" sound="${sound}" classification=${classification} cameras=${JSON.stringify(camerasObj)}`);
            const stateAfterFinalize = get();
            const orderAfterFinalize = stateAfterFinalize.logSheets
              .filter(s => s.projectId === updated.projectId)
              .sort((a, b) => (parseInt(a.projectLocalId as string, 10) || 0) - (parseInt(b.projectLocalId as string, 10) || 0))
              .map(s => ({
                id: s.projectLocalId || s.id,
                scene: (s.data as any)?.sceneNumber,
                shot: (s.data as any)?.shotNumber,
                take: (s.data as any)?.takeNumber,
                camera: ((s.data as any)?.camera1_from && (s.data as any)?.camera1_to)
                  ? `${(s.data as any)?.camera1_from}-${(s.data as any)?.camera1_to}`
                  : ((s.data as any)?.cameraFile || undefined),
                sound: ((s.data as any)?.sound_from && (s.data as any)?.sound_to)
                  ? `${(s.data as any)?.sound_from}-${(s.data as any)?.sound_to}`
                  : ((s.data as any)?.soundFile || undefined),
                classification: (s.data as any)?.classification || undefined,
                ...(() => { const d:any=(s as any).data||{}; const o:Record<string,string>={}; for(let i=1;i<=10;i++){const fk=`camera${i}_from`;const tk=`camera${i}_to`;const ck=`cameraFile${i}`; if (d[fk]&&d[tk]) o[`camera${i}`]=`${d[fk]}-${d[tk]}`; else if (d[ck]) o[`camera${i}`]=d[ck];} return o;})()
              }));
            console.log(`[ACTION] ORDER AFTER -> projectId=${updated.projectId}`, orderAfterFinalize);
          }
        } catch {}
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
                return {
                  ...logSheet,
                  data: {
                    ...logSheet.data,
                    takeNumber: (currentTakeNum + increment).toString(),
                  },
                  updatedAt: new Date().toISOString(),
                };
              } else if (!Number.isNaN(currentTakeNum) && currentTakeNum > fromTakeNumber && maxTakeNumber !== undefined) {
                // Skipping beyond maxTakeNumber - no logging per minimal policy
              }
              return logSheet;
            } catch (e) {
              console.log('[updateTakeNumbers] error while updating take numbers', e);
              return logSheet;
            }
          }),
        }));
      },

      updateFileNumbers: (projectId: string, fieldId: string, fromNumber: number, increment: number, excludeLogId?: string, targetLocalId?: string) => {
        logger.logFunctionEntry({
          functionName: 'updateFileNumbers',
          projectId,
          fieldId,
          fromNumber,
          increment,
          excludeLogId,
          targetLocalId
        });
        
        // IMPORTANT: Get the current state at the start of processing to ensure we see
        // updates from previous updateFileNumbers calls (for multi-camera scenarios)
        const currentState = get();
        
        set((state) => {
          // Use the current state (which includes updates from previous calls) instead of the state parameter
          // This ensures we see the latest updates when processing multiple camera fields
          const activeState = currentState;
          
          // Helper to get field value and determine if blank (used by both shifting logics)
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
                  const [s, e] = soundFile.split('-').map((x: string) => parseInt(x.trim(), 10) || 0);
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
                  const [s, e] = cameraFile.split('-').map((x: string) => parseInt(x.trim(), 10) || 0);
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

          // Use global project-wide sequential shifting for all fields
          // This processes ALL logs (including SFX/Ambience) in order, maintaining temp variables across blank entries
          const updatedSheetsMap = new Map<string, LogSheet>();
          
          // Build a project-wide ordered list (by take asc, then createdAt asc)
          const projectOrdered = activeState.logSheets
            .filter(s => s.projectId === projectId)
            .map(s => ({
              s,
              take: parseInt((s.data as any)?.takeNumber || '0', 10) || 0,
              createdAtMs: new Date(s.createdAt).getTime(),
            }))
            .sort((a, b) => (a.take - b.take) || (a.createdAtMs - b.createdAtMs));

          // Find inserted index
          let insertedIndex = -1;
          if (excludeLogId) {
            insertedIndex = projectOrdered.findIndex(x => x.s.id === excludeLogId);
          }
          if (insertedIndex < 0) {
            insertedIndex = projectOrdered.findIndex(x => {
              const effData = x.s.data || {};
              const val = getFieldValue(effData, fieldId);
              return val && (val.lower === fromNumber || val.upper === fromNumber);
            });
          }

          // Initialize temp variable from inserted (or fromNumber)
          let tempGlobal: number = fromNumber;
          if (insertedIndex >= 0) {
            const insertedData = projectOrdered[insertedIndex].s.data || {};
            const val = getFieldValue(insertedData, fieldId);
            if (val && val.value !== null) tempGlobal = val.upper;
            console.log(`[GLOBAL INIT] ${fieldId} TEMP - Found inserted log at index ${insertedIndex}, tempGlobal = ${tempGlobal} (from inserted log value: ${val?.lower}/${val?.upper})`);
          } else {
            console.log(`[GLOBAL INIT] ${fieldId} TEMP - Inserted log not found, tempGlobal = ${tempGlobal} (from fromNumber)`);
          }

          // Walk forward from inserted index and sequentially update ALL entries
          // This processes ALL logs (including SFX/Ambience) in order, maintaining tempGlobal across blank entries
          const startIdx = insertedIndex >= 0 ? insertedIndex + 1 : 0;
          for (let i = startIdx; i < projectOrdered.length; i++) {
            const s = projectOrdered[i].s;
            
            // Skip excluded log
            if (excludeLogId && s.id === excludeLogId) {
              updatedSheetsMap.set(s.id, s);
              continue;
            }
            
            const original = s.data || {} as any;
            const effData = (updatedSheetsMap.get(s.id)?.data) || original; // prefer updated data in this call
            const currentFieldVal = getFieldValue(effData, fieldId);
            
            // Only shift entries at/after the insertion point (by file number)
            // Pre-insertion entries should not affect tempGlobal
            if (currentFieldVal && currentFieldVal.upper < fromNumber) {
              // Skip pre-insertion entries but also don't advance tempGlobal
              updatedSheetsMap.set(s.id, s);
              continue;
            }
            
            if (!currentFieldVal || currentFieldVal.value === null) {
              // Blank field (e.g., Waste): do not modify, tempGlobal remains unchanged (delta = 0)
              // This ensures subsequent entries can still increment correctly
              const takeNum = parseInt((effData as any)?.takeNumber || '0', 10) || 0;
              console.log(`[GLOBAL CALC] ${fieldId} - Log ${s.id} (Take ${takeNum}): BLANK field, tempGlobal remains ${tempGlobal} (delta = 0)`);
              logger.logDebug(`Global ${fieldId} shift: Log ${s.id} has blank field - tempGlobal remains ${tempGlobal}`);
              updatedSheetsMap.set(s.id, s);
              continue;
            }

            // Calculate delta based on current entry (0 for blank, 1 for single, range span for ranges)
            let delta: number;
            if (fieldId === 'soundFile') {
              const soundDeltaInput: DeltaCalculationInput = { logSheetData: effData } as any;
              delta = calculateSoundDeltaForShifting(soundDeltaInput);
            } else if (fieldId.startsWith('cameraFile')) {
              const cameraDeltaInput: DeltaCalculationInput = { logSheetData: effData } as any;
              delta = calculateCameraDeltaForShifting(cameraDeltaInput, fieldId);
            } else {
              delta = currentFieldVal.isRange 
                ? (currentFieldVal.upper - currentFieldVal.lower)
                : 1;
            }

            // Apply sequential rule: base is previous tempGlobal (which may have been unchanged if previous entry was blank)
            const base = tempGlobal;
            let newLower: number;
            let newUpper: number;
            const takeNum = parseInt((effData as any)?.takeNumber || '0', 10) || 0;
            
            if (currentFieldVal.isRange) {
              newLower = base + 1;
              newUpper = newLower + delta;
            } else {
              newLower = base + delta; // delta=1 for single
              newUpper = newLower;
            }
            
            const globalCalcFormula = currentFieldVal.isRange
              ? `Range: newLower = tempGlobal(${base}) + 1 = ${newLower}, newUpper = ${newLower} + ${delta} = ${newUpper}`
              : `Single value: newLower = tempGlobal(${base}) + delta(${delta}) = ${newLower}, newUpper = ${newLower} (single value)`;
            
            console.log(`[GLOBAL CALC] ${fieldId} - Log ${s.id} (Take ${takeNum}): tempGlobal=${base}, delta=${delta}, currentLower=${currentFieldVal.lower}, currentUpper=${currentFieldVal.upper}, isRange=${currentFieldVal.isRange}, formula="${globalCalcFormula}", result: ${newLower}/${newUpper}`);

            const newData: Record<string, any> = { ...effData };
            
            if (fieldId === 'soundFile') {
              if (currentFieldVal.isRange) {
                newData['sound_from'] = String(newLower).padStart(4, '0');
                newData['sound_to'] = String(newUpper).padStart(4, '0');
                if (typeof effData.soundFile === 'string' && effData.soundFile.includes('-')) {
                  newData.soundFile = `${String(newLower).padStart(4, '0')}-${String(newUpper).padStart(4, '0')}`;
                }
              } else {
                newData.soundFile = String(newLower).padStart(4, '0');
                delete newData['sound_from'];
                delete newData['sound_to'];
              }
            } else if (fieldId.startsWith('cameraFile')) {
              const cameraNum = fieldId === 'cameraFile' ? 1 : (parseInt(fieldId.replace('cameraFile', ''), 10) || 1);
              if (currentFieldVal.isRange) {
                newData[`camera${cameraNum}_from`] = String(newLower).padStart(4, '0');
                newData[`camera${cameraNum}_to`] = String(newUpper).padStart(4, '0');
                if (typeof effData[fieldId] === 'string' && effData[fieldId].includes('-')) {
                  newData[fieldId] = `${String(newLower).padStart(4, '0')}-${String(newUpper).padStart(4, '0')}`;
                }
              } else {
                newData[fieldId] = String(newLower).padStart(4, '0');
                delete newData[`camera${cameraNum}_from`];
                delete newData[`camera${cameraNum}_to`];
              }
            }

            logger.logCalculation(
              'Global File Number Shift (All Entries)',
              `Sequential shift for ${s.id} after insertion`,
              { base: tempGlobal, delta, currentLower: currentFieldVal.lower, currentUpper: currentFieldVal.upper },
              currentFieldVal.isRange
                ? `Range: newLower = base(${base}) + 1 = ${newLower}, newUpper = ${newLower} + ${delta} = ${newUpper}`
                : `Single: newLower = base(${base}) + delta(${delta}) = ${newLower}`,
              { newLower, newUpper }
            );

            logger.logSave('updateFileNumbers', s.id, newData, effData);
            updatedSheetsMap.set(s.id, { ...s, data: newData, updatedAt: new Date().toISOString() });
            
            // Update tempGlobal with the new upper bound for subsequent calculations
            const previousTempGlobal = tempGlobal;
            tempGlobal = currentFieldVal.isRange ? newUpper : newLower;
            console.log(`[GLOBAL UPDATE] tempGlobal: ${previousTempGlobal} -> ${tempGlobal} (after processing Log ${s.id}, Take ${takeNum}, ${fieldId} changed from ${currentFieldVal.lower}/${currentFieldVal.upper} to ${newLower}/${newUpper})`);
            logger.logDebug(`Updated tempGlobal to ${tempGlobal} after processing log ${s.id}`);
          }

          // Convert map back to array, preserving non-project sheets
          // Use activeState to ensure we see updates from previous updateFileNumbers calls
          const updatedSheets = activeState.logSheets.map(logSheet => {
            if (logSheet.projectId !== projectId) return logSheet;
            // First check if we have an update in this call's map, otherwise use the current state
            const updatedSheet = updatedSheetsMap.get(logSheet.id);
            if (updatedSheet) return updatedSheet;
            // If no update in this call, use the current state (which may have updates from previous calls)
            return logSheet;
          });

          logger.logFunctionExit({ shiftedCount: updatedSheets.filter((s, i) => s !== state.logSheets[i]).length });
          return { logSheets: updatedSheets };
        });
        
        // Emit ORDER AFTER snapshot at end of updateFileNumbers to capture latest populated fields (e.g., last entry)
        // This ensures the snapshot includes all updates made by updateFileNumbers
        try {
          const finalState = get();
          const orderAfterFiles = finalState.logSheets
            .filter(s => s.projectId === projectId)
            .sort((a, b) => (parseInt((a.projectLocalId as string) || '0', 10) || 0) - (parseInt((b.projectLocalId as string) || '0', 10) || 0))
            .map(s => ({
              id: s.projectLocalId || s.id,
              scene: (s.data as any)?.sceneNumber,
              shot: (s.data as any)?.shotNumber,
              take: (s.data as any)?.takeNumber,
              camera: ((s.data as any)?.camera1_from && (s.data as any)?.camera1_to)
                ? `${(s.data as any)?.camera1_from}-${(s.data as any)?.camera1_to}`
                : ((s.data as any)?.cameraFile || undefined),
              sound: ((s.data as any)?.sound_from && (s.data as any)?.sound_to)
                ? `${(s.data as any)?.sound_from}-${(s.data as any)?.sound_to}`
                : ((s.data as any)?.soundFile || undefined),
              classification: (s.data as any)?.classification || undefined,
              ...(() => { const d:any=(s.data as any)||{}; const o:Record<string,string>={}; for(let i=1;i<=10;i++){const fk=`camera${i}_from`;const tk=`camera${i}_to`;const ck=`cameraFile${i}`; if (d[fk]&&d[tk]) o[`camera${i}`]=`${d[fk]}-${d[tk]}`; else if (d[ck]) o[`camera${i}`]=d[ck];} return o;})()
            }));
          console.log(`[ACTION] ORDER AFTER -> projectId=${projectId}`, orderAfterFiles);
        } catch {}
      },
    }),
    {
      name: 'film-log-storage',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);