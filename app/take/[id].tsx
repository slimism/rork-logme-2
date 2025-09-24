import React, { useState, useEffect, useRef } from 'react';
import { View, StyleSheet, ScrollView, Text, TextInput, Alert, Modal, TouchableOpacity, KeyboardAvoidingView, Platform, Keyboard, Switch, useWindowDimensions } from 'react-native';
import { useLocalSearchParams, Stack, router } from 'expo-router';
import { ArrowLeft, Save, Check } from 'lucide-react-native';
import { useProjectStore } from '@/store/projectStore';
import { Button } from '@/components/Button';
import { colors } from '@/constants/colors';
import { ClassificationType, ShotDetailsType } from '@/types';
import Toast from 'react-native-toast-message';
import { useThemeStore } from '@/store/themeStore';

interface FieldType {
  id: string;
  label: string;
  enabled?: boolean;
  required?: boolean;
  locked?: boolean;
}

export default function EditTakeScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { projects, logSheets, updateLogSheet } = useProjectStore();
  const { darkMode } = useThemeStore();
  
  const [logSheet, setLogSheet] = useState(logSheets.find(l => l.id === id));
  const [project, setProject] = useState<any>(null);
  const [takeData, setTakeData] = useState<Record<string, string>>({});
  const [classification, setClassification] = useState<ClassificationType | null>(null);
  const [shotDetails, setShotDetails] = useState<ShotDetailsType | null>(null);
  const [isGoodTake, setIsGoodTake] = useState(false);
  const [showWasteModal, setShowWasteModal] = useState(false);
  const [showInsertModal, setShowInsertModal] = useState(false);
  const [wasteOptions, setWasteOptions] = useState({ camera: false, sound: false });
  const [insertSoundSpeed, setInsertSoundSpeed] = useState<boolean | null>(null);
  const [showRangeMode, setShowRangeMode] = useState<{ [key: string]: boolean }>({});
  const [rangeData, setRangeData] = useState<{ [key: string]: { from: string; to: string } }>({});
  const [cameraRangeEnabled, setCameraRangeEnabled] = useState(false);
  const [soundRangeEnabled, setSoundRangeEnabled] = useState(false);
  const [cameraRange, setCameraRange] = useState({ from: '', to: '' });
  const [soundRange, setSoundRange] = useState({ from: '', to: '' });
  const [cameraRecState, setCameraRecState] = useState<{ [key: string]: boolean }>({});
  const [disabledFields, setDisabledFields] = useState<Set<string>>(new Set());
  const [validationErrors, setValidationErrors] = useState<Set<string>>(new Set());
  const [showDuplicateModal, setShowDuplicateModal] = useState(false);
  const [duplicateInfo, setDuplicateInfo] = useState<any>(null);
  const [duplicateAction, setDuplicateAction] = useState<'before' | 'after' | null>(null);
  const inputRefs = useRef<Record<string, TextInput | null>>({});
  const scrollViewRef = useRef<ScrollView>(null);
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;


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

  // Initialize REC state separately to avoid infinite loops
  useEffect(() => {
    const currentLogSheet = logSheets.find(l => l.id === id);
    const currentProject = projects.find(p => p.id === currentLogSheet?.projectId);
    
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
  }, [id, projects, logSheets]);

  useEffect(() => {
    const currentLogSheet = logSheets.find(l => l.id === id);
    const currentProject = projects.find(p => p.id === currentLogSheet?.projectId);
    
    setLogSheet(currentLogSheet);
    setProject(currentProject);
    
    if (currentLogSheet?.data) {
      setTakeData(currentLogSheet.data);
      setClassification(currentLogSheet.data.classification as ClassificationType || null);
      setShotDetails(currentLogSheet.data.shotDetails as ShotDetailsType || null);
      setIsGoodTake(currentLogSheet.data.isGoodTake === true || currentLogSheet.data.isGoodTake === 'true');
      
      // Parse waste options if they exist
      if (currentLogSheet.data.wasteOptions) {
        try {
          const parsedWasteOptions = typeof currentLogSheet.data.wasteOptions === 'string' 
            ? JSON.parse(currentLogSheet.data.wasteOptions) 
            : currentLogSheet.data.wasteOptions;
          setWasteOptions(parsedWasteOptions || { camera: false, sound: false });
        } catch (e) {
          console.log('Error parsing waste options:', e);
          setWasteOptions({ camera: false, sound: false });
        }
      }
      
      // Parse insert sound speed if it exists
      if (currentLogSheet.data.insertSoundSpeed !== undefined) {
        const soundSpeed = currentLogSheet.data.insertSoundSpeed === 'true' || currentLogSheet.data.insertSoundSpeed === true;
        setInsertSoundSpeed(soundSpeed);
      }
      
      // Parse camera REC state if it exists
      if (currentLogSheet.data.cameraRecState) {
        try {
          const parsedRecState = typeof currentLogSheet.data.cameraRecState === 'string' 
            ? JSON.parse(currentLogSheet.data.cameraRecState) 
            : currentLogSheet.data.cameraRecState;
          setCameraRecState(parsedRecState || {});
        } catch (e) {
          console.log('Error parsing camera REC state:', e);
          setCameraRecState({});
        }
      }
      
      // Initialize range data from existing values if they contain ranges
      const newRangeData: { [key: string]: { from: string; to: string } } = {};
      const newShowRangeMode: { [key: string]: boolean } = {};
      
      Object.keys(currentLogSheet.data).forEach(key => {
        const value = currentLogSheet.data[key];
        if (typeof value === 'string' && value.includes('-') && (key.includes('File') || key === 'soundFile')) {
          const [from, to] = value.split('-');
          if (from && to) {
            newRangeData[key] = { from, to };
            newShowRangeMode[key] = true;
          }
        }
      });
      
      setRangeData(newRangeData);
      setShowRangeMode(newShowRangeMode);
      
      // Also set the legacy range states for backward compatibility
      if (newRangeData['cameraFile']) {
        setCameraRange(newRangeData['cameraFile']);
        setCameraRangeEnabled(true);
      }
      if (newRangeData['soundFile']) {
        setSoundRange(newRangeData['soundFile']);
        setSoundRangeEnabled(true);
      }
    }
  }, [id, projects, logSheets]);

  useEffect(() => {
    const newDisabledFields = new Set<string>();
    
    if (classification === 'SFX' || classification === 'Ambience') {
      newDisabledFields.add('cameraFile');
      newDisabledFields.add('cameraFile1');
      newDisabledFields.add('cameraFile2');
      newDisabledFields.add('cameraFile3');
      newDisabledFields.add('shotNumber');
      newDisabledFields.add('takeNumber');
    }
    
    if (shotDetails === 'MOS') {
      newDisabledFields.add('soundFile');
    }
    
    // For Waste classification: disable fields that are NOT selected for waste
    if (classification === 'Waste') {
      // If camera is NOT selected for waste, disable camera fields
      if (!wasteOptions.camera) {
        newDisabledFields.add('cameraFile');
        newDisabledFields.add('cameraFile1');
        newDisabledFields.add('cameraFile2');
        newDisabledFields.add('cameraFile3');
      }
      
      // If sound is NOT selected for waste, disable sound field
      if (!wasteOptions.sound) {
        newDisabledFields.add('soundFile');
      }
    }
    
    if (classification === 'Insert' && insertSoundSpeed === false) {
      newDisabledFields.add('soundFile');
    }
    
    setDisabledFields(newDisabledFields);
  }, [classification, shotDetails, wasteOptions, insertSoundSpeed]);

  const HeaderLeft = () => (
    <TouchableOpacity onPress={() => router.back()} style={styles.headerButton}>
      <ArrowLeft size={24} color={darkMode ? '#ffffff' : colors.text} />
    </TouchableOpacity>
  );



  const updateTakeData = (fieldId: string, value: string) => {
    setTakeData(prev => ({ ...prev, [fieldId]: value }));
    // Clear validation error when user starts typing
    if (validationErrors.has(fieldId)) {
      setValidationErrors(prev => {
        const newErrors = new Set(prev);
        newErrors.delete(fieldId);
        return newErrors;
      });
    }
  };

  const formatFileNumber = (value: string): string => {
    const num = parseInt(value, 10);
    if (isNaN(num)) return '';
    return num.toString().padStart(4, '0');
  };

  const handleClassificationPress = (type: ClassificationType) => {
    const newClassification = classification === type ? null : type;
    setClassification(newClassification);
    
    if (newClassification === type) {
      // Setting a new classification
      if (type === 'Waste') {
        setShowWasteModal(true);
      } else if (type === 'Insert') {
        setShowInsertModal(true);
      } else {
        // For SFX and Ambience, reset waste and insert options
        setWasteOptions({ camera: false, sound: false });
        setInsertSoundSpeed(null);
      }
    } else {
      // Clearing classification
      setWasteOptions({ camera: false, sound: false });
      setInsertSoundSpeed(null);
    }
  };

  const handleShotDetailPress = (detail: ShotDetailsType) => {
    if (shotDetails === detail) {
      setShotDetails(null);
    } else {
      setShotDetails(detail);
    }
  };

  const handleWasteModalConfirm = () => {
    if (!wasteOptions.camera && !wasteOptions.sound) {
      Alert.alert('Error', 'Please select at least one option');
      return;
    }
    setShowWasteModal(false);
  };

  const handleInsertModalConfirm = (soundSpeed: boolean) => {
    setInsertSoundSpeed(soundSpeed);
    setShowInsertModal(false);
  };

  const toggleCameraRec = (fieldId: string) => {
    setCameraRecState(prev => ({
      ...prev,
      [fieldId]: !prev[fieldId]
    }));
  };

  // Helper function to find first duplicate take number within same scene and shot
  const findDuplicateTake = () => {
    if (!logSheet) return null;
    
    const projectLogSheets = logSheets.filter(sheet => 
      sheet.projectId === logSheet.projectId && sheet.id !== logSheet.id // Exclude current take
    );
    const sceneNumber = takeData.sceneNumber;
    const shotNumber = takeData.shotNumber;
    const takeNumber = takeData.takeNumber;
    
    if (sceneNumber && shotNumber && takeNumber) {
      const existingTake = projectLogSheets.find(sheet => 
        sheet.data?.sceneNumber === sceneNumber &&
        sheet.data?.shotNumber === shotNumber &&
        sheet.data?.takeNumber === takeNumber
      );
      
      if (existingTake) {
        return {
          type: 'take',
          label: 'Take',
          fieldId: 'takeNumber',
          value: takeNumber,
          number: parseInt(takeNumber) || 0,
          sceneNumber,
          shotNumber,
          existingEntry: existingTake
        };
      }
    }
    
    return null;
  };

  // Helper function to find first duplicate file number across all scenes and shots
  const findFirstDuplicateFile = () => {
    if (!logSheet) return null;
    
    const projectLogSheets = logSheets.filter(sheet => 
      sheet.projectId === logSheet.projectId && sheet.id !== logSheet.id // Exclude current take
    );
    type DuplicateInfo = { type: string; label: string; fieldId: string; value: string; number: number; existingEntry: any } | null;

    // Sound first - check across all scenes and shots
    if (takeData.soundFile && !disabledFields.has('soundFile')) {
      const val = takeData.soundFile as string;
      const existingEntry = projectLogSheets.find(s => s.data?.soundFile === val);
      if (existingEntry) {
        return { type: 'file', label: 'Sound File', fieldId: 'soundFile', value: val, number: parseInt(val) || 0, existingEntry } as DuplicateInfo;
      }
    }
    
    // Camera files - check across all scenes and shots
    const cameraConfiguration = project?.settings?.cameraConfiguration || 1;
    if (cameraConfiguration === 1) {
      if (takeData.cameraFile && !disabledFields.has('cameraFile')) {
        const val = takeData.cameraFile as string;
        const existingEntry = projectLogSheets.find(s => s.data?.cameraFile === val);
        if (existingEntry) {
          return { type: 'file', label: 'Camera File', fieldId: 'cameraFile', value: val, number: parseInt(val) || 0, existingEntry } as DuplicateInfo;
        }
      }
    } else {
      for (let i = 1; i <= cameraConfiguration; i++) {
        const fieldId = `cameraFile${i}`;
        const val = takeData[fieldId] as string | undefined;
        if (val && !disabledFields.has(fieldId)) {
          const existingEntry = projectLogSheets.find(s => s.data?.[fieldId] === val);
          if (existingEntry) {
            return { type: 'file', label: `Camera File ${i}`, fieldId, value: val, number: parseInt(val) || 0, existingEntry } as DuplicateInfo;
          }
        }
      }
    }
    
    return null;
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
    
    // Check Camera Files (mandatory unless disabled or REC is inactive)
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

  const handleSaveTake = () => {
    if (!logSheet) return;
    
    // Validate mandatory fields first
    if (!validateMandatoryFields()) {
      return;
    }
    
    // Check for take number duplicates within same scene and shot first
    const duplicateTake = findDuplicateTake();
    if (duplicateTake) {
      setDuplicateInfo(duplicateTake);
      Alert.alert(
        'Duplicate Detected',
        `A duplicate was found. Would you like to insert before, insert after, or cancel?`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Insert Before',
            onPress: () => {
              setDuplicateAction('before');
              handleSaveWithDuplicateHandling('before', duplicateTake);
            },
          },
          {
            text: 'Insert After',
            onPress: () => {
              setDuplicateAction('after');
              handleSaveWithDuplicateHandling('after', duplicateTake);
            },
          },
        ]
      );
      return;
    }
    
    // Check for duplicate file numbers across all scenes and shots
    const duplicateFile = findFirstDuplicateFile();
    if (duplicateFile) {
      setDuplicateInfo(duplicateFile);
      Alert.alert(
        'Duplicate Detected',
        `A duplicate was found. Would you like to insert before, insert after, or cancel?`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Insert Before',
            onPress: () => {
              setDuplicateAction('before');
              handleSaveWithDuplicateHandling('before', duplicateFile);
            },
          },
          {
            text: 'Insert After',
            onPress: () => {
              setDuplicateAction('after');
              handleSaveWithDuplicateHandling('after', duplicateFile);
            },
          },
        ]
      );
      return;
    }
    
    // No duplicate, save normally
    saveNormally();
  };
  
  const handleSaveWithDuplicateHandling = (position: 'before' | 'after', duplicateInfo: any) => {
    if (!logSheet || !project) return;
    
    const { updateTakeNumbers, updateFileNumbers } = useProjectStore.getState();
    const camCount = project?.settings?.cameraConfiguration || 1;
    const existingEntry = duplicateInfo.existingEntry;
    
    if (position === 'before') {
      // Insert Before special logic
      let newLogData = { ...takeData };
      
      if (duplicateInfo.type === 'take') {
        // For take duplicates: copy the duplicate target's camera file and sound file to the new log
        if (existingEntry.data?.soundFile) {
          newLogData.soundFile = existingEntry.data.soundFile;
        }
        if (camCount === 1 && existingEntry.data?.cameraFile) {
          newLogData.cameraFile = existingEntry.data.cameraFile;
        } else if (camCount > 1) {
          for (let i = 1; i <= camCount; i++) {
            const fieldId = `cameraFile${i}`;
            if (existingEntry.data?.[fieldId]) {
              newLogData[fieldId] = existingEntry.data[fieldId];
            }
          }
        }
        
        // Shift the duplicate target and all subsequent entries by +1 for take numbers (within same scene/shot)
        const sceneNumber = takeData.sceneNumber!;
        const shotNumber = takeData.shotNumber!;
        const takeNumber = parseInt(takeData.takeNumber || '1');
        updateTakeNumbers(logSheet.projectId!, sceneNumber, shotNumber, takeNumber, 1);
        
        // Shift all file numbers from the duplicate target onwards (across all scenes/shots)
        const fieldsToShift: string[] = ['soundFile'];
        if (camCount === 1) {
          fieldsToShift.push('cameraFile');
        } else {
          for (let i = 1; i <= camCount; i++) fieldsToShift.push(`cameraFile${i}`);
        }
        
        fieldsToShift.forEach(fieldId => {
          const targetFileNum = parseInt(existingEntry.data?.[fieldId] || '0') || 0;
          if (targetFileNum > 0) {
            updateFileNumbers(logSheet.projectId!, fieldId, targetFileNum, 1);
          }
        });
        
      } else if (duplicateInfo.type === 'file') {
        // For file duplicates: copy the duplicate target's identifiers
        if (existingEntry.data?.soundFile) {
          newLogData.soundFile = existingEntry.data.soundFile;
        }
        if (camCount === 1 && existingEntry.data?.cameraFile) {
          newLogData.cameraFile = existingEntry.data.cameraFile;
        } else if (camCount > 1) {
          for (let i = 1; i <= camCount; i++) {
            const fieldId = `cameraFile${i}`;
            if (existingEntry.data?.[fieldId]) {
              newLogData[fieldId] = existingEntry.data[fieldId];
            }
          }
        }
        if (existingEntry.data?.takeNumber) {
          newLogData.takeNumber = existingEntry.data.takeNumber;
        }
        
        // Shift the duplicate target and all subsequent entries by +1
        const fieldsToShift: string[] = ['soundFile'];
        if (camCount === 1) {
          fieldsToShift.push('cameraFile');
        } else {
          for (let i = 1; i <= camCount; i++) fieldsToShift.push(`cameraFile${i}`);
        }
        
        fieldsToShift.forEach(fieldId => {
          const targetFileNum = parseInt(existingEntry.data?.[fieldId] || '0') || 0;
          if (targetFileNum > 0) {
            updateFileNumbers(logSheet.projectId!, fieldId, targetFileNum, 1);
          }
        });
        
        // Also shift take numbers if same scene/shot
        if (existingEntry.data?.sceneNumber && existingEntry.data?.shotNumber && existingEntry.data?.takeNumber) {
          const takeNum = parseInt(existingEntry.data.takeNumber);
          if (!isNaN(takeNum)) {
            updateTakeNumbers(logSheet.projectId!, existingEntry.data.sceneNumber, existingEntry.data.shotNumber, takeNum, 1);
          }
        }
      }
      
      // Update current log with new data
      const finalTakeData = { ...newLogData };
      if (camCount > 1) {
        for (let i = 1; i <= camCount; i++) {
          const fieldId = `cameraFile${i}`;
          const isRecActive = cameraRecState[fieldId] ?? true;
          if (!isRecActive) {
            delete finalTakeData[fieldId];
          }
        }
      }
      
      const updatedData = {
        ...finalTakeData,
        classification,
        shotDetails,
        isGoodTake,
        wasteOptions: classification === 'Waste' ? JSON.stringify(wasteOptions) : '',
        insertSoundSpeed: classification === 'Insert' ? (insertSoundSpeed?.toString() || '') : '',
        cameraRecState: camCount > 1 ? cameraRecState : undefined
      };
      
      updateLogSheet(logSheet.id, updatedData);
      
    } else {
      // Insert After logic
      let newLogData = { ...takeData };
      
      if (duplicateInfo.type === 'take') {
        // Copy the duplicate's camera file, sound file, and take number, then increment each by +1
        if (existingEntry.data?.soundFile) {
          const duplicateSoundNum = parseInt(existingEntry.data.soundFile) || 0;
          newLogData.soundFile = String(duplicateSoundNum + 1).padStart(4, '0');
        }
        
        if (camCount === 1 && existingEntry.data?.cameraFile) {
          const duplicateCameraNum = parseInt(existingEntry.data.cameraFile) || 0;
          newLogData.cameraFile = String(duplicateCameraNum + 1).padStart(4, '0');
        } else if (camCount > 1) {
          for (let i = 1; i <= camCount; i++) {
            const fieldId = `cameraFile${i}`;
            if (existingEntry.data?.[fieldId]) {
              const duplicateCameraNum = parseInt(existingEntry.data[fieldId]) || 0;
              newLogData[fieldId] = String(duplicateCameraNum + 1).padStart(4, '0');
            }
          }
        }
        
        if (existingEntry.data?.takeNumber) {
          const duplicateTakeNum = parseInt(existingEntry.data.takeNumber) || 0;
          newLogData.takeNumber = String(duplicateTakeNum + 1);
        }
        
        // Shift all subsequent entries (after the new log) by +1 onwards
        const sceneNumber = existingEntry.data?.sceneNumber!;
        const shotNumber = existingEntry.data?.shotNumber!;
        const newTakeNumber = parseInt(newLogData.takeNumber || '1');
        
        // For take numbers, shift all entries in the same scene/shot that have take numbers > newTakeNumber
        updateTakeNumbers(logSheet.projectId!, sceneNumber, shotNumber, newTakeNumber + 1, 1);
        
        // Shift file numbers for all subsequent entries across all scenes/shots
        const fieldsToShift: string[] = ['soundFile'];
        if (camCount === 1) {
          fieldsToShift.push('cameraFile');
        } else {
          for (let i = 1; i <= camCount; i++) fieldsToShift.push(`cameraFile${i}`);
        }
        
        fieldsToShift.forEach(fieldId => {
          const newFileNum = parseInt(newLogData[fieldId] || '0') || 0;
          // Shift all file numbers >= newFileNum (including the duplicate target)
          updateFileNumbers(logSheet.projectId!, fieldId, newFileNum, 1);
        });
        
      } else if (duplicateInfo.type === 'file') {
        // Copy the duplicate's camera file, sound file, and take number, then increment each by +1
        if (existingEntry.data?.soundFile) {
          const duplicateSoundNum = parseInt(existingEntry.data.soundFile) || 0;
          newLogData.soundFile = String(duplicateSoundNum + 1).padStart(4, '0');
        }
        
        if (camCount === 1 && existingEntry.data?.cameraFile) {
          const duplicateCameraNum = parseInt(existingEntry.data.cameraFile) || 0;
          newLogData.cameraFile = String(duplicateCameraNum + 1).padStart(4, '0');
        } else if (camCount > 1) {
          for (let i = 1; i <= camCount; i++) {
            const fieldId = `cameraFile${i}`;
            if (existingEntry.data?.[fieldId]) {
              const duplicateCameraNum = parseInt(existingEntry.data[fieldId]) || 0;
              newLogData[fieldId] = String(duplicateCameraNum + 1).padStart(4, '0');
            }
          }
        }
        
        if (existingEntry.data?.takeNumber) {
          const duplicateTakeNum = parseInt(existingEntry.data.takeNumber) || 0;
          newLogData.takeNumber = String(duplicateTakeNum + 1);
        }
        
        // Shift all subsequent entries (after the new log) by +1 onwards
        const fieldsToShift: string[] = ['soundFile'];
        if (camCount === 1) {
          fieldsToShift.push('cameraFile');
        } else {
          for (let i = 1; i <= camCount; i++) fieldsToShift.push(`cameraFile${i}`);
        }
        
        fieldsToShift.forEach(fieldId => {
          const newFileNum = parseInt(newLogData[fieldId] || '0') || 0;
          // Shift all file numbers >= newFileNum (including the duplicate target)
          updateFileNumbers(logSheet.projectId!, fieldId, newFileNum, 1);
        });
        
        // Also shift take numbers if same scene/shot
        if (existingEntry.data?.sceneNumber && existingEntry.data?.shotNumber && newLogData.takeNumber) {
          const newTakeNum = parseInt(newLogData.takeNumber);
          // Shift all take numbers >= newTakeNum in the same scene/shot (including the duplicate target)
          updateTakeNumbers(logSheet.projectId!, existingEntry.data.sceneNumber, existingEntry.data.shotNumber, newTakeNum, 1);
        }
      }
      
      // Update current log with new data
      const finalTakeData = { ...newLogData };
      if (camCount > 1) {
        for (let i = 1; i <= camCount; i++) {
          const fieldId = `cameraFile${i}`;
          const isRecActive = cameraRecState[fieldId] ?? true;
          if (!isRecActive) {
            delete finalTakeData[fieldId];
          }
        }
      }
      
      const updatedData = {
        ...finalTakeData,
        classification,
        shotDetails,
        isGoodTake,
        wasteOptions: classification === 'Waste' ? JSON.stringify(wasteOptions) : '',
        insertSoundSpeed: classification === 'Insert' ? (insertSoundSpeed?.toString() || '') : '',
        cameraRecState: camCount > 1 ? cameraRecState : undefined
      };
      
      updateLogSheet(logSheet.id, updatedData);
    }
    
    router.back();
  };
  
  const saveNormally = () => {
    if (!logSheet || !project) return;
    
    try {
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
      
      const updatedData = {
        ...finalTakeData,
        classification: classification || '',
        shotDetails: shotDetails || '',
        isGoodTake: isGoodTake,
        wasteOptions: classification === 'Waste' ? JSON.stringify(wasteOptions) : '',
        insertSoundSpeed: classification === 'Insert' ? (insertSoundSpeed?.toString() || '') : '',
        cameraRecState: cameraConfiguration > 1 ? cameraRecState : undefined
      };
      
      updateLogSheet(logSheet.id, updatedData);
      router.back();
    } catch (error) {
      console.error('Error saving take:', error);
      Alert.alert('Error', 'Failed to save changes. Please try again.');
    }
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

  const renderField = (field: FieldType, allFieldIds: string[], customStyle?: any) => {
    const value = takeData[field.id] || '';
    const isMultiline = field.id === 'notesForTake' || field.id === 'descriptionOfShot';
    const isDisabled = disabledFields.has(field.id);
    const hasError = validationErrors.has(field.id);
    const isMandatory = ['sceneNumber', 'shotNumber', 'soundFile', 'cameraFile'].includes(field.id) || field.id.startsWith('cameraFile');
    const isFileField = field.id === 'soundFile';
    
    if (isFileField && soundRangeEnabled) {
      return (
        <View key={field.id} style={[styles.fieldContainer, customStyle]}>
          <View style={styles.fieldHeaderRow}>
            <Text style={[
              styles.fieldLabel, 
              isDisabled && styles.disabledLabel,
              hasError && styles.errorLabel
            ]}>
              Sound File{!isDisabled && <Text style={styles.asterisk}> *</Text>}
            </Text>
            <TouchableOpacity
              style={[styles.rangeButtonSmall, isDisabled && styles.disabledButton]}
              onPress={() => setSoundRangeEnabled(false)}
              disabled={isDisabled}
            >
              <Text style={[styles.rangeButtonText, isDisabled && styles.disabledText]}>Range</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.rangeContainer}>
            <TextInput
              style={[styles.fieldInput, styles.rangeInput, isDisabled && styles.disabledInput, darkMode && styles.fieldInputDark]}
              value={soundRange.from}
              onChangeText={(text) => setSoundRange(prev => ({ ...prev, from: text }))}
              onBlur={() => setSoundRange(prev => ({ ...prev, from: formatFileNumber(prev.from) }))}
              placeholder="From"
              placeholderTextColor={colors.subtext}
              keyboardType="numeric"
              maxLength={4}
              editable={!isDisabled}
            />
            <Text style={styles.rangeSeparator}>-</Text>
            <TextInput
              style={[styles.fieldInput, styles.rangeInput, isDisabled && styles.disabledInput, darkMode && styles.fieldInputDark]}
              value={soundRange.to}
              onChangeText={(text) => setSoundRange(prev => ({ ...prev, to: text }))}
              onBlur={() => setSoundRange(prev => ({ ...prev, to: formatFileNumber(prev.to) }))}
              placeholder="To"
              placeholderTextColor={colors.subtext}
              keyboardType="numeric"
              maxLength={4}
              editable={!isDisabled}
            />
          </View>
        </View>
      );
    }
    
    if (isFileField) {
      return (
        <View key={field.id} style={[styles.fieldContainer, customStyle]}>
          <View style={styles.fieldHeaderRow}>
            <Text style={[
              styles.fieldLabel, 
              isDisabled && styles.disabledLabel,
              hasError && styles.errorLabel
            ]}>
              Sound File{!isDisabled && <Text style={styles.asterisk}> *</Text>}
            </Text>
            <TouchableOpacity
              style={[styles.rangeButtonSmall, isDisabled && styles.disabledButton]}
              onPress={() => setSoundRangeEnabled(true)}
              disabled={isDisabled}
            >
              <Text style={[styles.rangeButtonText, isDisabled && styles.disabledText]}>Range</Text>
            </TouchableOpacity>
          </View>
          <TextInput
            ref={(ref) => { inputRefs.current[field.id] = ref; }}
            style={[
              styles.fieldInput, 
              isDisabled && styles.disabledInput,
              hasError && styles.errorInput,
              darkMode && styles.fieldInputDark,
            ]}
            value={value}
            onChangeText={(text) => updateTakeData(field.id, text)}
            onBlur={() => {
              if (value && !isDisabled) {
                updateTakeData(field.id, formatFileNumber(value));
              }
            }}
            placeholder={isDisabled ? '' : `Enter ${field.label.toLowerCase()}`}
            placeholderTextColor={colors.subtext}
            keyboardType="numeric"
            maxLength={4}
            editable={!isDisabled}
          />
        </View>
      );
    }
    
    return (
      <View key={field.id} style={[styles.fieldContainer, customStyle]}>
        <Text style={[
          styles.fieldLabel, 
          isDisabled && styles.disabledLabel,
          hasError && styles.errorLabel
        ]}>
          {field.label}{isMandatory && !isDisabled && <Text style={styles.asterisk}> *</Text>}
        </Text>
        <TextInput
          ref={(ref) => { inputRefs.current[field.id] = ref; }}
          style={[
            styles.fieldInput,
            isMultiline && styles.multilineInput,
            isDisabled && styles.disabledInput,
            hasError && styles.errorInput,
            darkMode && styles.fieldInputDark,
          ]}
          value={isDisabled ? '' : value}
          onChangeText={(text) => updateTakeData(field.id, text)}
          placeholder={isDisabled ? '' : `Enter ${field.label.toLowerCase()}`}
          placeholderTextColor={colors.subtext}
          multiline={isMultiline}
          numberOfLines={isMultiline ? 3 : 1}
          keyboardType={getKeyboardType(field.id)}
          returnKeyType={isMultiline ? 'default' : 'next'}
          onSubmitEditing={() => {
            if (!isMultiline) {
              const nextFieldId = getNextFieldId(field.id, allFieldIds);
              if (nextFieldId && inputRefs.current[nextFieldId]) {
                inputRefs.current[nextFieldId]?.focus();
              }
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
          blurOnSubmit={isMultiline}
          editable={!isDisabled}
        />
      </View>
    );
  };

  const renderCameraFields = (cameraCount: number, allFieldIds: string[]) => {
    const fields = [];
    for (let i = 1; i <= cameraCount; i++) {
      const fieldId = cameraCount === 1 ? 'cameraFile' : `cameraFile${i}`;
      const fieldLabel = cameraCount === 1 ? 'Camera File' : `Camera File ${i}`;
      const isDisabled = disabledFields.has(fieldId);
      
      if (i === 1 && cameraRangeEnabled) {
        fields.push(
          <View key={fieldId} style={styles.fieldContainer}>
            <View style={styles.fieldHeaderRow}>
              <Text style={[styles.fieldLabel, isDisabled && styles.disabledLabel]}>{fieldLabel}</Text>
              <TouchableOpacity
                style={[styles.rangeButtonSmall, isDisabled && styles.disabledButton]}
                onPress={() => setCameraRangeEnabled(false)}
                disabled={isDisabled}
              >
                <Text style={[styles.rangeButtonText, isDisabled && styles.disabledText]}>Range</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.rangeContainer}>
              <TextInput
                style={[styles.fieldInput, styles.rangeInput, isDisabled && styles.disabledInput, darkMode && styles.fieldInputDark]}
                value={cameraRange.from}
                onChangeText={(text) => setCameraRange(prev => ({ ...prev, from: text }))}
                onBlur={() => setCameraRange(prev => ({ ...prev, from: formatFileNumber(prev.from) }))}
                placeholder="From"
                placeholderTextColor={colors.subtext}
                keyboardType="numeric"
                maxLength={4}
                editable={!isDisabled}
              />
              <Text style={styles.rangeSeparator}>-</Text>
              <TextInput
                style={[styles.fieldInput, styles.rangeInput, isDisabled && styles.disabledInput, darkMode && styles.fieldInputDark]}
                value={cameraRange.to}
                onChangeText={(text) => setCameraRange(prev => ({ ...prev, to: text }))}
                onBlur={() => setCameraRange(prev => ({ ...prev, to: formatFileNumber(prev.to) }))}
                placeholder="To"
                placeholderTextColor={colors.subtext}
                keyboardType="numeric"
                maxLength={4}
                editable={!isDisabled}
              />
            </View>
          </View>
        );
      } else {
        fields.push(
          <View key={fieldId} style={styles.fieldContainer}>
            <View style={styles.fieldHeaderRow}>
              <Text style={[
                styles.fieldLabel, 
                isDisabled && styles.disabledLabel,
                validationErrors.has(fieldId) && styles.errorLabel
              ]}>
                {fieldLabel}{!isDisabled && (cameraRecState[fieldId] ?? true) && <Text style={styles.asterisk}> *</Text>}
              </Text>
              <View style={styles.buttonGroup}>
                {i === 1 && (
                  <TouchableOpacity
                    style={[styles.rangeButtonSmall, isDisabled && styles.disabledButton]}
                    onPress={() => setCameraRangeEnabled(true)}
                    disabled={isDisabled}
                  >
                    <Text style={[styles.rangeButtonText, isDisabled && styles.disabledText]}>Range</Text>
                  </TouchableOpacity>
                )}
                {cameraCount > 1 && (
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
                )}
              </View>
            </View>
            <TextInput
              ref={(ref) => { inputRefs.current[fieldId] = ref; }}
              style={[
                styles.fieldInput, 
                isDisabled && styles.disabledInput,
                validationErrors.has(fieldId) && styles.errorInput,
                darkMode && styles.fieldInputDark,
              ]}
              value={isDisabled ? '' : (takeData[fieldId] || '')}
              onChangeText={(text) => updateTakeData(fieldId, text)}
              onBlur={() => {
                const value = takeData[fieldId];
                if (value && !isDisabled) {
                  updateTakeData(fieldId, formatFileNumber(value));
                }
              }}
              placeholder={isDisabled ? '' : `Enter ${fieldLabel.toLowerCase()}`}
              placeholderTextColor={colors.subtext}
              keyboardType="numeric"
              maxLength={4}
              returnKeyType="next"
              onSubmitEditing={() => {
                const nextFieldId = getNextFieldId(fieldId, allFieldIds);
                if (nextFieldId && inputRefs.current[nextFieldId]) {
                  inputRefs.current[nextFieldId]?.focus();
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
              editable={!isDisabled}
            />
          </View>
        );
      }
    }
    return fields;
  };

  if (!logSheet || !project) {
    return (
      <View style={[styles.container, darkMode && styles.containerDark]}>
        <Stack.Screen 
          options={{
            title: "Take Not Found",
            headerLeft: () => <HeaderLeft />,
            headerBackVisible: false,
          }} 
        />
        <View style={styles.errorContainer}>
          <Text style={[styles.errorText, darkMode && styles.errorTextDark]}>Take not found</Text>
        </View>
      </View>
    );
  }

  const enabledFields = project.settings?.logSheetFields || [];
  const customFields = project.settings?.customFields || [];
  const cameraConfiguration = project.settings?.cameraConfiguration || 1;

  // Filter out camera file and sound file fields since we handle them separately, and notes field to put it last
  const fieldsToRender = enabledFields.filter((field: FieldType) => field.id !== 'cameraFile' && field.id !== 'soundFile' && field.id !== 'notesForTake');
  const notesField = enabledFields.find((field: FieldType) => field.id === 'notesForTake');
  
  // Build ordered field list for navigation
  const allFieldIds: string[] = [];
  fieldsToRender.forEach((field: FieldType) => allFieldIds.push(field.id));
  
  // Add camera fields
  for (let i = 1; i <= cameraConfiguration; i++) {
    const fieldId = cameraConfiguration === 1 ? 'cameraFile' : `cameraFile${i}`;
    allFieldIds.push(fieldId);
  }

  // Add card number fields after camera fields when enabled
  const cardFieldEnabled = !!enabledFields.find((field: FieldType) => field.id === 'cardNumber');
  if (cardFieldEnabled) {
    if (cameraConfiguration === 1) {
      allFieldIds.push('cardNumber');
    } else {
      for (let i = 1; i <= cameraConfiguration; i++) {
        allFieldIds.push(`cardNumber${i}`);
      }
    }
  }
  
  // Add sound file field to navigation if enabled
  const soundFieldEnabled = !!enabledFields.find((field: FieldType) => field.id === 'soundFile');
  if (soundFieldEnabled) {
    allFieldIds.push('soundFile');
  }

  // Add custom fields
  customFields.forEach((_: string, index: number) => {
    allFieldIds.push(`custom_${index}`);
  });
  
  // Add notes field last
  if (notesField) {
    allFieldIds.push('notesForTake');
  }


  return (
    <KeyboardAvoidingView 
      style={[styles.container, darkMode && styles.containerDark]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      <Stack.Screen 
        options={{
          title: "Edit Take",
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
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: keyboardHeight > 0 ? keyboardHeight + 20 : 20 },
          isLandscape ? styles.scrollContentLandscape : null,
        ]}
      >
        <View style={[
          styles.sectionContainer,
          isLandscape ? styles.mainContainerLandscape : null,
        ]}>
          <View style={styles.takeInfo}>
            <Text style={[styles.takeTitle, darkMode && styles.takeTitleDark]}>
              Scene {takeData.sceneNumber || 'Unknown'} - Shot {takeData.shotNumber || 'Unknown'}
            </Text>
            <Text style={[styles.takeSubtitle, darkMode && styles.takeSubtitleDark]}>
              Created: {new Date(logSheet.createdAt).toLocaleDateString()}
            </Text>
            <Text style={[styles.takeSubtitle, darkMode && styles.takeSubtitleDark]}>
              Last Updated: {new Date(logSheet.updatedAt).toLocaleDateString()}
            </Text>
          </View>
          {/* Scene, Shot, Take on same row */}
          <View style={styles.topRowContainer}>
            {enabledFields.find((field: FieldType) => field.id === 'sceneNumber') && (
              <View style={styles.topFieldContainer}>
                <Text style={[
                  styles.topFieldLabel, 
                  darkMode && styles.fieldLabelDark,
                  validationErrors.has('sceneNumber') && styles.errorLabel
                ]}>
                  Scene<Text style={styles.asterisk}> *</Text>
                </Text>
                <TextInput
                  style={[
                    styles.topFieldInput, 
                    darkMode && styles.fieldInputDark,
                    disabledFields.has('sceneNumber') && styles.disabledInput,
                    validationErrors.has('sceneNumber') && styles.errorInput
                  ]}
                  value={disabledFields.has('sceneNumber') ? '' : (takeData.sceneNumber || '')}
                  onChangeText={(text) => updateTakeData('sceneNumber', text)}
                  placeholder={disabledFields.has('sceneNumber') ? '' : ''}
                  placeholderTextColor={darkMode ? '#888' : colors.subtext}
                  editable={!disabledFields.has('sceneNumber')}
                  onFocus={(event) => {
                    if (!disabledFields.has('sceneNumber')) {
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
              </View>
            )}
            {enabledFields.find((field: FieldType) => field.id === 'shotNumber') && (
              <View style={styles.topFieldContainer}>
                <Text style={[
                  styles.topFieldLabel, 
                  darkMode && styles.fieldLabelDark,
                  disabledFields.has('shotNumber') && styles.disabledLabel,
                  validationErrors.has('shotNumber') && styles.errorLabel
                ]}>
                  Shot<Text style={styles.asterisk}> *</Text>
                </Text>
                <TextInput
                  style={[
                    styles.topFieldInput, 
                    darkMode && styles.fieldInputDark,
                    disabledFields.has('shotNumber') && styles.disabledInput,
                    validationErrors.has('shotNumber') && styles.errorInput
                  ]}
                  value={disabledFields.has('shotNumber') ? '' : (takeData.shotNumber || '')}
                  onChangeText={(text) => updateTakeData('shotNumber', text)}
                  placeholder={disabledFields.has('shotNumber') ? '' : ''}
                  placeholderTextColor={darkMode ? '#888' : colors.subtext}
                  editable={!disabledFields.has('shotNumber')}
                  onFocus={(event) => {
                    if (!disabledFields.has('shotNumber')) {
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
              </View>
            )}
            {enabledFields.find((field: FieldType) => field.id === 'takeNumber') && (
              <View style={styles.topFieldContainer}>
                <Text style={[
                  styles.topFieldLabel, 
                  darkMode && styles.fieldLabelDark,
                  disabledFields.has('takeNumber') && styles.disabledLabel,
                  validationErrors.has('takeNumber') && styles.errorLabel
                ]}>Take</Text>
                <TextInput
                  style={[
                    styles.topFieldInput, 
                    darkMode && styles.fieldInputDark,
                    disabledFields.has('takeNumber') && styles.disabledInput,
                    validationErrors.has('takeNumber') && styles.errorInput
                  ]}
                  value={disabledFields.has('takeNumber') ? '' : (takeData.takeNumber || '')}
                  onChangeText={(text) => updateTakeData('takeNumber', text)}
                  placeholder={disabledFields.has('takeNumber') ? '' : ''}
                  placeholderTextColor={darkMode ? '#888' : colors.subtext}
                  keyboardType="numeric"
                  editable={!disabledFields.has('takeNumber')}
                  onFocus={(event) => {
                    if (!disabledFields.has('takeNumber')) {
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
              </View>
            )}
          </View>
          
          {/* Camera files */}
          {renderCameraFields(cameraConfiguration, allFieldIds)}

          {/* Card Numbers (when enabled) */}
          {cardFieldEnabled && (
            cameraConfiguration === 1 ? (
              <View style={styles.fieldContainer}>
                <Text style={[styles.fieldLabel, darkMode && styles.fieldLabelDark]}>Card Number</Text>
                <TextInput
                  ref={(ref) => { inputRefs.current['cardNumber'] = ref; }}
                  style={[styles.fieldInput, darkMode && styles.fieldInputDark]}
                  value={takeData.cardNumber || ''}
                  onChangeText={(text) => updateTakeData('cardNumber', text)}
                  placeholder={'Enter card number'}
                  placeholderTextColor={darkMode ? '#888' : colors.subtext}
                  returnKeyType="next"
                />
              </View>
            ) : (
              <View>
                {Array.from({ length: cameraConfiguration }, (_, i) => {
                  const fieldId = `cardNumber${i + 1}`;
                  const label = `Card Number Camera ${i + 1}`;
                  return (
                    <View key={fieldId} style={styles.fieldContainer}>
                      <Text style={[styles.fieldLabel, darkMode && styles.fieldLabelDark]}>{label}</Text>
                      <TextInput
                        ref={(ref) => { inputRefs.current[fieldId] = ref; }}
                        style={[styles.fieldInput, darkMode && styles.fieldInputDark]}
                        value={takeData[fieldId] || ''}
                        onChangeText={(text) => updateTakeData(fieldId, text)}
                        placeholder={`Enter ${label}`}
                        placeholderTextColor={darkMode ? '#888' : colors.subtext}
                        returnKeyType="next"
                      />
                    </View>
                  );
                })}
              </View>
            )
          )}
          
          {/* Sound file */}
          {enabledFields.find((field: FieldType) => field.id === 'soundFile') && renderField({ id: 'soundFile', label: 'Sound File' }, allFieldIds)}
          
          {/* Other fields */}
          {fieldsToRender
            .filter((field: FieldType) => !['sceneNumber', 'shotNumber', 'takeNumber'].includes(field.id))
            .map((field: FieldType) => renderField(field, allFieldIds))}
          
          {/* Custom fields */}
          {customFields.map((fieldName: string, index: number) => 
            renderField({
              id: `custom_${index}`,
              label: fieldName
            }, allFieldIds)
          )}
          
          {/* Notes field always last */}
          {notesField && renderField(notesField, allFieldIds)}
        </View>

        {/* Classification Section */}
        <View style={styles.sectionContainer}>
          <Text style={[styles.sectionTitle, darkMode && styles.sectionTitleDark]}>Classification</Text>
          <View style={styles.classificationRow}>
            {(['Waste', 'Insert', 'Ambience', 'SFX'] as ClassificationType[]).map((type) => (
              <TouchableOpacity
                key={type}
                style={[
                  styles.classificationTab,
                  darkMode && styles.classificationTabDark,
                  classification === type && styles.classificationTabActive
                ]}
                onPress={() => handleClassificationPress(type)}
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
          <Text style={[styles.sectionTitle, darkMode && styles.sectionTitleDark]}>Shot Details</Text>
          <View style={styles.shotDetailsRow}>
            {(['MOS', 'NO SLATE'] as ShotDetailsType[]).map((type) => {
              const isDisabled = type === 'MOS' && (classification === 'Ambience' || classification === 'SFX');
              return (
                <TouchableOpacity
                  key={type}
                  style={[
                    styles.shotDetailsButton,
                    darkMode && styles.shotDetailsButtonDark,
                    shotDetails === type && styles.shotDetailsButtonActive,
                    isDisabled && styles.shotDetailsButtonDisabled
                  ]}
                  onPress={() => !isDisabled && handleShotDetailPress(type)}
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
          <View style={styles.buttonRow}>
            <TouchableOpacity
              testID="good-take-button"
              style={[
                styles.goodTakeButton,
                isGoodTake && styles.goodTakeButtonActive
              ]}
              onPress={() => setIsGoodTake(!isGoodTake)}
              activeOpacity={0.8}
            >
              <Text style={[
                styles.goodTakeButtonText,
                isGoodTake && styles.goodTakeButtonTextActive
              ]}>Good Take</Text>
            </TouchableOpacity>
            <TouchableOpacity
              testID="save-changes-button"
              style={styles.saveChangesButton}
              onPress={handleSaveTake}
              activeOpacity={0.8}
            >
              <Text style={styles.saveChangesText}>Save Changes</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>

      <Modal
        visible={showWasteModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowWasteModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, darkMode && styles.modalContentDark]}>
            <Text style={[styles.modalTitle, darkMode && styles.modalTitleDark]}>Select Waste Options</Text>
            <TouchableOpacity
              style={styles.checkboxRow}
              onPress={() => setWasteOptions(prev => ({ ...prev, camera: !prev.camera }))}
            >
              <View style={[
                styles.checkbox,
                darkMode ? styles.checkboxDarkBorder : styles.checkboxLightBorder,
                wasteOptions.camera ? styles.checkboxChecked : undefined
              ]}
              >
                {wasteOptions.camera ? <Check size={16} color="white" /> : null}
              </View>
              <Text style={[styles.checkboxLabel, darkMode && styles.checkboxLabelDark]}>Camera file waste</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.checkboxRow}
              onPress={() => setWasteOptions(prev => ({ ...prev, sound: !prev.sound }))}
            >
              <View style={[
                styles.checkbox,
                darkMode ? styles.checkboxDarkBorder : styles.checkboxLightBorder,
                wasteOptions.sound ? styles.checkboxChecked : undefined
              ]}
              >
                {wasteOptions.sound ? <Check size={16} color="white" /> : null}
              </View>
              <Text style={[styles.checkboxLabel, darkMode && styles.checkboxLabelDark]}>Sound file waste</Text>
            </TouchableOpacity>
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.modalButton}
                onPress={() => {
                  setShowWasteModal(false);
                  setClassification(null);
                  setWasteOptions({ camera: false, sound: false });
                }}
              >
                <Text style={[styles.modalButtonText, darkMode && styles.modalButtonTextDark]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonPrimary]}
                onPress={handleWasteModalConfirm}
              >
                <Text style={[styles.modalButtonText, styles.modalButtonTextPrimary]}>Confirm</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showInsertModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowInsertModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, darkMode && styles.modalContentDark]}>
            <Text style={[styles.modalTitle, darkMode && styles.modalTitleDark]}>Did sound speed in this shot?</Text>
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonPrimary]}
                onPress={() => handleInsertModalConfirm(true)}
              >
                <Text style={[styles.modalButtonText, styles.modalButtonTextPrimary]}>Yes</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonPrimary]}
                onPress={() => handleInsertModalConfirm(false)}
              >
                <Text style={[styles.modalButtonText, styles.modalButtonTextPrimary]}>No</Text>
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
    backgroundColor: '#ffffff',
  },
  containerDark: {
    backgroundColor: '#1a1a1a',
  },
  content: {
    flex: 1,
    width: '100%',
  },
  scrollContent: {
    flexGrow: 1,
    alignItems: 'stretch',
  },
  scrollContentLandscape: {
    paddingHorizontal: 16,
    minWidth: '100%',
  },
  headerButton: {
    padding: 8,
    marginHorizontal: 8,
  },
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorText: {
    fontSize: 18,
    color: colors.subtext,
  },
  errorTextDark: {
    color: '#cccccc',
  },
  mainContainer: {
    backgroundColor: 'white',
    margin: 20,
    borderRadius: 12,
    padding: 20,
  },
  formContainer: {
    backgroundColor: 'transparent',
    margin: 0,
    borderRadius: 0,
    padding: 16,
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
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 8,
  },
  topFieldInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    color: colors.text,
    backgroundColor: 'white',
    height: 48,
  },
  addTakeSection: {
    backgroundColor: 'transparent',
    margin: 0,
    borderRadius: 0,
    paddingHorizontal: 16,
    shadowColor: 'transparent',
    shadowOffset: {
      width: 0,
      height: 0,
    },
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
    marginTop: 16,
  },
  goodTakeButton: {
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#54a349',
    backgroundColor: 'white',
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 120,
  },
  goodTakeButtonActive: {
    backgroundColor: '#54a349',
  },
  goodTakeButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#54a349',
  },
  goodTakeButtonTextActive: {
    color: 'white',
  },
  sectionContainer: {
    backgroundColor: 'transparent',
    margin: 0,
    borderRadius: 0,
    paddingHorizontal: 16,
    shadowColor: 'transparent',
    shadowOffset: {
      width: 0,
      height: 0,
    },
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
    marginTop: 16,
  },
  shotDetailsSection: {
    marginTop: 16,
  },
  mainContainerLandscape: {
    margin: 0,
    borderRadius: 0,
    paddingHorizontal: 24,
    paddingVertical: 16,
  },
  mainContainerDark: {
    backgroundColor: '#2a2a2a',
  },
  takeInfo: {
    marginBottom: 20,
    alignItems: 'center',
  },
  takeTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 8,
    textAlign: 'center',
  },
  takeTitleDark: {
    color: '#ffffff',
  },
  takeSubtitle: {
    fontSize: 14,
    color: colors.subtext,
    marginBottom: 4,
    textAlign: 'center',
  },
  takeSubtitleDark: {
    color: '#cccccc',
  },

  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 16,
  },
  sectionTitleDark: {
    color: '#cccccc',
  },
  toggleContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  toggleButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: 'white',
  },
  toggleButtonActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  toggleButtonDisabled: {
    opacity: 0.5,
  },
  toggleText: {
    fontSize: 14,
    color: colors.text,
    fontWeight: '500',
  },
  toggleTextActive: {
    color: 'white',
  },
  toggleTextDisabled: {
    color: colors.subtext,
  },

  fieldContainer: {
    marginBottom: 20,
  },
  fieldRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginBottom: 20,
    gap: 10,
  },
  fieldWithButton: {
    flex: 1,
  },
  fieldWithRange: {
    flex: 1,
  },
  fieldLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 8,
  },
  fieldLabelDark: {
    color: '#ffffff',
  },
  fieldInput: {
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    color: colors.text,
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: colors.border,
  },
  fieldInputDark: {
    backgroundColor: '#2a2a2a',
    color: '#ffffff',
  },
  disabledInput: {
    backgroundColor: '#f5f5f5',
    color: colors.subtext,
  },
  multilineInput: {
    height: 80,
    textAlignVertical: 'top',
  },
  rangeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  rangeInput: {
    flex: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    color: colors.text,
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: colors.border,
  },
  rangeSeparator: {
    fontSize: 16,
    color: colors.text,
  },
  rangeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'white',
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
  goodTakeLabelDark: {
    color: '#ffffff',
  },
  saveChangesButton: {
    backgroundColor: '#BDDFEB',
    flex: 1,
    height: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveChangesText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0b0b0b',
  },
  classificationRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
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
    borderColor: colors.border,
    height: 44,
  },
  classificationTabActive: {
    backgroundColor: '#BDDFEB',
    borderColor: '#BDDFEB',
  },
  classificationTabText: {
    fontSize: 11.2,
    fontWeight: '500',
    color: '#666',
  },
  classificationTabTextActive: {
    color: '#333',
    fontWeight: '600',
  },
  shotDetailsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  shotDetailsButton: {
    flex: 1,
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 32,
    backgroundColor: '#F5F5F5',
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    height: 56,
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
  classificationTabDark: {
    backgroundColor: '#2a2a2a',
    borderColor: '#2a2a2a',
    borderWidth: 1,
  },
  shotDetailsButtonDark: {
    backgroundColor: '#151515',
    borderColor: '#2a2a2a',
    borderWidth: 1,
  },
  shotDetailsButtonDisabled: {
    opacity: 0.5,
    backgroundColor: '#f5f5f5',
  },
  shotDetailsButtonTextDisabled: {
    color: colors.disabled,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 20,
    width: '80%',
    maxWidth: 400,
  },
  modalContentDark: {
    backgroundColor: '#2a2a2a',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 20,
  },
  modalTitleDark: {
    color: '#ffffff',
  },
  modalDescription: {
    fontSize: 16,
    color: colors.text,
    marginBottom: 20,
    lineHeight: 22,
  },
  modalDescriptionDark: {
    color: '#ffffff',
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
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxLightBorder: {
    borderColor: colors.text,
  },
  checkboxDarkBorder: {
    borderColor: '#ffffff',
  },
  checkboxChecked: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  checkboxLabel: {
    fontSize: 16,
    color: colors.text,
  },
  checkboxLabelDark: {
    color: '#ffffff',
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    marginTop: 20,
  },
  modalButton: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  modalButtonPrimary: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  modalButtonText: {
    fontSize: 16,
    color: colors.text,
    fontWeight: '500',
  },
  modalButtonTextDark: {
    color: '#ffffff',
  },
  modalButtonTextPrimary: {
    color: 'white',
  },
  rowContainer: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 20,
  },
  thirdWidth: {
    flex: 1,
  },
  fieldHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  rangeButtonSmall: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: 'white',
  },
  rangeButtonText: {
    fontSize: 12,
    fontWeight: '500',
    color: colors.primary,
  },
  disabledButton: {
    opacity: 0.5,
  },
  disabledText: {
    color: colors.subtext,
  },
  disabledLabel: {
    color: colors.subtext,
  },
  errorLabel: {
    color: colors.error,
  },
  errorInput: {
    borderColor: colors.error,
    borderWidth: 1,
  },
  asterisk: {
    color: colors.error,
    fontSize: 16,
    fontWeight: 'bold',
  },
  buttonGroup: {
    flexDirection: 'row',
    gap: 8,
  },
  recButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    minWidth: 50,
    alignItems: 'center',
  },
  recButtonActive: {
    backgroundColor: '#DC2626',
  },
  recButtonInactive: {
    backgroundColor: '#9CA3AF',
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
  sectionSpacing: {
    marginTop: 24,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
  },


});