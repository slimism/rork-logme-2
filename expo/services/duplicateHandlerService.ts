import { LogSheet, Project } from '@/types';
import { DuplicateService, DuplicateInfo, BlankFieldCheck } from './duplicateService';
import { FileNumberService } from './fileNumberService';

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
      // This would be connected to the actual updateFileNumbers function from the store
      console.log('Updating file numbers:', projectId, fieldId, fromNumber, increment);
    };
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
