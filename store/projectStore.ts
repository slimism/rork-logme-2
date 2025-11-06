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
        // Snapshot before - use projectLocalId for id field to match ORDER AFTER format
        const beforeOrder = [...projectLogs]
          .sort((a, b) => (parseInt(a.projectLocalId as string || '0', 10) || 0) - (parseInt(b.projectLocalId as string || '0', 10) || 0))
          .map(s => ({
            id: s.projectLocalId || s.id,
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
        
        console.log(`[insertNewLogBefore] targetLogId=${targetLogId}, targetNumeric=${targetNumeric}, targetLog found=${!!targetLog}, targetLog.projectLocalId=${targetLog?.projectLocalId}, targetLocal=${targetLocal}`);

        set((prev) => {
          const updated: LogSheet[] = prev.logSheets.map(s => {
            if (s.projectId !== projectId) return s;
            const nLocal = parseInt(s.projectLocalId as string, 10) || 0;
            if (nLocal >= targetLocal) {
              const newLocal = (nLocal + 1).toString();
              console.log(`[insertNewLogBefore] Incrementing log projectLocalId: ${nLocal} -> ${newLocal} (take: ${s.data?.takeNumber})`);
              return { ...s, projectLocalId: newLocal, updatedAt: new Date().toISOString() };
            }
            return s;
          });
          // Place new log with the target id
          const inserted: LogSheet = { ...newLog, projectLocalId: targetLocal.toString() };
          console.log(`[insertNewLogBefore] Inserting new log with projectLocalId=${targetLocal.toString()}, take=${inserted.data?.takeNumber}`);
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

          // Always use sequential shifting logic (tempCamera/tempSound)
          // If targetLocalId is not provided, try to determine it from the excluded log (inserted log)
          let resolvedTargetLocalId = targetLocalId;
          if (!resolvedTargetLocalId && excludeLogId) {
            const insertedLog = activeState.logSheets.find(s => s.id === excludeLogId && s.projectId === projectId);
            if (insertedLog && (insertedLog as any).projectLocalId) {
              resolvedTargetLocalId = String((insertedLog as any).projectLocalId);
            }
          }
          
          // Use resolvedTargetLocalId throughout the sequential logic
          const effectiveTargetLocalId = resolvedTargetLocalId;

          // SPECIAL HANDLING FOR SOUND FILES: When editing a log to insert before another log,
          // process ALL logs by projectLocalId (not by scene/shot groups) for sequential shifting
          // This automatically handles SFX, Ambience, and regular logs uniformly
          const updatedSheetsMap = new Map<string, LogSheet>();
          
          if (fieldId === 'soundFile' && effectiveTargetLocalId) {
            const targetLocalIdNum = parseInt(effectiveTargetLocalId, 10) || 0;
            
            // Get all project logs sorted by projectLocalId
            const allProjectLogs = activeState.logSheets
              .filter(sheet => sheet.projectId === projectId)
              .map(sheet => ({
                sheet,
                localId: parseInt((sheet as any).projectLocalId as string || '0', 10) || 0
              }))
              .sort((a, b) => a.localId - b.localId);
            
            // Find the inserted log (excludeLogId) to initialize tempSound from its upper bound
            let insertedLog: LogSheet | null = null;
            let tempSound: number | null = null;
            
            if (excludeLogId) {
              insertedLog = allProjectLogs.find(item => item.sheet.id === excludeLogId)?.sheet || null;
            }
            
            // If not found by ID, try to find by file number matching fromNumber
            if (!insertedLog) {
              const matching = allProjectLogs.find(item => {
                const fieldVal = getFieldValue(item.sheet.data || {}, fieldId);
                return fieldVal && (fieldVal.lower === fromNumber || fieldVal.upper === fromNumber);
              });
              insertedLog = matching?.sheet || null;
            }
            
            // Initialize tempSound from inserted log's upper bound
            if (insertedLog) {
              const insertedFieldVal = getFieldValue(insertedLog.data || {}, fieldId);
              if (insertedFieldVal && insertedFieldVal.value !== null) {
                tempSound = insertedFieldVal.upper;
                console.log(`[SOUND INIT] tempSound initialized from inserted log: ${tempSound} (from inserted log soundFile: ${insertedFieldVal.lower}/${insertedFieldVal.upper})`);
                logger.logDebug(`Initialized tempSound from inserted log: ${tempSound}`);
              }
            }
            
            // Fallback: if inserted log not found or has blank sound, use fromNumber
            if (tempSound === null) {
              tempSound = fromNumber;
              console.log(`[SOUND INIT] tempSound initialized from fromNumber fallback: ${tempSound}`);
              logger.logDebug(`tempSound initialized from fromNumber fallback: ${tempSound}`);
            }
            
            // Process all logs with projectLocalId > targetLocalId sequentially
            for (const { sheet, localId } of allProjectLogs) {
              // Skip the inserted log itself
              if (excludeLogId && sheet.id === excludeLogId) {
                updatedSheetsMap.set(sheet.id, sheet);
                continue;
              }
              
              // Only process logs after the insertion point
              if (localId <= targetLocalIdNum) {
                updatedSheetsMap.set(sheet.id, sheet);
                continue;
              }
              
              const data = sheet.data || {};
              const currentFieldVal = getFieldValue(data, fieldId);
              const newData: Record<string, any> = { ...data };
              let updated = false;
              
              if (!currentFieldVal || currentFieldVal.value === null) {
                // Waste (blank sound): delta = 0, tempSound stays unchanged
                console.log(`[SOUND SHIFT] Log ${sheet.id} (projectLocalId: ${localId}): BLANK sound, tempSound remains ${tempSound} (delta = 0)`);
                logger.logDebug(`Sound file blank (Waste) - tempSound remains ${tempSound}`);
                // tempSound stays the same, no update needed
              } else {
                // Calculate delta based on the current entry's original range span
                const soundDeltaInput: DeltaCalculationInput = { logSheetData: data } as any;
                const delta = calculateSoundDeltaForShifting(soundDeltaInput);
                
                let soundNewLower: number;
                let soundNewUpper: number;
                
                if (currentFieldVal.isRange) {
                  // Range: newLower = tempSound + 1, newUpper = newLower + delta
                  soundNewLower = tempSound! + 1;
                  soundNewUpper = soundNewLower + delta;
                } else {
                  // Single value: newLower = tempSound + delta, newUpper = newLower
                  soundNewLower = tempSound! + delta;
                  soundNewUpper = soundNewLower;
                }
                
                const soundCalcFormula = currentFieldVal.isRange
                  ? `Range: newLower = tempSound(${tempSound}) + 1 = ${soundNewLower}, newUpper = ${soundNewLower} + ${delta} = ${soundNewUpper}`
                  : `Single: newLower = tempSound(${tempSound}) + delta(${delta}) = ${soundNewLower}, newUpper = ${soundNewLower}`;
                
                console.log(`[SOUND SHIFT] Log ${sheet.id} (projectLocalId: ${localId}): tempSound=${tempSound}, delta=${delta}, current=${currentFieldVal.lower}/${currentFieldVal.upper}, isRange=${currentFieldVal.isRange}, formula="${soundCalcFormula}", result: ${soundNewLower}/${soundNewUpper}`);
                
                logger.logCalculation(
                  'Sound File Sequential Shift (projectLocalId)',
                  `Shifting sound file for log ${sheet.id} (projectLocalId: ${localId})`,
                  {
                    tempSound,
                    delta,
                    currentLower: currentFieldVal.lower,
                    currentUpper: currentFieldVal.upper,
                    isRange: currentFieldVal.isRange
                  },
                  soundCalcFormula,
                  { newLower: soundNewLower, newUpper: soundNewUpper }
                );
                
                // Update the data
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
                
                // Update tempSound for next iteration
                const previousTempSound = tempSound;
                tempSound = currentFieldVal.isRange ? soundNewUpper : soundNewLower;
                console.log(`[SOUND UPDATE] tempSound: ${previousTempSound} -> ${tempSound} (after processing Log ${sheet.id}, projectLocalId: ${localId})`);
                logger.logDebug(`Updated tempSound from ${previousTempSound} to ${tempSound} after processing log ${sheet.id}`);
                
                updated = true;
              }
              
              if (updated) {
                logger.logSave('updateFileNumbers', sheet.id, newData, data);
                updatedSheetsMap.set(sheet.id, { ...sheet, data: newData, updatedAt: new Date().toISOString() });
              } else {
                updatedSheetsMap.set(sheet.id, sheet);
              }
            }
            
            // For sound files with targetLocalId, we've handled all processing above
            // Skip the scene/shot grouping logic below
            // Convert map back to array and return
            const updatedSheets = activeState.logSheets.map(logSheet => {
              if (logSheet.projectId !== projectId) return logSheet;
              const updatedSheet = updatedSheetsMap.get(logSheet.id);
              if (updatedSheet) return updatedSheet;
              return logSheet;
            });
            
            logger.logFunctionExit({ shiftedCount: updatedSheets.filter((s, i) => s !== state.logSheets[i]).length });
            return { logSheets: updatedSheets };
          }

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
          // Use activeState instead of state to ensure we see updates from previous updateFileNumbers calls
          activeState.logSheets.forEach(logSheet => {
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
          // If effectiveTargetLocalId is provided, also sort by projectLocalId to ensure correct processing order
          sheetsBySceneShot.forEach((sheets, key) => {
            sheets.sort((a, b) => {
              const aTake = parseInt(a.data?.takeNumber as string || '0', 10);
              const bTake = parseInt(b.data?.takeNumber as string || '0', 10);
              // If effectiveTargetLocalId is provided, prioritize projectLocalId ordering
              if (effectiveTargetLocalId) {
                const aLocalId = parseInt((a as any).projectLocalId as string || '0', 10) || 0;
                const bLocalId = parseInt((b as any).projectLocalId as string || '0', 10) || 0;
                if (aLocalId !== bLocalId) {
                  return aLocalId - bLocalId;
                }
              }
              return aTake - bTake;
            });
          });
          
          // Process each scene/shot group sequentially
          // Note: updatedSheetsMap is already initialized above for sound file special handling
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
            // IMPORTANT: If excludeLogId is provided, it's the ID of the newly inserted log - use it directly!
            // This is more reliable than searching by file number, which can match multiple logs
            let insertedLog: LogSheet | null = null;
            
            // Strategy 1: If excludeLogId is provided, use it directly (most reliable)
            // The excludeLogId is the newly inserted log that we just saved
            if (excludeLogId) {
              insertedLog = sheets.find(sheet => sheet.id === excludeLogId) || null;
              if (insertedLog) {
                logger.logDebug(`Found inserted log via excludeLogId: Take ${insertedLog.data?.takeNumber}, ID: ${excludeLogId}`);
              } else {
                logger.logWarning(`excludeLogId ${excludeLogId} provided but log not found in sheets - will fall back to search by file number`);
              }
            }
            
            // Strategy 2: If excludeLogId not provided or not found, search by file number
            // Find log with file number matching fromNumber, prioritizing the LOWEST take number
            // This handles edge cases where excludeLogId might not be set
            if (!insertedLog) {
              const matchingLogs = sheets
                .filter(sheet => {
                  const sheetFieldVal = getFieldValue(sheet.data || {}, fieldId);
                  if (sheetFieldVal && sheetFieldVal.value !== null) {
                    // Check if this log's file number matches fromNumber
                    // The inserted log should have file number = fromNumber
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
              
              insertedLog = matchingLogs.length > 0 ? matchingLogs[0] : null;
              
              if (insertedLog) {
                logger.logDebug(`Found inserted log via file number search: Take ${insertedLog.data?.takeNumber}, file number ${fromNumber}`);
              }
            }
            
            // Strategy 3: Final fallback - try fromNumber - 1 (for edge cases)
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
              
              insertedLog = fallbackLogs[0] || null;
              
              if (insertedLog) {
                logger.logDebug(`Found inserted log via fallback search (fromNumber - 1): Take ${insertedLog.data?.takeNumber}`);
              }
            }
            
            // Strategy 4: If still not found, look for the most recently created log in this scene/shot
            // This handles cases where the inserted log was created but doesn't have file numbers set yet
            if (!insertedLog) {
              const recentLogs = sheets
                .sort((a, b) => {
                  // Sort by creation time (most recent first)
                  const aTime = new Date(a.createdAt).getTime();
                  const bTime = new Date(b.createdAt).getTime();
                  return bTime - aTime;
                });
              
              // Take the most recently created log as a potential inserted log
              if (recentLogs.length > 0) {
                insertedLog = recentLogs[0];
                logger.logDebug(`Found potential inserted log via recent creation time: Take ${insertedLog.data?.takeNumber}, ID ${insertedLog.id}`);
              }
            }

            // If we still did not find an inserted log (common when inserting-before before saving the new log),
            // seed temp values directly from fromNumber so sequential shifting can proceed.
            if (!insertedLog) {
              if (fieldId === 'soundFile') {
                tempSound = fromNumber;
                console.log(`[INIT] SOUND TEMP INITIALIZATION - Inserted log not found, seeding tempSound from fromNumber=${fromNumber}`);
                logger.logDebug(`Inserted log not found; seeding tempSound directly from fromNumber=${fromNumber}`);
              } else if (fieldId.startsWith('cameraFile')) {
                // For camera fields, when inserted log not found, initialize ALL camera tempCamera values from fromNumber
                // This ensures that when processing cameraFile2, tempCamera[1], tempCamera[2], etc. are all initialized
                // Only initialize if not already set (preserve from previous camera processing)
                const project = activeState.projects.find(p => p.id === projectId);
                const cameraConfiguration = project?.settings?.cameraConfiguration || 1;
                console.log(`[INIT] CAMERA TEMP INITIALIZATION - Inserted log not found, seeding tempCamera[1..${cameraConfiguration}] from fromNumber=${fromNumber} (only if not already set)`);
                for (let camNum = 1; camNum <= cameraConfiguration; camNum++) {
                  if (tempCamera[camNum] === null || tempCamera[camNum] === undefined) {
                    tempCamera[camNum] = fromNumber;
                    console.log(`[INIT] tempCamera[${camNum}] = ${fromNumber} (from fromNumber fallback)`);
                    logger.logDebug(`Inserted log not found; seeding tempCamera[${camNum}] directly from fromNumber=${fromNumber}`);
                  } else {
                    console.log(`[INIT] tempCamera[${camNum}] already set to ${tempCamera[camNum]} (preserving from previous camera processing)`);
                    logger.logDebug(`tempCamera[${camNum}] already initialized to ${tempCamera[camNum]} - preserving from previous camera field processing`);
                  }
                }
              }
            }

            if (insertedLog) {
              const insertedData = insertedLog.data || {};
              const insertedTakeNum = parseInt(insertedData.takeNumber as string || '0', 10);
              
              // Get project settings to determine number of cameras
              const project = activeState.projects.find(p => p.id === projectId);
              const cameraConfiguration = project?.settings?.cameraConfiguration || 1;
              const maxCameras = Math.max(cameraConfiguration, 10); // At least check up to project's camera count, but also up to 10 for safety
              
              // Initialize the current field's temp variable
              const insertedFieldVal = getFieldValue(insertedData, fieldId);
              if (insertedFieldVal && insertedFieldVal.value !== null) {
                if (fieldId === 'soundFile') {
                  tempSound = insertedFieldVal.upper;
                  console.log(`[INIT] SOUND TEMP INITIALIZATION - Found inserted log (Take ${insertedTakeNum}, ID: ${insertedLog.id}), tempSound = ${tempSound} (from inserted log soundFile value: ${insertedFieldVal.lower}/${insertedFieldVal.upper})`);
                  logger.logDebug(`Initialized tempSound from inserted log (Take ${insertedTakeNum}, file number ${insertedFieldVal.lower}/${insertedFieldVal.upper}): ${tempSound}`);
                } else if (fieldId.startsWith('cameraFile')) {
                  const cameraNum = fieldId === 'cameraFile' ? 1 : (parseInt(fieldId.replace('cameraFile', ''), 10) || 1);
                  tempCamera[cameraNum] = insertedFieldVal.upper;
                  console.log(`[INIT] tempCamera[${cameraNum}] = ${tempCamera[cameraNum]} (from inserted log Take ${insertedTakeNum}, field ${fieldId}, value: ${insertedFieldVal.lower}/${insertedFieldVal.upper})`);
                  logger.logDebug(`Initialized tempCamera[${cameraNum}] from inserted log (Take ${insertedTakeNum}, file number ${insertedFieldVal.lower}/${insertedFieldVal.upper}): ${tempCamera[cameraNum]}`);
                }
              } else {
                console.log(`[INIT] WARNING - Inserted log (Take ${insertedTakeNum}, ID: ${insertedLog.id}) found but field ${fieldId} is blank/null - temp variables not initialized for this field`);
                logger.logWarning(`Inserted log (Take ${insertedTakeNum}) found but field ${fieldId} is blank/null - temp variables not initialized for this field`);
              }
              
              // For multi-camera: Initialize tempCamera for ALL cameras in the project settings from the inserted log
              // This matches the single-camera behavior where we initialize from the inserted log
              // Each camera field processing call will initialize ALL cameras, ensuring consistent starting values
              if (fieldId.startsWith('cameraFile')) {
                // Initialize tempCamera for ALL cameras in the project (based on cameraConfiguration)
                // This matches single-camera behavior: we always initialize from the inserted log
                console.log(`[INIT] CAMERA TEMP INITIALIZATION - Found inserted log (Take ${insertedTakeNum}, ID: ${insertedLog.id}), initializing tempCamera for all ${cameraConfiguration} cameras from inserted log values`);
                for (let camNum = 1; camNum <= cameraConfiguration; camNum++) {
                  const camFieldId = camNum === 1 ? 'cameraFile' : `cameraFile${camNum}`;
                  // Get the current state of this camera field from the inserted log
                  const camFieldVal = getFieldValue(insertedData, camFieldId);
                  if (camFieldVal && camFieldVal.value !== null) {
                    tempCamera[camNum] = camFieldVal.upper;
                    console.log(`[INIT] tempCamera[${camNum}] = ${tempCamera[camNum]} (from inserted log Take ${insertedTakeNum}, field ${camFieldId}, value: ${camFieldVal.lower}/${camFieldVal.upper})`);
                    logger.logDebug(`Initialized tempCamera[${camNum}] from inserted log (Take ${insertedTakeNum}, field ${camFieldId}, file number ${camFieldVal.lower}/${camFieldVal.upper}): ${tempCamera[camNum]}`);
                  } else {
                    // Camera field is blank in inserted log - this shouldn't happen for a valid inserted log,
                    // but if it does, we'll leave tempCamera[camNum] as null/undefined
                    console.log(`[INIT] WARNING: tempCamera[${camNum}] NOT initialized - inserted log (Take ${insertedTakeNum}) has blank ${camFieldId}`);
                    logger.logWarning(`Inserted log (Take ${insertedTakeNum}) has blank ${camFieldId} - tempCamera[${camNum}] not initialized`);
                  }
                }
              }
            } else if (fieldId !== 'soundFile') {
              // For camera fields, keep existing warning behavior
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
                // Shift if:
                // 1. File number matches condition (currentFieldVal.lower >= fromNumber || currentFieldVal.upper >= fromNumber), OR
                // 2. effectiveTargetLocalId is provided and this take's projectLocalId > effectiveTargetLocalId (for shifting subsequent takes when editing existing take)
                const logSheetLocalId = parseInt((logSheet as any).projectLocalId as string || '0', 10) || 0;
                const targetLocalIdNum = effectiveTargetLocalId ? (parseInt(effectiveTargetLocalId, 10) || 0) : null;
                const needsShiftingByFileNumber = currentFieldVal.lower >= fromNumber || currentFieldVal.upper >= fromNumber;
                const needsShiftingByLocalId = targetLocalIdNum !== null && logSheetLocalId > targetLocalIdNum;
                
                if (needsShiftingByFileNumber || needsShiftingByLocalId) {
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
                  
                  // Determine which delta to use:
                  // - Always use each take's own original delta (calculated from the take's current data)
                  // - This ensures that when moving an existing take, the target duplicate uses its own original delta,
                  //   and subsequent takes also use their own original deltas
                  // - TempSound/TempCamera are initialized from inserted log's upper bound, but delta comes from the take being shifted
                  let delta: number;
                  
                  // Use centralized delta calculator for consistency - always use the take's own original delta
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
                  
                  const logSheetLocalId = (logSheet as any).projectLocalId;
                  const isTargetDuplicate = effectiveTargetLocalId && 
                    (parseInt(logSheetLocalId as string || '0', 10) || 0) === (parseInt(effectiveTargetLocalId, 10) || 0);
                  
                  if (isTargetDuplicate) {
                    logger.logDebug(`Using target duplicate's own original delta (${delta}) for shifting (Take ${takeNum}, projectLocalId=${logSheetLocalId})`);
                  } else {
                    logger.logDebug(`Using take's own original delta (${delta}) for subsequent take (Take ${takeNum}, projectLocalId=${logSheetLocalId})`);
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
                    // Use the take's own original delta (already calculated above as 'delta')
                    // This ensures target duplicate uses its own original delta, and subsequent takes use their own deltas
                    const soundDeltaForShift = delta;
                    
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
                    
                    // Calculate new bounds based on whether it's a range or single value
                    // For single values: newLower = tempSound + delta (direct increment)
                    // For ranges: newLower = tempSound + 1, newUpper = newLower + delta
                    let soundNewLower: number;
                    let soundNewUpper: number;
                    
                    if (currentFieldVal.isRange) {
                      // Range: newLower = tempSound + 1, newUpper = newLower + delta
                      soundNewLower = soundShiftBase + 1;
                      soundNewUpper = soundNewLower + soundDeltaForShift;
                    } else {
                      // Single value: newLower = tempSound + delta (single file number)
                      // For single values, delta represents the span (1 file), so we add it directly
                      soundNewLower = soundShiftBase + soundDeltaForShift;
                      soundNewUpper = soundNewLower; // Single value: upper equals lower
                    }
                    
                    const soundCalcFormula = currentFieldVal.isRange
                      ? `Range: newLower = tempSound(${soundShiftBase}) + 1 = ${soundNewLower}, newUpper = ${soundNewLower} + ${soundDeltaForShift} = ${soundNewUpper}`
                      : `Single value: newLower = tempSound(${soundShiftBase}) + delta(${soundDeltaForShift}) = ${soundNewLower}, newUpper = ${soundNewLower} (single value)`;
                    
                    console.log(`[CALC] SOUND FILE - Take ${takeNum} (ID: ${logSheet.id}): tempSound=${tempSound ?? 'null'}, shiftBase=${soundShiftBase}, delta=${soundDeltaForShift}, currentLower=${currentFieldVal.lower}, currentUpper=${currentFieldVal.upper}, isRange=${currentFieldVal.isRange}, formula="${soundCalcFormula}", result: ${soundNewLower}/${soundNewUpper}`);
                    
                    logger.logCalculation(
                      'Sound File Shift Calculation',
                      `Calculate new sound file bounds for take ${takeNum}`,
                      {
                        tempSound: tempSound !== null ? tempSound : 'N/A',
                        shiftBase: soundShiftBase,
                        delta: soundDeltaForShift,
                        currentLower: currentFieldVal.lower,
                        currentUpper: currentFieldVal.upper,
                        isRange: currentFieldVal.isRange
                      },
                      soundCalcFormula,
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
                    console.log(`[UPDATE] tempSound: ${previousTempSound ?? 'null'} -> ${tempSound} (after processing Take ${takeNum}, sound changed from ${currentFieldVal.lower}/${currentFieldVal.upper} to ${soundNewLower}/${soundNewUpper}, finalUpper=${finalUpperForTempSound})`);
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
                    // Note: delta was already calculated above - for target duplicate it's the inserted log's delta,
                    //       for subsequent takes it's each take's own original delta
                    
                    if (tempCamera[cameraNum] !== null && tempCamera[cameraNum] !== undefined) {
                      // ALWAYS use tempCamera when available - this includes target duplicate
                      // Calculate what it should be based on tempCamera
                      // delta is already set correctly above: inserted log's delta for target duplicate,
                      // or the take's own original delta for subsequent takes
                      newLower = tempCamera[cameraNum]! + 1;
                      newUpper = newLower + delta;
                      
                      const cameraCalcFormula = currentFieldVal.isRange
                        ? `Range: newLower = tempCamera[${cameraNum}](${tempCamera[cameraNum]}) + 1 = ${newLower}, newUpper = ${newLower} + ${delta} = ${newUpper}`
                        : `Single value: newLower = tempCamera[${cameraNum}](${tempCamera[cameraNum]}) + 1 = ${newLower}, newUpper = ${newLower} (single value)`;
                      
                      console.log(`[CALC] CAMERA FILE ${cameraNum} - Take ${takeNum} (ID: ${logSheet.id}): tempCamera[${cameraNum}]=${tempCamera[cameraNum]}, delta=${delta}, currentLower=${currentFieldVal.lower}, currentUpper=${currentFieldVal.upper}, isRange=${currentFieldVal.isRange}, formula="${cameraCalcFormula}", result: ${newLower}/${newUpper}`);
                      
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
                      console.log(`[CALC] CAMERA FILE ${cameraNum} - Take ${takeNum} (ID: ${logSheet.id}): tempCamera[${cameraNum}]=null/undefined, using shiftBase=${shiftBase}, delta=${delta}, formula="newLower = shiftBase(${shiftBase}) + 1 = ${newLower}, newUpper = ${newLower} + ${delta} = ${newUpper}", result: ${newLower}/${newUpper}`);
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
                    console.log(`[UPDATE] tempCamera[${cameraNum}]: ${previousTempCamera ?? 'null'} -> ${tempCamera[cameraNum]} (after processing Take ${takeNum}, camera changed from ${currentFieldVal.lower}/${currentFieldVal.upper} to ${newLower}/${newUpper}, finalUpper=${finalUpperForTemp})`);
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
                    // Sound is blank - tempSound should stay as it is (from previous valid record)
                    // If tempSound is null or undefined, we need to find the previous valid sound file
                    // This is critical: when a take has blank sound, we still need tempSound to track
                    // the last valid value so subsequent takes can increment correctly
                    if (tempSound === null || tempSound === undefined) {
                      // Use getPreviousValidValue to find the last valid sound file before this take
                      const excludeIds = new Set<string>([logSheet.id]);
                      if (excludeLogId) excludeIds.add(excludeLogId);
                      const previousSoundUpper = getPreviousValidValue(activeState.logSheets, takeNum, sceneNum, shotNum, 'soundFile', excludeIds);
                      
                      if (previousSoundUpper !== null) {
                        tempSound = previousSoundUpper;
                        logger.logCalculation(
                          'Sound File Blank - Setting tempSound from Previous Valid',
                          `Take ${takeNum} has blank sound file, setting tempSound from previous valid upper bound`,
                          {
                            takeNumber: takeNum,
                            previousSoundUpper,
                            tempSound
                          },
                          `tempSound = ${tempSound} (from previous valid take, stays same for next calculation)`,
                          tempSound
                        );
                      } else {
                        // Also try using SoundHandler for more robust lookup
                        const soundHandlerContext: SoundHandlerContext = {
                          projectId,
                          projectLogSheets: activeState.logSheets.filter(s => s.projectId === projectId),
                          sceneNumber: sceneNum,
                          shotNumber: shotNum,
                          takeNumber: takeNum
                        };
                        
                        const handlerSoundUpper = getSoundFileValueForSubsequentShift(
                          soundHandlerContext,
                          takeNum - 1 // Previous take number
                        );
                        
                        if (handlerSoundUpper !== null) {
                          tempSound = handlerSoundUpper;
                          logger.logCalculation(
                            'Sound File Blank - Setting tempSound via SoundHandler',
                            `Take ${takeNum} has blank sound file, setting tempSound via SoundHandler`,
                            {
                              takeNumber: takeNum,
                              handlerSoundUpper,
                              tempSound
                            },
                            `tempSound = ${tempSound} (stays same for next calculation)`,
                            tempSound
                          );
                        } else {
                          logger.logWarning(`Take ${takeNum} has blank sound file and no previous valid sound file found - tempSound remains null`);
                        }
                      }
                    } else {
                      // tempSound already set - keep it for next calculation (add 0 = stays same)
                      // This is correct: blank fields don't change tempSound, so subsequent takes
                      // can still increment from the last valid value
                      logger.logCalculation(
                        'Sound File Blank - Keeping tempSound',
                        `Take ${takeNum} has blank sound file, tempSound stays unchanged`,
                        {
                          takeNumber: takeNum,
                          tempSound
                        },
                        `tempSound remains ${tempSound} (blank field adds 0, so temp variable stays same for next take)`,
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
                      const prevValid = getPreviousValidValue(activeState.logSheets, takeNum, sceneNum, shotNum, fieldId, excludeIds);
                      
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

          // For sound files: also sequentially shift SFX/Ambience entries project-wide that occur after the insertion
          // Skip this if we already handled sound files with targetLocalId above
          if (fieldId === 'soundFile' && !effectiveTargetLocalId) {
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
                const effData = (updatedSheetsMap.get(x.s.id)?.data) || x.s.data || {};
                const val = getFieldValue(effData, 'soundFile');
                return val && (val.lower === fromNumber || val.upper === fromNumber);
              });
            }

            // Initialize tempSound from inserted (or fromNumber)
            let tempSoundGlobal: number = fromNumber;
            if (insertedIndex >= 0) {
              const effData = (updatedSheetsMap.get(projectOrdered[insertedIndex].s.id)?.data) || projectOrdered[insertedIndex].s.data || {};
              const val = getFieldValue(effData, 'soundFile');
              if (val && val.value !== null) tempSoundGlobal = val.upper;
              console.log(`[GLOBAL INIT] SOUND TEMP - Found inserted log at index ${insertedIndex}, tempSoundGlobal = ${tempSoundGlobal} (from inserted log soundFile value: ${val?.lower}/${val?.upper})`);
            } else {
              console.log(`[GLOBAL INIT] SOUND TEMP - Inserted log not found, tempSoundGlobal = ${tempSoundGlobal} (from fromNumber)`);
            }

            // Walk forward from inserted index and sequentially update ALL entries
            // This processes ALL logs (including SFX/Ambience) in order, maintaining tempSound across blank entries
            const startIdx = insertedIndex >= 0 ? insertedIndex + 1 : 0;
            for (let i = startIdx; i < projectOrdered.length; i++) {
              const s = projectOrdered[i].s;
              const original = s.data || {} as any;
              const effData = (updatedSheetsMap.get(s.id)?.data) || original; // prefer updated data in this call
              const currentFieldVal = getFieldValue(effData, 'soundFile');
              
              // Only shift entries at/after the insertion point (by file number)
              // Pre-insertion entries should not affect tempSoundGlobal
              if (currentFieldVal && currentFieldVal.upper < fromNumber) {
                // Skip pre-insertion entries but also don't advance tempSoundGlobal
                continue;
              }
              
              if (!currentFieldVal || currentFieldVal.value === null) {
                // Blank sound (e.g., Waste): do not modify, tempSound remains unchanged (delta = 0)
                // This ensures subsequent entries can still increment correctly
                const takeNum = parseInt((effData as any)?.takeNumber || '0', 10) || 0;
                console.log(`[GLOBAL CALC] SOUND FILE - Log ${s.id} (Take ${takeNum}): BLANK sound, tempSoundGlobal remains ${tempSoundGlobal} (delta = 0)`);
                logger.logDebug(`Global sound shift: Log ${s.id} has blank sound - tempSoundGlobal remains ${tempSoundGlobal}`);
                continue;
              }

              // Calculate delta based on current entry (0 for blank, 1 for single, range span for ranges)
              const soundDeltaInput: DeltaCalculationInput = { logSheetData: effData } as any;
              const delta = calculateSoundDeltaForShifting(soundDeltaInput);

              // Apply sequential rule: base is previous tempSound (which may have been unchanged if previous entry was blank)
              const base = tempSoundGlobal;
              let soundNewLower: number;
              let soundNewUpper: number;
              const takeNum = parseInt((effData as any)?.takeNumber || '0', 10) || 0;
              if (currentFieldVal.isRange) {
                soundNewLower = base + 1;
                soundNewUpper = soundNewLower + delta;
              } else {
                soundNewLower = base + delta; // delta=1 for single
                soundNewUpper = soundNewLower;
              }
              
              const globalSoundCalcFormula = currentFieldVal.isRange
                ? `Range: newLower = tempSoundGlobal(${base}) + 1 = ${soundNewLower}, newUpper = ${soundNewLower} + ${delta} = ${soundNewUpper}`
                : `Single value: newLower = tempSoundGlobal(${base}) + delta(${delta}) = ${soundNewLower}, newUpper = ${soundNewLower} (single value)`;
              
              console.log(`[GLOBAL CALC] SOUND FILE - Log ${s.id} (Take ${takeNum}): tempSoundGlobal=${base}, delta=${delta}, currentLower=${currentFieldVal.lower}, currentUpper=${currentFieldVal.upper}, isRange=${currentFieldVal.isRange}, formula="${globalSoundCalcFormula}", result: ${soundNewLower}/${soundNewUpper}`);

              const newData: Record<string, any> = { ...effData };
              if (currentFieldVal.isRange) {
                newData['sound_from'] = String(soundNewLower).padStart(4, '0');
                newData['sound_to'] = String(soundNewUpper).padStart(4, '0');
                if (typeof effData.soundFile === 'string' && effData.soundFile.includes('-')) {
                  newData.soundFile = `${String(soundNewLower).padStart(4, '0')}-${String(soundNewUpper).padStart(4, '0')}`;
                }
              } else {
                newData.soundFile = String(soundNewLower).padStart(4, '0');
                delete newData['sound_from'];
                delete newData['sound_to'];
              }

              logger.logCalculation(
                'Global Sound Shift (All Entries)',
                `Sequential shift for ${s.id} after insertion`,
                { base: tempSoundGlobal, delta, currentLower: currentFieldVal.lower, currentUpper: currentFieldVal.upper },
                currentFieldVal.isRange
                  ? `Range: newLower = base(${base}) + 1 = ${soundNewLower}, newUpper = ${soundNewLower} + ${delta} = ${soundNewUpper}`
                  : `Single: newLower = base(${base}) + delta(${delta}) = ${soundNewLower}`,
                { newLower: soundNewLower, newUpper: soundNewUpper }
              );

              logger.logSave('updateFileNumbers', s.id, newData, effData);
              updatedSheetsMap.set(s.id, { ...s, data: newData, updatedAt: new Date().toISOString() });
              // Update tempSoundGlobal with the new upper bound for subsequent calculations
              const previousTempSoundGlobal = tempSoundGlobal;
              tempSoundGlobal = currentFieldVal.isRange ? soundNewUpper : soundNewLower;
              console.log(`[GLOBAL UPDATE] tempSoundGlobal: ${previousTempSoundGlobal} -> ${tempSoundGlobal} (after processing Log ${s.id}, Take ${takeNum}, sound changed from ${currentFieldVal.lower}/${currentFieldVal.upper} to ${soundNewLower}/${soundNewUpper})`);
              logger.logDebug(`Updated tempSoundGlobal to ${tempSoundGlobal} after processing log ${s.id}`);
            }
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