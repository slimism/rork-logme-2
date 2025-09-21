import React, { useState, useEffect, useRef } from 'react';
import { View, StyleSheet, ScrollView, Text, TextInput, TouchableOpacity, Alert, KeyboardAvoidingView, Modal, Platform, Keyboard, Switch } from 'react-native';
import { useLocalSearchParams, Stack, router } from 'expo-router';
import { ArrowLeft, Check, X } from 'lucide-react-native';
import { useProjectStore } from '@/store/projectStore';
import { useTokenStore } from '@/store/subscriptionStore';
import { colors } from '@/constants/colors';
import { ClassificationType, ShotDetailsType, TakeData } from '@/types';
import Toast from 'react-native-toast-message';

export default function AddTakeScreen() {
  const { projectId } = useLocalSearchParams<{ projectId: string }>();
  const { projects, logSheets, addLogSheet, updateTakeNumbers } = useProjectStore();
  const tokenStore = useTokenStore();
  const { getRemainingTrialLogs, tokens, canAddLog } = tokenStore;
  
  const [project, setProject] = useState(projects.find(p => p.id === projectId));
  const [takeData, setTakeData] = useState<TakeData>({});
  const [classification, setClassification] = useState<ClassificationType | null>(null);
  const [shotDetails, setShotDetails] = useState<ShotDetailsType | null>(null);
  const [isGoodTake, setIsGoodTake] = useState<boolean>(false);
  const [, setLastShotDescription] = useState<string>('');
  const [stats, setStats] = useState({ totalTakes: 0, scenes: 0 });

  const [showRangeMode, setShowRangeMode] = useState<{ [key: string]: boolean }>({});
  const [rangeData, setRangeData] = useState<{ [key: string]: { from: string; to: string } }>({});
  const [cameraRecState, setCameraRecState] = useState<{ [key: string]: boolean }>({});
  const [showWasteModal, setShowWasteModal] = useState<boolean>(false);
  const [wasteOptions, setWasteOptions] = useState<{ camera: boolean; sound: boolean }>({ camera: false, sound: false });
  const [showInsertModal, setShowInsertModal] = useState<boolean>(false);
  const [disabledFields, setDisabledFields] = useState<Set<string>>(new Set());
  const [validationErrors, setValidationErrors] = useState<Set<string>>(new Set());

  const inputRefs = useRef<Record<string, TextInput | null>>({});
  const scrollViewRef = useRef<ScrollView>(null);
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  useEffect(() => {
    const keyboardDidShowListener = Keyboard.addListener('keyboardDidShow', (e) => {
      setKeyboardHeight(e.endCoordinates.height);
    });
    const keyboardDidHideListener = Keyboard.addListener('keyboardDidHide', () => {
      setKeyboardHeight(0);
    });

    return () => {
      keyboardDidShowListener.remove();
      keyboardDidHideListener.remove();
    };
  }, []);

  // Helper function to get the highest file number from all logs for a specific camera
  const getHighestFileNumber = (fieldId: string, projectLogSheets: any[]) => {
    let highestNum = 0;
    
    projectLogSheets.forEach(sheet => {
      if (sheet.data?.[fieldId]) {
        const fileValue = sheet.data[fieldId];
        if (fileValue.includes('-')) {
          // Handle range format (e.g., "0001-0005")
          const rangeParts = fileValue.split('-');
          const endRange = parseInt(rangeParts[1]) || 0;
          highestNum = Math.max(highestNum, endRange);
        } else {
          // Handle single number format
          const num = parseInt(fileValue) || 0;
          highestNum = Math.max(highestNum, num);
        }
      }
    });
    
    return highestNum;
  };

  // Helper function to get the next file number based on REC state
  const getNextFileNumber = (fieldId: string, projectLogSheets: any[], isRecActive: boolean) => {
    if (!isRecActive) {
      // If REC is not active, don't increment - use the same number as last recorded entry
      const lastRecordedEntry = projectLogSheets
        .filter(sheet => sheet.data?.[fieldId])
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
      
      if (lastRecordedEntry?.data?.[fieldId]) {
        const lastValue = lastRecordedEntry.data[fieldId];
        if (lastValue.includes('-')) {
          const rangeParts = lastValue.split('-');
          return parseInt(rangeParts[1]) || 1;
        } else {
          return parseInt(lastValue) || 1;
        }
      }
      return 1; // If no previous entry, start with 1
    } else {
      // If REC is active, increment from the highest number
      return getHighestFileNumber(fieldId, projectLogSheets) + 1;
    }
  };

  // Initialize REC state separately to avoid infinite loops
  useEffect(() => {
    const currentProject = projects.find(p => p.id === projectId);
    if (currentProject) {
      const initialRecState: { [key: string]: boolean } = {};
      // Only initialize REC state for multiple cameras (more than 1)
      if ((currentProject.settings?.cameraConfiguration || 1) > 1) {
        for (let i = 1; i <= (currentProject.settings?.cameraConfiguration || 1); i++) {
          initialRecState[`cameraFile${i}`] = true;
        }
        setCameraRecState(initialRecState);
      }
    }
  }, [projectId, projects]);

  useEffect(() => {
    const currentProject = projects.find(p => p.id === projectId);
    setProject(currentProject);
    
    // Calculate stats
    const projectLogSheets = logSheets.filter(sheet => sheet.projectId === projectId);
    const scenes = new Set(projectLogSheets.map(sheet => sheet.data?.sceneNumber).filter(Boolean));
    
    setStats({
      totalTakes: projectLogSheets.length,
      scenes: scenes.size,
    });
    
    // Auto-fill logic
    if (projectLogSheets.length === 0) {
      // Very first log file - fill with "0001" for all file fields
      const autoFillData: TakeData = {};
      
      // Set sound file to "0001"
      if (currentProject?.settings?.logSheetFields?.find(f => f.id === 'soundFile')?.enabled) {
        autoFillData.soundFile = '0001';
      }
      
      // Set camera files to "0001"
      if (currentProject?.settings?.cameraConfiguration === 1) {
        autoFillData.cameraFile = '0001';
      } else {
        for (let i = 1; i <= (currentProject?.settings?.cameraConfiguration || 1); i++) {
          autoFillData[`cameraFile${i}`] = '0001';
        }
      }
      
      setTakeData(autoFillData);
    } else {
      // Subsequent log files - increment from highest file number
      const lastLog = projectLogSheets
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
      
      if (lastLog?.data) {
        const { 
          episodeNumber, 
          sceneNumber, 
          shotNumber, 
          takeNumber, 
          cardNumber 
        } = lastLog.data;
        
        const autoFillData: TakeData = {};
        
        // Always keep episode, scene, shot, and card number
        if (episodeNumber) autoFillData.episodeNumber = episodeNumber;
        if (sceneNumber) autoFillData.sceneNumber = sceneNumber;
        if (shotNumber) autoFillData.shotNumber = shotNumber;
        if (cardNumber) autoFillData.cardNumber = cardNumber;
        
        // Auto-increment take number
        if (takeNumber) {
          const nextTakeNumber = (parseInt(takeNumber) + 1).toString();
          autoFillData.takeNumber = nextTakeNumber;
        }
        
        // Auto-increment sound file based on highest number + 1
        if (!disabledFields.has('soundFile')) {
          const highestSoundNum = getHighestFileNumber('soundFile', projectLogSheets);
          const nextSoundFileNum = highestSoundNum + 1;
          autoFillData.soundFile = String(nextSoundFileNum).padStart(4, '0');
        }
        
        // Handle camera files based on configuration and REC state
        if (currentProject?.settings?.cameraConfiguration === 1) {
          if (!disabledFields.has('cameraFile')) {
            const highestCameraNum = getHighestFileNumber('cameraFile', projectLogSheets);
            const nextCameraFileNum = highestCameraNum + 1;
            autoFillData.cameraFile = String(nextCameraFileNum).padStart(4, '0');
          }
        } else {
          // Multiple cameras - use REC state to determine file numbers
          for (let i = 1; i <= (currentProject?.settings?.cameraConfiguration || 1); i++) {
            const fieldId = `cameraFile${i}`;
            if (!disabledFields.has(fieldId)) {
              const isRecActive = cameraRecState[fieldId] ?? true;
              const nextCameraFileNum = getNextFileNumber(fieldId, projectLogSheets, isRecActive);
              autoFillData[fieldId] = String(nextCameraFileNum).padStart(4, '0');
            }
          }
        }
        
        // Keep shot description if same shot
        if (lastLog.data?.descriptionOfShot && 
            lastLog.data?.sceneNumber === autoFillData.sceneNumber &&
            lastLog.data?.shotNumber === autoFillData.shotNumber) {
          autoFillData.descriptionOfShot = lastLog.data.descriptionOfShot;
          setLastShotDescription(lastLog.data.descriptionOfShot);
        }
        
        setTakeData(autoFillData);
      }
    }
  }, [projectId, projects, logSheets, disabledFields]);
  


  const HeaderLeft = () => (
    <TouchableOpacity onPress={() => router.back()} style={styles.headerButton}>
      <ArrowLeft size={24} color={colors.text} />
    </TouchableOpacity>
  );

  const updateTakeData = (fieldId: string, value: string | boolean) => {
    setTakeData(prev => {
      const newData = { ...prev, [fieldId]: value };
      
      // Smart auto-fill logic based on field changes - only reset what's necessary
      if (fieldId === 'episodeNumber' && project?.settings?.logSheetFields?.find(f => f.id === 'episodeNumber')?.enabled) {
        // Reset scene, shot, take when episode changes
        newData.sceneNumber = '';
        newData.shotNumber = '';
        newData.takeNumber = '1';
        // Clear description and notes
        newData.descriptionOfShot = '';
        newData.notesForTake = '';
        setLastShotDescription('');
        // Clear custom fields
        project?.settings?.customFields?.forEach((_, index) => {
          newData[`custom_${index}`] = '';
        });
      } else if (fieldId === 'sceneNumber') {
        // Reset shot and take when scene changes
        newData.shotNumber = '';
        newData.takeNumber = '1';
        // Clear description and notes
        newData.descriptionOfShot = '';
        newData.notesForTake = '';
        setLastShotDescription('');
        // Clear custom fields
        project?.settings?.customFields?.forEach((_, index) => {
          newData[`custom_${index}`] = '';
        });
      } else if (fieldId === 'shotNumber') {
        // Reset only take when shot changes
        newData.takeNumber = '1';
        // Clear description and notes only if shot actually changed
        const currentShot = prev.shotNumber;
        if (currentShot !== value) {
          newData.descriptionOfShot = '';
          setLastShotDescription('');
        }
        newData.notesForTake = '';
        // Clear custom fields
        project?.settings?.customFields?.forEach((_, index) => {
          newData[`custom_${index}`] = '';
        });
      } else if (fieldId === 'descriptionOfShot') {
        // Update last shot description when it changes
        setLastShotDescription(value as string);
      }
      
      return newData;
    });
  };

  // Helper function to check for duplicate file numbers
  const checkForDuplicateFiles = () => {
    const projectLogSheets = logSheets.filter(sheet => sheet.projectId === projectId);
    const duplicates: string[] = [];
    
    // Check sound file
    if (takeData.soundFile && !disabledFields.has('soundFile')) {
      const soundFileValue = takeData.soundFile;
      const existingSheet = projectLogSheets.find(sheet => 
        sheet.data?.soundFile === soundFileValue
      );
      
      if (existingSheet) {
        duplicates.push(`Sound File "${soundFileValue}"`);
      }
    }
    
    // Check camera files
    const cameraConfiguration = project?.settings?.cameraConfiguration || 1;
    if (cameraConfiguration === 1) {
      if (takeData.cameraFile && !disabledFields.has('cameraFile')) {
        const cameraFileValue = takeData.cameraFile;
        const existingSheet = projectLogSheets.find(sheet => 
          sheet.data?.cameraFile === cameraFileValue
        );
        
        if (existingSheet) {
          duplicates.push(`Camera File "${cameraFileValue}"`);
        }
      }
    } else {
      for (let i = 1; i <= cameraConfiguration; i++) {
        const fieldId = `cameraFile${i}`;
        if (takeData[fieldId] && !disabledFields.has(fieldId)) {
          const cameraFileValue = takeData[fieldId];
          const existingSheet = projectLogSheets.find(sheet => 
            sheet.data?.[fieldId] === cameraFileValue
          );
          
          if (existingSheet) {
            duplicates.push(`Camera File ${i} "${cameraFileValue}"`);
          }
        }
      }
    }
    
    return duplicates;
  };

  // Helper function to validate mandatory fields
  const validateMandatoryFields = () => {
    const errors = new Set<string>();
    const missingFields: string[] = [];
    
    // Check Scene Number (always mandatory)
    if (!takeData.sceneNumber?.trim()) {
      errors.add('sceneNumber');
      missingFields.push('Scene');
    }
    
    // Check Shot Number (always mandatory)
    if (!takeData.shotNumber?.trim()) {
      errors.add('shotNumber');
      missingFields.push('Shot');
    }
    
    // Check Sound File (mandatory unless disabled)
    if (!disabledFields.has('soundFile') && !takeData.soundFile?.trim()) {
      errors.add('soundFile');
      missingFields.push('Sound File');
    }
    
    // Check Camera Files (mandatory unless disabled)
    const cameraConfiguration = project?.settings?.cameraConfiguration || 1;
    if (cameraConfiguration === 1) {
      if (!disabledFields.has('cameraFile') && !takeData.cameraFile?.trim()) {
        errors.add('cameraFile');
        missingFields.push('Camera File');
      }
    } else {
      for (let i = 1; i <= cameraConfiguration; i++) {
        const fieldId = `cameraFile${i}`;
        const isRecActive = cameraRecState[fieldId] ?? true;
        // Only validate if field is not disabled AND REC is active
        if (!disabledFields.has(fieldId) && isRecActive && !takeData[fieldId]?.trim()) {
          errors.add(fieldId);
          missingFields.push(`Camera File ${i}`);
        }
      }
    }
    
    setValidationErrors(errors);
    
    if (missingFields.length > 0) {
      const fieldList = missingFields.join(', ');
      Toast.show({
        type: 'error',
        text1: 'Missing Required Fields',
        text2: `Please fill in: ${fieldList}`,
        position: 'top',
        visibilityTime: 4000,
      });
      return false;
    }
    
    return true;
  };

  const handleAddTake = () => {
    // Check if user can add more logs
    if (!canAddLog()) {
      Alert.alert(
        'Out of Free Logs',
        'You have used all your free trial logs. Purchase a token to get unlimited logs for a project.',
        [
          { text: 'OK', style: 'default' },
          {
            text: 'Buy Tokens',
            onPress: () => router.push('/store'),
          },
        ]
      );
      return;
    }
    
    // Validate mandatory fields first
    if (!validateMandatoryFields()) {
      return;
    }
    
    // Check for duplicate file numbers
    const duplicateFiles = checkForDuplicateFiles();
    if (duplicateFiles.length > 0) {
      const duplicateList = duplicateFiles.join(', ');
      Toast.show({
        type: 'error',
        text1: 'Duplicate File Numbers',
        text2: `${duplicateList} already exist in this project`,
        position: 'top',
        visibilityTime: 4000,
      });
      return;
    }
    
    // Check for duplicate takes
    const sceneNumber = takeData.sceneNumber;
    const shotNumber = takeData.shotNumber;
    const takeNumber = takeData.takeNumber;
    
    if (sceneNumber && shotNumber && takeNumber) {
      const existingTake = logSheets.find(sheet => 
        sheet.projectId === projectId &&
        sheet.data?.sceneNumber === sceneNumber &&
        sheet.data?.shotNumber === shotNumber &&
        sheet.data?.takeNumber === takeNumber
      );
      
      if (existingTake) {
        // Find position info for the duplicate message
        const sameTakes = logSheets.filter(sheet => 
          sheet.projectId === projectId &&
          sheet.data?.sceneNumber === sceneNumber &&
          sheet.data?.shotNumber === shotNumber
        ).sort((a, b) => parseInt(a.data?.takeNumber || '0') - parseInt(b.data?.takeNumber || '0'));
        
        const existingIndex = sameTakes.findIndex(take => take.id === existingTake.id);
        const positionText = existingIndex === 0 ? 'at the beginning' : 
                           existingIndex === sameTakes.length - 1 ? 'at the end' : 
                           `at position ${existingIndex + 1}`;
        
        Alert.alert(
          'Duplicate Take Detected',
          `Scene ${sceneNumber}, Shot ${shotNumber}, Take ${takeNumber} already exists.\n\nWhere would you like to add the new take?\n\nNote: Adding before will place it ${positionText}, and all subsequent takes will be renumbered.`,
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Add Before',
              onPress: () => addTakeWithPosition('before', existingTake.id),
            },
            {
              text: 'Add After',
              onPress: () => addTakeWithPosition('after', existingTake.id),
            },
          ]
        );
        return;
      }
    }
    
    // No duplicate, add normally
    addNewTake();
  };
  
  const addTakeWithPosition = (position: 'before' | 'after', existingTakeId: string) => {
    const existingTake = logSheets.find(sheet => sheet.id === existingTakeId);
    if (!existingTake) return;
    
    // Use trial log if no tokens available
    if (tokens === 0) {
      tokenStore.useTrial();
    }
    
    const sceneNumber = takeData.sceneNumber;
    const shotNumber = takeData.shotNumber;
    const takeNumber = parseInt(takeData.takeNumber || '1');
    
    if (position === 'before') {
      // Update all takes from this take number onwards
      updateTakeNumbers(projectId!, sceneNumber!, shotNumber!, takeNumber, 1);
      
      // Create new take with the original take number
      const logSheet = addLogSheet(
        `Take ${stats.totalTakes + 1}`,
        'take',
        '',
        projectId
      );
      
      // Ensure the new take has the correct take number (minimum 1)
      const newTakeNumber = Math.max(1, takeNumber);
      logSheet.data = {
        ...takeData,
        takeNumber: newTakeNumber.toString(),
        classification,
        shotDetails,
        isGoodTake
      };
    } else {
      // Add after - increment the take number by 1
      const newTakeNumber = takeNumber + 1;
      
      // Update all takes from the new take number onwards
      updateTakeNumbers(projectId!, sceneNumber!, shotNumber!, newTakeNumber, 1);
      
      // Create new take with the incremented take number
      const logSheet = addLogSheet(
        `Take ${stats.totalTakes + 1}`,
        'take',
        '',
        projectId
      );
      
      logSheet.data = {
        ...takeData,
        takeNumber: newTakeNumber.toString(),
        classification,
        shotDetails,
        isGoodTake
      };
    }
    
    router.back();
  };
  
  const addNewTake = () => {
    // Use trial log if no tokens available
    if (tokens === 0) {
      tokenStore.useTrial();
    }
    
    const logSheet = addLogSheet(
      `Take ${stats.totalTakes + 1}`,
      'take',
      '',
      projectId
    );
    
    // Prepare final take data with REC state considerations
    const finalTakeData = { ...takeData };
    
    // For multiple cameras, only include file data for cameras with active REC
    const cameraConfiguration = project?.settings?.cameraConfiguration || 1;
    if (cameraConfiguration > 1) {
      for (let i = 1; i <= cameraConfiguration; i++) {
        const fieldId = `cameraFile${i}`;
        const isRecActive = cameraRecState[fieldId] ?? true;
        
        if (!isRecActive) {
          // If REC is not active, don't record this camera file
          delete finalTakeData[fieldId];
        }
      }
    }
    
    // Update the log sheet with take data including new fields
    logSheet.data = {
      ...finalTakeData,
      classification,
      shotDetails,
      isGoodTake,
      cameraRecState: cameraConfiguration > 1 ? cameraRecState : undefined
    };
    
    router.back();
  };

  const getKeyboardType = (fieldId: string) => {
    if (fieldId === 'takeNumber') {
      return 'numeric';
    }
    return 'default';
  };

  const getNextFieldId = (currentFieldId: string, allFieldIds: string[]) => {
    const currentIndex = allFieldIds.indexOf(currentFieldId);
    if (currentIndex < allFieldIds.length - 1) {
      return allFieldIds[currentIndex + 1];
    }
    return null;
  };
  
  const focusNextField = (currentFieldId: string, allFieldIds: string[]) => {
    const nextFieldId = getNextFieldId(currentFieldId, allFieldIds);
    if (nextFieldId && inputRefs.current[nextFieldId]) {
      // Small delay to ensure smooth transition
      setTimeout(() => {
        inputRefs.current[nextFieldId]?.focus();
      }, 100);
    }
  };

  const getPlaceholderText = (fieldId: string, fieldLabel: string) => {
    // For camera and audio files, show "0001" as placeholder
    if (fieldId === 'soundFile' || fieldId.startsWith('cameraFile')) {
      return '0001';
    }
    return `Enter ${fieldLabel.toLowerCase()}`;
  };

  const toggleRangeMode = (fieldId: string) => {
    setShowRangeMode(prev => ({
      ...prev,
      [fieldId]: !prev[fieldId]
    }));
    
    if (!showRangeMode[fieldId]) {
      // Initialize range data when entering range mode
      const currentValue = takeData[fieldId] || '0001';
      setRangeData(prev => ({
        ...prev,
        [fieldId]: { from: currentValue, to: currentValue }
      }));
    } else {
      // When exiting range mode, set the single value to the 'from' value
      const range = rangeData[fieldId];
      if (range) {
        updateTakeData(fieldId, range.from);
      }
    }
  };

  const updateRangeData = (fieldId: string, type: 'from' | 'to', value: string) => {
    // Only allow numeric input, don't pad during typing
    const numericValue = value.replace(/[^0-9]/g, '');
    
    setRangeData(prev => ({
      ...prev,
      [fieldId]: {
        ...prev[fieldId],
        [type]: numericValue
      }
    }));
    
    // Update the main takeData with the range string for display
    const currentRange = rangeData[fieldId] || { from: '', to: '' };
    const updatedRange = { ...currentRange, [type]: numericValue };
    
    if (updatedRange.from && updatedRange.to) {
      updateTakeData(fieldId, `${updatedRange.from}-${updatedRange.to}`);
    } else if (updatedRange.from) {
      updateTakeData(fieldId, updatedRange.from);
    }
  };

  const formatFileNumber = (value: string) => {
    // Only allow numeric input
    const numericValue = value.replace(/[^0-9]/g, '');
    return numericValue;
  };

  const formatFileNumberOnBlur = (value: string) => {
    // Pad to 4 digits on blur
    const numericValue = value.replace(/[^0-9]/g, '');
    return numericValue ? String(parseInt(numericValue)).padStart(4, '0') : '';
  };

  const handleClassificationChange = (type: ClassificationType) => {
    const newClassification = classification === type ? null : type;
    setClassification(newClassification);
    
    // Reset shot details if incompatible
    if ((newClassification === 'Ambience' || newClassification === 'SFX') && shotDetails === 'MOS') {
      setShotDetails(null);
    }
    
    // Calculate new disabled fields based on the new classification
    const fieldsToDisable = new Set<string>();
    
    // Keep existing MOS disabled fields if MOS is still active
    if (shotDetails === 'MOS') {
      fieldsToDisable.add('soundFile');
    }
    
    if (newClassification === 'Waste') {
      setShowWasteModal(true);
      // Don't set disabled fields yet, wait for waste modal confirmation
      return;
    } else if (newClassification === 'SFX') {
      // For SFX: disable camera files and shot/take fields
      if (project?.settings?.cameraConfiguration === 1) {
        fieldsToDisable.add('cameraFile');
      } else {
        for (let i = 1; i <= (project?.settings?.cameraConfiguration || 1); i++) {
          fieldsToDisable.add(`cameraFile${i}`);
        }
      }
      
      // Disable shot and take fields
      fieldsToDisable.add('shotNumber');
      fieldsToDisable.add('takeNumber');
      
      setDisabledFields(fieldsToDisable);
      
      // Clear only the newly disabled field values, preserve others
      setTakeData(prev => {
        const newData = { ...prev };
        // Only clear camera and shot/take fields for SFX
        if (project?.settings?.cameraConfiguration === 1) {
          newData['cameraFile'] = '';
        } else {
          for (let i = 1; i <= (project?.settings?.cameraConfiguration || 1); i++) {
            newData[`cameraFile${i}`] = '';
          }
        }
        newData['shotNumber'] = '';
        newData['takeNumber'] = '';
        return newData;
      });
    } else if (newClassification === 'Ambience') {
      // For Ambience: disable camera files and shot/take fields
      if (project?.settings?.cameraConfiguration === 1) {
        fieldsToDisable.add('cameraFile');
      } else {
        for (let i = 1; i <= (project?.settings?.cameraConfiguration || 1); i++) {
          fieldsToDisable.add(`cameraFile${i}`);
        }
      }
      
      // Disable shot and take fields
      fieldsToDisable.add('shotNumber');
      fieldsToDisable.add('takeNumber');
      
      setDisabledFields(fieldsToDisable);
      
      // Clear only the newly disabled field values, preserve others
      setTakeData(prev => {
        const newData = { ...prev };
        // Only clear camera and shot/take fields for Ambience
        if (project?.settings?.cameraConfiguration === 1) {
          newData['cameraFile'] = '';
        } else {
          for (let i = 1; i <= (project?.settings?.cameraConfiguration || 1); i++) {
            newData[`cameraFile${i}`] = '';
          }
        }
        newData['shotNumber'] = '';
        newData['takeNumber'] = '';
        return newData;
      });
    } else if (newClassification === 'Insert') {
      setShowInsertModal(true);
      // Don't set disabled fields yet, wait for insert modal confirmation
      return;
    } else {
      // No classification selected - only keep MOS disabled fields if MOS is active
      setDisabledFields(fieldsToDisable);
    }
  };

  const handleWasteConfirm = () => {
    if (!wasteOptions.camera && !wasteOptions.sound) {
      Alert.alert('Selection Required', 'Please select at least one option to waste.');
      return;
    }
    
    const fieldsToDisable = new Set<string>();
    
    // Handle camera file waste - if NOT selected for waste, disable camera fields
    if (!wasteOptions.camera) {
      if (project?.settings?.cameraConfiguration === 1) {
        fieldsToDisable.add('cameraFile');
      } else {
        for (let i = 1; i <= (project?.settings?.cameraConfiguration || 1); i++) {
          fieldsToDisable.add(`cameraFile${i}`);
        }
      }
    }
    
    // Handle sound file waste - if NOT selected for waste, disable sound field
    if (!wasteOptions.sound) {
      fieldsToDisable.add('soundFile');
    }
    
    setDisabledFields(fieldsToDisable);
    
    // Clear disabled field values
    setTakeData(prev => {
      const newData = { ...prev };
      fieldsToDisable.forEach(fieldId => {
        newData[fieldId] = '';
      });
      return newData;
    });
    
    setShowWasteModal(false);
    setWasteOptions({ camera: false, sound: false });
  };

  const handleWasteCancel = () => {
    setShowWasteModal(false);
    setWasteOptions({ camera: false, sound: false });
    setClassification(null);
  };

  const handleInsertSoundSpeed = (hasSoundSpeed: boolean) => {
    if (!hasSoundSpeed) {
      // If no sound speed, disable sound file
      const fieldsToDisable = new Set<string>(['soundFile']);
      setDisabledFields(fieldsToDisable);
      
      // Clear sound file value
      setTakeData(prev => ({
        ...prev,
        soundFile: ''
      }));
    }
    
    setShowInsertModal(false);
  };

  const handleInsertCancel = () => {
    setShowInsertModal(false);
    setClassification(null);
  };

  const toggleCameraRec = (fieldId: string) => {
    setCameraRecState(prev => ({
      ...prev,
      [fieldId]: !prev[fieldId]
    }));
  };

  const handleShotDetailsChange = (type: ShotDetailsType) => {
    const newShotDetails = shotDetails === type ? null : type;
    
    if (type === 'MOS') {
      // Check if MOS should be disabled
      if (classification === 'Ambience' || classification === 'SFX') {
        return; // Don't allow MOS selection
      }
      
      if (newShotDetails === 'MOS') {
        // Disable sound file for MOS
        const currentDisabled = new Set(disabledFields);
        currentDisabled.add('soundFile');
        setDisabledFields(currentDisabled);
        
        // Clear sound file value
        setTakeData(prev => ({
          ...prev,
          soundFile: ''
        }));
      } else {
        // Re-enable sound file when MOS is deselected (unless disabled by other reasons)
        const currentDisabled = new Set(disabledFields);
        
        // Only remove soundFile from disabled if it's not disabled by classification
        if (classification !== 'Waste' || wasteOptions.sound) {
          currentDisabled.delete('soundFile');
        }
        
        setDisabledFields(currentDisabled);
      }
    }
    
    setShotDetails(newShotDetails);
  };

  const renderField = (field: any, allFieldIds: string[], style?: any) => {
    const value = takeData[field.id] || '';
    const isMultiline = field.id === 'notesForTake' || field.id === 'descriptionOfShot';
    const isDisabled = disabledFields.has(field.id);
    const hasError = validationErrors.has(field.id);
    const isMandatory = ['sceneNumber', 'shotNumber', 'soundFile', 'cameraFile'].includes(field.id) || field.id.startsWith('cameraFile');
    
    return (
      <View key={field.id} style={[styles.fieldContainer, style]}>
        <Text style={[styles.fieldLabel, isDisabled && styles.disabledLabel, hasError && styles.errorLabel]}>
          {field.label}{isMandatory && !isDisabled && <Text style={styles.asterisk}> *</Text>}
        </Text>
        <TextInput
          ref={(ref) => { inputRefs.current[field.id] = ref; }}
          style={[
            styles.fieldInput,
            isMultiline && styles.multilineInput,
            isDisabled && styles.disabledInput,
            hasError && styles.errorInput
          ]}
          value={isDisabled ? '' : value}
          onChangeText={(text) => {
            if (!isDisabled) {
              updateTakeData(field.id, text);
              // Clear validation error when user starts typing
              if (validationErrors.has(field.id)) {
                setValidationErrors(prev => {
                  const newErrors = new Set(prev);
                  newErrors.delete(field.id);
                  return newErrors;
                });
              }
            }
          }}
          placeholder={isDisabled ? '' : getPlaceholderText(field.id, field.label)}
          placeholderTextColor={isDisabled ? colors.disabled : colors.subtext}
          multiline={isMultiline}
          numberOfLines={isMultiline ? 3 : 1}
          keyboardType={getKeyboardType(field.id)}
          returnKeyType={isMultiline ? 'default' : 'next'}
          editable={!isDisabled}
          onSubmitEditing={() => {
            if (!isMultiline && !isDisabled) {
              focusNextField(field.id, allFieldIds);
            }
          }}
          onFocus={(event) => {
            if (!isDisabled) {
              // Scroll to make the field visible when focused
              setTimeout(() => {
                const target = event.target as any;
                target?.measure?.((x: number, y: number, width: number, height: number, pageX: number, pageY: number) => {
                  const scrollY = Math.max(0, pageY - 100);
                  scrollViewRef.current?.scrollTo({ y: scrollY, animated: true });
                });
              }, 100);
            }
          }}
          blurOnSubmit={isMultiline}
        />
      </View>
    );
  };

  if (!project) {
    return null;
  }

  const enabledFields = project.settings?.logSheetFields || [];
  const customFields = project.settings?.customFields || [];
  const cameraConfiguration = project.settings?.cameraConfiguration || 1;

  // Filter out camera file field since we handle it separately, and notes field to put it last
  const fieldsToRender = enabledFields.filter(field => field.id !== 'cameraFile' && field.id !== 'notesForTake');
  const notesField = enabledFields.find(field => field.id === 'notesForTake');
  
  // Build ordered field list for proper keyboard navigation sequence
  const allFieldIds: string[] = [];
  
  // Add core fields in specific order: scene, shot, take, camera, sound
  const coreFieldOrder = ['episodeNumber', 'sceneNumber', 'shotNumber', 'takeNumber'];
  coreFieldOrder.forEach(fieldId => {
    if (enabledFields.find(f => f.id === fieldId)) {
      allFieldIds.push(fieldId);
    }
  });
  
  // Add camera fields
  for (let i = 1; i <= cameraConfiguration; i++) {
    const fieldId = cameraConfiguration === 1 ? 'cameraFile' : `cameraFile${i}`;
    allFieldIds.push(fieldId);
  }
  
  // Add sound file
  if (enabledFields.find(f => f.id === 'soundFile')) {
    allFieldIds.push('soundFile');
  }
  
  // Add other fields (excluding core fields, camera, sound, and notes)
  fieldsToRender
    .filter(field => !coreFieldOrder.includes(field.id) && field.id !== 'soundFile')
    .forEach(field => allFieldIds.push(field.id));
  
  // Add custom fields
  customFields.forEach((_, index) => {
    allFieldIds.push(`custom_${index}`);
  });
  
  // Add notes field last
  if (notesField) {
    allFieldIds.push('notesForTake');
  }

  return (
    <KeyboardAvoidingView 
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      <Stack.Screen 
        options={{
          title: "New Log",
          headerLeft: () => <HeaderLeft />,
          headerBackVisible: false,
          headerTitleAlign: 'center',
        }} 
      />
      
      <ScrollView 
        ref={scrollViewRef}
        style={styles.content} 
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[styles.scrollContent, { paddingBottom: keyboardHeight > 0 ? keyboardHeight + 20 : 20 }]}
      >
        <View style={styles.formContainer}>
          {/* Scene, Shot, Take on same row */}
          <View style={styles.topRowContainer}>
            {enabledFields.find(f => f.id === 'sceneNumber') && (
              <View style={styles.topFieldContainer}>
                <Text style={[styles.topFieldLabel, validationErrors.has('sceneNumber') && styles.errorLabel]}>
                  Scene<Text style={styles.asterisk}> *</Text>
                </Text>
                <TextInput
                  ref={(ref) => { inputRefs.current['sceneNumber'] = ref; }}
                  style={[
                    styles.topFieldInput,
                    validationErrors.has('sceneNumber') && styles.errorInput
                  ]}
                  value={takeData.sceneNumber || ''}
                  onChangeText={(text) => {
                    updateTakeData('sceneNumber', text);
                    if (validationErrors.has('sceneNumber')) {
                      setValidationErrors(prev => {
                        const newErrors = new Set(prev);
                        newErrors.delete('sceneNumber');
                        return newErrors;
                      });
                    }
                  }}
                  placeholder=""
                  placeholderTextColor={colors.subtext}
                  returnKeyType="next"
                  onSubmitEditing={() => focusNextField('sceneNumber', allFieldIds)}
                  onFocus={(event) => {
                    setTimeout(() => {
                      const target = event.target as any;
                      target?.measure?.((x: number, y: number, width: number, height: number, pageX: number, pageY: number) => {
                        const scrollY = Math.max(0, pageY - 100);
                        scrollViewRef.current?.scrollTo({ y: scrollY, animated: true });
                      });
                    }, 100);
                  }}
                />
              </View>
            )}
            {enabledFields.find(f => f.id === 'shotNumber') && (
              <View style={styles.topFieldContainer}>
                <Text style={[styles.topFieldLabel, validationErrors.has('shotNumber') && styles.errorLabel]}>
                  Shot<Text style={styles.asterisk}> *</Text>
                </Text>
                <TextInput
                  ref={(ref) => { inputRefs.current['shotNumber'] = ref; }}
                  style={[
                    styles.topFieldInput,
                    validationErrors.has('shotNumber') && styles.errorInput
                  ]}
                  value={takeData.shotNumber || ''}
                  onChangeText={(text) => {
                    updateTakeData('shotNumber', text);
                    if (validationErrors.has('shotNumber')) {
                      setValidationErrors(prev => {
                        const newErrors = new Set(prev);
                        newErrors.delete('shotNumber');
                        return newErrors;
                      });
                    }
                  }}
                  placeholder=""
                  placeholderTextColor={colors.subtext}
                  returnKeyType="next"
                  onSubmitEditing={() => focusNextField('shotNumber', allFieldIds)}
                  onFocus={(event) => {
                    setTimeout(() => {
                      const target = event.target as any;
                      target?.measure?.((x: number, y: number, width: number, height: number, pageX: number, pageY: number) => {
                        const scrollY = Math.max(0, pageY - 100);
                        scrollViewRef.current?.scrollTo({ y: scrollY, animated: true });
                      });
                    }, 100);
                  }}
                />
              </View>
            )}
            {enabledFields.find(f => f.id === 'takeNumber') && (
              <View style={styles.topFieldContainer}>
                <Text style={[styles.topFieldLabel, validationErrors.has('takeNumber') && styles.errorLabel]}>
                  Take<Text style={styles.asterisk}> *</Text>
                </Text>
                <TextInput
                  ref={(ref) => { inputRefs.current['takeNumber'] = ref; }}
                  style={[
                    styles.topFieldInput,
                    validationErrors.has('takeNumber') && styles.errorInput
                  ]}
                  value={takeData.takeNumber || ''}
                  onChangeText={(text) => {
                    updateTakeData('takeNumber', text);
                    if (validationErrors.has('takeNumber')) {
                      setValidationErrors(prev => {
                        const newErrors = new Set(prev);
                        newErrors.delete('takeNumber');
                        return newErrors;
                      });
                    }
                  }}
                  placeholder=""
                  placeholderTextColor={colors.subtext}
                  keyboardType="numeric"
                  returnKeyType="next"
                  onSubmitEditing={() => focusNextField('takeNumber', allFieldIds)}
                  onFocus={(event) => {
                    setTimeout(() => {
                      const target = event.target as any;
                      target?.measure?.((x: number, y: number, width: number, height: number, pageX: number, pageY: number) => {
                        const scrollY = Math.max(0, pageY - 100);
                        scrollViewRef.current?.scrollTo({ y: scrollY, animated: true });
                      });
                    }, 100);
                  }}
                />
              </View>
            )}
          </View>
          
          {/* Camera file */}
          {cameraConfiguration === 1 && (
            <View style={styles.fieldContainer}>
              <View style={styles.fieldHeaderRow}>
                <Text style={[
                  styles.fieldLabel, 
                  disabledFields.has('cameraFile') && styles.disabledLabel,
                  validationErrors.has('cameraFile') && styles.errorLabel
                ]}>
                  Camera File{!disabledFields.has('cameraFile') && <Text style={styles.asterisk}> *</Text>}
                </Text>
                <TouchableOpacity 
                  style={[styles.rangeButton, disabledFields.has('cameraFile') && styles.disabledButton]}
                  onPress={() => !disabledFields.has('cameraFile') && toggleRangeMode('cameraFile')}
                  disabled={disabledFields.has('cameraFile')}
                >
                  <Text style={[styles.rangeButtonText, disabledFields.has('cameraFile') && styles.disabledText]}>Range</Text>
                </TouchableOpacity>
              </View>
              {showRangeMode['cameraFile'] && !disabledFields.has('cameraFile') ? (
                <View style={styles.rangeContainer}>
                  <TextInput
                    style={[styles.fieldInput, styles.rangeInput]}
                    value={rangeData['cameraFile']?.from || ''}
                    onChangeText={(text) => updateRangeData('cameraFile', 'from', text)}
                    onBlur={() => {
                      const currentRange = rangeData['cameraFile'];
                      if (currentRange?.from) {
                        const formatted = formatFileNumberOnBlur(currentRange.from);
                        updateRangeData('cameraFile', 'from', formatted);
                      }
                    }}
                    placeholder="From"
                    placeholderTextColor={colors.subtext}
                    keyboardType="numeric"
                    maxLength={4}
                  />
                  <Text style={styles.rangeSeparator}>-</Text>
                  <TextInput
                    style={[styles.fieldInput, styles.rangeInput]}
                    value={rangeData['cameraFile']?.to || ''}
                    onChangeText={(text) => updateRangeData('cameraFile', 'to', text)}
                    onBlur={() => {
                      const currentRange = rangeData['cameraFile'];
                      if (currentRange?.to) {
                        const formatted = formatFileNumberOnBlur(currentRange.to);
                        updateRangeData('cameraFile', 'to', formatted);
                      }
                    }}
                    placeholder="To"
                    placeholderTextColor={colors.subtext}
                    keyboardType="numeric"
                    maxLength={4}
                  />
                </View>
              ) : (
                <TextInput
                  ref={(ref) => { inputRefs.current['cameraFile'] = ref; }}
                  style={[
                    styles.fieldInput, 
                    disabledFields.has('cameraFile') && styles.disabledInput,
                    validationErrors.has('cameraFile') && styles.errorInput
                  ]}
                  value={disabledFields.has('cameraFile') ? '' : (takeData['cameraFile'] || '')}
                  onChangeText={(text) => {
                    if (!disabledFields.has('cameraFile')) {
                      updateTakeData('cameraFile', formatFileNumber(text));
                      if (validationErrors.has('cameraFile')) {
                        setValidationErrors(prev => {
                          const newErrors = new Set(prev);
                          newErrors.delete('cameraFile');
                          return newErrors;
                        });
                      }
                    }
                  }}
                  onBlur={() => {
                    if (!disabledFields.has('cameraFile') && takeData['cameraFile']) {
                      const formatted = formatFileNumberOnBlur(takeData['cameraFile']);
                      updateTakeData('cameraFile', formatted);
                    }
                  }}
                  placeholder={disabledFields.has('cameraFile') ? '' : getPlaceholderText('cameraFile', 'Camera file')}
                  placeholderTextColor={disabledFields.has('cameraFile') ? colors.disabled : colors.subtext}
                  keyboardType="numeric"
                  maxLength={4}
                  returnKeyType="next"
                  editable={!disabledFields.has('cameraFile')}
                  onSubmitEditing={() => {
                    if (!disabledFields.has('cameraFile')) {
                      focusNextField('cameraFile', allFieldIds);
                    }
                  }}
                  onFocus={(event) => {
                    if (!disabledFields.has('cameraFile')) {
                      setTimeout(() => {
                        const target = event.target as any;
                        target?.measure?.((x: number, y: number, width: number, height: number, pageX: number, pageY: number) => {
                          const scrollY = Math.max(0, pageY - 100);
                          scrollViewRef.current?.scrollTo({ y: scrollY, animated: true });
                        });
                      }, 100);
                    }
                  }}
                />
              )}
            </View>
          )}
          
          {/* Sound file */}
          {enabledFields.find(f => f.id === 'soundFile') && (
            <View style={styles.fieldContainer}>
              <View style={styles.fieldHeaderRow}>
                <Text style={[
                  styles.fieldLabel, 
                  disabledFields.has('soundFile') && styles.disabledLabel,
                  validationErrors.has('soundFile') && styles.errorLabel
                ]}>
                  Sound File{!disabledFields.has('soundFile') && <Text style={styles.asterisk}> *</Text>}
                </Text>
                <TouchableOpacity 
                  style={[styles.rangeButton, disabledFields.has('soundFile') && styles.disabledButton]}
                  onPress={() => !disabledFields.has('soundFile') && toggleRangeMode('soundFile')}
                  disabled={disabledFields.has('soundFile')}
                >
                  <Text style={[styles.rangeButtonText, disabledFields.has('soundFile') && styles.disabledText]}>Range</Text>
                </TouchableOpacity>
              </View>
              {showRangeMode['soundFile'] && !disabledFields.has('soundFile') ? (
                <View style={styles.rangeContainer}>
                  <TextInput
                    style={[styles.fieldInput, styles.rangeInput]}
                    value={rangeData['soundFile']?.from || ''}
                    onChangeText={(text) => updateRangeData('soundFile', 'from', text)}
                    onBlur={() => {
                      const currentRange = rangeData['soundFile'];
                      if (currentRange?.from) {
                        const formatted = formatFileNumberOnBlur(currentRange.from);
                        updateRangeData('soundFile', 'from', formatted);
                      }
                    }}
                    placeholder="From"
                    placeholderTextColor={colors.subtext}
                    keyboardType="numeric"
                    maxLength={4}
                  />
                  <Text style={styles.rangeSeparator}>-</Text>
                  <TextInput
                    style={[styles.fieldInput, styles.rangeInput]}
                    value={rangeData['soundFile']?.to || ''}
                    onChangeText={(text) => updateRangeData('soundFile', 'to', text)}
                    onBlur={() => {
                      const currentRange = rangeData['soundFile'];
                      if (currentRange?.to) {
                        const formatted = formatFileNumberOnBlur(currentRange.to);
                        updateRangeData('soundFile', 'to', formatted);
                      }
                    }}
                    placeholder="To"
                    placeholderTextColor={colors.subtext}
                    keyboardType="numeric"
                    maxLength={4}
                  />
                </View>
              ) : (
                <TextInput
                  ref={(ref) => { inputRefs.current['soundFile'] = ref; }}
                  style={[
                    styles.fieldInput, 
                    disabledFields.has('soundFile') && styles.disabledInput,
                    validationErrors.has('soundFile') && styles.errorInput
                  ]}
                  value={disabledFields.has('soundFile') ? '' : (takeData['soundFile'] || '')}
                  onChangeText={(text) => {
                    if (!disabledFields.has('soundFile')) {
                      updateTakeData('soundFile', formatFileNumber(text));
                      if (validationErrors.has('soundFile')) {
                        setValidationErrors(prev => {
                          const newErrors = new Set(prev);
                          newErrors.delete('soundFile');
                          return newErrors;
                        });
                      }
                    }
                  }}
                  onBlur={() => {
                    if (!disabledFields.has('soundFile') && takeData['soundFile']) {
                      const formatted = formatFileNumberOnBlur(takeData['soundFile']);
                      updateTakeData('soundFile', formatted);
                    }
                  }}
                  placeholder={disabledFields.has('soundFile') ? '' : getPlaceholderText('soundFile', 'Sound file')}
                  placeholderTextColor={disabledFields.has('soundFile') ? colors.disabled : colors.subtext}
                  keyboardType="numeric"
                  maxLength={4}
                  returnKeyType="next"
                  editable={!disabledFields.has('soundFile')}
                  onSubmitEditing={() => {
                    if (!disabledFields.has('soundFile')) {
                      focusNextField('soundFile', allFieldIds);
                    }
                  }}
                  onFocus={(event) => {
                    if (!disabledFields.has('soundFile')) {
                      setTimeout(() => {
                        const target = event.target as any;
                        target?.measure?.((x: number, y: number, width: number, height: number, pageX: number, pageY: number) => {
                          const scrollY = Math.max(0, pageY - 100);
                          scrollViewRef.current?.scrollTo({ y: scrollY, animated: true });
                        });
                      }, 100);
                    }
                  }}
                />
              )}
            </View>
          )}
          
          {/* Additional camera fields if more than 1 camera - each on its own row */}
          {cameraConfiguration > 1 && (
            <View style={styles.additionalCameraFields}>
              {Array.from({ length: cameraConfiguration }, (_, i) => {
                const fieldId = `cameraFile${i + 1}`;
                const fieldLabel = `Camera file ${i + 1}`;
                const isDisabled = disabledFields.has(fieldId);
                return (
                  <View key={fieldId} style={styles.fieldContainer}>
                    <View style={styles.fieldHeaderRow}>
                      <Text style={[
                        styles.fieldLabel, 
                        isDisabled && styles.disabledLabel,
                        validationErrors.has(fieldId) && styles.errorLabel
                      ]}>
                        {fieldLabel}{!isDisabled && <Text style={styles.asterisk}> *</Text>}
                      </Text>
                      <View style={styles.buttonGroup}>
                        <TouchableOpacity 
                          style={[styles.rangeButton, isDisabled && styles.disabledButton]}
                          onPress={() => !isDisabled && toggleRangeMode(fieldId)}
                          disabled={isDisabled}
                        >
                          <Text style={[styles.rangeButtonText, isDisabled && styles.disabledText]}>Range</Text>
                        </TouchableOpacity>
                        <TouchableOpacity 
                          style={[
                            styles.recButton, 
                            (cameraRecState[fieldId] ?? true) ? styles.recButtonActive : styles.recButtonInactive,
                            isDisabled && styles.disabledButton
                          ]}
                          onPress={() => !isDisabled && toggleCameraRec(fieldId)}
                          disabled={isDisabled}
                        >
                          <Text style={[
                            styles.recButtonText, 
                            (cameraRecState[fieldId] ?? true) ? styles.recButtonTextActive : styles.recButtonTextInactive,
                            isDisabled && styles.disabledText
                          ]}>REC</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                    {showRangeMode[fieldId] && !isDisabled ? (
                      <View style={styles.rangeContainer}>
                        <TextInput
                          style={[styles.fieldInput, styles.rangeInput]}
                          value={rangeData[fieldId]?.from || ''}
                          onChangeText={(text) => updateRangeData(fieldId, 'from', text)}
                          onBlur={() => {
                            const currentRange = rangeData[fieldId];
                            if (currentRange?.from) {
                              const formatted = formatFileNumberOnBlur(currentRange.from);
                              updateRangeData(fieldId, 'from', formatted);
                            }
                          }}
                          placeholder="From"
                          placeholderTextColor={colors.subtext}
                          keyboardType="numeric"
                          maxLength={4}
                        />
                        <Text style={styles.rangeSeparator}>-</Text>
                        <TextInput
                          style={[styles.fieldInput, styles.rangeInput]}
                          value={rangeData[fieldId]?.to || ''}
                          onChangeText={(text) => updateRangeData(fieldId, 'to', text)}
                          onBlur={() => {
                            const currentRange = rangeData[fieldId];
                            if (currentRange?.to) {
                              const formatted = formatFileNumberOnBlur(currentRange.to);
                              updateRangeData(fieldId, 'to', formatted);
                            }
                          }}
                          placeholder="To"
                          placeholderTextColor={colors.subtext}
                          keyboardType="numeric"
                          maxLength={4}
                        />
                      </View>
                    ) : (
                      <TextInput
                        ref={(ref) => { inputRefs.current[fieldId] = ref; }}
                        style={[
                          styles.fieldInput, 
                          isDisabled && styles.disabledInput,
                          validationErrors.has(fieldId) && styles.errorInput
                        ]}
                        value={isDisabled ? '' : (takeData[fieldId] || '')}
                        onChangeText={(text) => {
                          if (!isDisabled) {
                            updateTakeData(fieldId, formatFileNumber(text));
                            if (validationErrors.has(fieldId)) {
                              setValidationErrors(prev => {
                                const newErrors = new Set(prev);
                                newErrors.delete(fieldId);
                                return newErrors;
                              });
                            }
                          }
                        }}
                        onBlur={() => {
                          if (!isDisabled && takeData[fieldId]) {
                            const formatted = formatFileNumberOnBlur(takeData[fieldId]);
                            updateTakeData(fieldId, formatted);
                          }
                        }}
                        placeholder={isDisabled ? '' : getPlaceholderText(fieldId, fieldLabel)}
                        placeholderTextColor={isDisabled ? colors.disabled : colors.subtext}
                        keyboardType="numeric"
                        maxLength={4}
                        returnKeyType="next"
                        editable={!isDisabled}
                        onSubmitEditing={() => {
                          if (!isDisabled) {
                            focusNextField(fieldId, allFieldIds);
                          }
                        }}
                        onFocus={(event) => {
                          if (!isDisabled) {
                            setTimeout(() => {
                              const target = event.target as any;
                              target?.measure?.((x: number, y: number, width: number, height: number, pageX: number, pageY: number) => {
                                const scrollY = Math.max(0, pageY - 100);
                                scrollViewRef.current?.scrollTo({ y: scrollY, animated: true });
                              });
                            }, 100);
                          }
                        }}
                      />
                    )}
                  </View>
                );
              })}
            </View>
          )}
          
          {/* Take Description */}
          <View style={styles.fieldContainer}>
            <Text style={styles.fieldLabel}>Take Description</Text>
            <TextInput
              ref={(ref) => { inputRefs.current['descriptionOfShot'] = ref; }}
              style={[styles.fieldInput, styles.multilineInput]}
              value={takeData.descriptionOfShot || ''}
              onChangeText={(text) => updateTakeData('descriptionOfShot', text)}
              placeholder=""
              placeholderTextColor={colors.subtext}
              multiline={true}
              numberOfLines={4}
              textAlignVertical="top"
            />
          </View>

          {/* Notes */}
          {notesField && (
            <View style={styles.fieldContainer}>
              <Text style={styles.fieldLabel}>Notes</Text>
              <TextInput
                ref={(ref) => { inputRefs.current['notesForTake'] = ref; }}
                style={[styles.fieldInput, styles.multilineInput]}
                value={takeData.notesForTake || ''}
                onChangeText={(text) => updateTakeData('notesForTake', text)}
                placeholder=""
                placeholderTextColor={colors.subtext}
                multiline={true}
                numberOfLines={4}
                textAlignVertical="top"
              />
            </View>
          )}
        </View>

        {/* Classification Section */}
        <View style={styles.sectionContainer}>
          <Text style={styles.sectionTitle}>Classification</Text>
          <View style={styles.classificationRow}>
            {(['Waste', 'Insert', 'Ambience', 'SFX'] as ClassificationType[]).map((type) => (
              <TouchableOpacity
                key={type}
                style={[
                  styles.classificationTab,
                  classification === type && styles.classificationTabActive
                ]}
                onPress={() => handleClassificationChange(type)}
              >
                <Text style={[
                  styles.classificationTabText,
                  classification === type && styles.classificationTabTextActive
                ]}>
                  {type}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Shot Details Section */}
        <View style={[styles.sectionContainer, styles.shotDetailsSection]}>
          <Text style={styles.sectionTitle}>Shot Details</Text>
          <View style={styles.shotDetailsRow}>
            {(['MOS', 'NO SLATE'] as ShotDetailsType[]).map((type) => {
              const isDisabled = type === 'MOS' && (classification === 'Ambience' || classification === 'SFX');
              return (
                <TouchableOpacity
                  key={type}
                  style={[
                    styles.shotDetailsButton,
                    shotDetails === type && styles.shotDetailsButtonActive,
                    isDisabled && styles.shotDetailsButtonDisabled
                  ]}
                  onPress={() => !isDisabled && handleShotDetailsChange(type)}
                  disabled={isDisabled}
                >
                  <Text style={[
                    styles.shotDetailsButtonText,
                    shotDetails === type && styles.shotDetailsButtonTextActive,
                    isDisabled && styles.shotDetailsButtonTextDisabled
                  ]}>
                    {type === 'NO SLATE' ? 'No Slate' : type}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        <View style={styles.addTakeSection}>
          <View style={styles.goodTakeRow}>
            <Text style={styles.goodTakeLabel}>Good Take</Text>
            <Switch
              testID="good-take-switch"
              value={isGoodTake}
              onValueChange={setIsGoodTake}
              trackColor={{ false: '#e5e7eb', true: '#BDDFEB' }}
              thumbColor={Platform.OS === 'android' ? (isGoodTake ? '#60a5fa' : '#f4f3f4') : undefined}
            />
          </View>
          <TouchableOpacity
            testID="add-record-button"
            style={styles.addRecordButton}
            onPress={handleAddTake}
            activeOpacity={0.8}
          >
            <Text style={styles.addRecordText}>Add Record</Text>
          </TouchableOpacity>
        </View>


      </ScrollView>
      
      {/* Waste Modal */}
      <Modal
        visible={showWasteModal}
        transparent={true}
        animationType="fade"
        onRequestClose={handleWasteCancel}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Waste Options</Text>
              <TouchableOpacity onPress={handleWasteCancel} style={styles.modalCloseButton}>
                <X size={24} color={colors.text} />
              </TouchableOpacity>
            </View>
            
            <Text style={styles.modalDescription}>
              Select which files you want to waste:
            </Text>
            
            <View style={styles.checkboxContainer}>
              <TouchableOpacity
                style={styles.checkboxRow}
                onPress={() => setWasteOptions(prev => ({ ...prev, camera: !prev.camera }))}
              >
                <View style={[styles.checkbox, wasteOptions.camera && styles.checkboxChecked]}>
                  {wasteOptions.camera && <Check size={16} color="white" />}
                </View>
                <Text style={styles.checkboxLabel}>Camera file waste</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={styles.checkboxRow}
                onPress={() => setWasteOptions(prev => ({ ...prev, sound: !prev.sound }))}
              >
                <View style={[styles.checkbox, wasteOptions.sound && styles.checkboxChecked]}>
                  {wasteOptions.sound && <Check size={16} color="white" />}
                </View>
                <Text style={styles.checkboxLabel}>Sound file waste</Text>
              </TouchableOpacity>
            </View>
            
            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.modalCancelButton} onPress={handleWasteCancel}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalConfirmButton} onPress={handleWasteConfirm}>
                <Text style={styles.modalConfirmText}>Confirm</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Insert Modal */}
      <Modal
        visible={showInsertModal}
        transparent={true}
        animationType="fade"
        onRequestClose={handleInsertCancel}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Insert Shot</Text>
              <TouchableOpacity onPress={handleInsertCancel} style={styles.modalCloseButton}>
                <X size={24} color={colors.text} />
              </TouchableOpacity>
            </View>
            
            <Text style={styles.modalDescription}>
              Did sound speed in this shot?
            </Text>
            
            <View style={styles.modalButtons}>
              <TouchableOpacity 
                style={styles.modalCancelButton} 
                onPress={() => handleInsertSoundSpeed(false)}
              >
                <Text style={styles.modalCancelText}>No</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.modalConfirmButton} 
                onPress={() => handleInsertSoundSpeed(true)}
              >
                <Text style={styles.modalConfirmText}>Yes</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
      
      <Toast />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'white',
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    padding: 16,
  },
  headerButton: {
    padding: 8,
    marginHorizontal: 8,
  },
  formContainer: {
    backgroundColor: 'transparent',
    margin: 0,
    borderRadius: 0,
    padding: 0,
    shadowColor: 'transparent',
    shadowOffset: {
      width: 0,
      height: 0,
    },
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
  },
  topRowContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  topFieldContainer: {
    flex: 1,
  },
  topFieldLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#666',
    marginBottom: 8,
  },
  topFieldInput: {
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    color: colors.text,
    backgroundColor: 'white',
    height: 48,
  },
  fieldContainer: {
    marginBottom: 24,
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#666',
    marginBottom: 8,
  },
  fieldInput: {
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    color: colors.text,
    backgroundColor: 'white',
    minHeight: 48,
  },
  multilineInput: {
    height: 100,
    textAlignVertical: 'top',
    paddingTop: 12,
  },
  addTakeSection: {
    backgroundColor: 'transparent',
    margin: 0,
    borderRadius: 0,
    padding: 0,
    shadowColor: 'transparent',
    shadowOffset: {
      width: 0,
      height: 0,
    },
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
  },
  addTakeButton: {
    backgroundColor: '#2c3e50',
    flex: 1,
    height: 48,
  },
  goodTakeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
    paddingVertical: 8,
    marginBottom: 16,
  },
  goodTakeLabel: {
    fontSize: 16,
    color: colors.text,
    fontWeight: '500',
  },
  addRecordButton: {
    backgroundColor: '#BDDFEB',
    height: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  addRecordText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0b0b0b',
  },

  rowContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  thirdWidth: {
    flex: 1,
    marginBottom: 0,
  },
  halfWidth: {
    flex: 1,
    marginBottom: 0,
  },
  additionalCameraFields: {
    marginBottom: 20,
  },
  sectionContainer: {
    backgroundColor: 'transparent',
    margin: 0,
    borderRadius: 0,
    padding: 0,
    shadowColor: 'transparent',
    shadowOffset: {
      width: 0,
      height: 0,
    },
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 16,
  },
  buttonRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  toggleButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: 'white',
    minWidth: 80,
    alignItems: 'center',
  },
  toggleButtonActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  toggleButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.text,
  },
  toggleButtonTextActive: {
    color: 'white',
  },
  addTakeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  goodTakeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.success,
    backgroundColor: 'white',
    gap: 8,
    height: 48,
  },
  goodTakeButtonActive: {
    backgroundColor: colors.success,
  },
  goodTakeButtonText: {
    fontSize: 16,
    fontWeight: '500',
    color: colors.success,
  },
  goodTakeButtonTextActive: {
    color: 'white',
  },
  fieldHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  rangeButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    backgroundColor: '#f8f8f8',
  },
  rangeButtonText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#007AFF',
  },
  disabledText: {
    color: colors.disabled,
  },
  rangeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  rangeInput: {
    flex: 1,
    textAlign: 'center',
  },
  rangeSeparator: {
    fontSize: 16,
    fontWeight: '500',
    color: colors.text,
  },
  disabledInput: {
    backgroundColor: '#f5f5f5',
    color: colors.disabled,
    borderColor: colors.disabled,
  },
  disabledLabel: {
    color: colors.disabled,
  },
  errorLabel: {
    color: colors.error,
  },
  errorInput: {
    borderColor: colors.error,
    borderWidth: 2,
  },
  asterisk: {
    color: colors.error,
    fontSize: 16,
    fontWeight: 'bold',
  },
  disabledButton: {
    opacity: 0.5,
  },
  buttonGroup: {
    flexDirection: 'row',
    gap: 8,
  },
  recButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderRadius: 6,
    minWidth: 50,
    alignItems: 'center',
  },
  recButtonActive: {
    backgroundColor: '#DC2626',
    borderColor: '#DC2626',
  },
  recButtonInactive: {
    backgroundColor: '#9CA3AF',
    borderColor: '#9CA3AF',
  },
  recButtonText: {
    fontSize: 12,
    fontWeight: '600',
  },
  recButtonTextActive: {
    color: 'white',
  },
  recButtonTextInactive: {
    color: 'white',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 24,
    margin: 20,
    minWidth: 300,
    maxWidth: 400,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
  },
  modalCloseButton: {
    padding: 4,
  },
  modalDescription: {
    fontSize: 16,
    color: colors.text,
    marginBottom: 20,
  },
  checkboxContainer: {
    marginBottom: 24,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: 4,
    marginRight: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxChecked: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  checkboxLabel: {
    fontSize: 16,
    color: colors.text,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  modalCancelButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  modalConfirmButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    backgroundColor: colors.primary,
    alignItems: 'center',
  },
  modalCancelText: {
    fontSize: 16,
    fontWeight: '500',
    color: colors.text,
  },
  modalConfirmText: {
    fontSize: 16,
    fontWeight: '500',
    color: 'white',
  },
  toggleButtonDisabled: {
    opacity: 0.5,
    backgroundColor: '#f5f5f5',
  },
  toggleButtonTextDisabled: {
    color: colors.disabled,
  },
  classificationRow: {
    flexDirection: 'row',
    gap: 8,
  },
  classificationTab: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    height: 44,
  },
  classificationTabActive: {
    backgroundColor: '#BDDFEB',
    borderColor: '#BDDFEB',
  },
  classificationTabText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#666',
  },
  classificationTabTextActive: {
    color: '#333',
    fontWeight: '600',
  },
  shotDetailsSection: {
    marginTop: 16,
  },
  shotDetailsRow: {
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'center',
  },
  shotDetailsButton: {
    flex: 1,
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    backgroundColor: '#f8f8f8',
    alignItems: 'center',
    justifyContent: 'center',
    height: 48,
  },
  shotDetailsButtonActive: {
    backgroundColor: '#BDDFEB',
    borderColor: '#BDDFEB',
  },
  shotDetailsButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#666',
  },
  shotDetailsButtonTextActive: {
    color: 'white',
  },
  shotDetailsButtonDisabled: {
    opacity: 0.5,
    backgroundColor: '#f5f5f5',
  },
  shotDetailsButtonTextDisabled: {
    color: colors.disabled,
  },
});