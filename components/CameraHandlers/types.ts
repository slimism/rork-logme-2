import { TakeData, ClassificationType, LogSheet } from '@/types';

export interface DuplicateInfo {
  type: 'file' | 'take';
  label?: string;
  fieldId?: string;
  value?: string;
  number?: number;
  existingEntry: LogSheet;
  isRangeConflict?: boolean;
  conflictType?: 'lower' | 'upper' | 'within';
  rangeInfo?: { from: string; to: string };
}

export interface CameraHandlerProps {
  takeData: TakeData;
  classification: ClassificationType | null;
  disabledFields: Set<string>;
  validationErrors: Set<string>;
  showRangeMode: { [key: string]: boolean };
  rangeData: { [key: string]: { from: string; to: string } };
  projectId: string;
  cameraRecState?: { [key: string]: boolean };
}

export interface CameraValidationResult {
  hasErrors: boolean;
  missingFields: string[];
  errors: Set<string>;
}

export interface CameraDuplicateCheckResult {
  duplicateInfo: DuplicateInfo | null;
  hasConflicts: boolean;
}

