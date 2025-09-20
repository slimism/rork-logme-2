export enum LogSheetType {
  CAMERA_LOG = 'camera_log',
  SOUND_LOG = 'sound_log',
  SCRIPT_NOTES = 'script_notes',
  SHOT_LIST = 'shot_list',
  CONTINUITY_LOG = 'continuity_log'
}

export interface LogSheetField {
  id: string;
  label: string;
  enabled: boolean;
  required?: boolean;
  locked?: boolean;
}

export interface ProjectSettings {
  logSheetFields: LogSheetField[];
  customFields: string[];
  cameraConfiguration?: number;
  directorName?: string;
  cinematographerName?: string;
  loggerName?: string;
}

export interface Project {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  settings?: ProjectSettings;
  logoUri?: string;
}

export interface Folder {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  projectId: string;
}

export interface LogSheet {
  id: string;
  name: string;
  type: LogSheetType | string;
  createdAt: string;
  updatedAt: string;
  folderId: string;
  projectId: string;
  data: any;
}

export type Classification = 'Waste' | 'Insert' | 'Ambience' | 'SFX';
export type ClassificationType = Classification; // Alias for backward compatibility
export type ShotDetail = 'MOS' | 'NO SLATE';
export type ShotDetailsType = ShotDetail; // Alias for backward compatibility

export interface TakeData {
  sceneNumber?: string;
  shotNumber?: string;
  takeNumber?: string;
  episodeNumber?: string;
  cardNumber?: string;
  cameraFile?: string;
  soundFile?: string;
  descriptionOfShot?: string;
  notesForTake?: string;
  classification?: Classification;
  shotDetails?: ShotDetail[];
  isGoodTake?: boolean;
  [key: string]: any;
}

export interface CameraLogData {
  scene: string;
  take: string;
  shot: string;
  lens: string;
  aperture: string;
  notes: string;
}

export interface SoundLogData {
  scene: string;
  take: string;
  track: string;
  microphone: string;
  notes: string;
}

export interface ScriptNotesData {
  scene: string;
  take: string;
  notes: string;
  continuity: string;
}

export interface ShotListData {
  scene: string;
  shotNumber: string;
  description: string;
  angle: string;
  framing: string;
  movement: string;
  equipment: string;
  notes: string;
}

export interface ContinuityLogData {
  scene: string;
  take: string;
  description: string;
  wardrobe: string;
  props: string;
  makeup: string;
  notes: string;
}