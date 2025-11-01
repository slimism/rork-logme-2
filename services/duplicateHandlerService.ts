import { LogSheet, Project } from '@/types';
import { DuplicateService, DuplicateInfo, BlankFieldCheck } from './duplicateService';
import { FileNumberService } from './fileNumberService';
import { Platform } from 'react-native';

export interface DuplicateHandlingParams {
  logSheet: LogSheet;
  project: Project;
  takeData: any;
  rangeData: any;
  showRangeMode: any;
  cameraRecState: any;
  disabledFields: Set<string>;
  classification: string;
  shotDetails: string[];
  isGoodTake: boolean;
  wasteOptions: any;
  insertSoundSpeed: number | null;
  updateTakeNumbers: (projectId: string, sceneNumber: string, shotNumber: string, fromTakeNumber: number, increment: number) => void;
  updateLogSheet: (id: string, data: any) => void;
  router: any;
}

export class DuplicateHandlerService {
  private duplicateService: DuplicateService;
  private fileNumberService: FileNumberService;
  private params: DuplicateHandlingParams;

  constructor(params: DuplicateHandlingParams) {
    this.params = params;
    
    const excludeIds = new Set<string>();
    if (params.logSheet?.id) excludeIds.add(params.logSheet.id);
    
    this.duplicateService = new DuplicateService(
      params.project ? [] : [], // Will be set properly in checkAndHandleDuplicates
      params.project,
      excludeIds
    );

    this.fileNumberService = new FileNumberService(
      this.createUpdateFileNumbersHandler(),
      params.updateLogSheet
    );
  }

  /**
   * Main method to check for duplicates and handle them appropriately
   */
  async checkAndHandleDuplicates(logSheets: LogSheet[]): Promise<boolean> {
    // Update the logSheets in duplicate service
    this.duplicateService = new DuplicateService(
      logSheets.filter(sheet => sheet.projectId === this.params.project.id),
      this.params.project,
      new Set([this.params.logSheet.id])
    );

    const { soundDup, cameraDup } = this.duplicateService.checkDuplicates(
      this.params.takeData,
      this.params.rangeData,
      this.params.showRangeMode,
      this.params.cameraRecState,
      this.params.disabledFields
    );

    const blankFields = this.duplicateService.checkBlankFields(
      this.params.takeData,
      soundDup,
      cameraDup,
      this.params.cameraRecState
    );

    const strategy = this.duplicateService.getDuplicateHandlingStrategy(
      soundDup,
      cameraDup,
      blankFields
    );

    return this.handleDuplicateStrategy(strategy, soundDup, cameraDup);
  }

  /**
   * Handle the specific duplicate strategy
   */
  private async handleDuplicateStrategy(
    strategy: string,
    soundDup: DuplicateInfo | null,
    cameraDup: DuplicateInfo | null
  ): Promise<boolean> {
    switch (strategy) {
      case 'none':
        return false; // No duplicates, continue normally
      
      case 'both_same':
        return this.handleBothSameDuplicate(soundDup!);
      
      case 'sound_only':
        return this.handleSoundOnlyDuplicate(soundDup!);
      
      case 'camera_only':
        return this.handleCameraOnlyDuplicate(cameraDup!);
      
      case 'selective_sound':
        return this.handleSelectiveSoundDuplicate(soundDup!);
      
      case 'selective_camera':
        return this.handleSelectiveCameraDuplicate(cameraDup!);
      
      case 'cross_log_conflict':
        return this.handleCrossLogConflict(soundDup!, cameraDup!);
      
      default:
        return false;
    }
  }

  /**
   * Handle when both sound and camera are duplicates of the same entry
   */
  private handleBothSameDuplicate(soundDup: DuplicateInfo): boolean {
    const location = this.duplicateService.getLocationString(soundDup.existingEntry);
    
    // Check for range conflict
    const soundConflict = this.findFirstDuplicateFile();
    if (soundConflict?.isRangeConflict && 
        (soundConflict.conflictType === 'upper' || soundConflict.conflictType === 'within')) {
      this.showAlert(
        'Part of Ranged Take',
        `The file number is part of a take that contains a range at ${location}. Adjust the value(s) to continue.`,
        [{ text: 'OK', style: 'default' }]
      );
      return true;
    }

    this.showAlert(
      'Duplicate Detected',
      `Camera and Sound files are duplicates found in ${location}. Do you want to insert before?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Insert Before', 
          onPress: () => this.handleSaveWithDuplicatePair(
            soundDup.existingEntry, 
            soundDup.number, 
            soundDup.fieldId, // Assuming same field for both
            soundDup.number
          )
        }
      ]
    );
    return true;
  }

  /**
   * Handle when only sound file is a duplicate
   */
  private handleSoundOnlyDuplicate(soundDup: DuplicateInfo): boolean {
    const location = this.duplicateService.getLocationString(soundDup.existingEntry);
    
    this.showAlert(
      'Duplicate Detected',
      `Sound file is a duplicate at ${location}. Do you want to insert before?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Insert Before', 
          onPress: () => this.handleSaveWithDuplicateHandling(
            'before', 
            { type: 'file', fieldId: 'soundFile', existingEntry: soundDup.existingEntry, number: soundDup.number }
          )
        }
      ]
    );
    return true;
  }

  /**
   * Handle when only camera file is a duplicate
   */
  private handleCameraOnlyDuplicate(cameraDup: DuplicateInfo): boolean {
    const location = this.duplicateService.getLocationString(cameraDup.existingEntry);

    if (this.isCameraOnlyOverlapAllowed(cameraDup)) {
      this.mergeCameraOnlyOverlap(cameraDup);
      return false;
    }
    
    this.showAlert(
      'Duplicate Detected',
      `Camera file is a duplicate at ${location}. Do you want to insert before?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Insert Before', 
          onPress: () => this.handleSaveWithDuplicateHandling(
            'before', 
            { type: 'file', fieldId: cameraDup.fieldId, existingEntry: cameraDup.existingEntry, number: cameraDup.number }
          )
        }
      ]
    );
    return true;
  }

  /**
   * Handle selective shifting for sound file
   */
  private handleSelectiveSoundDuplicate(soundDup: DuplicateInfo): boolean {
    const location = this.duplicateService.getLocationString(soundDup.existingEntry);
    
    this.showAlert(
      'Duplicate Detected',
      `Sound file is a duplicate at ${location}. Camera field is blank. Do you want to insert before and shift only sound files?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Insert Before (Sound Only)', 
          onPress: () => this.handleSaveWithSelectiveDuplicateHandling(
            'before', 
            { type: 'file', fieldId: 'soundFile', existingEntry: soundDup.existingEntry, number: soundDup.number }
          )
        }
      ]
    );
    return true;
  }

  /**
   * Handle selective shifting for camera file
   */
  private handleSelectiveCameraDuplicate(cameraDup: DuplicateInfo): boolean {
    const location = this.duplicateService.getLocationString(cameraDup.existingEntry);
    
    this.showAlert(
      'Duplicate Detected',
      `Camera file is a duplicate at ${location}. Sound field is blank. Do you want to insert before and shift only camera files?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Insert Before (Camera Only)', 
          onPress: () => this.handleSaveWithSelectiveDuplicateHandling(
            'before', 
            { type: 'file', fieldId: cameraDup.fieldId, existingEntry: cameraDup.existingEntry, number: cameraDup.number }
          )
        }
      ]
    );
    return true;
  }

  /**
   * Handle cross-log conflict when sound and camera files exist in different logs
   */
  private handleCrossLogConflict(soundDup: DuplicateInfo, cameraDup: DuplicateInfo): boolean {
    const sLoc = this.duplicateService.getLocationString(soundDup.existingEntry);
    const cLoc = this.duplicateService.getLocationString(cameraDup.existingEntry);
    
    // Get the actual file numbers for better user understanding
    const soundFileNumber = this.params.takeData.soundFile || 'Unknown';
    const cameraFileNumber = cameraDup.fieldId === 'cameraFile' ? 
      (this.params.takeData.cameraFile || 'Unknown') : 
      (this.params.takeData[cameraDup.fieldId] || 'Unknown');
    
    this.showAlert(
      'Cross-Log Conflict Detected',
      `Cannot ${this.params.logSheet ? 'update' : 'add'} log because the sound file and camera file already exist in different logs:

Sound File ${soundFileNumber} → Found in: ${sLoc}
Camera File ${cameraFileNumber} → Found in: ${cLoc}

This would break the logging logic and create inconsistencies in the file numbering system. Please adjust your file numbers to avoid conflicts.`,
      [{ text: 'OK', style: 'default' }]
    );
    return true;
  }

  /**
   * Handle save with duplicate pair (both sound and camera from same entry)
   */
  private handleSaveWithDuplicatePair(
    existingEntry: LogSheet,
    soundNumber: number,
    cameraFieldId: string,
    cameraNumber: number
  ): void {
    // Implementation for handling duplicate pairs
    // This would contain the logic from the original handleSaveWithDuplicatePair function
    console.log('Handling duplicate pair:', existingEntry, soundNumber, cameraFieldId, cameraNumber);
  }

  /**
   * Handle save with duplicate handling (single field)
   */
  private handleSaveWithDuplicateHandling(position: 'before', duplicateInfo: any): void {
    // Implementation for handling single field duplicates
    // This would contain the logic from the original handleSaveWithDuplicateHandling function
    console.log('Handling duplicate:', position, duplicateInfo);
  }

  /**
   * Handle save with selective duplicate handling
   */
  private handleSaveWithSelectiveDuplicateHandling(position: 'before', duplicateInfo: any): void {
    // Implementation for selective shifting
    // This would contain the logic from the original handleSaveWithSelectiveDuplicateHandling function
    console.log('Handling selective duplicate:', position, duplicateInfo);
  }

  /**
   * Helper methods
   */
  private createUpdateFileNumbersHandler() {
    return (projectId: string, fieldId: string, fromNumber: number, increment: number) => {
      console.log('Updating file numbers:', projectId, fieldId, fromNumber, increment);
    };
  }

  private isCameraOnlyOverlapAllowed(cameraDup: DuplicateInfo): boolean {
    const incomingHasNoSound = !(this.params.takeData?.soundFile?.trim()) && !(this.params.rangeData?.soundFile?.from) && !(this.params.rangeData?.soundFile?.to);
    const existingHasSound = (() => {
      const d = cameraDup.existingEntry?.data ?? {};
      const hasSingle = typeof d.soundFile === 'string' && d.soundFile.trim().length > 0;
      const hasRange = typeof d.sound_from === 'string' || typeof d.sound_to === 'string';
      return hasSingle || hasRange;
    })();

    if (!incomingHasNoSound || !existingHasSound) return false;

    const camCount = this.params.project?.settings?.cameraConfiguration || 1;

    for (let i = 1; i <= camCount; i++) {
      const fieldId = camCount === 1 ? 'cameraFile' : `cameraFile${i}`;
      const inRange = this.getIncomingRange(fieldId);
      const exRange = this.getExistingRange(cameraDup.existingEntry, fieldId);
      if (!inRange || !exRange) return false;
      if (!this.rangesAreCompatible(inRange.min, inRange.max, exRange.min, exRange.max)) return false;
    }

    return true;
  }

  private getIncomingRange(fieldId: string): { min: number; max: number } | null {
    const showRange = this.params.showRangeMode?.[fieldId];
    if (showRange && this.params.rangeData?.[fieldId]?.from && this.params.rangeData?.[fieldId]?.to) {
      const a = parseInt(this.params.rangeData[fieldId].from, 10) || 0;
      const b = parseInt(this.params.rangeData[fieldId].to, 10) || 0;
      return { min: Math.min(a, b), max: Math.max(a, b) };
    }
    const val: string | undefined = this.params.takeData?.[fieldId] || (fieldId === 'cameraFile' ? this.params.takeData?.cameraFile : undefined);
    if (!val) return null;
    if (val.includes('-')) {
      const [a, b] = val.split('-');
      const ai = parseInt(a, 10) || 0;
      const bi = parseInt(b, 10) || 0;
      return { min: Math.min(ai, bi), max: Math.max(ai, bi) };
    }
    const n = parseInt(val, 10) || 0;
    return { min: n, max: n };
  }

  private getExistingRange(entry: LogSheet, fieldId: string): { min: number; max: number; fromKey: string; toKey: string } | null {
    if (fieldId === 'soundFile') return null;
    if (fieldId === 'cameraFile') {
      const fromKey = 'camera1_from';
      const toKey = 'camera1_to';
      const from = entry.data?.[fromKey];
      const to = entry.data?.[toKey];
      if (from && to) {
        const a = parseInt(from, 10) || 0; const b = parseInt(to, 10) || 0;
        return { min: Math.min(a, b), max: Math.max(a, b), fromKey, toKey };
      }
    } else if (fieldId.startsWith('cameraFile')) {
      const cam = parseInt(fieldId.replace('cameraFile','')) || 1;
      const fromKey = `camera${cam}_from`;
      const toKey = `camera${cam}_to`;
      const from = entry.data?.[fromKey];
      const to = entry.data?.[toKey];
      if (from && to) {
        const a = parseInt(from, 10) || 0; const b = parseInt(to, 10) || 0;
        return { min: Math.min(a, b), max: Math.max(a, b), fromKey, toKey };
      }
    }
    return null;
  }

  private rangesAreCompatible(minA: number, maxA: number, minB: number, maxB: number): boolean {
    const overlap = !(maxA < minB || minA > maxB);
    const touching = maxA + 1 === minB || maxB + 1 === minA;
    return overlap || touching;
  }

  private mergeCameraOnlyOverlap(cameraDup: DuplicateInfo): void {
    const camCount = this.params.project?.settings?.cameraConfiguration || 1;
    const entry = cameraDup.existingEntry;

    const updates: Record<string, any> = { ...entry.data };
    const shifts: { fieldId: string; start: number; inc: number }[] = [];

    for (let i = 1; i <= camCount; i++) {
      const fieldId = camCount === 1 ? 'cameraFile' : `cameraFile${i}`;
      const inRange = this.getIncomingRange(fieldId);
      const exRange = this.getExistingRange(entry, fieldId);
      if (!inRange || !exRange) continue;

      const newMin = Math.min(inRange.min, exRange.min);
      const newMax = Math.max(inRange.max, exRange.max);

      const fromKey = exRange.fromKey;
      const toKey = exRange.toKey;
      const oldTo = exRange.max;

      if (newMin !== exRange.min || newMax !== exRange.max) {
        updates[fromKey] = String(newMin).padStart(4, '0');
        updates[toKey] = String(newMax).padStart(4, '0');

        const inc = newMax - oldTo;
        if (inc > 0) {
          shifts.push({ fieldId, start: oldTo + 1, inc });
        }
      }
    }

    if (Object.keys(updates).length > 0) {
      this.params.updateLogSheet(entry.id, updates);
    }

    // Shift subsequent logs for cameras only
    shifts.forEach(s => {
      const fn = this.createUpdateFileNumbersHandler();
      fn(this.params.project.id, s.fieldId, s.start, s.inc);
    });
  }

  private findFirstDuplicateFile(): any {
    // Implementation for finding first duplicate file
    return null;
  }

  private showAlert(title: string, message: string, buttons: any[]): void {
    // This would be connected to the actual Alert.alert function
    console.log('Alert:', title, message, buttons);
  }
}
