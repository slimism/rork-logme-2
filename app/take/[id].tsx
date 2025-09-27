import React, { useState, useEffect, useRef } from 'react';
import { View, StyleSheet, ScrollView, Text, TextInput, Alert, Modal, TouchableOpacity, KeyboardAvoidingView, Platform, Keyboard, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, Stack, router } from 'expo-router';
import { ArrowLeft, Check } from 'lucide-react-native';
import { useProjectStore } from '@/store/projectStore';
import { useColors } from '@/constants/colors';
import { ClassificationType, ShotDetailsType } from '@/types';
import Toast from 'react-native-toast-message';

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
  const colors = useColors();

  const [logSheet, setLogSheet] = useState(logSheets.find(l => l.id === id));
  const [project, setProject] = useState<any>(null);
  const [takeData, setTakeData] = useState<Record<string, string>>({});
  const [classification, setClassification] = useState<ClassificationType | null>(null);
  const [shotDetails, setShotDetails] = useState<ShotDetailsType[]>([]);
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
  const inputRefs = useRef<Record<string, TextInput | null>>({});
  const scrollViewRef = useRef<ScrollView>(null);
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  const { width, height } = useWindowDimensions();
  const styles = createStyles(colors);
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
      const savedShotDetails = currentLogSheet.data.shotDetails;
      if (savedShotDetails) {
        if (typeof savedShotDetails === 'string') {
          setShotDetails([savedShotDetails as ShotDetailsType]);
        } else if (Array.isArray(savedShotDetails)) {
          setShotDetails(savedShotDetails);
        } else {
          setShotDetails([]);
        }
      } else {
        setShotDetails([]);
      }
      setIsGoodTake(currentLogSheet.data.isGoodTake === true || currentLogSheet.data.isGoodTake === 'true');

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

      if (currentLogSheet.data.insertSoundSpeed !== undefined) {
        const soundSpeed = currentLogSheet.data.insertSoundSpeed === 'true' || currentLogSheet.data.insertSoundSpeed === true;
        setInsertSoundSpeed(soundSpeed);
      }

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

      const newRangeData: { [key: string]: { from: string; to: string } } = {};
      const newShowRangeMode: { [key: string]: boolean } = {};

      const trySetRangeFromStableKeys = (sheetData: Record<string, any>) => {
        const soundFrom = sheetData['sound_from'];
        const soundTo = sheetData['sound_to'];
        if (soundFrom && soundTo) {
          newRangeData['soundFile'] = { from: soundFrom, to: soundTo };
          newShowRangeMode['soundFile'] = true;
        }
        // camera 1..N
        for (let i = 1; i <= (currentProject?.settings?.cameraConfiguration || 1); i++) {
          const fromKey = `camera${i}_from`;
          const toKey = `camera${i}_to`;
          if (sheetData[fromKey] && sheetData[toKey]) {
            const fieldId = i === 1 && (currentProject?.settings?.cameraConfiguration || 1) === 1 ? 'cameraFile' : `cameraFile${i}`;
            newRangeData[fieldId] = { from: sheetData[fromKey], to: sheetData[toKey] };
            newShowRangeMode[fieldId] = true;
          }
        }
      };

      trySetRangeFromStableKeys(currentLogSheet.data as any);

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
    const camCount = project?.settings?.cameraConfiguration || 1;

    if (classification === 'SFX' || classification === 'Ambience') {
      if (camCount === 1) {
        newDisabledFields.add('cameraFile');
      } else {
        for (let i = 1; i <= camCount; i++) {
          newDisabledFields.add(`cameraFile${i}`);
        }
      }
      newDisabledFields.add('sceneNumber');
      newDisabledFields.add('shotNumber');
      newDisabledFields.add('takeNumber');
    }

    if (shotDetails.includes('MOS')) {
      newDisabledFields.add('soundFile');
    }

    if (classification === 'Waste') {
      if (!wasteOptions.camera) {
        if (camCount === 1) {
          newDisabledFields.add('cameraFile');
        } else {
          for (let i = 1; i <= camCount; i++) {
            newDisabledFields.add(`cameraFile${i}`);
          }
        }
      }
      if (!wasteOptions.sound) {
        newDisabledFields.add('soundFile');
      }
    }

    if (classification === 'Insert' && insertSoundSpeed === false) {
      newDisabledFields.add('soundFile');
    }

    setDisabledFields(newDisabledFields);
  }, [classification, shotDetails, wasteOptions, insertSoundSpeed, project]);

  const HeaderLeft = () => (
    <TouchableOpacity onPress={() => router.back()} style={styles.headerButton}>
      <ArrowLeft size={24} color={colors.text} />
    </TouchableOpacity>
  );

  const updateTakeData = (fieldId: string, value: string) => {
    setTakeData(prev => ({ ...prev, [fieldId]: value }));
    if (validationErrors.has(fieldId)) {
      setValidationErrors(prev => {
        const newErrors = new Set(prev);
        newErrors.delete(fieldId);
        return newErrors;
      });
    }
  };

  const formatFileNumber = (value: string): string => {
    const numeric = value.replace(/[^0-9]/g, '');
    const num = parseInt(numeric, 10);
    if (isNaN(num)) return '';
    return num.toString().padStart(4, '0');
  };

  const formatFileNumberOnBlur = (value: string): string => {
    const numeric = value.replace(/[^0-9]/g, '');
    return numeric ? String(parseInt(numeric, 10)).padStart(4, '0') : '';
  };

  const toggleRangeMode = (fieldId: string) => {
    setShowRangeMode(prev => ({
      ...prev,
      [fieldId]: !prev[fieldId]
    }));

    if (!showRangeMode[fieldId]) {
      const currentValue = (takeData[fieldId] as string) || '0001';
      setRangeData(prev => ({
        ...prev,
        [fieldId]: { from: currentValue, to: currentValue }
      }));
    } else {
      const range = rangeData[fieldId];
      if (range) {
        updateTakeData(fieldId, range.from);
      }
    }
  };

  const updateRangeData = (fieldId: string, type: 'from' | 'to', value: string) => {
    const numericValue = value.replace(/[^0-9]/g, '');
    setRangeData(prev => ({
      ...prev,
      [fieldId]: {
        ...prev[fieldId],
        [type]: numericValue
      }
    }));

    const currentRange = rangeData[fieldId] || { from: '', to: '' };
    const updatedRange = { ...currentRange, [type]: numericValue } as { from: string; to: string };
    if (updatedRange.from && updatedRange.to) {
      updateTakeData(fieldId, `${updatedRange.from}-${updatedRange.to}`);
    } else if (updatedRange.from) {
      updateTakeData(fieldId, updatedRange.from);
    }
  };

  const handleClassificationPress = (type: ClassificationType) => {
    const newClassification = classification === type ? null : type;
    setClassification(newClassification);

    if (newClassification === 'Ambience' || newClassification === 'SFX') {
      setShotDetails(prev => prev.filter(d => d !== 'MOS'));
    }

    if (newClassification === type) {
      if (type === 'Waste') {
        setShowWasteModal(true);
      } else if (type === 'Insert') {
        setShowInsertModal(true);
      } else {
        setWasteOptions({ camera: false, sound: false });
        setInsertSoundSpeed(null);
      }
    } else {
      setWasteOptions({ camera: false, sound: false });
      setInsertSoundSpeed(null);
    }
  };

  const handleShotDetailPress = (detail: ShotDetailsType) => {
    setShotDetails(prev => {
      if (prev.includes(detail)) {
        return prev.filter(d => d !== detail);
      } else {
        return [...prev, detail];
      }
    });
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

  const findDuplicateTake = () => {
    if (!logSheet) return null;
    const projectLogSheets = logSheets.filter(sheet => sheet.projectId === logSheet.projectId && sheet.id !== logSheet.id);
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

  const findFirstDuplicateFile = () => {
    if (!logSheet) return null;
    const projectLogSheets = logSheets.filter(sheet => sheet.projectId === logSheet.projectId && sheet.id !== logSheet.id);
    type DuplicateInfo = { type: string; label: string; fieldId: string; value: string; number: number; existingEntry: any } | null;

    if (takeData.soundFile && !disabledFields.has('soundFile')) {
      const val = takeData.soundFile as string;
      const existingEntry = projectLogSheets.find(s => s.data?.soundFile === val);
      if (existingEntry) {
        return { type: 'file', label: 'Sound File', fieldId: 'soundFile', value: val, number: parseInt(val) || 0, existingEntry } as DuplicateInfo;
      }
    }

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

  const validateMandatoryFields = () => {
    const errors = new Set<string>();
    const missingFields: string[] = [];

    // Scene and Shot are not mandatory when Ambience or SFX
    const isAmbienceOrSFX = classification === 'Ambience' || classification === 'SFX';
    if (!isAmbienceOrSFX) {
      if (!takeData.sceneNumber?.trim()) {
        errors.add('sceneNumber');
        missingFields.push('Scene');
      }
      if (!takeData.shotNumber?.trim()) {
        errors.add('shotNumber');
        missingFields.push('Shot');
      }
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

  // Helper function to sanitize data before saving (same as New Log)
  const sanitizeDataBeforeSave = (data: Record<string, string>, classification: ClassificationType | null) => {
    const sanitizedData = { ...data };
    
    // For Ambience and SFX, remove scene, shot, and take numbers
    if (classification === 'Ambience' || classification === 'SFX') {
      delete sanitizedData.sceneNumber;
      delete sanitizedData.shotNumber;
      delete sanitizedData.takeNumber;
      
      // Also remove camera files for these classifications
      const cameraConfiguration = project?.settings?.cameraConfiguration || 1;
      if (cameraConfiguration === 1) {
        delete sanitizedData.cameraFile;
      } else {
        for (let i = 1; i <= cameraConfiguration; i++) {
          delete sanitizedData[`cameraFile${i}`];
        }
      }
    }
    
    return sanitizedData;
  };

  const handleSaveTake = () => {
    if (!logSheet) return;
    if (!validateMandatoryFields()) {
      return;
    }

    const duplicateTake = findDuplicateTake();
    if (duplicateTake) {
      Alert.alert(
        'Duplicate Detected',
        `A duplicate was found. Would you like to insert before, insert after, or cancel?`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Insert Before',
            onPress: () => {
              handleSaveWithDuplicateHandling('before', duplicateTake);
            },
          },
          {
            text: 'Insert After',
            onPress: () => {
              handleSaveWithDuplicateHandling('after', duplicateTake);
            },
          },
        ]
      );
      return;
    }

    const duplicateFile = findFirstDuplicateFile();
    if (duplicateFile) {
      Alert.alert(
        'Duplicate Detected',
        `A duplicate was found. Would you like to insert before, insert after, or cancel?`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Insert Before',
            onPress: () => {
              handleSaveWithDuplicateHandling('before', duplicateFile);
            },
          },
          {
            text: 'Insert After',
            onPress: () => {
              handleSaveWithDuplicateHandling('after', duplicateFile);
            },
          },
        ]
      );
      return;
    }

    saveNormally();
  };

  const pruneDisabled = (data: Record<string, any>) => {
    const cleaned: Record<string, any> = { ...data };
    disabledFields.forEach((f) => {
      if (f in cleaned) delete cleaned[f];
    });
    return cleaned;
  };

  const handleSaveWithDuplicateHandling = (position: 'before' | 'after', duplicateInfo: any) => {
    if (!logSheet || !project) return;
    // Backend shifting disabled: store only UI-provided values; do not renumber existing entries.
    const camCount = project?.settings?.cameraConfiguration || 1;
    const existingEntry = duplicateInfo.existingEntry;

    if (position === 'before') {
      let newLogData = { ...takeData };

      if (duplicateInfo.type === 'take') {
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

        const duplicateSceneNumber = existingEntry.data?.sceneNumber;
        const duplicateShotNumber = existingEntry.data?.shotNumber;
        const newLogSceneNumber = newLogData.sceneNumber;
        const newLogShotNumber = newLogData.shotNumber;
        const isSameSceneAndShot = duplicateSceneNumber === newLogSceneNumber && duplicateShotNumber === newLogShotNumber;

        if (isSameSceneAndShot) {
          if (existingEntry.data?.takeNumber) {
            newLogData.takeNumber = existingEntry.data.takeNumber;
          }
          // Backend shifting disabled: no renumbering of other entries.
        } else {
          const projectLogSheets = logSheets.filter(sheet => sheet.projectId === logSheet.projectId && sheet.id !== logSheet.id);
          const sameShotTakes = projectLogSheets.filter(sheet => sheet.data?.sceneNumber === newLogSceneNumber && sheet.data?.shotNumber === newLogShotNumber);
          let maxTakeNumber = 0;
          sameShotTakes.forEach(sheet => {
            const takeNum = parseInt(sheet.data?.takeNumber || '0');
            if (takeNum > maxTakeNumber) {
              maxTakeNumber = takeNum;
            }
          });
          newLogData.takeNumber = String(maxTakeNumber + 1);
        }

        // Backend shifting disabled: no renumbering of other entries.

      } else if (duplicateInfo.type === 'file') {
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
        // Backend shifting disabled: no renumbering of other entries.
        // Backend shifting disabled: no renumbering of other entries.
      }

      let finalTakeData = { ...newLogData };
      if (camCount > 1) {
        for (let i = 1; i <= camCount; i++) {
          const fieldId = `cameraFile${i}`;
          const isRecActive = cameraRecState[fieldId] ?? true;
          if (!isRecActive) {
            delete finalTakeData[fieldId];
          }
        }
      }

      finalTakeData = pruneDisabled(finalTakeData);
      const filteredShotDetails = (classification === 'Ambience' || classification === 'SFX')
        ? shotDetails.filter(d => d !== 'MOS')
        : shotDetails;
      const updatedData = {
        ...finalTakeData,
        classification,
        shotDetails: filteredShotDetails,
        isGoodTake,
        wasteOptions: classification === 'Waste' ? JSON.stringify(wasteOptions) : '',
        insertSoundSpeed: classification === 'Insert' ? (insertSoundSpeed?.toString() || '') : '',
        cameraRecState: camCount > 1 ? cameraRecState : undefined
      };
      updateLogSheet(logSheet.id, updatedData);

    } else {
      let newLogData = { ...takeData };

      if (duplicateInfo.type === 'take') {
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
        const duplicateSceneNumber = existingEntry.data?.sceneNumber;
        const duplicateShotNumber = existingEntry.data?.shotNumber;
        const newLogSceneNumber = newLogData.sceneNumber;
        const newLogShotNumber = newLogData.shotNumber;
        const isSameSceneAndShot = duplicateSceneNumber === newLogSceneNumber && duplicateShotNumber === newLogShotNumber;
        if (isSameSceneAndShot) {
          if (existingEntry.data?.takeNumber) {
            const duplicateTakeNum = parseInt(existingEntry.data.takeNumber) || 0;
            newLogData.takeNumber = String(duplicateTakeNum);
          }
          // Backend shifting disabled: no renumbering of other entries.
        }
        // Backend shifting disabled: no renumbering of other entries.

      } else if (duplicateInfo.type === 'file') {
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
        const duplicateSceneNumber = existingEntry.data?.sceneNumber;
        const duplicateShotNumber = existingEntry.data?.shotNumber;
        const newLogSceneNumber = newLogData.sceneNumber;
        const newLogShotNumber = newLogData.shotNumber;
        const isSameSceneAndShot = duplicateSceneNumber === newLogSceneNumber && duplicateShotNumber === newLogShotNumber;
        if (isSameSceneAndShot) {
          if (existingEntry.data?.takeNumber) {
            const duplicateTakeNum = parseInt(existingEntry.data.takeNumber) || 0;
            newLogData.takeNumber = String(duplicateTakeNum);
          }
          // Backend shifting disabled: no renumbering of other entries.
        }
        // Backend shifting disabled: no renumbering of other entries.
      }

      let finalTakeData = { ...newLogData };
      if (camCount > 1) {
        for (let i = 1; i <= camCount; i++) {
          const fieldId = `cameraFile${i}`;
          const isRecActive = cameraRecState[fieldId] ?? true;
          if (!isRecActive) {
            delete finalTakeData[fieldId];
          }
        }
      }
      finalTakeData = pruneDisabled(finalTakeData);
      // Apply sanitization to enforce business rules
      finalTakeData = sanitizeDataBeforeSave(finalTakeData, classification);
      
      const filteredShotDetails = (classification === 'Ambience' || classification === 'SFX')
        ? shotDetails.filter(d => d !== 'MOS')
        : shotDetails;
      const updatedData = {
        ...finalTakeData,
        classification,
        shotDetails: filteredShotDetails,
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
      let finalTakeData = { ...takeData } as Record<string, any>;
      const cameraConfiguration = project?.settings?.cameraConfiguration || 1;
      if (cameraConfiguration > 1) {
        for (let i = 1; i <= cameraConfiguration; i++) {
          const fieldId = `cameraFile${i}`;
          const isRecActive = cameraRecState[fieldId] ?? true;
          if (!isRecActive) {
            delete finalTakeData[fieldId];
          }
        }
      }

      const pad4 = (v?: string) => (v ? String(parseInt(v as any, 10) || 0).padStart(4, '0') : '');
      const applyRangePersistence = (data: Record<string, any>) => {
        const out: Record<string, any> = { ...data };
        const handleField = (fieldId: string, enabled: boolean, idx?: number) => {
          const r = rangeData[fieldId];
          const inRange = showRangeMode[fieldId] === true;
          if (!enabled) {
            if (fieldId === 'soundFile') {
              delete out.soundFile;
              delete out['sound_from'];
              delete out['sound_to'];
            } else if (idx != null) {
              const base = idx === 1 && cameraConfiguration === 1 ? 'cameraFile' : `cameraFile${idx}`;
              delete out[base];
              delete out[`camera${idx}_from`];
              delete out[`camera${idx}_to`];
            }
            return;
          }
          if (inRange && r && r.from && r.to) {
            if (fieldId === 'soundFile') {
              out['sound_from'] = pad4(r.from);
              out['sound_to'] = pad4(r.to);
              delete out.soundFile;
            } else if (idx != null) {
              out[`camera${idx}_from`] = pad4(r.from);
              out[`camera${idx}_to`] = pad4(r.to);
              const base = idx === 1 && cameraConfiguration === 1 ? 'cameraFile' : `cameraFile${idx}`;
              delete out[base];
            }
          } else {
            if (fieldId === 'soundFile') {
              delete out['sound_from'];
              delete out['sound_to'];
            } else if (idx != null) {
              delete out[`camera${idx}_from`];
              delete out[`camera${idx}_to`];
            }
          }
        };

        const soundEnabled = !disabledFields.has('soundFile');
        handleField('soundFile', soundEnabled);

        if (cameraConfiguration === 1) {
          const camEnabled = !disabledFields.has('cameraFile');
          handleField('cameraFile', camEnabled, 1);
        } else {
          for (let i = 1; i <= cameraConfiguration; i++) {
            const fieldId = `cameraFile${i}`;
            const camEnabled = !disabledFields.has(fieldId) && (cameraRecState[fieldId] ?? true);
            handleField(fieldId, camEnabled, i);
          }
        }
        return out;
      };

      finalTakeData = pruneDisabled(finalTakeData);
      finalTakeData = sanitizeDataBeforeSave(finalTakeData, classification);
      finalTakeData = applyRangePersistence(finalTakeData);

      const filteredShotDetails = (classification === 'Ambience' || classification === 'SFX')
        ? shotDetails.filter(d => d !== 'MOS')
        : shotDetails;
      
      const updatedData = {
        ...finalTakeData,
        classification: classification || '',
        shotDetails: filteredShotDetails.length > 0 ? filteredShotDetails : [],
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
              style={[styles.rangeButton, isDisabled && styles.disabledButton]}
              onPress={() => setSoundRangeEnabled(false)}
              disabled={isDisabled}
            >
              <Text style={[styles.rangeButtonText, isDisabled && styles.disabledText]}>Range</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.rangeContainer}>
            <TextInput
              style={[styles.fieldInput, styles.rangeInput, isDisabled && styles.disabledInput]}
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
              style={[styles.fieldInput, styles.rangeInput, isDisabled && styles.disabledInput]}
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
              style={[styles.rangeButton, isDisabled && styles.disabledButton]}
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
    const fields: React.ReactElement[] = [];
    for (let i = 1; i <= cameraCount; i++) {
      const fieldId = cameraCount === 1 ? 'cameraFile' : `cameraFile${i}`;
      const fieldLabel = cameraCount === 1 ? 'Camera File' : `Camera File ${i}`;
      const isDisabled = disabledFields.has(fieldId);

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
              <TouchableOpacity
                style={[styles.rangeButton, isDisabled && styles.disabledButton]}
                onPress={() => !isDisabled && toggleRangeMode(fieldId)}
                disabled={isDisabled}
              >
                <Text style={[styles.rangeButtonText, isDisabled && styles.disabledText]}>Range</Text>
              </TouchableOpacity>
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
          {showRangeMode[fieldId] && !isDisabled ? (
            <View style={styles.rangeContainer}>
              <TextInput
                style={[styles.fieldInput, styles.rangeInput, isDisabled && styles.disabledInput]}
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
                editable={!isDisabled}
              />
              <Text style={styles.rangeSeparator}>-</Text>
              <TextInput
                style={[styles.fieldInput, styles.rangeInput, isDisabled && styles.disabledInput]}
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
                editable={!isDisabled}
              />
            </View>
          ) : (
            <TextInput
              ref={(ref) => { inputRefs.current[fieldId] = ref; }}
              style={[
                styles.fieldInput, 
                isDisabled && styles.disabledInput,
                validationErrors.has(fieldId) && styles.errorInput,
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
          )}
        </View>
      );
    }
    return fields;
  };

  if (!logSheet || !project) {
    return (
      <View style={styles.container}>
        <Stack.Screen 
          options={{
            title: "Take Not Found",
            headerLeft: () => <HeaderLeft />,
            headerBackVisible: false,
          }} 
        />
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Take not found</Text>
        </View>
      </View>
    );
  }

  const enabledFields = project.settings?.logSheetFields || [];
  const customFields = project.settings?.customFields || [];
  const cameraConfiguration = project.settings?.cameraConfiguration || 1;

  const fieldsToRender = enabledFields.filter((field: FieldType) => field.id !== 'cameraFile' && field.id !== 'soundFile' && field.id !== 'notesForTake');
  const notesField = enabledFields.find((field: FieldType) => field.id === 'notesForTake');

  const allFieldIds: string[] = [];
  fieldsToRender.forEach((field: FieldType) => allFieldIds.push(field.id));
  for (let i = 1; i <= cameraConfiguration; i++) {
    const fieldId = cameraConfiguration === 1 ? 'cameraFile' : `cameraFile${i}`;
    allFieldIds.push(fieldId);
  }
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
  const soundFieldEnabled = !!enabledFields.find((field: FieldType) => field.id === 'soundFile');
  if (soundFieldEnabled) {
    allFieldIds.push('soundFile');
  }
  customFields.forEach((_: string, index: number) => {
    allFieldIds.push(`custom_${index}`);
  });
  if (notesField) {
    allFieldIds.push('notesForTake');
  }

  return (
    <KeyboardAvoidingView 
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      <SafeAreaView style={styles.safeArea}>
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
        <View style={[styles.sectionContainer, isLandscape ? styles.mainContainerLandscape : null]}>
          <View style={styles.takeInfo}>
            <Text style={styles.takeTitle}>
              {classification === 'Ambience' ? 'Ambience' : classification === 'SFX' ? 'SFX' : `Scene ${takeData.sceneNumber || 'Unknown'} - Shot ${takeData.shotNumber || 'Unknown'}`}
            </Text>
            <Text style={styles.takeSubtitle}>
              created: {new Date(logSheet.createdAt).toLocaleDateString()}
            </Text>
            <Text style={styles.takeSubtitle}>
              Last Updated: {new Date(logSheet.updatedAt).toLocaleDateString()}
            </Text>
          </View>

          <View style={styles.topRowContainer}>
            {enabledFields.find((field: FieldType) => field.id === 'sceneNumber') && (
              <View style={styles.topFieldContainer}>
                <Text style={[styles.topFieldLabel, validationErrors.has('sceneNumber') && styles.errorLabel]}>
                  Scene<Text style={styles.asterisk}> *</Text>
                </Text>
                <TextInput
                  style={[
                    styles.topFieldInput,
                    disabledFields.has('sceneNumber') && styles.disabledInput,
                    validationErrors.has('sceneNumber') && styles.errorInput
                  ]}
                  value={disabledFields.has('sceneNumber') ? '' : (takeData.sceneNumber || '')}
                  onChangeText={(text) => updateTakeData('sceneNumber', text)}
                  placeholder={disabledFields.has('sceneNumber') ? '' : ''}
                  placeholderTextColor={colors.subtext}
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
                  disabledFields.has('shotNumber') && styles.disabledLabel,
                  validationErrors.has('shotNumber') && styles.errorLabel
                ]}>
                  Shot<Text style={styles.asterisk}> *</Text>
                </Text>
                <TextInput
                  style={[
                    styles.topFieldInput,
                    disabledFields.has('shotNumber') && styles.disabledInput,
                    validationErrors.has('shotNumber') && styles.errorInput
                  ]}
                  value={disabledFields.has('shotNumber') ? '' : (takeData.shotNumber || '')}
                  onChangeText={(text) => updateTakeData('shotNumber', text)}
                  placeholder={disabledFields.has('shotNumber') ? '' : ''}
                  placeholderTextColor={colors.subtext}
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
                  disabledFields.has('takeNumber') && styles.disabledLabel,
                  validationErrors.has('takeNumber') && styles.errorLabel
                ]}>Take<Text style={styles.asterisk}> *</Text></Text>
                <TextInput
                  style={[
                    styles.topFieldInput,
                    disabledFields.has('takeNumber') && styles.disabledInput,
                    validationErrors.has('takeNumber') && styles.errorInput
                  ]}
                  value={disabledFields.has('takeNumber') ? '' : (takeData.takeNumber || '')}
                  onChangeText={(text) => updateTakeData('takeNumber', text)}
                  placeholder={disabledFields.has('takeNumber') ? '' : ''}
                  placeholderTextColor={colors.subtext}
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

          {renderCameraFields(cameraConfiguration, allFieldIds)}

          {cardFieldEnabled && (
            cameraConfiguration === 1 ? (
              <View style={styles.fieldContainer}>
                <Text style={styles.fieldLabel}>Card Number</Text>
                <TextInput
                  ref={(ref) => { inputRefs.current['cardNumber'] = ref; }}
                  style={styles.fieldInput}
                  value={takeData.cardNumber || ''}
                  onChangeText={(text) => updateTakeData('cardNumber', text)}
                  placeholder={'Enter card number'}
                  placeholderTextColor={colors.subtext}
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
                      <Text style={styles.fieldLabel}>{label}</Text>
                      <TextInput
                        ref={(ref) => { inputRefs.current[fieldId] = ref; }}
                        style={styles.fieldInput}
                        value={takeData[fieldId] || ''}
                        onChangeText={(text) => updateTakeData(fieldId, text)}
                        placeholder={`Enter ${label}`}
                        placeholderTextColor={colors.subtext}
                        returnKeyType="next"
                      />
                    </View>
                  );
                })}
              </View>
            )
          )}

          {enabledFields.find((field: FieldType) => field.id === 'soundFile') && renderField({ id: 'soundFile', label: 'Sound File' }, allFieldIds)}

          {fieldsToRender
            .filter((field: FieldType) => !['sceneNumber', 'shotNumber', 'takeNumber'].includes(field.id))
            .map((field: FieldType) => renderField(field, allFieldIds))}

          {customFields.map((fieldName: string, index: number) => 
            renderField({
              id: `custom_${index}`,
              label: fieldName
            }, allFieldIds)
          )}

          {notesField && renderField(notesField, allFieldIds)}
        </View>

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

        <View style={[styles.sectionContainer, styles.shotDetailsSection]}>
          <Text style={styles.sectionTitle}>Shot Details</Text>
          <View style={styles.shotDetailsRow}>
            {(['MOS', 'NO SLATE'] as ShotDetailsType[]).map((type) => {
              const isDisabled = type === 'MOS' && (classification === 'Ambience' || classification === 'SFX');
              const isActive = shotDetails.includes(type);
              return (
                <TouchableOpacity
                  key={type}
                  style={[
                    styles.shotDetailsButton,
                    isActive && styles.shotDetailsButtonActive,
                    isDisabled && styles.shotDetailsButtonDisabled
                  ]}
                  onPress={() => !isDisabled && handleShotDetailPress(type)}
                  disabled={isDisabled}
                >
                  <Text style={[
                    styles.shotDetailsButtonText,
                    isActive && styles.shotDetailsButtonTextActive,
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
      </SafeAreaView>

      <Modal
        visible={showWasteModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowWasteModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Waste Options</Text>
            </View>
            <TouchableOpacity
              style={styles.checkboxRow}
              onPress={() => setWasteOptions(prev => ({ ...prev, camera: !prev.camera }))}
            >
              <View style={[styles.checkbox, styles.checkboxLightBorder, wasteOptions.camera ? styles.checkboxChecked : undefined]}
              >
                {wasteOptions.camera ? <Check size={16} color="white" /> : null}
              </View>
              <Text style={styles.checkboxLabel}>Camera file waste</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.checkboxRow}
              onPress={() => setWasteOptions(prev => ({ ...prev, sound: !prev.sound }))}
            >
              <View style={[styles.checkbox, styles.checkboxLightBorder, wasteOptions.sound ? styles.checkboxChecked : undefined]}
              >
                {wasteOptions.sound ? <Check size={16} color="white" /> : null}
              </View>
              <Text style={styles.checkboxLabel}>Sound file waste</Text>
            </TouchableOpacity>
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.modalCancelButton}
                onPress={() => {
                  setShowWasteModal(false);
                  setClassification(null);
                  setWasteOptions({ camera: false, sound: false });
                }}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalConfirmButton}
                onPress={handleWasteModalConfirm}
              >
                <Text style={styles.modalConfirmText}>Confirm</Text>
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
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Did sound speed in this shot?</Text>
            </View>
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.modalConfirmButton}
                onPress={() => handleInsertModalConfirm(true)}
              >
                <Text style={styles.modalConfirmText}>Yes</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalConfirmButton}
                onPress={() => handleInsertModalConfirm(false)}
              >
                <Text style={styles.modalConfirmText}>No</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Toast />
    </KeyboardAvoidingView>
  );
}

const createStyles = (colors: ReturnType<typeof useColors>) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flex: 1,
    width: '100%',
  },
  scrollContent: {
    flexGrow: 1,
    alignItems: 'stretch',
    padding: 16,
  },
  scrollContentLandscape: {
    paddingHorizontal: 16,
    minWidth: '100%',
  },
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
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
  mainContainerLandscape: {
    margin: 0,
    borderRadius: 0,
    paddingHorizontal: 24,
    paddingVertical: 16,
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
    backgroundColor: colors.inputBackground,
    height: 48,
  },
  fieldContainer: {
    marginBottom: 24,
  },
  fieldLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 8,
  },
  fieldInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    color: colors.text,
    backgroundColor: colors.inputBackground,
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
    paddingHorizontal: 16,
    shadowColor: 'transparent',
    shadowOffset: {
      width: 0,
      height: 0,
    },
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
    marginTop: 24,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
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
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 16,
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
    backgroundColor: colors.inputBackground,
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
    borderColor: colors.border,
    backgroundColor: colors.cardSecondary,
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
    borderColor: colors.border,
    borderRadius: 8,
    backgroundColor: colors.cardSecondary,
  },
  rangeButtonText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#007AFF',
  },
  disabledButton: {
    opacity: 0.5,
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
    backgroundColor: colors.cardSecondary,
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
    backgroundColor: colors.modalBackground,
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
  modalDescription: {
    fontSize: 16,
    color: colors.text,
    marginBottom: 20,
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
  checkboxLightBorder: {
    borderColor: colors.text,
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
  takeInfo: {
    marginBottom: 16,
    alignItems: 'center',
  },
  takeTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 6,
    textAlign: 'center',
  },
  takeSubtitle: {
    fontSize: 14,
    color: colors.subtext,
    marginBottom: 4,
    textAlign: 'center',
  },
});