import { LogSheet, Project } from '@/types';

export interface DuplicateInfo {
  fieldId: string;
  number: number;
  existingEntry: LogSheet;
}

export interface DuplicateCheckResult {
  soundDup: DuplicateInfo | null;
  cameraDup: DuplicateInfo | null;
}

export interface BlankFieldCheck {
  isCameraBlank: boolean;
  isSoundBlank: boolean;
  targetSoundBlank: boolean;
  targetCameraBlank: boolean;
}

export class DuplicateService {
  private logSheets: LogSheet[];
  private project: Project;
  private excludeIds: Set<string>;

  constructor(logSheets: LogSheet[], project: Project, excludeIds: Set<string> = new Set()) {
    this.logSheets = logSheets;
    this.project = project;
    this.excludeIds = excludeIds;
  }

  /**
   * Check if a field value conflicts with existing entries
   */
  private getEligibleDuplicateForField(
    fieldId: string,
    currentVal: string,
    currentRange?: { from: string; to: string } | null,
    disabledFields: Set<string> = new Set()
  ): DuplicateInfo | null {
    if (disabledFields.has(fieldId)) return null;

    const currentNum = currentVal ? (parseInt(currentVal, 10) || 0) : 0;
    const curFrom = currentRange?.from ? (parseInt(currentRange.from, 10) || 0) : currentNum;
    const curTo = currentRange?.to ? (parseInt(currentRange.to, 10) || 0) : currentNum;
    const curMin = Math.min(curFrom, curTo);
    const curMax = Math.max(curFrom, curTo);

    for (const sheet of this.logSheets) {
      if (!sheet.data || this.excludeIds.has(sheet.id)) continue;

      const getExistingRange = (): { from?: string; to?: string } => {
        if (fieldId === 'soundFile') {
          return { from: sheet.data['sound_from'], to: sheet.data['sound_to'] };
        }
        if (fieldId.startsWith('cameraFile')) {
          const camNum = fieldId === 'cameraFile' ? 1 : (parseInt(fieldId.replace('cameraFile', ''), 10) || 1);
          return { from: sheet.data[`camera${camNum}_from`], to: sheet.data[`camera${camNum}_to`] };
        }
        return {};
      };

      const existingRange = getExistingRange();
      const exFrom = existingRange.from ? (parseInt(existingRange.from, 10) || 0) : undefined;
      const exTo = existingRange.to ? (parseInt(existingRange.to, 10) || 0) : undefined;

      if (exFrom != null && exTo != null) {
        const exMin = Math.min(exFrom, exTo);
        const exMax = Math.max(exFrom, exTo);
        if (this.checkRangeOverlap(curMin, curMax, exMin, exMax)) {
          if (currentNum === exMin) {
            return { fieldId, number: currentNum, existingEntry: sheet };
          }
        }
      }

      const existingVal = sheet.data[fieldId] as string | undefined;
      if (existingVal && typeof existingVal === 'string' && !this.isRangeString(existingVal)) {
        const exNum = parseInt(existingVal, 10) || 0;
        if (exNum >= curMin && exNum <= curMax) {
          return { fieldId, number: exNum, existingEntry: sheet };
        }
      }
    }
    return null;
  }

  /**
   * Check for duplicates in both sound and camera fields
   */
  checkDuplicates(
    takeData: any,
    rangeData: any,
    showRangeMode: any,
    cameraRecState: any,
    disabledFields: Set<string> = new Set()
  ): DuplicateCheckResult {
    const soundDup = this.getEligibleDuplicateForField(
      'soundFile',
      takeData.soundFile || '',
      showRangeMode['soundFile'] ? rangeData['soundFile'] : null,
      disabledFields
    );

    let cameraDup: DuplicateInfo | null = null;
    const cameraConfiguration = this.project?.settings?.cameraConfiguration || 1;

    if (cameraConfiguration === 1) {
      cameraDup = this.getEligibleDuplicateForField(
        'cameraFile',
        takeData.cameraFile || '',
        showRangeMode['cameraFile'] ? rangeData['cameraFile'] : null,
        disabledFields
      );
    } else {
      for (let i = 1; i <= cameraConfiguration; i++) {
        const fieldId = `cameraFile${i}`;
        const isRecActive = cameraRecState[fieldId] ?? true;
        if (isRecActive && takeData[fieldId]) {
          const duplicate = this.getEligibleDuplicateForField(
            fieldId,
            takeData[fieldId] || '',
            showRangeMode[fieldId] ? rangeData[fieldId] : null,
            disabledFields
          );
          if (duplicate) {
            cameraDup = duplicate;
            break;
          }
        }
      }
    }

    return { soundDup, cameraDup };
  }

  /**
   * Check which fields are blank in input and target
   */
  checkBlankFields(
    takeData: any,
    soundDup: DuplicateInfo | null,
    cameraDup: DuplicateInfo | null,
    cameraRecState: any
  ): BlankFieldCheck {
    const camCount = this.project?.settings?.cameraConfiguration || 1;

    // Check if input fields are blank
    const isCameraBlankInput = this.isCameraFieldBlank(takeData, cameraRecState);
    const isSoundBlankInput = !(takeData.soundFile?.trim());

    // Check if target fields are blank
    const targetSoundBlank = this.isTargetSoundBlank(cameraDup);
    const targetCameraBlank = this.isTargetCameraBlank(soundDup);

    return {
      isCameraBlank: isCameraBlankInput,
      isSoundBlank: isSoundBlankInput,
      targetSoundBlank,
      targetCameraBlank
    };
  }

  /**
   * Determine the appropriate duplicate handling strategy
   */
  getDuplicateHandlingStrategy(
    soundDup: DuplicateInfo | null,
    cameraDup: DuplicateInfo | null,
    blankFields: BlankFieldCheck
  ): 'none' | 'both_same' | 'sound_only' | 'camera_only' | 'selective_sound' | 'selective_camera' | 'cross_log_conflict' {
    if (!soundDup && !cameraDup) return 'none';
    if (!soundDup) return 'camera_only';
    if (!cameraDup) return 'sound_only';

    // Both duplicates exist
    if (soundDup.existingEntry.id === cameraDup.existingEntry.id) {
      return 'both_same';
    }

    // Cross-log conflict: sound and camera files exist in different logs
    // This is the most critical conflict that should prevent insertion
    return 'cross_log_conflict';
  }

  /**
   * Check if there's a cross-log conflict (sound and camera files in different logs)
   */
  hasCrossLogConflict(soundDup: DuplicateInfo | null, cameraDup: DuplicateInfo | null): boolean {
    if (!soundDup || !cameraDup) return false;
    return soundDup.existingEntry.id !== cameraDup.existingEntry.id;
  }

  /**
   * Helper methods
   */
  private checkRangeOverlap(minA: number, maxA: number, minB: number, maxB: number): boolean {
    return !(maxA < minB || minA > maxB);
  }

  private isRangeString(value: string): boolean {
    return value.includes('-') && value.split('-').length === 2;
  }

  private isCameraFieldBlank(takeData: any, cameraRecState: any): boolean {
    const camCount = this.project?.settings?.cameraConfiguration || 1;
    if (camCount === 1) {
      return !(takeData.cameraFile?.trim());
    }
    for (let i = 1; i <= camCount; i++) {
      const fieldId = `cameraFile${i}`;
      if ((cameraRecState[fieldId] ?? true) && takeData[fieldId]?.trim()) return false;
    }
    return true;
  }

  private isTargetSoundBlank(cameraDup: DuplicateInfo | null): boolean {
    if (!cameraDup) return false;
    const hasSingle = typeof cameraDup.existingEntry.data?.soundFile === 'string' && 
                     cameraDup.existingEntry.data.soundFile.trim().length > 0;
    const hasRange = typeof cameraDup.existingEntry.data?.sound_from === 'string' || 
                    typeof cameraDup.existingEntry.data?.sound_to === 'string';
    return !(hasSingle || hasRange);
  }

  private isTargetCameraBlank(soundDup: DuplicateInfo | null): boolean {
    if (!soundDup) return false;
    const camCount = this.project?.settings?.cameraConfiguration || 1;
    
    if (camCount === 1) {
      const hasSingle = typeof soundDup.existingEntry.data?.cameraFile === 'string' && 
                       soundDup.existingEntry.data.cameraFile.trim().length > 0;
      const hasRange = typeof soundDup.existingEntry.data?.camera1_from === 'string' || 
                      typeof soundDup.existingEntry.data?.camera1_to === 'string';
      return !(hasSingle || hasRange);
    }

    let anyCamPresent = false;
    for (let i = 1; i <= camCount; i++) {
      const val = soundDup.existingEntry.data?.[`cameraFile${i}`];
      const fromVal = soundDup.existingEntry.data?.[`camera${i}_from`];
      const toVal = soundDup.existingEntry.data?.[`camera${i}_to`];
      if ((typeof val === 'string' && val.trim().length > 0) || 
          (typeof fromVal === 'string' && fromVal.trim().length > 0) || 
          (typeof toVal === 'string' && toVal.trim().length > 0)) {
        anyCamPresent = true;
        break;
      }
    }
    return !anyCamPresent;
  }

  /**
   * Get location string for display
   */
  getLocationString(entry: LogSheet): string {
    const classification = entry.data?.classification;
    if (classification === 'SFX') return 'SFX';
    if (classification === 'Ambience') return 'Ambience';
    return `Scene ${entry.data?.sceneNumber || 'Unknown'}, Shot ${entry.data?.shotNumber || 'Unknown'}, Take ${entry.data?.takeNumber || 'Unknown'}`;
  }
}
