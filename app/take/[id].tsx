import React, { useState, useEffect, useRef } from 'react';
import { View, StyleSheet, ScrollView, Text, TextInput, Alert, Modal, TouchableOpacity, KeyboardAvoidingView, Platform, Keyboard, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, Stack, router } from 'expo-router';
import { ArrowLeft, Check } from 'lucide-react-native';
import { useProjectStore } from '@/store/projectStore';
import { useColors } from '@/constants/colors';
import { ClassificationType, ShotDetailsType } from '@/types';
import Toast from 'react-native-toast-message';
import { handleSoundFileForDuplicateInsertion } from '@/components/CameraHandlers/SoundHandler';
import { calculateSoundDeltaForShifting, calculateCameraDeltaForShifting } from '@/components/CameraHandlers/deltaCalculator';

interface FieldType {
  id: string;
  label: string;
  enabled?: boolean;
  required?: boolean;
  locked?: boolean;
}

export default function EditTakeScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { projects, logSheets, updateLogSheet, updateTakeNumbers, updateFileNumbers, moveExistingLogBefore } = useProjectStore();
  const colors = useColors();

  const [logSheet, setLogSheet] = useState(logSheets.find(l => l.id === id));
  const [project, setProject] = useState<any>(null);
  const [takeData, setTakeData] = useState<Record<string, string>>({});
  const [classification, setClassification] = useState<ClassificationType | null>(null);
  const [shotDetails, setShotDetails] = useState<ShotDetailsType[]>([]);
  const [isGoodTake, setIsGoodTake] = useState(false);
  const [lastShotDescriptions, setLastShotDescriptions] = useState<Record<string, string>>({});
  const [lastEpisodeNumbers, setLastEpisodeNumbers] = useState<Record<string, string>>({});
  const [showWasteModal, setShowWasteModal] = useState(false);
  const [showInsertModal, setShowInsertModal] = useState(false);
  const [wasteOptions, setWasteOptions] = useState({ camera: false, sound: false });
  const [insertSoundSpeed, setInsertSoundSpeed] = useState<boolean | null>(null);
  const [showRangeMode, setShowRangeMode] = useState<{ [key: string]: boolean }>({});
  const [rangeData, setRangeData] = useState<{ [key: string]: { from: string; to: string } }>({});
  const [cameraRangeEnabled, setCameraRangeEnabled] = useState(false);
  const [cameraRange, setCameraRange] = useState({ from: '', to: '' });
  const [cameraRecState, setCameraRecState] = useState<{ [key: string]: boolean }>({});
  const [disabledFields, setDisabledFields] = useState<Set<string>>(new Set());
  const [validationErrors, setValidationErrors] = useState<Set<string>>(new Set());
  const inputRefs = useRef<Record<string, TextInput | null>>({});
  const scrollViewRef = useRef<ScrollView>(null);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const writingProgrammaticallyRef = useRef(false);
  const lastAutoIncrementRef = useRef<{ [key: string]: number }>({});
  const savedFieldValues = useRef<Record<string, string>>({});

  const { width, height } = useWindowDimensions();
  const styles = createStyles(colors);
  const isLandscape = width > height;

  // Helper function to get the highest file number from all logs for a specific field
  const getHighestFileNumber = React.useCallback((fieldId: string, projectLogSheets: any[]) => {
    let highestNum = 0;
    
    projectLogSheets.forEach(sheet => {
      if (sheet.data) {
        // Check single value field
        if (sheet.data[fieldId]) {
          const fileValue = sheet.data[fieldId];
          if (typeof fileValue === 'string') {
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
        }
        
        // Check range format stored in separate fields (sound_from/sound_to, camera1_from/camera1_to, etc.)
        if (fieldId === 'soundFile') {
          const soundFrom = sheet.data['sound_from'];
          const soundTo = sheet.data['sound_to'];
          if (soundFrom) {
            const fromNum = parseInt(soundFrom) || 0;
            highestNum = Math.max(highestNum, fromNum);
          }
          if (soundTo) {
            const toNum = parseInt(soundTo) || 0;
            highestNum = Math.max(highestNum, toNum);
          }
        } else if (fieldId.startsWith('cameraFile')) {
          // Extract camera number from fieldId (e.g., cameraFile1 -> 1, cameraFile -> 1)
          const cameraNum = fieldId === 'cameraFile' ? 1 : parseInt(fieldId.replace('cameraFile', '')) || 1;
          const cameraFrom = sheet.data[`camera${cameraNum}_from`];
          const cameraTo = sheet.data[`camera${cameraNum}_to`];
          if (cameraFrom) {
            const fromNum = parseInt(cameraFrom) || 0;
            highestNum = Math.max(highestNum, fromNum);
          }
          if (cameraTo) {
            const toNum = parseInt(cameraTo) || 0;
            highestNum = Math.max(highestNum, toNum);
          }
        }
      }
    });
    
    return highestNum;
  }, []);

  // Helper function to compute next file numbers for all fields
  const computeNextFileNumbers = React.useCallback((projectLogSheets: any[], currentProject: any) => {
    const nextNumbers: { [key: string]: number } = {};
    
    // Compute next sound file number
    const highestSound = getHighestFileNumber('soundFile', projectLogSheets);
    nextNumbers['soundFile'] = highestSound + 1;
    
    // Compute next camera file numbers
    const cameraConfiguration = currentProject?.settings?.cameraConfiguration || 1;
    if (cameraConfiguration === 1) {
      const highestCamera = getHighestFileNumber('cameraFile', projectLogSheets);
      nextNumbers['cameraFile'] = highestCamera + 1;
    } else {
      for (let i = 1; i <= cameraConfiguration; i++) {
        const fieldId = `cameraFile${i}`;
        const highestCamera = getHighestFileNumber(fieldId, projectLogSheets);
        nextNumbers[fieldId] = highestCamera + 1;
      }
    }
    
    return nextNumbers;
  }, [getHighestFileNumber]);

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

    // Build shot description and episode maps from existing logs
    if (currentProject) {
      const projectLogSheets = logSheets.filter(s => s.projectId === currentProject.id);
      const shotDescMap: Record<string, string> = {};
      const episodeMap: Record<string, string> = {};
      projectLogSheets.forEach(sheet => {
        if (sheet.id === currentLogSheet?.id) return;
        if (sheet.data?.sceneNumber && sheet.data?.shotNumber && sheet.data?.descriptionOfShot) {
          const key = `${sheet.data.sceneNumber}_${sheet.data.shotNumber}`;
          shotDescMap[key] = sheet.data.descriptionOfShot;
        }
        if (sheet.data?.sceneNumber && sheet.data?.shotNumber && sheet.data?.episodeNumber) {
          const key = `${sheet.data.sceneNumber}_${sheet.data.shotNumber}`;
          episodeMap[key] = sheet.data.episodeNumber;
        }
      });
      setLastShotDescriptions(shotDescMap);
      setLastEpisodeNumbers(episodeMap);
    }

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
      
      console.log('DEBUG OnLoad - Loading log sheet:');
      console.log('  currentLogSheet.data.camera1_from:', currentLogSheet.data?.camera1_from);
      console.log('  currentLogSheet.data.camera1_to:', currentLogSheet.data?.camera1_to);
      console.log('  currentLogSheet.data.cameraFile:', currentLogSheet.data?.cameraFile);
      console.log('  newRangeData:', newRangeData);
      console.log('  newShowRangeMode:', newShowRangeMode);
      
      setRangeData(newRangeData);
      setShowRangeMode(newShowRangeMode);

      if (newRangeData['cameraFile']) {
        setCameraRange(newRangeData['cameraFile']);
        setCameraRangeEnabled(true);
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
          const fieldId = 'cameraFile';
          newDisabledFields.add(fieldId);
          // Save current value before blanking only if not already saved
          setTakeData(prev => {
            if (prev[fieldId] && !savedFieldValues.current[fieldId]) {
              savedFieldValues.current[fieldId] = prev[fieldId];
            }
            // Blank only the camera field if it's not already blank
            if (prev[fieldId]) {
              return { ...prev, [fieldId]: '' };
            }
            return prev;
          });
        } else {
          for (let i = 1; i <= camCount; i++) {
            const fieldId = `cameraFile${i}`;
            newDisabledFields.add(fieldId);
            // Save current value before blanking only if not already saved
            setTakeData(prev => {
              if (prev[fieldId] && !savedFieldValues.current[fieldId]) {
                savedFieldValues.current[fieldId] = prev[fieldId];
              }
              // Blank only the camera field if it's not already blank
              if (prev[fieldId]) {
                return { ...prev, [fieldId]: '' };
              }
              return prev;
            });
          }
        }
      } else {
        // Camera is enabled, restore if needed
        if (camCount === 1) {
          const fieldId = 'cameraFile';
          if (savedFieldValues.current[fieldId]) {
            const savedValue = savedFieldValues.current[fieldId];
            delete savedFieldValues.current[fieldId];
            setTakeData(prev => ({ ...prev, [fieldId]: savedValue }));
          }
        } else {
          for (let i = 1; i <= camCount; i++) {
            const fieldId = `cameraFile${i}`;
            if (savedFieldValues.current[fieldId]) {
              const savedValue = savedFieldValues.current[fieldId];
              delete savedFieldValues.current[fieldId];
              setTakeData(prev => ({ ...prev, [fieldId]: savedValue }));
            }
          }
        }
      }
      if (!wasteOptions.sound) {
        const fieldId = 'soundFile';
        newDisabledFields.add(fieldId);
        // Save current value before blanking only if not already saved
        setTakeData(prev => {
          if (prev[fieldId] && !savedFieldValues.current[fieldId]) {
            savedFieldValues.current[fieldId] = prev[fieldId];
          }
          // Blank only the sound field if it's not already blank
          if (prev[fieldId]) {
            return { ...prev, [fieldId]: '' };
          }
          return prev;
        });
      } else {
        // Sound is enabled, restore if needed
        const fieldId = 'soundFile';
        if (savedFieldValues.current[fieldId]) {
          const savedValue = savedFieldValues.current[fieldId];
          delete savedFieldValues.current[fieldId];
          setTakeData(prev => ({ ...prev, [fieldId]: savedValue }));
        }
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
    setTakeData(prev => {
      const next = { ...prev, [fieldId]: value } as Record<string, string>;

      if (fieldId === 'shotNumber') {
        const scene = next.sceneNumber || '';
        const shot = typeof value === 'string' ? value : '';
        const key = `${scene}_${shot}`;
        const lastDesc = lastShotDescriptions[key];
        const lastEpisode = lastEpisodeNumbers[key];
        if (lastDesc != null) {
          next.descriptionOfShot = lastDesc;
        }
        if (lastEpisode != null) {
          next.episodeNumber = lastEpisode;
        }
      }

      return next;
    });
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
    const prevDisabled = new Set(disabledFields);
    setClassification(newClassification);

    // Reset MOS when switching to Ambience or SFX
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
      // Toggling Waste OFF - re-enable fields and restore saved values
      if (classification === 'Waste' && newClassification === null && logSheet) {
        const camCount = project?.settings?.cameraConfiguration || 1;
        
        // Re-enable and restore Camera Files
        if (wasteOptions.camera) {
          if (camCount === 1) {
            const fieldId = 'cameraFile';
            if (prevDisabled.has(fieldId)) {
              setTimeout(() => {
                // Restore saved value
                const savedValue = savedFieldValues.current[fieldId];
                if (savedValue) {
                  writingProgrammaticallyRef.current = true;
                  setTakeData(prev => ({
                    ...prev,
                    [fieldId]: savedValue
                  }));
                  // Clear saved value after restoring
                  delete savedFieldValues.current[fieldId];
                  setTimeout(() => { writingProgrammaticallyRef.current = false; }, 100);
                }
              }, 100);
            }
          } else {
            for (let i = 1; i <= camCount; i++) {
              const fieldId = `cameraFile${i}`;
              if (prevDisabled.has(fieldId)) {
                setTimeout(() => {
                  // Restore saved value
                  const savedValue = savedFieldValues.current[fieldId];
                  if (savedValue) {
                    writingProgrammaticallyRef.current = true;
                    setTakeData(prev => ({
                      ...prev,
                      [fieldId]: savedValue
                    }));
                    // Clear saved value after restoring
                    delete savedFieldValues.current[fieldId];
                    setTimeout(() => { writingProgrammaticallyRef.current = false; }, 100);
                  }
                }, 100);
              }
            }
          }
        }
        
        // Re-enable and restore Sound File
        if (wasteOptions.sound && prevDisabled.has('soundFile')) {
          setTimeout(() => {
            // Restore saved value
            const savedValue = savedFieldValues.current['soundFile'];
            if (savedValue) {
              writingProgrammaticallyRef.current = true;
              setTakeData(prev => ({
                ...prev,
                soundFile: savedValue
              }));
              // Clear saved value after restoring
              delete savedFieldValues.current['soundFile'];
              setTimeout(() => { writingProgrammaticallyRef.current = false; }, 100);
            }
          }, 100);
        }
      }
      
      setWasteOptions({ camera: false, sound: false });
      setInsertSoundSpeed(null);
    }
  };

  const handleShotDetailPress = (detail: ShotDetailsType) => {
    // Block MOS selection when classification is Ambience or SFX
    if (detail === 'MOS' && (classification === 'Ambience' || classification === 'SFX')) {
      return;
    }
    
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

  // Helper function to check if a number falls within a range (inclusive of both bounds)
  const isNumberInRange = (number: number, fromValue: string, toValue: string): boolean => {
    const from = parseInt(fromValue) || 0;
    const to = parseInt(toValue) || 0;
    const min = Math.min(from, to);
    const max = Math.max(from, to);
    // Check if number is within the range (inclusive)
    return number >= min && number <= max;
  };

  // Helper function to check if two ranges overlap (including all numbers in between)
  const doRangesOverlap = (range1From: number, range1To: number, range2From: number, range2To: number): boolean => {
    const min1 = Math.min(range1From, range1To);
    const max1 = Math.max(range1From, range1To);
    const min2 = Math.min(range2From, range2To);
    const max2 = Math.max(range2From, range2To);
    // Ranges overlap if they share any number (inclusive of all values in between)
    return !(max1 < min2 || min1 > max2);
  };

  // Helper function to expand a range into all numbers it contains
  const expandRange = (from: number, to: number): number[] => {
    const min = Math.min(from, to);
    const max = Math.max(from, to);
    const numbers: number[] = [];
    for (let i = min; i <= max; i++) {
      numbers.push(i);
    }
    return numbers;
  };

  // Helper to get inserted bounds (min/max) for a given field from current input
  const getInsertedBounds = (fieldId: string): { min: number; max: number } | null => {
    const r = rangeData[fieldId];
    if (showRangeMode[fieldId] && r?.from && r?.to) {
      const a = parseInt(r.from, 10) || 0;
      const b = parseInt(r.to, 10) || 0;
      return { min: Math.min(a, b), max: Math.max(a, b) };
    }
    const v = takeData[fieldId] as string | undefined;
    if (v && v.trim()) {
      const n = parseInt(v, 10) || 0;
      return { min: n, max: n };
    }
    return null;
  };

  // Helper regex to match both hyphen and en-dash
  const RANGE_SEP = /[-–]/;

  // Helper function to check if a string is a range (contains hyphen or en-dash)
  const isRangeString = (s?: string) => !!s && RANGE_SEP.test(s);

  // Helper function to get range values from stored data
  const getRangeFromData = (data: any, fieldId: string): { from: string; to: string } | null => {
    // First, check stable keys
    if (fieldId === 'soundFile') {
      const from = data['sound_from'];
      const to = data['sound_to'];
      if (from && to) return { from, to };
    } else if (fieldId.startsWith('cameraFile')) {
      const cameraNum = fieldId === 'cameraFile' ? 1 : parseInt(fieldId.replace('cameraFile', '')) || 1;
      const from = data[`camera${cameraNum}_from`];
      const to = data[`camera${cameraNum}_to`];
      if (from && to) return { from, to };
    }
    
    // Fallback: parse display field if it contains a range separator
    const raw = data[fieldId];
    if (typeof raw === 'string' && isRangeString(raw)) {
      const parts = raw.split(RANGE_SEP).map(s => s.replace(/\D/g, '')).filter(Boolean);
      if (parts.length === 2 && parts[0] && parts[1]) {
        return { from: parts[0], to: parts[1] };
      }
    }
    
    return null;
  };

  const findFirstDuplicateFile = () => {
    if (!logSheet) return null;
    const projectLogSheets = logSheets.filter(sheet => sheet.projectId === logSheet.projectId && sheet.id !== logSheet.id);
    type DuplicateInfo = { 
      type: string; 
      label: string; 
      fieldId: string; 
      value: string; 
      number: number; 
      existingEntry: any;
      isRangeConflict?: boolean;
      conflictType?: 'lower' | 'upper' | 'within';
      rangeInfo?: { from: string; to: string };
    } | null;

    // Sound first - check across all scenes and shots
    if (takeData.soundFile && !disabledFields.has('soundFile')) {
      const currentRange = rangeData['soundFile'];
      const isCurrentRange = showRangeMode['soundFile'] && currentRange?.from && currentRange?.to;
      
      if (isCurrentRange) {
        // Current input is a range - check for conflicts
        const currentFrom = parseInt(currentRange.from) || 0;
        const currentTo = parseInt(currentRange.to) || 0;
        const currentMin = Math.min(currentFrom, currentTo);
        const currentMax = Math.max(currentFrom, currentTo);
        const currentNumbers = expandRange(currentFrom, currentTo);
        
        for (const sheet of projectLogSheets) {
          const data = sheet.data;
          if (!data) continue;
          
          // Check against existing ranges
          const existingRange = getRangeFromData(data, 'soundFile');
          if (existingRange) {
            const existingFrom = parseInt(existingRange.from) || 0;
            const existingTo = parseInt(existingRange.to) || 0;
            const existingMin = Math.min(existingFrom, existingTo);
            const existingMax = Math.max(existingFrom, existingTo);
            const existingNumbers = expandRange(existingFrom, existingTo);
            
            // Check if any number in current range exists in existing range
            const hasOverlap = currentNumbers.some(num => existingNumbers.includes(num));
            if (hasOverlap) {
              // Determine conflict type: check if overlap is at boundaries or within
              let conflictType: 'lower' | 'upper' | 'within';
              const overlapAtLower = currentNumbers.some(n => n === existingMin);
              const overlapAtUpper = currentNumbers.some(n => n === existingMax);
              
              if (overlapAtLower && !overlapAtUpper) {
                conflictType = 'lower';
              } else if (overlapAtUpper && !overlapAtLower) {
                conflictType = 'upper';
              } else {
                conflictType = 'within';
              }
              
              return {
                type: 'file',
                label: 'Sound File',
                fieldId: 'soundFile',
                value: `${currentRange.from}–${currentRange.to}`,
                number: currentFrom,
                existingEntry: sheet,
                isRangeConflict: true,
                conflictType,
                rangeInfo: existingRange
              } as DuplicateInfo;
            }
          }
          
          // Check against existing single values
          if (data.soundFile && typeof data.soundFile === 'string' && !isRangeString(data.soundFile)) {
            const existingNum = parseInt(data.soundFile) || 0;
            if (currentNumbers.includes(existingNum)) {
              const conflictType = existingNum === currentMin ? 'lower' : (existingNum === currentMax ? 'upper' : 'within');
              return {
                type: 'file',
                label: 'Sound File',
                fieldId: 'soundFile',
                value: `${currentRange.from}–${currentRange.to}`,
                number: currentFrom,
                existingEntry: sheet,
                isRangeConflict: true,
                conflictType
              } as DuplicateInfo;
            }
          }
        }
      } else {
        // Current input is a single value - check for conflicts
        const val = takeData.soundFile as string;
        const currentNum = parseInt(val) || 0;
        
        for (const sheet of projectLogSheets) {
          const data = sheet.data;
          if (!data) continue;
          
          // Check against existing ranges
          const existingRange = getRangeFromData(data, 'soundFile');
          if (existingRange) {
            const existingFrom = parseInt(existingRange.from) || 0;
            const existingTo = parseInt(existingRange.to) || 0;
            const existingMin = Math.min(existingFrom, existingTo);
            const existingMax = Math.max(existingFrom, existingTo);
            
            if (isNumberInRange(currentNum, existingRange.from, existingRange.to)) {
              // Determine conflict type based on position in range
              let conflictType: 'lower' | 'upper' | 'within';
              if (currentNum === existingMin) {
                conflictType = 'lower';
              } else if (currentNum === existingMax) {
                conflictType = 'upper';
              } else {
                conflictType = 'within';
              }
              return {
                type: 'file',
                label: 'Sound File',
                fieldId: 'soundFile',
                value: val,
                number: currentNum,
                existingEntry: sheet,
                isRangeConflict: true,
                conflictType,
                rangeInfo: existingRange
              } as DuplicateInfo;
            }
          }
          
          // Check against existing single values
          if (data.soundFile === val) {
            return {
              type: 'file',
              label: 'Sound File',
              fieldId: 'soundFile',
              value: val,
              number: currentNum,
              existingEntry: sheet
            } as DuplicateInfo;
          }
        }
      }
    }

    const cameraConfiguration = project?.settings?.cameraConfiguration || 1;
    if (cameraConfiguration === 1) {
      if (takeData.cameraFile && !disabledFields.has('cameraFile')) {
        const currentRange = rangeData['cameraFile'];
        const isCurrentRange = showRangeMode['cameraFile'] && currentRange?.from && currentRange?.to;
        
        if (isCurrentRange) {
          // Current input is a range - check for conflicts
          const currentFrom = parseInt(currentRange.from) || 0;
          const currentTo = parseInt(currentRange.to) || 0;
          const currentMin = Math.min(currentFrom, currentTo);
          const currentMax = Math.max(currentFrom, currentTo);
          const currentNumbers = expandRange(currentFrom, currentTo);
          
          for (const sheet of projectLogSheets) {
            const data = sheet.data;
            if (!data) continue;
            
            // Check against existing ranges
            const existingRange = getRangeFromData(data, 'cameraFile');
            if (existingRange) {
              const existingFrom = parseInt(existingRange.from) || 0;
              const existingTo = parseInt(existingRange.to) || 0;
              const existingMin = Math.min(existingFrom, existingTo);
              const existingMax = Math.max(existingFrom, existingTo);
              const existingNumbers = expandRange(existingFrom, existingTo);
              
              // Check if any number in current range exists in existing range
              const hasOverlap = currentNumbers.some(num => existingNumbers.includes(num));
              if (hasOverlap) {
                // Determine conflict type: check if overlap is at boundaries or within
                let conflictType: 'lower' | 'upper' | 'within';
                const overlapAtLower = currentNumbers.some(n => n === existingMin);
                const overlapAtUpper = currentNumbers.some(n => n === existingMax);
                
                if (overlapAtLower && !overlapAtUpper) {
                  conflictType = 'lower';
                } else if (overlapAtUpper && !overlapAtLower) {
                  conflictType = 'upper';
                } else {
                  conflictType = 'within';
                }
                
                return {
                  type: 'file',
                  label: 'Camera File',
                  fieldId: 'cameraFile',
                  value: `${currentRange.from}–${currentRange.to}`,
                  number: currentFrom,
                  existingEntry: sheet,
                  isRangeConflict: true,
                  conflictType,
                  rangeInfo: existingRange
                } as DuplicateInfo;
              }
            }
            
            // Check against existing single values
            if (data.cameraFile && typeof data.cameraFile === 'string' && !isRangeString(data.cameraFile)) {
              const existingNum = parseInt(data.cameraFile) || 0;
              if (currentNumbers.includes(existingNum)) {
                const conflictType = existingNum === currentMin ? 'lower' : (existingNum === currentMax ? 'upper' : 'within');
                return {
                  type: 'file',
                  label: 'Camera File',
                  fieldId: 'cameraFile',
                  value: `${currentRange.from}–${currentRange.to}`,
                  number: currentFrom,
                  existingEntry: sheet,
                  isRangeConflict: true,
                  conflictType
                } as DuplicateInfo;
              }
            }
          }
        } else {
          // Current input is a single value - check for conflicts
          const val = takeData.cameraFile as string;
          const currentNum = parseInt(val) || 0;
          
          for (const sheet of projectLogSheets) {
            const data = sheet.data;
            if (!data) continue;
            
            // Check against existing ranges
            const existingRange = getRangeFromData(data, 'cameraFile');
            if (existingRange) {
              const existingFrom = parseInt(existingRange.from) || 0;
              const existingTo = parseInt(existingRange.to) || 0;
              const existingMin = Math.min(existingFrom, existingTo);
              const existingMax = Math.max(existingFrom, existingTo);
              
              if (isNumberInRange(currentNum, existingRange.from, existingRange.to)) {
                // Determine conflict type based on position in range
                let conflictType: 'lower' | 'upper' | 'within';
                if (currentNum === existingMin) {
                  conflictType = 'lower';
                } else if (currentNum === existingMax) {
                  conflictType = 'upper';
                } else {
                  conflictType = 'within';
                }
                return {
                  type: 'file',
                  label: 'Camera File',
                  fieldId: 'cameraFile',
                  value: val,
                  number: currentNum,
                  existingEntry: sheet,
                  isRangeConflict: true,
                  conflictType,
                  rangeInfo: existingRange
                } as DuplicateInfo;
              }
            }
            
            // Check against existing single values
            if (data.cameraFile === val) {
              return {
                type: 'file',
                label: 'Camera File',
                fieldId: 'cameraFile',
                value: val,
                number: currentNum,
                existingEntry: sheet
              } as DuplicateInfo;
            }
          }
        }
      }
    } else {
      for (let i = 1; i <= cameraConfiguration; i++) {
        const fieldId = `cameraFile${i}`;
        const val = takeData[fieldId] as string | undefined;
        if (val && !disabledFields.has(fieldId)) {
          const currentRange = rangeData[fieldId];
          const isCurrentRange = showRangeMode[fieldId] && currentRange?.from && currentRange?.to;
          
          if (isCurrentRange) {
            // Current input is a range - check for conflicts
            const currentFrom = parseInt(currentRange.from) || 0;
            const currentTo = parseInt(currentRange.to) || 0;
            const currentMin = Math.min(currentFrom, currentTo);
            const currentMax = Math.max(currentFrom, currentTo);
            const currentNumbers = expandRange(currentFrom, currentTo);
            
            for (const sheet of projectLogSheets) {
              const data = sheet.data;
              if (!data) continue;
              
              // Check against existing ranges
              const existingRange = getRangeFromData(data, fieldId);
              if (existingRange) {
                const existingFrom = parseInt(existingRange.from) || 0;
                const existingTo = parseInt(existingRange.to) || 0;
                const existingMin = Math.min(existingFrom, existingTo);
                const existingMax = Math.max(existingFrom, existingTo);
                const existingNumbers = expandRange(existingFrom, existingTo);
                
                // Check if any number in current range exists in existing range
                const hasOverlap = currentNumbers.some(num => existingNumbers.includes(num));
                if (hasOverlap) {
                  // Determine conflict type: check if overlap is at boundaries or within
                  let conflictType: 'lower' | 'upper' | 'within';
                  const overlapAtLower = currentNumbers.some(n => n === existingMin);
                  const overlapAtUpper = currentNumbers.some(n => n === existingMax);
                  
                  if (overlapAtLower && !overlapAtUpper) {
                    conflictType = 'lower';
                  } else if (overlapAtUpper && !overlapAtLower) {
                    conflictType = 'upper';
                  } else {
                    conflictType = 'within';
                  }
                  
                  return {
                    type: 'file',
                    label: `Camera File ${i}`,
                    fieldId,
                    value: `${currentRange.from}–${currentRange.to}`,
                    number: currentFrom,
                    existingEntry: sheet,
                    isRangeConflict: true,
                    conflictType,
                    rangeInfo: existingRange
                  } as DuplicateInfo;
                }
              }
              
              // Check against existing single values
              if (data[fieldId] && typeof data[fieldId] === 'string' && !isRangeString(data[fieldId])) {
                const existingNum = parseInt(data[fieldId]) || 0;
                if (currentNumbers.includes(existingNum)) {
                  const conflictType = existingNum === currentMin ? 'lower' : (existingNum === currentMax ? 'upper' : 'within');
                  return {
                    type: 'file',
                    label: `Camera File ${i}`,
                    fieldId,
                    value: `${currentRange.from}–${currentRange.to}`,
                    number: currentFrom,
                    existingEntry: sheet,
                    isRangeConflict: true,
                    conflictType
                  } as DuplicateInfo;
                }
              }
            }
          } else {
            // Current input is a single value - check for conflicts
            const currentNum = parseInt(val) || 0;
            
            for (const sheet of projectLogSheets) {
              const data = sheet.data;
              if (!data) continue;
              
              // Check against existing ranges
              const existingRange = getRangeFromData(data, fieldId);
              if (existingRange) {
                const existingFrom = parseInt(existingRange.from) || 0;
                const existingTo = parseInt(existingRange.to) || 0;
                const existingMin = Math.min(existingFrom, existingTo);
                const existingMax = Math.max(existingFrom, existingTo);
                
                if (isNumberInRange(currentNum, existingRange.from, existingRange.to)) {
                  // Determine conflict type based on position in range
                  let conflictType: 'lower' | 'upper' | 'within';
                  if (currentNum === existingMin) {
                    conflictType = 'lower';
                  } else if (currentNum === existingMax) {
                    conflictType = 'upper';
                  } else {
                    conflictType = 'within';
                  }
                  return {
                    type: 'file',
                    label: `Camera File ${i}`,
                    fieldId,
                    value: val,
                    number: currentNum,
                    existingEntry: sheet,
                    isRangeConflict: true,
                    conflictType,
                    rangeInfo: existingRange
                  } as DuplicateInfo;
                }
              }
              
              // Check against existing single values
              if (data[fieldId] === val) {
                return {
                  type: 'file',
                  label: `Camera File ${i}`,
                  fieldId,
                  value: val,
                  number: currentNum,
                  existingEntry: sheet
                } as DuplicateInfo;
              }
            }
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
      if (!disabledFields.has('cameraFile')) {
        const hasValue = showRangeMode['cameraFile'] 
          ? (rangeData['cameraFile']?.from?.trim() && rangeData['cameraFile']?.to?.trim())
          : takeData.cameraFile?.trim();
        if (!hasValue) {
          errors.add('cameraFile');
          missingFields.push('Camera File');
        }
      }
    } else {
      for (let i = 1; i <= cameraConfiguration; i++) {
        const fieldId = `cameraFile${i}`;
        const isRecActive = cameraRecState[fieldId] ?? true;
        // Only validate if field is not disabled AND REC is active
        if (!disabledFields.has(fieldId) && isRecActive) {
          const hasValue = showRangeMode[fieldId]
            ? (rangeData[fieldId]?.from?.trim() && rangeData[fieldId]?.to?.trim())
            : takeData[fieldId]?.trim();
          if (!hasValue) {
            errors.add(fieldId);
            missingFields.push(`Camera File ${i}`);
          }
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
    console.log('========== SAVE INITIATED: handleSaveTake ==========');
    if (!logSheet) return;
    if (!validateMandatoryFields()) {
      return;
    }

    const generalConflict = findFirstDuplicateFile();
    if (generalConflict?.isRangeConflict && (generalConflict.conflictType === 'upper' || generalConflict.conflictType === 'within')) {
      const e = generalConflict.existingEntry;
      const classification = e?.data?.classification;
      const loc =
        classification === 'SFX'
          ? 'SFX'
          : (classification === 'Ambience' ? 'Ambience' :
             `Scene ${e?.data?.sceneNumber || 'Unknown'}, Shot ${e?.data?.shotNumber || 'Unknown'}, Take ${e?.data?.takeNumber || 'Unknown'}`);
      Alert.alert(
        'Part of Ranged Take',
        `${generalConflict.label} file is part of a take that contains a range at ${loc}. Adjust the value(s) to continue.`,
        [{ text: 'OK', style: 'default' }]
      );
      return;
    }

    const getEligibleDuplicateForField = (fieldId: string) => {
      if (!logSheet) return null as any;
      const projectLogSheets = logSheets.filter(sheet => sheet.projectId === logSheet.projectId && sheet.id !== logSheet.id);
      const currentVal = takeData[fieldId] as string | undefined;
      const currentRange = rangeData[fieldId];
      const isCurrentRange = showRangeMode[fieldId] && !!currentRange?.from && !!currentRange?.to;
      if (disabledFields.has(fieldId)) return null as any;
      const hasSingle = typeof currentVal === 'string' && currentVal.trim().length > 0;
      const hasInput = isCurrentRange || hasSingle;
      if (!hasInput) return null as any;
      const parseNum = (s?: string) => (s ? (parseInt(s, 10) || 0) : 0);
      const valNum = parseNum(currentVal);
      for (const sheet of projectLogSheets) {
        const data = sheet.data;
        if (!data) continue;
        const existingRange = getRangeFromData(data, fieldId);
        if (isCurrentRange) {
          const curFrom = parseNum(currentRange!.from);
          const curTo = parseNum(currentRange!.to);
          const curMin = Math.min(curFrom, curTo);
          const curMax = Math.max(curFrom, curTo);
          if (existingRange) {
            const exFrom = parseNum(existingRange.from);
            const exTo = parseNum(existingRange.to);
            const exMin = Math.min(exFrom, exTo);
            const exMax = Math.max(exFrom, exTo);
            if (!(curMax < exMin || curMin > exMax)) {
              // Only allow insert before if current range starts at the lower bound of existing range
              if (curFrom === exMin) {
                return { fieldId, number: curFrom, existingEntry: sheet };
              }
            }
          }
          const existingVal = data[fieldId] as string | undefined;
          if (existingVal && typeof existingVal === 'string' && !isRangeString(existingVal)) {
            const exNum = parseNum(existingVal);
            if (exNum >= curMin && exNum <= curMax) {
              // Only allow insert before if existing value is at the lower bound of current range
              if (exNum === curMin) {
                return { fieldId, number: curMin, existingEntry: sheet };
              }
            }
          }
        } else {
          if (existingRange) {
            const exFrom = parseNum(existingRange.from);
            const exTo = parseNum(existingRange.to);
            const exMin = Math.min(exFrom, exTo);
            const exMax = Math.max(exFrom, exTo);
            if (valNum >= exMin && valNum <= exMax) {
              // Only allow insert before if current value is at the lower bound of existing range
              if (valNum === exMin) {
                return { fieldId, number: valNum, existingEntry: sheet };
              }
            }
          }
          if (data[fieldId] === currentVal) {
            return { fieldId, number: valNum, existingEntry: sheet };
          }
        }
      }
      return null as any;
    };

    const soundDup = getEligibleDuplicateForField('soundFile');
    let cameraDup: { fieldId: string; number: number; existingEntry: any } | null = null;
    const cameraConfiguration = project?.settings?.cameraConfiguration || 1;
    if (cameraConfiguration === 1) {
      cameraDup = getEligibleDuplicateForField('cameraFile');
    } else {
      for (let i = 1; i <= cameraConfiguration; i++) {
        const fid = `cameraFile${i}`;
        const isRecActive = cameraRecState[fid] ?? true;
        if (isRecActive && takeData[fid]) {
          const d = getEligibleDuplicateForField(fid);
          if (d) { cameraDup = d; break; }
        }
      }
    }

    if (soundDup && cameraDup) {
      if (soundDup.existingEntry?.id === cameraDup.existingEntry?.id) {
        const existingEntry = soundDup.existingEntry;
        const classification = existingEntry.data?.classification;
        let location: string;
        if (classification === 'SFX') location = 'SFX';
        else if (classification === 'Ambience') location = 'Ambience';
        else location = `Scene ${existingEntry.data?.sceneNumber || 'Unknown'}, Shot ${existingEntry.data?.shotNumber || 'Unknown'}, Take ${existingEntry.data?.takeNumber || 'Unknown'}`;
        
        // Check if this is a range conflict (upper or within)
        const soundConflict = findFirstDuplicateFile();
        if (soundConflict?.isRangeConflict && (soundConflict.conflictType === 'upper' || soundConflict.conflictType === 'within')) {
          Alert.alert(
            'Part of Ranged Take',
            `The file number is part of a take that contains a range at ${location}. Adjust the value(s) to continue.`,
            [{ text: 'OK', style: 'default' }]
          );
          return;
        }
        
        Alert.alert(
          'Duplicate Detected',
          `Camera and Sound files are duplicates found in ${location}. Do you want to insert before?`,
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Insert Before', onPress: () => handleSaveWithDuplicatePair(existingEntry, soundDup.number, cameraDup!.fieldId, cameraDup!.number) }
          ]
        );
        return;
      } else {
        const se = soundDup.existingEntry;
        const ce = cameraDup.existingEntry;

        // Prefer allowing insert-before when the target duplicate has the opposite field blank
        const camCountPref = project?.settings?.cameraConfiguration || 1;
        const targetSoundBlank = (() => {
          const hasSingle = typeof ce.data?.soundFile === 'string' && ce.data.soundFile.trim().length > 0;
          const hasRange = typeof ce.data?.sound_from === 'string' || typeof ce.data?.sound_to === 'string';
          return !(hasSingle || hasRange);
        })();
        const targetCameraBlank = (() => {
          if (camCountPref === 1) {
            const hasSingle = typeof se.data?.cameraFile === 'string' && se.data.cameraFile.trim().length > 0;
            const hasRange = typeof se.data?.camera1_from === 'string' || typeof se.data?.camera1_to === 'string';
            return !(hasSingle || hasRange);
          }
          let anyCamPresent = false;
          for (let i = 1; i <= camCountPref; i++) {
            const val = se.data?.[`cameraFile${i}`];
            const fromVal = se.data?.[`camera${i}_from`];
            const toVal = se.data?.[`camera${i}_to`];
            if ((typeof val === 'string' && val.trim().length > 0) || (typeof fromVal === 'string' && fromVal.trim().length > 0) || (typeof toVal === 'string' && toVal.trim().length > 0)) {
              anyCamPresent = true;
              break;
            }
          }
          return !anyCamPresent;
        })();

        const isCameraBlankInput = (() => {
          if (camCountPref === 1) {
            const hasRange = showRangeMode['cameraFile'] && !!rangeData['cameraFile']?.from && !!rangeData['cameraFile']?.to;
            const hasSingle = !!takeData.cameraFile?.trim();
            return !(hasRange || hasSingle);
          }
          for (let i = 1; i <= camCountPref; i++) {
            const fid = `cameraFile${i}`;
            if (!(cameraRecState[fid] ?? true)) continue;
            const hasRange = showRangeMode[fid] && !!rangeData[fid]?.from && !!rangeData[fid]?.to;
            const hasSingle = !!takeData[fid]?.trim();
            if (hasRange || hasSingle) return false;
          }
          return true;
        })();
        const isSoundBlankInput = (() => {
          const hasRange = showRangeMode['soundFile'] && !!rangeData['soundFile']?.from && !!rangeData['soundFile']?.to;
          const hasSingle = !!takeData.soundFile?.trim();
          return !(hasRange || hasSingle);
        })();

        // Check if one field is blank in input - if so, allow selective insertion
        const isCurrentAmbienceOrSFX = classification === 'Ambience' || classification === 'SFX';
        
        if (isCameraBlankInput && !isSoundBlankInput) {
          // Camera is blank, sound has duplicate - allow selective insertion for sound only
          const e = soundDup.existingEntry;
          const targetClassification = e.data?.classification;
          const loc = targetClassification === 'SFX' ? 'SFX' : (targetClassification === 'Ambience' ? 'Ambience' : `Scene ${e.data?.sceneNumber || 'Unknown'}, Shot ${e.data?.shotNumber || 'Unknown'}, Take ${e.data?.takeNumber || 'Unknown'}`);
          
          if (isCurrentAmbienceOrSFX) {
            // Special message for Ambience/SFX
            Alert.alert(
              `${classification} Duplicate Detected`,
              `Sound file is a duplicate at ${loc}.\n\nThis will be saved as ${classification}. The sound file numbers will be shifted, but Scene/Shot/Take ${loc} will remain unchanged.`,
              [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Save', onPress: () => handleSaveWithSelectiveDuplicateHandling('before', { type: 'file', fieldId: 'soundFile', existingEntry: e, number: soundDup.number }) }
              ]
            );
          } else {
            Alert.alert(
              'Duplicate Detected',
              `Sound file is a duplicate at ${loc}. Camera field is blank. Do you want to insert before and shift only sound files?`,
              [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Insert Before (Sound Only)', onPress: () => handleSaveWithSelectiveDuplicateHandling('before', { type: 'file', fieldId: 'soundFile', existingEntry: e, number: soundDup.number }) }
              ]
            );
          }
          return;
        }

        if (!isCameraBlankInput && isSoundBlankInput) {
          // Sound is blank, camera has duplicate - allow selective insertion for camera only
          const e = cameraDup.existingEntry;
          const targetClassification = e.data?.classification;
          const loc = targetClassification === 'SFX' ? 'SFX' : (targetClassification === 'Ambience' ? 'Ambience' : `Scene ${e.data?.sceneNumber || 'Unknown'}, Shot ${e.data?.shotNumber || 'Unknown'}, Take ${e.data?.takeNumber || 'Unknown'}`);
          
          if (isCurrentAmbienceOrSFX) {
            // Special message for Ambience/SFX
            Alert.alert(
              `${classification} Duplicate Detected`,
              `Camera file is a duplicate at ${loc}.\n\nThis will be saved as ${classification}. The camera file numbers will be shifted, but Scene/Shot/Take ${loc} will remain unchanged.`,
              [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Save', onPress: () => handleSaveWithSelectiveDuplicateHandling('before', { type: 'file', fieldId: cameraDup.fieldId, existingEntry: e, number: cameraDup.number }) }
              ]
            );
          } else {
            Alert.alert(
              'Duplicate Detected',
              `Camera file is a duplicate at ${loc}. Sound field is blank. Do you want to insert before and shift only camera files?`,
              [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Insert Before (Camera Only)', onPress: () => handleSaveWithSelectiveDuplicateHandling('before', { type: 'file', fieldId: cameraDup.fieldId, existingEntry: e, number: cameraDup.number }) }
              ]
            );
          }
          return;
        }

        if (!isCurrentAmbienceOrSFX && (targetSoundBlank || isSoundBlankInput)) {
          const e = ce;
          const targetClassification = e.data?.classification;
          const loc = targetClassification === 'SFX' ? 'SFX' : (targetClassification === 'Ambience' ? 'Ambience' : `Scene ${e.data?.sceneNumber || 'Unknown'}, Shot ${e.data?.shotNumber || 'Unknown'}, Take ${e.data?.takeNumber || 'Unknown'}`);
          Alert.alert(
            'Duplicate Detected',
            `Camera file is a duplicate at ${loc}. Do you want to insert before?`,
            [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Insert Before', onPress: () => handleSaveWithDuplicateHandling('before', { type: 'file', fieldId: cameraDup.fieldId, existingEntry: e, number: cameraDup.number }) }
            ]
          );
          return;
        }

        if (!isCurrentAmbienceOrSFX && (targetCameraBlank || isCameraBlankInput)) {
          const e = se;
          const targetClassification = e.data?.classification;
          const loc = targetClassification === 'SFX' ? 'SFX' : (targetClassification === 'Ambience' ? 'Ambience' : `Scene ${e.data?.sceneNumber || 'Unknown'}, Shot ${e.data?.shotNumber || 'Unknown'}, Take ${e.data?.takeNumber || 'Unknown'}`);
          Alert.alert(
            'Duplicate Detected',
            `Sound file is a duplicate at ${loc}. Do you want to insert before?`,
            [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Insert Before', onPress: () => handleSaveWithDuplicateHandling('before', { type: 'file', fieldId: 'soundFile', existingEntry: e, number: soundDup.number }) }
            ]
          );
          return;
        }

        if (!isCurrentAmbienceOrSFX) {
          const sLoc = se.data?.classification === 'SFX' ? 'SFX' : (se.data?.classification === 'Ambience' ? 'Ambience' : `Scene ${se.data?.sceneNumber || 'Unknown'}, Shot ${se.data?.shotNumber || 'Unknown'}, Take ${se.data?.takeNumber || 'Unknown'}`);
          const cLoc = ce.data?.classification === 'SFX' ? 'SFX' : (ce.data?.classification === 'Ambience' ? 'Ambience' : `Scene ${ce.data?.sceneNumber || 'Unknown'}, Shot ${ce.data?.shotNumber || 'Unknown'}, Take ${ce.data?.takeNumber || 'Unknown'}`);
          
          // Get the actual file numbers for better user understanding
          const soundFileNumber = takeData.soundFile || 'Unknown';
          const cameraFileNumber = cameraDup.fieldId === 'cameraFile' ? 
            (takeData.cameraFile || 'Unknown') : 
            (takeData[cameraDup.fieldId] || 'Unknown');
          
          Alert.alert(
            'Cross-Log Conflict Detected',
            `Cannot insert log because the sound file and camera file already exist in different logs:

Sound File ${soundFileNumber} → Found in: ${sLoc}
Camera File ${cameraFileNumber} → Found in: ${cLoc}

This would break the logging logic and create inconsistencies in the file numbering system. Please adjust your file numbers to avoid conflicts.`,
            [{ text: 'OK', style: 'default' }]
          );
          return;
        }
      }
    }

    // Allow insert-before when only one duplicate exists and the target duplicate has the other field blank
    const camCountForBlank = project?.settings?.cameraConfiguration || 1;
    const isCameraBlankInput = (() => {
      if (camCountForBlank === 1) {
        const hasRange = showRangeMode['cameraFile'] && !!rangeData['cameraFile']?.from && !!rangeData['cameraFile']?.to;
        const hasSingle = !!takeData.cameraFile?.trim();
        return !(hasRange || hasSingle);
      }
      for (let i = 1; i <= camCountForBlank; i++) {
        const fid = `cameraFile${i}`;
        if (!(cameraRecState[fid] ?? true)) continue;
        const hasRange = showRangeMode[fid] && !!rangeData[fid]?.from && !!rangeData[fid]?.to;
        const hasSingle = !!takeData[fid]?.trim();
        if (hasRange || hasSingle) return false;
      }
      return true;
    })();
    const isSoundBlankInput = (() => {
      const hasRange = showRangeMode['soundFile'] && !!rangeData['soundFile']?.from && !!rangeData['soundFile']?.to;
      const hasSingle = !!takeData.soundFile?.trim();
      return !(hasRange || hasSingle);
    })();

    if (soundDup) {
      const target = soundDup.existingEntry;
      const isTargetCameraBlank = (() => {
        if (camCountForBlank === 1) {
          const single = typeof target.data?.cameraFile === 'string' && target.data.cameraFile.trim().length > 0;
          const range = typeof target.data?.camera1_from === 'string' || typeof target.data?.camera1_to === 'string';
          return !(single || range);
        }
        for (let i = 1; i <= camCountForBlank; i++) {
          const val = target.data?.[`cameraFile${i}`];
          const fromVal = target.data?.[`camera${i}_from`];
          const toVal = target.data?.[`camera${i}_to`];
          if ((typeof val === 'string' && val.trim().length > 0) || (typeof fromVal === 'string' && fromVal.trim().length > 0) || (typeof toVal === 'string' && toVal.trim().length > 0)) {
            return false;
          }
        }
        return true;
      })();
      if (isTargetCameraBlank || isCameraBlankInput) {
        const e = target;
        const classification = e.data?.classification;
        const loc = classification === 'SFX' ? 'SFX' : (classification === 'Ambience' ? 'Ambience' : `Scene ${e.data?.sceneNumber || 'Unknown'}, Shot ${e.data?.shotNumber || 'Unknown'}, Take ${e.data?.takeNumber || 'Unknown'}`);
        Alert.alert(
          'Duplicate Detected',
          `Sound file is a duplicate at ${loc}. Do you want to insert before?`,
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Insert Before', onPress: () => handleSaveWithDuplicateHandling('before', { type: 'file', fieldId: 'soundFile', existingEntry: e, number: soundDup.number }) }
          ]
        );
        return;
      }
    }

    if (cameraDup) {
      const target = cameraDup.existingEntry;
      const isTargetSoundBlank = (() => {
        const single = typeof target.data?.soundFile === 'string' && target.data.soundFile.trim().length > 0;
        const range = typeof target.data?.sound_from === 'string' || typeof target.data?.sound_to === 'string';
        return !(single || range);
      })();
      if (isTargetSoundBlank || isSoundBlankInput) {
        const e = target;
        const classification = e.data?.classification;
        const loc = classification === 'SFX' ? 'SFX' : (classification === 'Ambience' ? 'Ambience' : `Scene ${e.data?.sceneNumber || 'Unknown'}, Shot ${e.data?.shotNumber || 'Unknown'}, Take ${e.data?.takeNumber || 'Unknown'}`);
        Alert.alert(
          'Duplicate Detected',
          `Camera file is a duplicate at ${loc}. Do you want to insert before?`,
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Insert Before', onPress: () => handleSaveWithDuplicateHandling('before', { type: 'file', fieldId: cameraDup.fieldId, existingEntry: e, number: cameraDup.number }) }
          ]
        );
        return;
      }
    }

    if (soundDup || cameraDup) {
      const dup = soundDup || cameraDup!;
      const label = dup.fieldId.startsWith('sound') ? 'Sound' : 'Camera';
      const e = dup.existingEntry;
      const classification = e.data?.classification;
      const loc = classification === 'SFX' ? 'SFX' : (classification === 'Ambience' ? 'Ambience' : `Scene ${e.data?.sceneNumber || 'Unknown'}, Shot ${e.data?.shotNumber || 'Unknown'}, Take ${e.data?.takeNumber || 'Unknown'}`);
      
      // Check if this is a range conflict (upper or within)
      const fileConflict = findFirstDuplicateFile();
      if (fileConflict?.isRangeConflict && (fileConflict.conflictType === 'upper' || fileConflict.conflictType === 'within')) {
        Alert.alert(
          'Part of Ranged Take',
          `${label} file is part of a take that contains a range at ${loc}. Adjust the value(s) to continue.`,
          [{ text: 'OK', style: 'default' }]
        );
        return;
      }
      
      Alert.alert(
        'Duplicate Found',
        `${label} file is a duplicate at ${loc}. The Log cannot be inserted with the current configuration to maintain the logging history and order.`,
        [{ text: 'OK', style: 'default' }]
      );
      return;
    }

    const duplicateTake = findDuplicateTake();
    if (duplicateTake) {
      Alert.alert(
        'Duplicate Detected',
        `A duplicate was found. Would you like to insert before, or cancel?`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Insert Before', onPress: () => handleSaveWithDuplicateHandling('before', duplicateTake) },
        ]
      );
      return;
    }

    saveNormally();
  };

  const handleSaveWithSelectiveDuplicateHandling = async (position: 'before', duplicateInfo: any) => {
    console.log('========== SAVE INITIATED: handleSaveWithSelectiveDuplicateHandling ==========');
    console.log('  duplicateInfo:', duplicateInfo);
    if (!logSheet || !project) return;
    const camCount = project?.settings?.cameraConfiguration || 1;
    const existingEntry = duplicateInfo.existingEntry;
    const targetFieldId = duplicateInfo.fieldId;
    const isCurrentAmbienceOrSFX = classification === 'Ambience' || classification === 'SFX';

    const projectLogSheets = logSheets.filter(sheet => sheet.projectId === logSheet.projectId);

    const excludeIds = new Set<string>();
    if (existingEntry?.id) excludeIds.add(existingEntry.id as string);
    if (logSheet?.id) excludeIds.add(logSheet.id as string);

    // In edit mode, preserve the user's edited values in takeData, don't overwrite with existingEntry
    // However, we need to make sure OLD range values from takeData don't interfere
    let newLogData = { ...takeData };
    
    // Remove OLD range values from takeData that will be replaced by rangeData
    if (showRangeMode['cameraFile'] && rangeData['cameraFile']?.from && rangeData['cameraFile']?.to) {
      delete newLogData.camera1_from;
      delete newLogData.camera1_to;
      delete newLogData.cameraFile;
    }
    if (showRangeMode['soundFile'] && rangeData['soundFile']?.from && rangeData['soundFile']?.to) {
      delete newLogData.sound_from;
      delete newLogData.sound_to;
      delete newLogData.soundFile;
    }
    for (let i = 1; i <= camCount; i++) {
      const fieldId = `cameraFile${i}`;
      if (showRangeMode[fieldId] && rangeData[fieldId]?.from && rangeData[fieldId]?.to) {
        delete newLogData[`camera${i}_from`];
        delete newLogData[`camera${i}_to`];
        delete newLogData[fieldId];
      }
    }

    // Update scene/shot/take to match the target position
    const targetSceneNumber = existingEntry.data?.sceneNumber;
    const targetShotNumber = existingEntry.data?.shotNumber;
    const targetTakeNumber = parseInt(existingEntry.data?.takeNumber || '0', 10);
    
    // For Ambience/SFX, remove scene/shot/take numbers (they go to separate sections)
    if (isCurrentAmbienceOrSFX) {
      // Explicitly remove scene/shot/take to ensure it goes to Ambience/SFX section
      delete newLogData.sceneNumber;
      delete newLogData.shotNumber;
      delete newLogData.takeNumber;
      // IMPORTANT: Don't call updateTakeNumbers for SFX/Ambience logs
    } else {
      // For regular logs, update scene/shot/take to match target position
      newLogData.sceneNumber = targetSceneNumber;
      newLogData.shotNumber = targetShotNumber;
      if (targetSceneNumber && targetShotNumber && !Number.isNaN(targetTakeNumber)) {
        newLogData.takeNumber = existingEntry.data.takeNumber;
        const originalTakeNumber = parseInt(logSheet.data?.takeNumber || '0', 10);
        const maxTake = originalTakeNumber > targetTakeNumber ? originalTakeNumber - 1 : undefined;
        console.log('DEBUG - Calling updateTakeNumbers with excludeLogId and maxTake:', {
          fromTakeNumber: targetTakeNumber,
          increment: 1,
          excludeLogId: logSheet.id,
          originalTakeNumber,
          maxTakeNumber: maxTake
        });
        updateTakeNumbers(logSheet.projectId, targetSceneNumber, targetShotNumber, targetTakeNumber, 1, logSheet.id, maxTake);
      }
    }

    // Variables to track shift parameters
    let camStart = targetTakeNumber;
    let camDelta = 0;
    let existingEntryUpdates: Record<string, any> | null = null;

    // Only shift the target field
    if (targetFieldId === 'soundFile') {
      // Use SoundHandler for selective sound file shifting
      const soundHandlerContext = {
        projectId: logSheet.projectId,
        projectLogSheets: logSheets.filter(s => s.projectId === logSheet.projectId),
        takeData,
        showRangeMode,
        rangeData,
        existingEntry,
        sceneNumber: existingEntry.data?.sceneNumber as string,
        shotNumber: existingEntry.data?.shotNumber as string,
        takeNumber: targetTakeNumber
      };
      
      const soundFileResult = handleSoundFileForDuplicateInsertion(
        soundHandlerContext,
        targetTakeNumber
      );
      
      console.log('🔍 DEBUG [handleSaveWithSelectiveDuplicateHandling] Sound file handling:', {
        shouldCallUpdateFileNumbers: soundFileResult.shouldCallUpdateFileNumbers,
        soundStart: soundFileResult.soundStart,
        soundDelta: soundFileResult.soundDelta,
        isDisabled: disabledFields.has('soundFile'),
        targetFieldId: targetFieldId,
        existingEntrySoundFile: existingEntry.data?.soundFile,
        existingEntrySoundFrom: existingEntry.data?.sound_from,
        insertedSoundFile: takeData.soundFile
      });
      
      if (soundFileResult.shouldCallUpdateFileNumbers && !disabledFields.has('soundFile')) {
        console.log('✅ [handleSaveWithSelectiveDuplicateHandling] Calling updateFileNumbers for soundFile:', { 
          start: soundFileResult.soundStart, 
          delta: soundFileResult.soundDelta,
          projectId: logSheet.projectId,
          fieldId: 'soundFile'
        });
        updateFileNumbers(logSheet.projectId, 'soundFile', soundFileResult.soundStart!, soundFileResult.soundDelta);
      } else {
        console.log('❌ [handleSaveWithSelectiveDuplicateHandling] NOT calling updateFileNumbers for soundFile:', {
          reason: !soundFileResult.shouldCallUpdateFileNumbers ? 'shouldCallUpdateFileNumbers=false' : 'soundFile is disabled',
          shouldCallUpdateFileNumbers: soundFileResult.shouldCallUpdateFileNumbers,
          isDisabled: disabledFields.has('soundFile')
        });
      }
      
      // If target has a range, adjust lower to end after inserted and extend upper by delta
      if (soundFileResult.shouldCallUpdateFileNumbers && !disabledFields.has('soundFile')) {
        const targetRange = getRangeFromData(existingEntry.data, 'soundFile');
        if (targetRange) {
          const bounds = getInsertedBounds('soundFile');
          const insertedUpper = bounds?.max ?? (parseInt(targetRange.from, 10) || 0);
          const oldToNum = parseInt(targetRange.to, 10) || 0;
          const newFrom = String(insertedUpper + 1).padStart(4, '0');
          const newTo = String(oldToNum + soundFileResult.soundDelta).padStart(4, '0');
          const updated: Record<string, any> = { ...existingEntry.data, sound_from: newFrom, sound_to: newTo, takeNumber: String(targetTakeNumber + 1) };
          const hadInline = typeof existingEntry.data?.soundFile === 'string' && isRangeString(existingEntry.data.soundFile);
          if (hadInline) {
            updated.soundFile = `${newFrom}-${newTo}`;
          }
          existingEntryUpdates = updated;
        } else if (typeof existingEntry.data?.soundFile === 'string' && existingEntry.data.soundFile.trim().length > 0) {
          const exNum = parseInt(existingEntry.data.soundFile, 10) || 0;
          const newVal = String(exNum + soundFileResult.soundDelta).padStart(4, '0');
          const updated: Record<string, any> = { ...existingEntry.data, soundFile: newVal, takeNumber: String(targetTakeNumber + 1) };
          existingEntryUpdates = updated;
        }
      }
    } else if (targetFieldId.startsWith('cameraFile')) {
      // Use outer-scoped camStart variable
      if (targetFieldId === 'cameraFile') {
        if (typeof existingEntry.data?.camera1_from === 'string') {
          const n = parseInt(existingEntry.data.camera1_from, 10);
          if (!Number.isNaN(n)) camStart = n;
        } else if (typeof existingEntry.data?.cameraFile === 'string') {
          const n = parseInt(existingEntry.data.cameraFile, 10);
          if (!Number.isNaN(n)) camStart = n;
        }
      } else {
        const cameraNum = parseInt(targetFieldId.replace('cameraFile', '')) || 1;
        const fromKey = `camera${cameraNum}_from`;
        const toKey = `camera${cameraNum}_to`;
        if (typeof existingEntry.data?.[fromKey] === 'string') {
          const n = parseInt(existingEntry.data[fromKey], 10);
          if (!Number.isNaN(n)) camStart = n;
        } else if (typeof existingEntry.data?.[targetFieldId] === 'string') {
          const n = parseInt(existingEntry.data[targetFieldId], 10);
          if (!Number.isNaN(n)) camStart = n;
        }
      }
      
      // Use centralized delta calculator instead of inline calculation
      const cameraDeltaInput = {
        takeData,
        showRangeMode,
        rangeData
      };
      camDelta = calculateCameraDeltaForShifting(cameraDeltaInput, targetFieldId);
      
      console.log('🔍 DEBUG [handleSaveWithSelectiveDuplicateHandling] Using centralized calculateCameraDeltaForShifting:', {
        camDelta,
        targetFieldId,
        takeDataField: targetFieldId === 'cameraFile' ? takeData.cameraFile : takeData[targetFieldId],
        showRangeMode: showRangeMode[targetFieldId],
        rangeData: rangeData[targetFieldId]
      });
      
      // Calculate existingEntry updates
      if (!disabledFields.has(targetFieldId) && camDelta > 0) {
        // If target has a range, adjust lower to end after inserted and extend upper by delta
        const targetRange = getRangeFromData(existingEntry.data, targetFieldId);
        if (targetRange) {
          const bounds = getInsertedBounds(targetFieldId);
          const insertedUpper = bounds?.max ?? (parseInt(targetRange.from, 10) || 0);
          const oldToNum = parseInt(targetRange.to, 10) || 0;
          const newFrom = String(insertedUpper + 1).padStart(4, '0');
          const newTo = String(oldToNum + camDelta).padStart(4, '0');
          const cameraNum = targetFieldId === 'cameraFile' ? 1 : (parseInt(targetFieldId.replace('cameraFile', '')) || 1);
          existingEntryUpdates = {
            ...existingEntry.data,
            [`camera${cameraNum}_from`]: newFrom,
            [`camera${cameraNum}_to`]: newTo,
            takeNumber: String(targetTakeNumber + 1)
          };
          const hadInline = typeof existingEntry.data?.[targetFieldId] === 'string' && isRangeString(existingEntry.data[targetFieldId]);
          if (hadInline) {
            existingEntryUpdates[targetFieldId] = `${newFrom}-${newTo}`;
          }
        } else {
          // Handle single camera value (not range) - target has single value
          const targetHasSingleCamera = typeof existingEntry.data?.[targetFieldId] === 'string' && !isRangeString(existingEntry.data[targetFieldId]);
          if (targetHasSingleCamera) {
            const targetCamNum = parseInt(existingEntry.data[targetFieldId] as string, 10) || 0;
            
            // Check if new entry has range or single value to get the inserted bounds
            let newCamMin: number;
            let newCamMax: number;
            if (showRangeMode[targetFieldId] && rangeData[targetFieldId]?.from && rangeData[targetFieldId]?.to) {
              // New entry has range - inserting range before single value
              const a = parseInt(rangeData[targetFieldId].from, 10) || 0;
              const b = parseInt(rangeData[targetFieldId].to, 10) || 0;
              newCamMin = Math.min(a, b);
              newCamMax = Math.max(a, b);
            } else if (targetFieldId === 'cameraFile' && takeData.cameraFile) {
              // New entry has single value
              const val = parseInt(String(takeData.cameraFile), 10) || 0;
              newCamMin = val;
              newCamMax = val;
            } else if (takeData[targetFieldId]) {
              const val = parseInt(String(takeData[targetFieldId]), 10) || 0;
              newCamMin = val;
              newCamMax = val;
            } else {
              newCamMin = 0;
              newCamMax = 0;
            }
            
            // Only bump if target camera number equals the min of the new range (insert before scenario)
            const shouldBump = targetCamNum === newCamMin;
            if (shouldBump) {
              // Shift target to max(inserted range) + 1
              existingEntryUpdates = {
                ...existingEntry.data,
                [targetFieldId]: String(newCamMax + 1).padStart(4, '0'),
                takeNumber: String(targetTakeNumber + 1)
              };
              // Update camStart to point to the NEW position of existingEntry for updateFileNumbers
              // This ensures updateFileNumbers shifts entries starting AFTER the updated existingEntry
              camStart = newCamMax + 1;
            }
          }
        }
      }
    }

    // Prepare and save current logSheet data with range persistence
    if (camCount > 1) {
      for (let i = 1; i <= camCount; i++) {
        const fid = `cameraFile${i}`;
        const isRecActive = cameraRecState[fid] ?? true;
        if (!isRecActive) delete newLogData[fid];
      }
    }
    newLogData = pruneDisabled(newLogData);
    
    // CRITICAL: Remove old range field values that will be replaced by rangeData
    // This prevents stale camera1_from/camera1_to from persisting when editing ranges
    if (camCount === 1) {
      if (showRangeMode['cameraFile'] && rangeData['cameraFile']?.from && rangeData['cameraFile']?.to) {
        // We're in range mode - delete any old range fields and inline string
        delete newLogData.camera1_from;
        delete newLogData.camera1_to;
        delete newLogData.cameraFile;
      }
    } else {
      for (let i = 1; i <= camCount; i++) {
        const fieldId = `cameraFile${i}`;
        if (showRangeMode[fieldId] && rangeData[fieldId]?.from && rangeData[fieldId]?.to) {
          delete newLogData[`camera${i}_from`];
          delete newLogData[`camera${i}_to`];
          delete newLogData[fieldId];
        }
      }
    }
    
    const pad4 = (v?: string) => (v ? String(parseInt(v as any, 10) || 0).padStart(4, '0') : '');
    const finalData: Record<string, any> = { ...newLogData };
    
    console.log('DEBUG handleSaveWithSelectiveDuplicateHandling - After pruneDisabled and range cleanup:', {
      'newLogData.cameraFile': newLogData.cameraFile,
      'newLogData.camera1_from': newLogData.camera1_from,
      'newLogData.camera1_to': newLogData.camera1_to,
      'finalData.cameraFile': finalData.cameraFile,
      disabledFields: Array.from(disabledFields)
    });
    if (showRangeMode['soundFile'] && rangeData['soundFile']?.from && rangeData['soundFile']?.to) {
      finalData['sound_from'] = pad4(rangeData['soundFile'].from);
      finalData['sound_to'] = pad4(rangeData['soundFile'].to);
      delete finalData.soundFile;
    } else if (!disabledFields.has('soundFile')) {
      delete finalData['sound_from'];
      delete finalData['sound_to'];
    } else {
      delete finalData.soundFile;
      delete finalData['sound_from'];
      delete finalData['sound_to'];
    }
    // Handle camera ranges - checking range mode FIRST regardless of enabled/disabled status
    if (camCount === 1) {
      const hasRange = showRangeMode['cameraFile'] && rangeData['cameraFile']?.from && rangeData['cameraFile']?.to;
      const isDisabled = disabledFields.has('cameraFile');
      
      console.log('DEBUG handleSaveWithSelectiveDuplicateHandling - Before camera handling:', {
        hasRange,
        isDisabled,
        'finalData.cameraFile': finalData.cameraFile,
        'finalData.camera1_from': finalData.camera1_from,
        'finalData.camera1_to': finalData.camera1_to
      });
      
      if (hasRange) {
        // Has range data - save it (works for both waste and non-waste)
        finalData['camera1_from'] = pad4(rangeData['cameraFile'].from);
        finalData['camera1_to'] = pad4(rangeData['cameraFile'].to);
        delete finalData.cameraFile;
        
        console.log('DEBUG - After setting range and deleting cameraFile:', {
          'finalData.cameraFile': finalData.cameraFile,
          'finalData.camera1_from': finalData.camera1_from,
          'finalData.camera1_to': finalData.camera1_to
        });
      } else if (!isDisabled) {
        // Enabled field without range - keep single value mode, delete range fields
        delete finalData['camera1_from'];
        delete finalData['camera1_to'];
      } else {
        // Disabled field without range data - delete everything (waste without range)
        delete finalData.cameraFile;
        delete finalData['camera1_from'];
        delete finalData['camera1_to'];
      }
    } else {
      for (let i = 1; i <= camCount; i++) {
        const fid = `cameraFile${i}`;
        const hasRange = showRangeMode[fid] && rangeData[fid]?.from && rangeData[fid]?.to;
        const isDisabled = disabledFields.has(fid);
        const isRecActive = cameraRecState[fid] ?? true;
        
        if (hasRange) {
          // Has range data - save it (works for both waste and non-waste)
          finalData[`camera${i}_from`] = pad4(rangeData[fid].from);
          finalData[`camera${i}_to`] = pad4(rangeData[fid].to);
          delete finalData[fid];
        } else if (!isDisabled && isRecActive) {
          // Enabled field without range - keep single value mode, delete range fields
          delete finalData[`camera${i}_from`];
          delete finalData[`camera${i}_to`];
        } else {
          // Disabled field or REC off without range data - delete everything
          delete finalData[fid];
          delete finalData[`camera${i}_from`];
          delete finalData[`camera${i}_to`];
        }
      }
    }
    const filteredShotDetails = (classification === 'Ambience' || classification === 'SFX') ? shotDetails.filter(d => d !== 'MOS') : shotDetails;
    let updatedData: Record<string, any> = {
      ...finalData,
      classification,
      shotDetails: filteredShotDetails,
      isGoodTake,
      wasteOptions: classification === 'Waste' ? JSON.stringify(wasteOptions) : '',
      insertSoundSpeed: classification === 'Insert' ? (insertSoundSpeed?.toString() || '') : '',
      cameraRecState: camCount > 1 ? cameraRecState : undefined
    };
    
    // CRITICAL FIX: For Ambience/SFX, ensure scene/shot/take are completely removed
    if (isCurrentAmbienceOrSFX) {
      delete updatedData.sceneNumber;
      delete updatedData.shotNumber;
      delete updatedData.takeNumber;
    }
    
    console.log('DEBUG handleSaveWithSelectiveDuplicateHandling - Before save:');
    console.log('  showRangeMode:', showRangeMode);
    console.log('  rangeData:', rangeData);
    console.log('  disabledFields:', Array.from(disabledFields));
    console.log('  updatedData to save:', {
      camera1_from: updatedData.camera1_from,
      camera1_to: updatedData.camera1_to,
      cameraFile: updatedData.cameraFile
    });
    
    // Save the current logSheet with edited values FIRST
    await updateLogSheet(logSheet.id, updatedData);
    
    // Use Promise to ensure Zustand state has propagated before calling updateFileNumbers
    await new Promise(resolve => setTimeout(resolve, 0));
    
    // Call updateFileNumbers to shift subsequent entries AFTER saving current logSheet
    // This ensures the current logSheet (with edited values) gets skipped
    if (targetFieldId.startsWith('cameraFile')) {
      if (!disabledFields.has(targetFieldId) && camDelta > 0) {
        // Always use camStart (the beginning of the duplicate), not the end of the range
        // updateFileNumbers will skip the first occurrence and shift everything else
        updateFileNumbers(logSheet.projectId, targetFieldId, camStart, camDelta);
      }
    }
    
    // Update existingEntry after shifting
    if (existingEntryUpdates) {
      await updateLogSheet(existingEntry.id, existingEntryUpdates);
    }

    router.back();
  };

  const pruneDisabled = (data: Record<string, any>) => {
    const cleaned: Record<string, any> = { ...data };
    disabledFields.forEach((f) => {
      if (f in cleaned) delete cleaned[f];
    });
    return cleaned;
  };

  const handleSaveWithDuplicateHandling = (position: 'before', duplicateInfo: any) => {
    console.log('========== SAVE INITIATED: handleSaveWithDuplicateHandling ==========');
    console.log('  duplicateInfo:', duplicateInfo);
    if (!logSheet || !project) return;
    const camCount = project?.settings?.cameraConfiguration || 1;
    const existingEntry = duplicateInfo.existingEntry;
    const selectiveShifting = duplicateInfo.selectiveShifting || false;

    const projectLogSheets = logSheets.filter(sheet => sheet.projectId === logSheet.projectId);

    const excludeIds = new Set<string>();
    if (existingEntry?.id) excludeIds.add(existingEntry.id as string);
    if (logSheet?.id) excludeIds.add(logSheet.id as string);

    const checkRangeOverlap = (minA: number, maxA: number, minB: number, maxB: number) => !(maxA < minB || minA > maxB);

    const checkField = (fieldId: string, currentVal?: string, currentRange?: { from: string; to: string } | null): boolean => {
      if (disabledFields.has(fieldId)) return false;
      const currentNum = currentVal ? (parseInt(currentVal, 10) || 0) : 0;
      const curFrom = currentRange?.from ? (parseInt(currentRange.from, 10) || 0) : currentNum;
      const curTo = currentRange?.to ? (parseInt(currentRange.to, 10) || 0) : currentNum;
      const curMin = Math.min(curFrom, curTo);
      const curMax = Math.max(curFrom, curTo);

      for (const sheet of projectLogSheets) {
        if (!sheet.data || excludeIds.has(sheet.id)) continue;
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
          if (checkRangeOverlap(curMin, curMax, exMin, exMax)) {
            return true;
          }
        }
        const existingVal = sheet.data[fieldId] as string | undefined;
        if (existingVal && typeof existingVal === 'string' && !isRangeString(existingVal)) {
          const exNum = parseInt(existingVal, 10) || 0;
          if (exNum >= curMin && exNum <= curMax) {
            return true;
          }
        }
      }
      return false;
    };

    if (duplicateInfo.type === 'take' && position === 'before') {
      const soundConflict = takeData.soundFile && !disabledFields.has('soundFile')
        ? checkField('soundFile', takeData.soundFile as string, rangeData['soundFile'] || null)
        : false;
      let camConflict = false;
      if (camCount === 1) {
        camConflict = !!(takeData.cameraFile && !disabledFields.has('cameraFile') && checkField('cameraFile', takeData.cameraFile as string, rangeData['cameraFile'] || null));
      } else {
        for (let i = 1; i <= camCount; i++) {
          const fid = `cameraFile${i}`;
          const isRecActive = cameraRecState[fid] ?? true;
          if (isRecActive && takeData[fid]) {
            if (checkField(fid, takeData[fid] as string, rangeData[fid] || null)) {
              camConflict = true;
              break;
            }
          }
        }
      }
      if (soundConflict || camConflict) {
        Alert.alert(
          'Duplicate Detected',
          'The camera file and/or sound file are already a part of another take. Please adjust the values.',
          [{ text: 'Cancel', style: 'cancel' }]
        );
        return;
      }
    }

    if (position === 'before') {
      let newLogData = { ...takeData };
      
      console.log('DEBUG handleSaveWithDuplicateHandling - Before cleanup:', {
        'takeData.cameraFile': takeData.cameraFile,
        'takeData.camera1_from': takeData.camera1_from,
        'takeData.camera1_to': takeData.camera1_to,
        'rangeData.cameraFile': rangeData['cameraFile'],
        'showRangeMode.cameraFile': showRangeMode['cameraFile']
      });
      
      // CRITICAL: Remove old range field values that will be replaced by rangeData
      // This prevents stale camera1_from/camera1_to from persisting when editing ranges
      if (camCount === 1) {
        if (showRangeMode['cameraFile'] && rangeData['cameraFile']?.from && rangeData['cameraFile']?.to) {
          delete newLogData.camera1_from;
          delete newLogData.camera1_to;
          delete newLogData.cameraFile;
        }
      } else {
        for (let i = 1; i <= camCount; i++) {
          const fieldId = `cameraFile${i}`;
          if (showRangeMode[fieldId] && rangeData[fieldId]?.from && rangeData[fieldId]?.to) {
            delete newLogData[`camera${i}_from`];
            delete newLogData[`camera${i}_to`];
            delete newLogData[fieldId];
          }
        }
      }
      if (showRangeMode['soundFile'] && rangeData['soundFile']?.from && rangeData['soundFile']?.to) {
        delete newLogData.sound_from;
        delete newLogData.sound_to;
        delete newLogData.soundFile;
      }
      
      console.log('DEBUG - After cleanup:', {
        'newLogData.cameraFile': newLogData.cameraFile,
        'newLogData.camera1_from': newLogData.camera1_from,
        'newLogData.camera1_to': newLogData.camera1_to
      });

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

        // Always insert before in target scene/shot
        const targetSceneNumber = duplicateSceneNumber;
        const targetShotNumber = duplicateShotNumber;
        const targetTakeNumber = parseInt(existingEntry.data?.takeNumber || '0', 10);
        newLogData.sceneNumber = targetSceneNumber;
        newLogData.shotNumber = targetShotNumber;
        // Move the existing (edited) log before the target to align projectLocalId ordering
        try {
          const movingLocalId = parseInt(String((logSheet as any)?.projectLocalId || ''), 10);
          const targetLocalId = parseInt(String((existingEntry as any)?.projectLocalId || ''), 10);
          if (!Number.isNaN(movingLocalId) && !Number.isNaN(targetLocalId) && movingLocalId !== targetLocalId) {
            moveExistingLogBefore(logSheet.projectId, String(movingLocalId), String(targetLocalId));
          }
        } catch {}
        if (!Number.isNaN(targetTakeNumber)) {
          newLogData.takeNumber = existingEntry.data?.takeNumber;
          const originalTakeNumber = parseInt(logSheet.data?.takeNumber || '0', 10);
          const maxTake = originalTakeNumber > targetTakeNumber ? originalTakeNumber - 1 : undefined;
          console.log('DEBUG handleSaveWithDuplicateHandling type=take - Calling updateTakeNumbers with excludeLogId and maxTake:', {
            fromTakeNumber: targetTakeNumber,
            increment: 1,
            excludeLogId: logSheet.id,
            originalTakeNumber,
            maxTakeNumber: maxTake
          });
          updateTakeNumbers(logSheet.projectId, targetSceneNumber, targetShotNumber, targetTakeNumber, 1, logSheet.id, maxTake);
        }

        // Collect all updates for the existing entry to avoid multiple updateLogSheet calls
        const existingEntryUpdates: Record<string, any> = { ...existingEntry.data };
        let hasUpdates = false;

        // Shift file numbers starting from target
        // Shift sound files starting from the correct number
        console.log('🔍 DEBUG [handleSaveWithDuplicateHandling] Sound file branch check:', {
          hasSoundFile: !!existingEntry.data?.soundFile,
          hasSoundFrom: !!existingEntry.data?.sound_from,
          existingEntrySoundFile: existingEntry.data?.soundFile,
          existingEntrySoundFrom: existingEntry.data?.sound_from,
          insertedSoundFile: takeData.soundFile,
          newLogDataSoundFile: newLogData.soundFile,
          isDisabled: disabledFields.has('soundFile'),
          targetTakeNumber
        });
        
        if (existingEntry.data?.soundFile || existingEntry.data?.sound_from) {
          console.log('✅ [handleSaveWithDuplicateHandling] Target has sound file - entering sound file branch');
          let soundStart = targetTakeNumber;
          if (typeof existingEntry.data?.sound_from === 'string') {
            const n = parseInt(existingEntry.data.sound_from, 10);
            if (!Number.isNaN(n)) soundStart = n;
          } else if (typeof existingEntry.data?.soundFile === 'string') {
            const n = parseInt(existingEntry.data.soundFile, 10);
            if (!Number.isNaN(n)) soundStart = n;
          }
          // Use centralized delta calculator instead of inline calculation
          const soundDeltaInput = {
            takeData,
            showRangeMode,
            rangeData
          };
          const soundDelta = calculateSoundDeltaForShifting(soundDeltaInput);
          
          console.log('🔍 DEBUG [handleSaveWithDuplicateHandling] Using centralized calculateSoundDeltaForShifting:', {
            soundDelta,
            takeDataSoundFile: takeData.soundFile,
            showRangeMode: showRangeMode['soundFile'],
            rangeData: rangeData['soundFile']
          });
          
          console.log('🔍 DEBUG [handleSaveWithDuplicateHandling] Sound file calculation (target has sound):', {
            soundStart,
            soundDelta,
            isDisabled: disabledFields.has('soundFile'),
            willCallUpdateFileNumbers: !disabledFields.has('soundFile')
          });
          
          if (!disabledFields.has('soundFile')) {
            console.log('✅ [handleSaveWithDuplicateHandling] Calling updateFileNumbers for soundFile (target has sound):', {
              projectId: logSheet.projectId,
              fieldId: 'soundFile',
              start: soundStart,
              delta: soundDelta
            });
            // Always use soundStart (the beginning of the duplicate), not the end of the range
            updateFileNumbers(logSheet.projectId, 'soundFile', soundStart, soundDelta, logSheet.id);
          } else {
            console.log('❌ [handleSaveWithDuplicateHandling] NOT calling updateFileNumbers for soundFile (disabled)');
          }
            
            // If target has a range, adjust lower to end after inserted and extend upper by delta
            const targetRange = getRangeFromData(existingEntry.data, 'soundFile');
            if (targetRange) {
              const bounds = getInsertedBounds('soundFile');
              const insertedUpper = bounds?.max ?? (parseInt(targetRange.from, 10) || 0);
              const oldToNum = parseInt(targetRange.to, 10) || 0;
              const newFrom = String(insertedUpper + 1).padStart(4, '0');
              const newTo = String(oldToNum + soundDelta).padStart(4, '0');
              existingEntryUpdates.sound_from = newFrom;
              existingEntryUpdates.sound_to = newTo;
              const hadInline = typeof existingEntry.data?.soundFile === 'string' && isRangeString(existingEntry.data.soundFile);
              if (hadInline) {
                existingEntryUpdates.soundFile = `${newFrom}-${newTo}`;
              }
              hasUpdates = true;
            } else if (typeof existingEntry.data?.soundFile === 'string' && existingEntry.data.soundFile.trim().length > 0) {
              const exNum = parseInt(existingEntry.data.soundFile, 10) || 0;
              const newVal = String(exNum + soundDelta).padStart(4, '0');
              existingEntryUpdates.soundFile = newVal;
              hasUpdates = true;
            }
        } else {
          console.log('✅ [handleSaveWithDuplicateHandling] Target has BLANK sound file - entering blank sound branch');
          // Target duplicate has blank sound: still shift subsequent sound files.
          // Fallback to the new log's sound number if available.
          let soundStart: number | null = null;
          if (typeof existingEntry.data?.sound_from === 'string') {
            const n = parseInt(existingEntry.data.sound_from, 10);
            if (!Number.isNaN(n)) soundStart = n;
            console.log('  Blank sound branch: found sound_from =', n);
          } else if (typeof existingEntry.data?.soundFile === 'string') {
            const n = parseInt(existingEntry.data.soundFile, 10);
            if (!Number.isNaN(n)) soundStart = n;
            console.log('  Blank sound branch: found soundFile =', n);
          }
          if (soundStart == null) {
            console.log('  Blank sound branch: soundStart is null, looking for candidate from inserted log');
            const candidate = typeof newLogData.soundFile === 'string'
              ? parseInt(newLogData.soundFile, 10)
              : parseInt(String(takeData.soundFile ?? ''), 10);
            if (!Number.isNaN(candidate)) {
              soundStart = candidate;
              console.log('  Blank sound branch: found candidate from inserted log =', candidate);
            } else {
              console.log('  Blank sound branch: no valid candidate found', {
                newLogDataSoundFile: newLogData.soundFile,
                takeDataSoundFile: takeData.soundFile
              });
            }
          }
          
          console.log('🔍 DEBUG [handleSaveWithDuplicateHandling] Sound file calculation (target has blank sound):', {
            soundStart,
            isDisabled: disabledFields.has('soundFile'),
            willCallUpdateFileNumbers: soundStart != null && !disabledFields.has('soundFile')
          });
          
          if (soundStart != null) {
            // Use centralized delta calculator instead of inline calculation
            const soundDeltaInput = {
              takeData,
              showRangeMode,
              rangeData
            };
            const soundDelta = calculateSoundDeltaForShifting(soundDeltaInput);
            
            console.log('🔍 DEBUG [handleSaveWithDuplicateHandling] Sound delta calculation:', {
              soundDelta,
              rangeData: rangeData['soundFile'],
              showRangeMode: showRangeMode['soundFile'],
              takeDataSoundFile: takeData.soundFile
            });
            
            if (!disabledFields.has('soundFile')) {
              const targetRange = getRangeFromData(existingEntry.data, 'soundFile');
              const start = targetRange ? ((parseInt(targetRange.to, 10) || 0) + 1) : soundStart;
              console.log('✅ [handleSaveWithDuplicateHandling] Calling updateFileNumbers for soundFile (target has blank sound):', {
                projectId: logSheet.projectId,
                fieldId: 'soundFile',
                start,
                delta: soundDelta,
                calculatedFrom: targetRange ? 'targetRange.to + 1' : 'soundStart',
                targetRange: targetRange ? { from: targetRange.from, to: targetRange.to } : null
              });
              updateFileNumbers(logSheet.projectId, 'soundFile', start, soundDelta, logSheet.id);
            } else {
              console.log('❌ [handleSaveWithDuplicateHandling] NOT calling updateFileNumbers for soundFile (disabled)');
            }
          } else {
            console.log('❌ [handleSaveWithDuplicateHandling] NOT calling updateFileNumbers for soundFile: soundStart is null');
          }
        }
        if (camCount === 1) {
          let camStart = targetTakeNumber;
          if (typeof existingEntry.data?.camera1_from === 'string') {
            const n = parseInt(existingEntry.data.camera1_from, 10);
            if (!Number.isNaN(n)) camStart = n;
          } else if (typeof existingEntry.data?.cameraFile === 'string') {
            const n = parseInt(existingEntry.data.cameraFile, 10);
            if (!Number.isNaN(n)) camStart = n;
          }
          {
            // Use centralized delta calculator instead of inline calculation
            const cameraDeltaInput = {
              takeData,
              showRangeMode,
              rangeData
            };
            const camDelta = calculateCameraDeltaForShifting(cameraDeltaInput, 'cameraFile');
            if (!disabledFields.has('cameraFile')) {
              { const targetRange = getRangeFromData(existingEntry.data, 'cameraFile'); const start = targetRange ? ((parseInt(targetRange.to, 10) || 0) + 1) : camStart; updateFileNumbers(logSheet.projectId, 'cameraFile', start, camDelta, logSheet.id); }
              
              // Read current state of the log from store (after updateFileNumbers may have updated it)
              const currentLogSheet = useProjectStore.getState().logSheets.find(sheet => sheet.id === existingEntry.id);
              const currentData = currentLogSheet?.data || existingEntry.data;
              
              // If target has a range, adjust lower to end after inserted and extend upper by delta
              const targetRange = getRangeFromData(currentData, 'cameraFile');
              if (targetRange) {
                const bounds = getInsertedBounds('cameraFile');
                const insertedUpper = bounds?.max ?? (parseInt(targetRange.from, 10) || 0);
                const oldToNum = parseInt(targetRange.to, 10) || 0;
                const newFrom = String(insertedUpper + 1).padStart(4, '0');
                const newTo = String(oldToNum + camDelta).padStart(4, '0');
                const updated: Record<string, any> = {
                  ...currentData,
                  camera1_from: newFrom,
                  camera1_to: newTo
                };
                const hadInline = typeof currentData?.cameraFile === 'string' && isRangeString(currentData.cameraFile);
                if (hadInline) {
                  updated.cameraFile = `${newFrom}-${newTo}`;
                }
                updated.takeNumber = String(targetTakeNumber + 1);
                updateLogSheet(existingEntry.id, updated);
              } else {
                // Handle single camera value (not range) in type=take scenario
                const targetSingleStr = currentData?.cameraFile as string | undefined;
                if (typeof targetSingleStr === 'string' && targetSingleStr.trim().length > 0) {
                  const targetSingleNum = parseInt(targetSingleStr, 10) || 0;
                  if (showRangeMode['cameraFile'] && rangeData['cameraFile']?.from && rangeData['cameraFile']?.to) {
                    const insFrom = parseInt(rangeData['cameraFile'].from, 10) || 0;
                    const insTo = parseInt(rangeData['cameraFile'].to, 10) || 0;
                    const min = Math.min(insFrom, insTo);
                    const max = Math.max(insFrom, insTo);
                    if (targetSingleNum >= min && targetSingleNum <= max) {
                      const updated: Record<string, any> = { 
                        ...currentData, 
                        cameraFile: String(targetSingleNum + camDelta).padStart(4, '0'),
                        takeNumber: String(targetTakeNumber + 1)
                      };
                      updateLogSheet(existingEntry.id, updated);
                    }
                  } else if (takeData.cameraFile) {
                    const newSingle = parseInt(String(takeData.cameraFile), 10) || 0;
                    if (newSingle === targetSingleNum) {
                      const updated: Record<string, any> = { 
                        ...currentData, 
                        cameraFile: String(targetSingleNum + camDelta).padStart(4, '0'),
                        takeNumber: String(targetTakeNumber + 1)
                      };
                      updateLogSheet(existingEntry.id, updated);
                    }
                  }
                }
              }
            }
          }
        } else {
          for (let i = 1; i <= camCount; i++) {
            const fieldId = `cameraFile${i}`;
            if (existingEntry.data?.[fieldId] || existingEntry.data?.[`camera${i}_from`]) {
              let camStart = targetTakeNumber;
              const fromKey = `camera${i}_from` as const;
              const fromVal = existingEntry.data?.[fromKey];
              const val = existingEntry.data?.[fieldId];
              if (typeof fromVal === 'string') {
                const n = parseInt(fromVal, 10);
                if (!Number.isNaN(n)) camStart = n;
              } else if (typeof val === 'string') {
                const n = parseInt(val, 10);
                if (!Number.isNaN(n)) camStart = n;
              }
              {
                // Use centralized delta calculator instead of inline calculation
                const cameraDeltaInput = {
                  takeData,
                  showRangeMode,
                  rangeData
                };
                const camDelta = calculateCameraDeltaForShifting(cameraDeltaInput, fieldId);
                if (!disabledFields.has(fieldId)) {
                  { const targetRange = getRangeFromData(existingEntry.data, fieldId); const start = targetRange ? ((parseInt(targetRange.to, 10) || 0) + 1) : camStart; updateFileNumbers(logSheet.projectId, fieldId, start, camDelta, logSheet.id); }
                  
                  // Read current state of the log from store (after updateFileNumbers may have updated it)
                  const currentLogSheet = useProjectStore.getState().logSheets.find(sheet => sheet.id === existingEntry.id);
                  const currentData = currentLogSheet?.data || existingEntry.data;
                  
                  // If target has a range, adjust lower to end after inserted and extend upper by delta
                  const targetRange = getRangeFromData(currentData, fieldId);
                  if (targetRange) {
                    const bounds = getInsertedBounds(fieldId);
                    const insertedUpper = bounds?.max ?? (parseInt(targetRange.from, 10) || 0);
                    const oldToNum = parseInt(targetRange.to, 10) || 0;
                    const newFrom = String(insertedUpper + 1).padStart(4, '0');
                    const newTo = String(oldToNum + camDelta).padStart(4, '0');
                    const updated: Record<string, any> = {
                      ...currentData,
                      [`camera${i}_from`]: newFrom,
                      [`camera${i}_to`]: newTo
                    };
                    const hadInline = typeof currentData?.[fieldId] === 'string' && isRangeString(currentData[fieldId]);
                    if (hadInline) {
                      updated[fieldId] = `${newFrom}-${newTo}`;
                    }
                    updated.takeNumber = String(targetTakeNumber + 1);
                    updateLogSheet(existingEntry.id, updated);
                  } else {
                    // Handle single camera value (not range) in type=take multi-camera scenario
                    const targetSingleStr = currentData?.[fieldId] as string | undefined;
                    if (typeof targetSingleStr === 'string' && targetSingleStr.trim().length > 0) {
                      const targetSingleNum = parseInt(targetSingleStr, 10) || 0;
                      // Use centralized delta calculator for the range calculation
                      const cameraDeltaInput = {
                        takeData,
                        showRangeMode,
                        rangeData
                      };
                      const calculatedDelta = calculateCameraDeltaForShifting(cameraDeltaInput, fieldId);
                      if (showRangeMode[fieldId] && rangeData[fieldId]?.from && rangeData[fieldId]?.to) {
                        const insFrom = parseInt(rangeData[fieldId].from, 10) || 0;
                        const insTo = parseInt(rangeData[fieldId].to, 10) || 0;
                        const min = Math.min(insFrom, insTo);
                        const max = Math.max(insFrom, insTo);
                        if (targetSingleNum >= min && targetSingleNum <= max) {
                          const updated: Record<string, any> = { 
                            ...currentData, 
                            [fieldId]: String(targetSingleNum + camDelta).padStart(4, '0'),
                            takeNumber: String(targetTakeNumber + 1)
                          };
                          updateLogSheet(existingEntry.id, updated);
                        }
                      } else if (takeData[fieldId]) {
                        const newSingle = parseInt(String(takeData[fieldId]), 10) || 0;
                        if (newSingle === targetSingleNum) {
                          const updated: Record<string, any> = { 
                            ...currentData, 
                            [fieldId]: String(targetSingleNum + camDelta).padStart(4, '0'),
                            takeNumber: String(targetTakeNumber + 1)
                          };
                          updateLogSheet(existingEntry.id, updated);
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }

        // Apply all accumulated updates to the existing entry in a single call
        if (hasUpdates) {
          updateLogSheet(existingEntry.id, existingEntryUpdates);
        }

      } else if (duplicateInfo.type === 'file') {
        // Force insert into target scene/shot
        const targetSceneNumber = existingEntry.data?.sceneNumber;
        const targetShotNumber = existingEntry.data?.shotNumber;
        const targetTakeNumber = parseInt(existingEntry.data?.takeNumber || '0', 10);
        newLogData.sceneNumber = targetSceneNumber;
        newLogData.shotNumber = targetShotNumber;
        // Move the existing (edited) log before the target to align projectLocalId ordering
        try {
          const movingLocalId = parseInt(String((logSheet as any)?.projectLocalId || ''), 10);
          const targetLocalId = parseInt(String((existingEntry as any)?.projectLocalId || ''), 10);
          if (!Number.isNaN(movingLocalId) && !Number.isNaN(targetLocalId) && movingLocalId !== targetLocalId) {
            moveExistingLogBefore(logSheet.projectId, String(movingLocalId), String(targetLocalId));
          }
        } catch {}
        if (targetSceneNumber && targetShotNumber && !Number.isNaN(targetTakeNumber)) {
          newLogData.takeNumber = existingEntry.data.takeNumber;
          const originalTakeNumber = parseInt(logSheet.data?.takeNumber || '0', 10);
          const maxTake = originalTakeNumber > targetTakeNumber ? originalTakeNumber - 1 : undefined;
          console.log('DEBUG handleSaveWithDuplicateHandling type=file - Calling updateTakeNumbers with excludeLogId and maxTake:', {
            fromTakeNumber: targetTakeNumber,
            increment: 1,
            excludeLogId: logSheet.id,
            originalTakeNumber,
            maxTakeNumber: maxTake
          });
          updateTakeNumbers(logSheet.projectId, targetSceneNumber, targetShotNumber, targetTakeNumber, 1, logSheet.id, maxTake);
        }

        // Save current log FIRST with range persistence to avoid stale ranges
        {
          let finalData: Record<string, any> = { ...newLogData };
          if (camCount > 1) {
            for (let i = 1; i <= camCount; i++) {
              const fid = `cameraFile${i}`;
              const isRecActive = cameraRecState[fid] ?? true;
              if (!isRecActive) delete finalData[fid];
            }
          }
          finalData = pruneDisabled(finalData);
          const pad4 = (v?: string) => (v ? String(parseInt(v as any, 10) || 0).padStart(4, '0') : '');
          // Persist sound range or single
          if (showRangeMode['soundFile'] && rangeData['soundFile']?.from && rangeData['soundFile']?.to) {
            finalData['sound_from'] = pad4(rangeData['soundFile'].from);
            finalData['sound_to'] = pad4(rangeData['soundFile'].to);
            delete finalData.soundFile;
          } else if (!disabledFields.has('soundFile')) {
            delete finalData['sound_from'];
            delete finalData['sound_to'];
          } else {
            delete finalData.soundFile;
            delete finalData['sound_from'];
            delete finalData['sound_to'];
          }
          // Persist camera ranges - checking range mode FIRST regardless of enabled/disabled status
          if (camCount === 1) {
            const hasRange = showRangeMode['cameraFile'] && rangeData['cameraFile']?.from && rangeData['cameraFile']?.to;
            const isDisabled = disabledFields.has('cameraFile');
            
            console.log('DEBUG handleSaveWithDuplicateHandling type=file - Camera handling:', {
              hasRange,
              isDisabled,
              'rangeData.cameraFile': rangeData['cameraFile'],
              'finalData.camera1_from BEFORE': finalData.camera1_from,
              'finalData.camera1_to BEFORE': finalData.camera1_to
            });
            
            if (hasRange) {
              // Has range data - save it (works for both waste and non-waste)
              finalData['camera1_from'] = pad4(rangeData['cameraFile'].from);
              finalData['camera1_to'] = pad4(rangeData['cameraFile'].to);
              delete finalData.cameraFile;
              
              console.log('DEBUG - Set camera range:', {
                'finalData.camera1_from': finalData.camera1_from,
                'finalData.camera1_to': finalData.camera1_to,
                'finalData.cameraFile': finalData.cameraFile
              });
            } else if (!isDisabled) {
              // Enabled field without range - keep single value mode, delete range fields
              delete finalData['camera1_from'];
              delete finalData['camera1_to'];
            } else {
              // Disabled field without range data - delete everything (waste without range)
              delete finalData.cameraFile;
              delete finalData['camera1_from'];
              delete finalData['camera1_to'];
            }
          } else {
            for (let i = 1; i <= camCount; i++) {
              const fid = `cameraFile${i}`;
              const hasRange = showRangeMode[fid] && rangeData[fid]?.from && rangeData[fid]?.to;
              const isDisabled = disabledFields.has(fid);
              const isRecActive = cameraRecState[fid] ?? true;
              
              if (hasRange) {
                // Has range data - save it (works for both waste and non-waste)
                finalData[`camera${i}_from`] = pad4(rangeData[fid].from);
                finalData[`camera${i}_to`] = pad4(rangeData[fid].to);
                delete finalData[fid];
              } else if (!isDisabled && isRecActive) {
                // Enabled field without range - keep single value mode, delete range fields
                delete finalData[`camera${i}_from`];
                delete finalData[`camera${i}_to`];
              } else {
                // Disabled field or REC off without range data - delete everything
                delete finalData[fid];
                delete finalData[`camera${i}_from`];
                delete finalData[`camera${i}_to`];
              }
            }
          }
          const filteredShotDetails = (classification === 'Ambience' || classification === 'SFX') ? shotDetails.filter(d => d !== 'MOS') : shotDetails;
          const updatedData = {
            ...finalData,
            classification,
            shotDetails: filteredShotDetails,
            isGoodTake,
            wasteOptions: classification === 'Waste' ? JSON.stringify(wasteOptions) : '',
            insertSoundSpeed: classification === 'Insert' ? (insertSoundSpeed?.toString() || '') : '',
            cameraRecState: camCount > 1 ? cameraRecState : undefined
          };
          
          console.log('DEBUG handleSaveWithDuplicateHandling type=file - Final updatedData:', {
            'updatedData.camera1_from': updatedData.camera1_from,
            'updatedData.camera1_to': updatedData.camera1_to,
            'updatedData.cameraFile': updatedData.cameraFile
          });
          
          updateLogSheet(logSheet.id, updatedData);
        }

        // Shift file numbers starting from target
        // Process cameras first, then sound ONCE after all camera processing
        console.log('===== handleSaveWithDuplicateHandling type=file - Starting shift operations =====');
        console.log('  Edited log ID:', logSheet.id);
        console.log('  Existing entry ID:', existingEntry.id);

        console.log('DEBUG - Processing camera shifts for camCount=1');
        if (camCount === 1) {
          let camStart = targetTakeNumber;
          if (typeof existingEntry.data?.camera1_from === 'string') {
            const n = parseInt(existingEntry.data.camera1_from, 10);
            if (!Number.isNaN(n)) camStart = n;
          } else if (typeof existingEntry.data?.cameraFile === 'string') {
            const n = parseInt(existingEntry.data.cameraFile, 10);
            if (!Number.isNaN(n)) camStart = n;
          }
          {
            // Use centralized delta calculator instead of inline calculation
            const cameraDeltaInput = {
              takeData,
              showRangeMode,
              rangeData
            };
            const camDelta = calculateCameraDeltaForShifting(cameraDeltaInput, 'cameraFile');
            if (!disabledFields.has('cameraFile')) {
              { 
                const targetRange = getRangeFromData(existingEntry.data, 'cameraFile'); 
                const start = targetRange ? ((parseInt(targetRange.to, 10) || 0) + 1) : camStart; 
                console.log('====> Calling updateFileNumbers for cameraFile:', {
                  start,
                  camDelta,
                  camStart,
                  targetRange,
                  'existingEntry.cameraFile': existingEntry.data?.cameraFile,
                  'editedLogId_ToExclude': logSheet.id
                });
                updateFileNumbers(logSheet.projectId, 'cameraFile', start, camDelta, logSheet.id); 
              }
              
              // Read current state of the log from store (after updateFileNumbers may have updated it)
              const currentLogSheet = useProjectStore.getState().logSheets.find(sheet => sheet.id === existingEntry.id);
              const currentData = currentLogSheet?.data || existingEntry.data;
              
              // If target has a range, adjust lower to end after inserted and extend upper by delta
              const targetRange = getRangeFromData(currentData, 'cameraFile');
              if (targetRange) {
                const bounds = getInsertedBounds('cameraFile');
                const insertedUpper = bounds?.max ?? (parseInt(targetRange.from, 10) || 0);
                const oldToNum = parseInt(targetRange.to, 10) || 0;
                const newFrom = String(insertedUpper + 1).padStart(4, '0');
                const newTo = String(oldToNum + camDelta).padStart(4, '0');
                const updated: Record<string, any> = {
                  ...currentData,
                  camera1_from: newFrom,
                  camera1_to: newTo
                };
                const hadInline = typeof currentData?.cameraFile === 'string' && isRangeString(currentData.cameraFile);
                if (hadInline) {
                  updated.cameraFile = `${newFrom}-${newTo}`;
                }
                updateLogSheet(existingEntry.id, updated);
                  } else if (!targetRange) {
                    // Handle single camera value (not range)
                    const targetSingleStr = currentData?.cameraFile as string | undefined;
                if (typeof targetSingleStr === 'string' && targetSingleStr.trim().length > 0) {
                  const targetSingleNum = parseInt(targetSingleStr, 10) || 0;
                  if (showRangeMode['cameraFile'] && rangeData['cameraFile']?.from && rangeData['cameraFile']?.to) {
                    // New entry has range, target has single value
                    const insFrom = parseInt(rangeData['cameraFile'].from, 10) || 0;
                    const insTo = parseInt(rangeData['cameraFile'].to, 10) || 0;
                    const min = Math.min(insFrom, insTo);
                    const max = Math.max(insFrom, insTo);
                        if (targetSingleNum >= min && targetSingleNum <= max) {
                      const updatedData: Record<string, any> = { 
                        ...currentData, 
                        cameraFile: String(targetSingleNum + camDelta).padStart(4, '0'),
                        takeNumber: String(targetTakeNumber + 1)
                      };
                      updateLogSheet(existingEntry.id, updatedData);
                    }
                  } else if (takeData.cameraFile) {
                    // Both have single values
                    const newSingle = parseInt(String(takeData.cameraFile), 10) || 0;
                    if (newSingle === targetSingleNum) {
                      const updatedData: Record<string, any> = { 
                        ...currentData, 
                        cameraFile: String(targetSingleNum + camDelta).padStart(4, '0'),
                        takeNumber: String(targetTakeNumber + 1)
                      };
                      updateLogSheet(existingEntry.id, updatedData);
                    }
                  }
                }
              }
            }
          }
        } else {
          for (let i = 1; i <= camCount; i++) {
            const fieldId = `cameraFile${i}`;
            if (existingEntry.data?.[fieldId] || existingEntry.data?.[`camera${i}_from`]) {
              let camStart = targetTakeNumber;
              const fromKey = `camera${i}_from` as const;
              const fromVal = existingEntry.data?.[fromKey];
              const val = existingEntry.data?.[fieldId];
              if (typeof fromVal === 'string') {
                const n = parseInt(fromVal, 10);
                if (!Number.isNaN(n)) camStart = n;
              } else if (typeof val === 'string') {
                const n = parseInt(val, 10);
                if (!Number.isNaN(n)) camStart = n;
              }
              {
                // Use centralized delta calculator instead of inline calculation
                const cameraDeltaInput = {
                  takeData,
                  showRangeMode,
                  rangeData
                };
                const camDelta = calculateCameraDeltaForShifting(cameraDeltaInput, fieldId);
                if (!disabledFields.has(fieldId)) {
                  { const targetRange = getRangeFromData(existingEntry.data, fieldId); const start = targetRange ? ((parseInt(targetRange.to, 10) || 0) + 1) : camStart; updateFileNumbers(logSheet.projectId, fieldId, start, camDelta); }
                  
                  // Read current state of the log from store (after updateFileNumbers may have updated it)
                  const currentLogSheet = useProjectStore.getState().logSheets.find(sheet => sheet.id === existingEntry.id);
                  const currentData = currentLogSheet?.data || existingEntry.data;
                  
                  // If target has a range, adjust lower to end after inserted and extend upper by delta
                  const targetRange = getRangeFromData(currentData, fieldId);
                  if (targetRange) {
                    const bounds = getInsertedBounds(fieldId);
                    const insertedUpper = bounds?.max ?? (parseInt(targetRange.from, 10) || 0);
                    const oldToNum = parseInt(targetRange.to, 10) || 0;
                    const newFrom = String(insertedUpper + 1).padStart(4, '0');
                    const newTo = String(oldToNum + camDelta).padStart(4, '0');
                    const updated: Record<string, any> = {
                      ...currentData,
                      [`camera${i}_from`]: newFrom,
                      [`camera${i}_to`]: newTo
                    };
                    const hadInline = typeof currentData?.[fieldId] === 'string' && isRangeString(currentData[fieldId]);
                    if (hadInline) {
                      updated[fieldId] = `${newFrom}-${newTo}`;
                    }
                    updated.takeNumber = String(targetTakeNumber + 1);
                    updateLogSheet(existingEntry.id, updated);
                  } else if (!targetRange) {
                    // Handle single camera value (not range)
                    const targetSingleStr = currentData?.[fieldId] as string | undefined;
                    if (typeof targetSingleStr === 'string' && targetSingleStr.trim().length > 0) {
                      const targetSingleNum = parseInt(targetSingleStr, 10) || 0;
                      if (showRangeMode[fieldId] && rangeData[fieldId]?.from && rangeData[fieldId]?.to) {
                        // New entry has range, target has single value
                        const insFrom = parseInt(rangeData[fieldId].from, 10) || 0;
                        const insTo = parseInt(rangeData[fieldId].to, 10) || 0;
                        const min = Math.min(insFrom, insTo);
                        const max = Math.max(insFrom, insTo);
                        if (targetSingleNum >= min && targetSingleNum <= max) {
                          const updatedData: Record<string, any> = { 
                            ...currentData, 
                            [fieldId]: String(targetSingleNum + camDelta).padStart(4, '0'),
                            takeNumber: String(targetTakeNumber + 1)
                          };
                          updateLogSheet(existingEntry.id, updatedData);
                        }
                      } else if (takeData[fieldId]) {
                        // Both have single values
                        const newSingle = parseInt(String(takeData[fieldId]), 10) || 0;
                        if (newSingle === targetSingleNum) {
                          const updatedData: Record<string, any> = { 
                            ...currentData, 
                            [fieldId]: String(targetSingleNum + camDelta).padStart(4, '0'),
                            takeNumber: String(targetTakeNumber + 1)
                          };
                          updateLogSheet(existingEntry.id, updatedData);
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
        
        // Also shift sound for single and multi-camera scenario (ONCE, after all camera processing)
        try {
          let soundStartLocal = 0;
          let soundIncrementLocal = 0;
          const hasInsertedSoundRange = !!(showRangeMode['soundFile'] && rangeData['soundFile']?.from && rangeData['soundFile']?.to);
          const hasInsertedSoundSingle = !!(takeData.soundFile?.trim());
          if (hasInsertedSoundRange) {
            const newFromS = parseInt(rangeData['soundFile'].from, 10) || 0;
            const newToS = parseInt(rangeData['soundFile'].to, 10) || 0;
            soundStartLocal = Math.min(newFromS, newToS);
            soundIncrementLocal = Math.abs(newToS - newFromS) + 1;
          } else if (hasInsertedSoundSingle) {
            const n = parseInt(String(takeData.soundFile), 10) || 0;
            soundStartLocal = n;
            soundIncrementLocal = 1;
          } else {
            const projectLogSheets = logSheets.filter(sheet => sheet.projectId === logSheet.projectId);
            const sameShotTakes = projectLogSheets
              .filter(sheet => sheet.data?.sceneNumber === targetSceneNumber && sheet.data?.shotNumber === targetShotNumber)
              .map(sheet => ({ sheet, take: parseInt(sheet.data?.takeNumber || '0', 10) }))
              .filter(x => !isNaN(x.take) && x.take < targetTakeNumber)
              .sort((a, b) => b.take - a.take);
            for (const entry of sameShotTakes) {
              const d = entry.sheet.data || {} as any;
              if (typeof d.sound_from === 'string' && typeof d.sound_to === 'string') {
                const fromN = parseInt(d.sound_from, 10) || 0;
                const toN = parseInt(d.sound_to, 10) || 0;
                soundStartLocal = Math.max(fromN, toN);
                break;
              } else if (typeof d.soundFile === 'string' && d.soundFile.trim().length > 0) {
                if (d.soundFile.includes('-')) {
                  const [s, e] = d.soundFile.split('-').map((x: string) => parseInt(x.trim(), 10) || 0);
                  soundStartLocal = Math.max(s, e);
                } else {
                  soundStartLocal = parseInt(d.soundFile, 10) || 0;
                }
                break;
              }
            }
            soundIncrementLocal = 0;
          }
          if (!disabledFields.has('soundFile') && (soundStartLocal > 0 || soundIncrementLocal > 0)) {
            // Use target duplicate's sound value as the start if it exists
            let soundStartForShift = soundStartLocal;
            if (existingEntry.data?.soundFile || existingEntry.data?.sound_from) {
              if (typeof existingEntry.data?.sound_from === 'string') {
                const n = parseInt(existingEntry.data.sound_from, 10);
                if (!Number.isNaN(n)) soundStartForShift = n;
              } else if (typeof existingEntry.data?.soundFile === 'string') {
                const n = parseInt(existingEntry.data.soundFile, 10);
                if (!Number.isNaN(n)) soundStartForShift = n;
              }
            }
            updateFileNumbers(logSheet.projectId, 'soundFile', soundStartForShift, soundIncrementLocal, logSheet.id);
          }
        } catch {}
      }

      // Note: For type='file', the log was already saved at line 2509 with correct range persistence
      // This redundant save code has been removed to prevent overwriting with cleaned data
      console.log('DEBUG handleSaveWithDuplicateHandling type=file - Skipping redundant second save');
    }
    router.back();
  };

  const saveNormally = () => {
    console.log('========== SAVE INITIATED: saveNormally ==========');
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
          const inRange = showRangeMode[fieldId] === true;
          const r = rangeData[fieldId];
          
          if (fieldId === 'cameraFile' || fieldId.startsWith('cameraFile')) {
            console.log(`DEBUG applyRangePersistence - handleField('${fieldId}'):`);
            console.log(`  enabled: ${enabled}, inRange: ${inRange}`);
            console.log(`  rangeData[${fieldId}]:`, r);
            console.log(`  Before delete - out.camera${idx}_from:`, out[`camera${idx}_from`]);
            console.log(`  Before delete - out.camera${idx}_to:`, out[`camera${idx}_to`]);
          }
          
          // First, clear any existing range or single values to ensure clean state
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
          
          // For disabled fields (waste), still save range data if it exists
          if (!enabled) {
            if (inRange && r && r.from && r.to) {
              // Field is disabled but has range data - save the range (waste with range)
              if (fieldId === 'soundFile') {
                out['sound_from'] = pad4(r.from);
                out['sound_to'] = pad4(r.to);
              } else if (idx != null) {
                out[`camera${idx}_from`] = pad4(r.from);
                out[`camera${idx}_to`] = pad4(r.to);
                if (fieldId === 'cameraFile' || fieldId.startsWith('cameraFile')) {
                  console.log(`  Set camera${idx}_from =`, pad4(r.from));
                  console.log(`  Set camera${idx}_to =`, pad4(r.to));
                }
              }
            } else {
              if (fieldId === 'cameraFile' || fieldId.startsWith('cameraFile')) {
                console.log(`  No range data to save (inRange:${inRange}, r:`, r, ')');
              }
            }
            // If no range data, fields remain deleted (blank for waste)
            return;
          }
          
          // Field is enabled - apply normal logic
          if (inRange && r && r.from && r.to) {
            // Range mode - set _from and _to fields
            if (fieldId === 'soundFile') {
              out['sound_from'] = pad4(r.from);
              out['sound_to'] = pad4(r.to);
            } else if (idx != null) {
              out[`camera${idx}_from`] = pad4(r.from);
              out[`camera${idx}_to`] = pad4(r.to);
            }
          } else if (!inRange) {
            // Single value mode - restore the single field from data
            if (fieldId === 'soundFile' && data.soundFile) {
              out.soundFile = data.soundFile;
            } else if (idx != null) {
              const base = idx === 1 && cameraConfiguration === 1 ? 'cameraFile' : `cameraFile${idx}`;
              if (data[base]) {
                out[base] = data[base];
              }
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

      console.log('DEBUG saveNormally - Before save:');
      console.log('  showRangeMode:', showRangeMode);
      console.log('  rangeData:', rangeData);
      console.log('  disabledFields:', Array.from(disabledFields));
      console.log('  finalTakeData camera1_from:', finalTakeData.camera1_from);
      console.log('  finalTakeData camera1_to:', finalTakeData.camera1_to);
      console.log('  finalTakeData cameraFile:', finalTakeData.cameraFile);

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
      
      console.log('DEBUG saveNormally - updatedData to save:', {
        camera1_from: updatedData.camera1_from,
        camera1_to: updatedData.camera1_to,
        cameraFile: updatedData.cameraFile
      });
      
      updateLogSheet(logSheet.id, updatedData);
      router.back();
    } catch (error) {
      console.error('Error saving take:', error);
      Alert.alert('Error', 'Failed to save changes. Please try again.');
    }
  };

  const handleSaveWithDuplicatePair = async (
    existingEntry: any,
    soundFromNumber: number,
    cameraFieldId: string,
    cameraFromNumber: number
  ) => {
    console.log('========== SAVE INITIATED: handleSaveWithDuplicatePair ==========');
    console.log('  existingEntry.id:', existingEntry?.id);
    if (!logSheet || !project) return;
    const camCount = project?.settings?.cameraConfiguration || 1;

    // In edit mode, preserve the user's edited values from rangeData and takeData
    let newLogData = { ...takeData } as Record<string, any>;
    
    // CRITICAL: Remove old range field values that will be replaced by rangeData
    // This prevents stale camera1_from/camera1_to from persisting when editing ranges
    if (camCount === 1) {
      if (showRangeMode['cameraFile'] && rangeData['cameraFile']?.from && rangeData['cameraFile']?.to) {
        delete newLogData.camera1_from;
        delete newLogData.camera1_to;
        delete newLogData.cameraFile;
      }
    } else {
      for (let i = 1; i <= camCount; i++) {
        const fieldId = `cameraFile${i}`;
        if (showRangeMode[fieldId] && rangeData[fieldId]?.from && rangeData[fieldId]?.to) {
          delete newLogData[`camera${i}_from`];
          delete newLogData[`camera${i}_to`];
          delete newLogData[fieldId];
        }
      }
    }
    
    // Update scene/shot/take to match the target position
    const targetSceneNumber = existingEntry.data?.sceneNumber as string | undefined;
    const targetShotNumber = existingEntry.data?.shotNumber as string | undefined;
    const targetTake = parseInt(existingEntry.data?.takeNumber || '0', 10);

    newLogData.sceneNumber = targetSceneNumber;
    newLogData.shotNumber = targetShotNumber;
    if (!Number.isNaN(targetTake)) {
      newLogData.takeNumber = existingEntry.data?.takeNumber;
      const originalTakeNumber = parseInt(logSheet.data?.takeNumber || '0', 10);
      const maxTake = originalTakeNumber > targetTake ? originalTakeNumber - 1 : undefined;
      console.log('DEBUG handleSaveWithDuplicatePair - Calling updateTakeNumbers with excludeLogId and maxTake:', {
        fromTakeNumber: targetTake,
        increment: 1,
        excludeLogId: logSheet.id,
        originalTakeNumber,
        maxTakeNumber: maxTake
      });
      updateTakeNumbers(logSheet.projectId, targetSceneNumber || '', targetShotNumber || '', targetTake, 1, logSheet.id, maxTake);
    }

    // Collect all updates for the existing entry to avoid multiple updateLogSheet calls
    let existingEntryUpdates: Record<string, any> = { ...existingEntry.data };
    let hasUpdates = false;
    
    // Update the take number for the existing entry (it's being shifted by 1)
    if (!Number.isNaN(targetTake)) {
      existingEntryUpdates.takeNumber = String(targetTake + 1);
      hasUpdates = true;
    }

    let soundStart = soundFromNumber;
    if (typeof existingEntry.data?.sound_from === 'string') {
      const n = parseInt(existingEntry.data.sound_from, 10);
      if (!Number.isNaN(n)) soundStart = n;
    } else if (typeof existingEntry.data?.soundFile === 'string') {
      const n = parseInt(existingEntry.data.soundFile, 10);
      if (!Number.isNaN(n)) soundStart = n;
    }

    // Use centralized delta calculator instead of inline calculation
    const soundDeltaInput = {
      takeData,
      showRangeMode,
      rangeData
    };
    const soundDelta = calculateSoundDeltaForShifting(soundDeltaInput);

    let newSoundToNum = 0;
    const rSound = getRangeFromData(existingEntry.data, 'soundFile');
    if (rSound) {
      const exTo = parseInt(rSound.to, 10) || 0;
      // Use centralized delta calculator instead of inline calculation
      const delta = calculateSoundDeltaForShifting({
        takeData,
        showRangeMode,
        rangeData
      });
      if (!disabledFields.has('soundFile')) {
        const bounds = getInsertedBounds('soundFile');
        const insertedUpper = bounds?.max ?? (parseInt(rSound.from, 10) || 0);
        const newFrom = String(insertedUpper + 1).padStart(4, '0');
        const newTo = String(exTo + delta).padStart(4, '0');
        newSoundToNum = exTo + delta;
        existingEntryUpdates.sound_from = newFrom;
        existingEntryUpdates.sound_to = newTo;
        const hadInline = typeof existingEntry.data?.soundFile === 'string' && isRangeString(existingEntry.data.soundFile);
        if (hadInline) {
          existingEntryUpdates.soundFile = `${newFrom}-${newTo}`;
        }
        hasUpdates = true;
      }
    } else if (typeof existingEntry.data?.soundFile === 'string' && existingEntry.data.soundFile.trim().length > 0 && !disabledFields.has('soundFile')) {
      // Use centralized delta calculator instead of inline calculation
      const delta = calculateSoundDeltaForShifting({
        takeData,
        showRangeMode,
        rangeData
      });
      const exNum = parseInt(existingEntry.data.soundFile, 10) || 0;
      const newVal = String(exNum + delta).padStart(4, '0');
      newSoundToNum = exNum + delta;
      existingEntryUpdates.soundFile = newVal;
      hasUpdates = true;
    }

    if (camCount === 1) {
      let camStart = cameraFromNumber;
      if (typeof existingEntry.data?.camera1_from === 'string') {
        const n = parseInt(existingEntry.data.camera1_from, 10);
        if (!Number.isNaN(n)) camStart = n;
      } else if (typeof existingEntry.data?.cameraFile === 'string') {
        const n = parseInt(existingEntry.data.cameraFile, 10);
        if (!Number.isNaN(n)) camStart = n;
      }
      // Use centralized delta calculator instead of inline calculation
      const cameraDeltaInput = {
        takeData,
        showRangeMode,
        rangeData
      };
      const camDelta = disabledFields.has('cameraFile') 
        ? 0 
        : calculateCameraDeltaForShifting(cameraDeltaInput, 'cameraFile');

      let newCamToNum = 0;
      const targetRange = getRangeFromData(existingEntry.data, 'cameraFile');
      if (targetRange && !disabledFields.has('cameraFile')) {
        const bounds = getInsertedBounds('cameraFile');
        const insertedUpper = bounds?.max ?? (parseInt(targetRange.from, 10) || 0);
        const oldToNum = parseInt(targetRange.to, 10) || 0;
        const delta = camDelta;
        const newFrom = String(insertedUpper + 1).padStart(4, '0');
        const newTo = String(oldToNum + delta).padStart(4, '0');
        newCamToNum = oldToNum + delta;
        existingEntryUpdates = {
          ...existingEntryUpdates,
          camera1_from: newFrom,
          camera1_to: newTo
        };
        const hadInline = typeof existingEntry.data?.cameraFile === 'string' && isRangeString(existingEntry.data.cameraFile);
        if (hadInline) {
          existingEntryUpdates.cameraFile = `${newFrom}-${newTo}`;
        }
        hasUpdates = true;
      } else {
        // Handle single camera value (not range) - target has single, need to update it
        const targetHasSingleCamera = typeof existingEntry.data?.cameraFile === 'string' && !isRangeString(existingEntry.data.cameraFile);
        if (targetHasSingleCamera) {
          const targetCamNum = parseInt(existingEntry.data.cameraFile as string, 10) || 0;
          
          // Check if new entry has range or single value - use edited values
          let newCamMin: number;
          let newCamMax: number;
          if (showRangeMode['cameraFile'] && rangeData['cameraFile']?.from && rangeData['cameraFile']?.to) {
            // New entry has range - use edited range values
            const a = parseInt(rangeData['cameraFile'].from, 10) || 0;
            const b = parseInt(rangeData['cameraFile'].to, 10) || 0;
            newCamMin = Math.min(a, b);
            newCamMax = Math.max(a, b);
          } else if (takeData.cameraFile) {
            // New entry has single value
            const val = parseInt(String(takeData.cameraFile), 10) || 0;
            newCamMin = val;
            newCamMax = val;
          } else {
            newCamMin = 0;
            newCamMax = 0;
          }
          
          // Only bump if target camera number equals the min of the new range (insert before scenario)
          const shouldBump = targetCamNum === newCamMin;
          if (shouldBump) {
            // Use edited range's max + 1 for calculating bump position
            existingEntryUpdates = {
              ...existingEntryUpdates,
              cameraFile: String(newCamMax + 1).padStart(4, '0'),
              takeNumber: String(targetTake + 1)
            };
            hasUpdates = true;
          }
        }
      }

    } else {
      for (let i = 1; i <= camCount; i++) {
        const fieldId = `cameraFile${i}`;
        if (existingEntry.data?.[fieldId] || existingEntry.data?.[`camera${i}_from`]) {
          let camStart = cameraFromNumber;
          const fromKey = `camera${i}_from` as const;
          const fromVal = existingEntry.data?.[fromKey];
          const val = existingEntry.data?.[fieldId];
          if (typeof fromVal === 'string') {
            const n = parseInt(fromVal, 10);
            if (!Number.isNaN(n)) camStart = n;
          } else if (typeof val === 'string') {
            const n = parseInt(val, 10);
            if (!Number.isNaN(n)) camStart = n;
          }
          // Use centralized delta calculator instead of inline calculation
          const cameraDeltaInput = {
            takeData,
            showRangeMode,
            rangeData
          };
          const camDelta = disabledFields.has(fieldId)
            ? 0
            : calculateCameraDeltaForShifting(cameraDeltaInput, fieldId);

          let newCamToNum = 0;
          const targetRange = getRangeFromData(existingEntry.data, fieldId);
          if (targetRange && !disabledFields.has(fieldId)) {
            const bounds = getInsertedBounds(fieldId);
            const insertedUpper = bounds?.max ?? (parseInt(targetRange.from, 10) || 0);
            const oldToNum = parseInt(targetRange.to, 10) || 0;
            const delta = camDelta;
            const newFrom = String(insertedUpper + 1).padStart(4, '0');
            const newTo = String(oldToNum + delta).padStart(4, '0');
            newCamToNum = oldToNum + delta;
            existingEntryUpdates = {
              ...existingEntryUpdates,
              [`camera${i}_from`]: newFrom,
              [`camera${i}_to`]: newTo
            };
            const hadInline = typeof existingEntry.data?.[fieldId] === 'string' && isRangeString(existingEntry.data[fieldId]);
            if (hadInline) {
              existingEntryUpdates[fieldId] = `${newFrom}-${newTo}`;
            }
            hasUpdates = true;
          } else {
            // Handle single camera value (not range) - target has single, need to update it
            const targetHasSingleCamera = typeof existingEntry.data?.[fieldId] === 'string' && !isRangeString(existingEntry.data[fieldId]);
            if (targetHasSingleCamera) {
              const targetCamNum = parseInt(existingEntry.data[fieldId] as string, 10) || 0;
              
              // Check if new entry has range or single value - use edited values
              let newCamMin: number;
              let newCamMax: number;
              if (showRangeMode[fieldId] && rangeData[fieldId]?.from && rangeData[fieldId]?.to) {
                // New entry has range - use edited range values
                const a = parseInt(rangeData[fieldId].from, 10) || 0;
                const b = parseInt(rangeData[fieldId].to, 10) || 0;
                newCamMin = Math.min(a, b);
                newCamMax = Math.max(a, b);
              } else if (takeData[fieldId]) {
                // New entry has single value
                const val = parseInt(String(takeData[fieldId]), 10) || 0;
                newCamMin = val;
                newCamMax = val;
              } else {
                newCamMin = 0;
                newCamMax = 0;
              }
              
              // Only bump if target camera number equals the min of the new range (insert before scenario)
              const shouldBump = targetCamNum === newCamMin;
              if (shouldBump) {
                // Use edited range's max + 1 for calculating bump position
                existingEntryUpdates = {
                  ...existingEntryUpdates,
                  [fieldId]: String(newCamMax + 1).padStart(4, '0'),
                  takeNumber: String(targetTake + 1)
                };
                hasUpdates = true;
              }
            }
          }

        }
      }
    }

    // Prepare and save the current logSheet's data FIRST before calling updateFileNumbers
    // This prevents the current logSheet from being shifted by updateFileNumbers
    if (camCount > 1) {
      for (let i = 1; i <= camCount; i++) {
        const fieldId = `cameraFile${i}`;
        const isRecActive = cameraRecState[fieldId] ?? true;
        if (!isRecActive) delete newLogData[fieldId];
      }
    }

    newLogData = pruneDisabled(newLogData);
    
    // Apply range persistence with edited values
    const pad4 = (v?: string) => (v ? String(parseInt(v as any, 10) || 0).padStart(4, '0') : '');
    const finalData: Record<string, any> = { ...newLogData };
    
    // Handle sound file range - use edited values from rangeData when in range mode
    if (showRangeMode['soundFile'] && rangeData['soundFile']?.from && rangeData['soundFile']?.to) {
      // Keep the edited range values
      finalData['sound_from'] = pad4(rangeData['soundFile'].from);
      finalData['sound_to'] = pad4(rangeData['soundFile'].to);
      delete finalData.soundFile;
    } else if (!disabledFields.has('soundFile')) {
      // Single value mode - use value from takeData
      delete finalData['sound_from'];
      delete finalData['sound_to'];
    } else {
      // Disabled field - remove all
      delete finalData.soundFile;
      delete finalData['sound_from'];
      delete finalData['sound_to'];
    }
    
    // Handle camera ranges - checking range mode FIRST regardless of enabled/disabled status
    if (camCount === 1) {
      const hasRange = showRangeMode['cameraFile'] && rangeData['cameraFile']?.from && rangeData['cameraFile']?.to;
      const isDisabled = disabledFields.has('cameraFile');
      
      console.log('DEBUG handleSaveWithDuplicatePair - Camera handling for camCount=1:', {
        hasRange,
        isDisabled,
        'rangeData.cameraFile': rangeData['cameraFile'],
        'finalData.cameraFile BEFORE': finalData.cameraFile,
        'finalData.camera1_from BEFORE': finalData.camera1_from,
        'finalData.camera1_to BEFORE': finalData.camera1_to
      });
      
      if (hasRange) {
        // Has range data - save it (works for both waste and non-waste)
        finalData['camera1_from'] = pad4(rangeData['cameraFile'].from);
        finalData['camera1_to'] = pad4(rangeData['cameraFile'].to);
        delete finalData.cameraFile;
        
        console.log('DEBUG - Set range values:', {
          'finalData.camera1_from': finalData.camera1_from,
          'finalData.camera1_to': finalData.camera1_to,
          'finalData.cameraFile': finalData.cameraFile
        });
      } else if (!isDisabled) {
        // Enabled field without range - keep single value mode, delete range fields
        delete finalData['camera1_from'];
        delete finalData['camera1_to'];
      } else {
        // Disabled field without range data - delete everything (waste without range)
        delete finalData.cameraFile;
        delete finalData['camera1_from'];
        delete finalData['camera1_to'];
      }
    } else {
      for (let i = 1; i <= camCount; i++) {
        const fieldId = `cameraFile${i}`;
        const hasRange = showRangeMode[fieldId] && rangeData[fieldId]?.from && rangeData[fieldId]?.to;
        const isDisabled = disabledFields.has(fieldId);
        const isRecActive = cameraRecState[fieldId] ?? true;
        
        if (hasRange) {
          // Has range data - save it (works for both waste and non-waste)
          finalData[`camera${i}_from`] = pad4(rangeData[fieldId].from);
          finalData[`camera${i}_to`] = pad4(rangeData[fieldId].to);
          delete finalData[fieldId];
        } else if (!isDisabled && isRecActive) {
          // Enabled field without range - keep single value mode, delete range fields
          delete finalData[`camera${i}_from`];
          delete finalData[`camera${i}_to`];
        } else {
          // Disabled field or REC off without range data - delete everything
          delete finalData[fieldId];
          delete finalData[`camera${i}_from`];
          delete finalData[`camera${i}_to`];
        }
      }
    }
    
    const filteredShotDetails = (classification === 'Ambience' || classification === 'SFX') ? shotDetails.filter(d => d !== 'MOS') : shotDetails;
    const updatedData = {
      ...finalData,
      classification,
      shotDetails: filteredShotDetails,
      isGoodTake,
      wasteOptions: classification === 'Waste' ? JSON.stringify(wasteOptions) : '',
      insertSoundSpeed: classification === 'Insert' ? (insertSoundSpeed?.toString() || '') : '',
      cameraRecState: camCount > 1 ? cameraRecState : undefined
    };
    
    console.log('DEBUG handleSaveWithDuplicatePair - Final data to save:', {
      'updatedData.camera1_from': updatedData.camera1_from,
      'updatedData.camera1_to': updatedData.camera1_to,
      'updatedData.cameraFile': updatedData.cameraFile
    });
    
    // Save the current logSheet with edited values
    await updateLogSheet(logSheet.id, updatedData);

    // Update the existingEntry with calculated shifts
    if (hasUpdates) {
      await updateLogSheet(existingEntry.id, existingEntryUpdates);
    }
    
    // Use Promise to ensure Zustand state has propagated
    await new Promise(resolve => setTimeout(resolve, 0));
    
    // Call updateFileNumbers to shift subsequent entries if needed
    if (!disabledFields.has('soundFile') && soundDelta > 0) {
      // Always use soundStart (the beginning of the duplicate), not the end of the range
      // Pass excludeLogId so store can reliably initialize tempSound from the inserted/edited log
      updateFileNumbers(logSheet.projectId, 'soundFile', soundStart, soundDelta, logSheet.id);
    }
    
    if (camCount === 1) {
      // Use centralized delta calculator instead of inline calculation
      const cameraDeltaInput = {
        takeData,
        showRangeMode,
        rangeData
      };
      const camDelta = disabledFields.has('cameraFile')
        ? 0
        : calculateCameraDeltaForShifting(cameraDeltaInput, 'cameraFile');

      if (!disabledFields.has('cameraFile') && camDelta > 0) {
        const targetRange = getRangeFromData(existingEntry.data, 'cameraFile');
        let camStart = cameraFromNumber;
        if (typeof existingEntry.data?.camera1_from === 'string') {
          const n = parseInt(existingEntry.data.camera1_from, 10);
          if (!Number.isNaN(n)) camStart = n;
        } else if (typeof existingEntry.data?.cameraFile === 'string') {
          const n = parseInt(existingEntry.data.cameraFile, 10);
          if (!Number.isNaN(n)) camStart = n;
        }
        const camStartShift = targetRange ? ((parseInt(targetRange.to, 10) || 0) + 1) : camStart;
        updateFileNumbers(logSheet.projectId, 'cameraFile', camStartShift, camDelta);
      }
    } else {
      for (let i = 1; i <= camCount; i++) {
        const fieldId = `cameraFile${i}`;
        if (existingEntry.data?.[fieldId] || existingEntry.data?.[`camera${i}_from`]) {
          // Use centralized delta calculator instead of inline calculation
          const cameraDeltaInput = {
            takeData,
            showRangeMode,
            rangeData
          };
          const camDelta = disabledFields.has(fieldId)
            ? 0
            : calculateCameraDeltaForShifting(cameraDeltaInput, fieldId);
          
          if (!disabledFields.has(fieldId) && camDelta > 0) {
            const targetRange = getRangeFromData(existingEntry.data, fieldId);
            let camStartForField = cameraFromNumber;
            const fromKey = `camera${i}_from` as const;
            const fromVal = existingEntry.data?.[fromKey];
            const val = existingEntry.data?.[fieldId];
            if (typeof fromVal === 'string') {
              const n = parseInt(fromVal, 10);
              if (!Number.isNaN(n)) camStartForField = n;
            } else if (typeof val === 'string') {
              const n = parseInt(val, 10);
              if (!Number.isNaN(n)) camStartForField = n;
            }
            const camStartShift = targetRange ? ((parseInt(targetRange.to, 10) || 0) + 1) : camStartForField;
            updateFileNumbers(logSheet.projectId, fieldId, camStartShift, camDelta);
          }
        }
      }
    }

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

  const renderField = (field: FieldType, allFieldIds: string[], customStyle?: any) => {
    const value = takeData[field.id] || '';
    const isMultiline = field.id === 'notesForTake' || field.id === 'descriptionOfShot';
    const isDisabled = disabledFields.has(field.id);
    const hasError = validationErrors.has(field.id);
    const isMandatory = ['sceneNumber', 'shotNumber', 'soundFile', 'cameraFile'].includes(field.id) || field.id.startsWith('cameraFile');
    const isFileField = field.id === 'soundFile';

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
              onPress={() => !isDisabled && toggleRangeMode('soundFile')}
              disabled={isDisabled}
            >
              <Text style={[styles.rangeButtonText, isDisabled && styles.disabledText]}>Range</Text>
            </TouchableOpacity>
          </View>
          {showRangeMode['soundFile'] && !isDisabled ? (
            <View style={styles.rangeContainer}>
              <TextInput
                style={[styles.fieldInput, styles.rangeInput, isDisabled && styles.disabledInput]}
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
                editable={!isDisabled}
              />
              <Text style={styles.rangeSeparator}>-</Text>
              <TextInput
                style={[styles.fieldInput, styles.rangeInput, isDisabled && styles.disabledInput]}
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
                editable={!isDisabled}
              />
            </View>
          ) : (
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
          )}
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
              const target = event.target as any;
              setTimeout(() => {
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
      const baseDisabled = disabledFields.has(fieldId);
      const isDisabled = baseDisabled || !(cameraRecState[fieldId] ?? true);

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
              {cameraCount > 1 && (
                <TouchableOpacity 
                  style={[
                    styles.recButton, 
                    (cameraRecState[fieldId] ?? true) ? styles.recButtonActive : styles.recButtonInactive,
                    baseDisabled && styles.disabledButton
                  ]}
                  onPress={() => !baseDisabled && toggleCameraRec(fieldId)}
                  disabled={baseDisabled}
                >
                  <Text style={[
                    styles.recButtonText, 
                    (cameraRecState[fieldId] ?? true) ? styles.recButtonTextActive : styles.recButtonTextInactive,
                    baseDisabled && styles.disabledText
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
                  const target = event.target as any;
                  setTimeout(() => {
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

  // Early return if logSheet or project not found
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

  const fieldsToRender = enabledFields.filter((field: FieldType) => field.id !== 'cameraFile' && field.id !== 'soundFile' && field.id !== 'notesForTake' && field.id !== 'episodeNumber');
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
  if (notesField) {
    allFieldIds.push('notesForTake');
  }
  customFields.forEach((_: string, index: number) => {
    allFieldIds.push(`custom_${index}`);
  });

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
                      const target = event.target as any;
                      setTimeout(() => {
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
                      const target = event.target as any;
                      setTimeout(() => {
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
                      const target = event.target as any;
                      setTimeout(() => {
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

          <View style={styles.fieldHeaderRow}>
            <Text style={styles.fieldLabel}>Camera Files</Text>
            <TouchableOpacity
              style={styles.rangeButton}
              onPress={() => {
                const camCount = project?.settings?.cameraConfiguration || 1;
                setShowRangeMode(prev => {
                  const next = { ...prev } as { [key: string]: boolean };
                  if (camCount === 1) {
                    const current = !!prev['cameraFile'];
                    next['cameraFile'] = !current;
                    if (!current) {
                      const currentValue = (takeData['cameraFile'] as string) || '0001';
                      setRangeData(rp => ({
                        ...rp,
                        ['cameraFile']: { from: currentValue, to: currentValue }
                      }));
                    } else {
                      const r = rangeData['cameraFile'];
                      if (r) {
                        updateTakeData('cameraFile', r.from);
                      }
                    }
                  } else {
                    for (let i = 1; i <= camCount; i++) {
                      const fid = `cameraFile${i}`;
                      const current = !!prev[fid];
                      next[fid] = !current;
                      if (!current) {
                        const currentValue = (takeData[fid] as string) || '0001';
                        setRangeData(rp => ({
                          ...rp,
                          [fid]: { from: currentValue, to: currentValue }
                        }));
                      } else {
                        const r = rangeData[fid];
                        if (r) {
                          updateTakeData(fid, r.from);
                        }
                      }
                    }
                  }
                  return next;
                });
              }}
            >
              <Text style={styles.rangeButtonText}>Range</Text>
            </TouchableOpacity>
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

          {/* Episode field right before Take Description */}
          {enabledFields.find((f: FieldType) => f.id === 'episodeNumber') && (
            <View style={styles.fieldContainer}>
              <Text style={[
                styles.fieldLabel,
                disabledFields.has('episodeNumber') && styles.disabledLabel,
                validationErrors.has('episodeNumber') && styles.errorLabel
              ]}>
                Episode
              </Text>
              <TextInput
                ref={(ref) => { inputRefs.current['episodeNumber'] = ref; }}
                style={[
                  styles.fieldInput,
                  disabledFields.has('episodeNumber') && styles.disabledInput,
                  validationErrors.has('episodeNumber') && styles.errorInput
                ]}
                value={disabledFields.has('episodeNumber') ? '' : (takeData.episodeNumber || '')}
                onChangeText={(text) => updateTakeData('episodeNumber', text)}
                placeholder="Enter episode number"
                placeholderTextColor={colors.subtext}
                returnKeyType="next"
                editable={!disabledFields.has('episodeNumber')}
              />
            </View>
          )}

          {fieldsToRender
            .filter((field: FieldType) => !['sceneNumber', 'shotNumber', 'takeNumber'].includes(field.id))
            .map((field: FieldType) => renderField(field, allFieldIds))}

          {notesField && renderField(notesField, allFieldIds)}

          {/* Custom Fields (appear under Notes) */}
          {customFields.map((fieldName: string, index: number) => 
            renderField({
              id: `custom_${index}`,
              label: fieldName
            }, allFieldIds)
          )}
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