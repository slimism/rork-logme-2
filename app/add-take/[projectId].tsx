import React, { useState, useEffect, useRef } from 'react';
import { View, StyleSheet, ScrollView, Text, TextInput, TouchableOpacity, Alert, KeyboardAvoidingView, Modal, Platform, Keyboard, Switch, Animated } from 'react-native';
import { useLocalSearchParams, Stack, router } from 'expo-router';
import { ArrowLeft, Check, X, AlertCircle } from 'lucide-react-native';
import { useProjectStore } from '@/store/projectStore';
import { useTokenStore } from '@/store/subscriptionStore';
import { useColors } from '@/constants/colors';
import { ClassificationType, ShotDetailsType, TakeData } from '@/types';
import Toast from 'react-native-toast-message';

export default function AddTakeScreen() {
  const { projectId } = useLocalSearchParams<{ projectId: string }>();
  const { projects, logSheets, addLogSheet, updateTakeNumbers, updateFileNumbers } = useProjectStore();
  const tokenStore = useTokenStore();
  const { getRemainingTrialLogs, tokens, canAddLog } = tokenStore;
  const colors = useColors();
  
  const [project, setProject] = useState(projects.find(p => p.id === projectId));
  const [takeData, setTakeData] = useState<TakeData>({});
  const [classification, setClassification] = useState<ClassificationType | null>(null);
  const [shotDetails, setShotDetails] = useState<ShotDetailsType[]>([]);
  const [isGoodTake, setIsGoodTake] = useState<boolean>(false);
  const [lastShotDescriptions, setLastShotDescriptions] = useState<Record<string, string>>({});
  const [lastEpisodeNumbers, setLastEpisodeNumbers] = useState<Record<string, string>>({});
  const [stats, setStats] = useState({ totalTakes: 0, scenes: 0 });

  const [showRangeMode, setShowRangeMode] = useState<{ [key: string]: boolean }>({});
  const [rangeData, setRangeData] = useState<{ [key: string]: { from: string; to: string } }>({});
  const [cameraRecState, setCameraRecState] = useState<{ [key: string]: boolean }>({});
  const [showWasteModal, setShowWasteModal] = useState<boolean>(false);
  const [wasteOptions, setWasteOptions] = useState<{ camera: boolean; sound: boolean }>({ camera: false, sound: false });
  const [showInsertModal, setShowInsertModal] = useState<boolean>(false);
  const [insertSoundSpeed, setInsertSoundSpeed] = useState<boolean | null>(null);
  const [disabledFields, setDisabledFields] = useState<Set<string>>(new Set());
  const [validationErrors, setValidationErrors] = useState<Set<string>>(new Set());
  const [notification, setNotification] = useState<{ message: string; type: 'error' | 'info' } | null>(null);
  const notificationOpacity = useRef(new Animated.Value(0)).current;
  const notificationTranslateY = useRef(new Animated.Value(-100)).current;
  const savedFieldValuesRef = useRef<TakeData>({});
  const writingProgrammaticallyRef = useRef(false);
  const lastAutoIncrementRef = useRef<{ [key: string]: number }>({});
  const wasteTemporaryStorageRef = useRef<{ [key: string]: string }>({});

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

  const showNotification = (message: string, type: 'error' | 'info' = 'error') => {
    setNotification({ message, type });
    
    // Animate in
    Animated.parallel([
      Animated.timing(notificationOpacity, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(notificationTranslateY, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start();

    // Auto hide after 4 seconds
    setTimeout(() => {
      hideNotification();
    }, 4000);
  };

  const hideNotification = () => {
    Animated.parallel([
      Animated.timing(notificationOpacity, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(notificationTranslateY, {
        toValue: -100,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setNotification(null);
    });
  };

  // Helper function to sanitize data before saving
  const sanitizeDataBeforeSave = (data: TakeData, classification: ClassificationType | null) => {
    const sanitizedData = { ...data };
    
    // For Ambience and SFX, remove scene, shot, and take numbers
    if (classification === 'Ambience' || classification === 'SFX') {
      delete sanitizedData.sceneNumber;
      delete sanitizedData.shotNumber;
      delete sanitizedData.takeNumber;
      
      // Keep camera files and sound files - they should still be saved and displayed
      // Only remove scene/shot/take numbers for these classifications
    }
    
    return sanitizedData;
  };

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

  // Track if auto-fill has run to prevent re-running on UI changes
  const hasAutoFilledRef = useRef(false);

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
    
    // Build map of shot descriptions from previous records
    const shotDescMap: Record<string, string> = {};
    const episodeMap: Record<string, string> = {};
    projectLogSheets.forEach(sheet => {
      if (sheet.data?.sceneNumber && sheet.data?.shotNumber && sheet.data?.descriptionOfShot) {
        const shotKey = `${sheet.data.sceneNumber}_${sheet.data.shotNumber}`;
        // Keep the most recent description for each shot
        shotDescMap[shotKey] = sheet.data.descriptionOfShot;
      }
      if (sheet.data?.sceneNumber && sheet.data?.shotNumber && sheet.data?.episodeNumber) {
        const shotKey = `${sheet.data.sceneNumber}_${sheet.data.shotNumber}`;
        // Keep the most recent episode for each shot
        episodeMap[shotKey] = sheet.data.episodeNumber;
      }
    });
    setLastShotDescriptions(shotDescMap);
    setLastEpisodeNumbers(episodeMap);
    
    // Auto-fill logic - run only once per component mount
    if (!hasAutoFilledRef.current) {
      hasAutoFilledRef.current = true;
      
      if (projectLogSheets.length === 0) {
        const autoFillData: TakeData = {};
        autoFillData.sceneNumber = '1';
        autoFillData.shotNumber = '1';
        autoFillData.takeNumber = '1';
        if (currentProject?.settings?.logSheetFields?.find(f => f.id === 'soundFile')?.enabled) {
          autoFillData.soundFile = '0001';
        }
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
        const sortedLogs = projectLogSheets.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        const lastLog = sortedLogs[0];
        const lastValid = sortedLogs.find(s => s.data?.classification !== 'Ambience' && s.data?.classification !== 'SFX');
        
        if (lastLog?.data || lastValid?.data) {
          const autoFillData: TakeData = {};
          
          // Prefer values from last valid non-Ambience/SFX entry
          const baseData = (lastValid?.data ?? lastLog?.data) as any;
          const episodeNumber = baseData?.episodeNumber;
          const sceneNumber = baseData?.sceneNumber;
          const shotNumber = baseData?.shotNumber;
          
          if (episodeNumber) autoFillData.episodeNumber = episodeNumber;
          autoFillData.sceneNumber = sceneNumber ?? '1';
          autoFillData.shotNumber = shotNumber ?? '1';

          // Prefill card numbers from last log when enabled
          const cardFieldEnabled = currentProject?.settings?.logSheetFields?.find(f => f.id === 'cardNumber')?.enabled;
          const camCount = currentProject?.settings?.cameraConfiguration || 1;
          if (cardFieldEnabled) {
            const cardSource = lastLog?.data;
            if (camCount === 1) {
              const lastSingle = cardSource?.cardNumber;
              if (lastSingle) autoFillData.cardNumber = lastSingle;
            } else {
              for (let i = 1; i <= camCount; i++) {
                const key = `cardNumber${i}`;
                const lastVal = cardSource?.[key] ?? cardSource?.cardNumber;
                if (lastVal) {
                  autoFillData[key] = lastVal;
                }
              }
            }
          }
          
          // Determine highest existing take in this Scene/Shot and set +1
          const sameShotTakes = projectLogSheets.filter(s => 
            s.data?.classification !== 'Ambience' && 
            s.data?.classification !== 'SFX' && 
            s.data?.sceneNumber === autoFillData.sceneNumber && 
            s.data?.shotNumber === autoFillData.shotNumber
          );
          let highestTake = 0;
          sameShotTakes.forEach(s => {
            const n = parseInt(s.data?.takeNumber || '0', 10);
            if (!Number.isNaN(n)) highestTake = Math.max(highestTake, n);
          });
          autoFillData.takeNumber = String(highestTake + 1);
          
          // Compute next file numbers for all fields
          const nextNumbers = computeNextFileNumbers(projectLogSheets, currentProject);
          
          // Auto-increment sound file based on highest number + 1 (only if field is empty)
          const nextSoundFileNum = nextNumbers['soundFile'];
          autoFillData.soundFile = String(nextSoundFileNum).padStart(4, '0');
          
          // Handle camera files based on configuration
          if (currentProject?.settings?.cameraConfiguration === 1) {
            const nextCameraFileNum = nextNumbers['cameraFile'];
            autoFillData.cameraFile = String(nextCameraFileNum).padStart(4, '0');
          } else {
            // Multiple cameras - fill all camera files
            for (let i = 1; i <= (currentProject?.settings?.cameraConfiguration || 1); i++) {
              const fieldId = `cameraFile${i}`;
              const nextCameraFileNum = nextNumbers[fieldId];
              autoFillData[fieldId] = String(nextCameraFileNum).padStart(4, '0');
            }
          }
          
          // DON'T prefill description or notes for new logs - keep them blank
          // Users should enter these fresh for each new log
          
          // Check if there's a previous description for this shot
          const shotKey = `${autoFillData.sceneNumber}_${autoFillData.shotNumber}`;
          const lastDesc = shotDescMap[shotKey];
          if (lastDesc) {
            autoFillData.descriptionOfShot = lastDesc;
          }
          
          setTakeData(autoFillData);
        }
      }
    }
  }, [projectId, projects, logSheets, computeNextFileNumbers]);
  


  const HeaderLeft = () => (
    <TouchableOpacity onPress={() => router.back()} style={styles.headerButton}>
      <ArrowLeft size={24} color={colors.text} />
    </TouchableOpacity>
  );

  const updateTakeData = (fieldId: string, value: string | boolean) => {
    setTakeData(prev => {
      const newData = { ...prev, [fieldId]: value };
      
      // Smart auto-fill logic based on field changes - only reset what's necessary
      if (fieldId === 'sceneNumber') {
        // Reset shot and take when scene changes
        newData.shotNumber = '';
        newData.takeNumber = '1';
        // Clear description and notes
        newData.descriptionOfShot = '';
        newData.notesForTake = '';
        // Clear custom fields
        project?.settings?.customFields?.forEach((_, index) => {
          newData[`custom_${index}`] = '';
        });
      } else if (fieldId === 'shotNumber') {
        // Reset only take when shot changes
        newData.takeNumber = '1';
        // When shot changes, try to bring last description and episode for this shot
        if (value && typeof value === 'string') {
          const shotKey = `${newData.sceneNumber || ''}_${value}`;
          const lastDesc = lastShotDescriptions[shotKey];
          const lastEpisode = lastEpisodeNumbers[shotKey];
          if (lastDesc) {
            newData.descriptionOfShot = lastDesc;
          } else {
            // Only clear if there was no previous description for this shot
            newData.descriptionOfShot = '';
          }
          if (lastEpisode) {
            newData.episodeNumber = lastEpisode;
          } else {
            newData.episodeNumber = '';
          }
        } else {
          newData.descriptionOfShot = '';
          newData.episodeNumber = '';
        }
        newData.notesForTake = '';
        // Clear custom fields
        project?.settings?.customFields?.forEach((_, index) => {
          newData[`custom_${index}`] = '';
        });
      } else if (fieldId === 'descriptionOfShot') {
        // Update last shot description when it changes
        const shotKey = `${prev.sceneNumber || ''}_${prev.shotNumber || ''}`;
        if (shotKey && value) {
          setLastShotDescriptions(prevDescs => ({
            ...prevDescs,
            [shotKey]: value as string
          }));
        }
      } else if (fieldId === 'episodeNumber') {
        const shotKey = `${prev.sceneNumber || ''}_${prev.shotNumber || ''}`;
        if (shotKey && value) {
          setLastEpisodeNumbers(prevEpisodes => ({
            ...prevEpisodes,
            [shotKey]: value as string
          }));
        }
      }
      
      return newData;
    });
  };

  const findDuplicateTake = () => {
    try {
      const isAmbienceOrSFX = classification === 'Ambience' || classification === 'SFX';
      if (isAmbienceOrSFX) return null as any;
      const scene = takeData.sceneNumber?.trim();
      const shot = takeData.shotNumber?.trim();
      const takeStr = takeData.takeNumber?.trim();
      if (!scene || !shot || !takeStr) return null as any;
      const takeNum = parseInt(takeStr, 10);
      if (Number.isNaN(takeNum)) return null as any;
      const projectLogSheets = logSheets.filter(s => s.projectId === projectId);
      const sameShot = projectLogSheets.filter(s => s.data?.sceneNumber === scene && s.data?.shotNumber === shot);
      let highest = 0;
      let duplicateAt: any | null = null;
      sameShot.forEach(s => {
        const n = parseInt(s.data?.takeNumber || '0', 10);
        if (!Number.isNaN(n)) {
          if (n > highest) highest = n;
          if (n === takeNum) duplicateAt = s;
        }
      });
      if (duplicateAt) {
        return { existingEntry: duplicateAt, highest } as { existingEntry: any; highest: number };
      }
      return null as any;
    } catch (e) {
      console.log('[findDuplicateTake] error', e);
      return null as any;
    }
  };

  // Helper function to check if a number falls within a range
  const isNumberInRange = (number: number, fromValue: string, toValue: string): boolean => {
    const from = parseInt(fromValue) || 0;
    const to = parseInt(toValue) || 0;
    return number >= Math.min(from, to) && number <= Math.max(from, to);
  };

  // Helper function to get range values from stored data
  const getRangeFromData = (data: any, fieldId: string): { from: string; to: string } | null => {
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
    return null;
  };

  // Helper function to find first duplicate file number across all scenes and shots with range support
  const findFirstDuplicateFile = () => {
    const projectLogSheets = logSheets.filter(sheet => sheet.projectId === projectId);
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
        const currentFrom = parseInt(currentRange.from) || 0;
        const currentTo = parseInt(currentRange.to) || 0;
        const currentMin = Math.min(currentFrom, currentTo);
        const currentMax = Math.max(currentFrom, currentTo);
        
        for (const sheet of projectLogSheets) {
          const data = sheet.data;
          if (!data) continue;
          
          const existingRange = getRangeFromData(data, 'soundFile');
          if (existingRange) {
            const existingFrom = parseInt(existingRange.from) || 0;
            const existingTo = parseInt(existingRange.to) || 0;
            const existingMin = Math.min(existingFrom, existingTo);
            const existingMax = Math.max(existingFrom, existingTo);
            if (!(currentMax < existingMin || currentMin > existingMax)) {
              let conflictType: 'lower' | 'upper' | 'within';
              if (currentFrom === existingMin) {
                conflictType = 'lower';
              } else if (currentFrom > existingMin && currentFrom <= existingMax) {
                conflictType = 'within';
              } else {
                conflictType = 'upper';
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
          
          if (data.soundFile && typeof data.soundFile === 'string' && !data.soundFile.includes('-')) {
            const existingNum = parseInt(data.soundFile) || 0;
            if (existingNum >= currentMin && existingNum <= currentMax) {
              const conflictType = existingNum === currentMin ? 'lower' : 'within';
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
        const val = takeData.soundFile as string;
        const currentNum = parseInt(val) || 0;
        
        for (const sheet of projectLogSheets) {
          const data = sheet.data;
          if (!data) continue;
          
          const existingRange = getRangeFromData(data, 'soundFile');
          if (existingRange) {
            if (isNumberInRange(currentNum, existingRange.from, existingRange.to)) {
              const existingFrom = parseInt(existingRange.from) || 0;
              const conflictType = currentNum === existingFrom ? 'lower' : 'within';
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

    // Camera files - check across all scenes and shots
    const cameraConfiguration = project?.settings?.cameraConfiguration || 1;
    if (cameraConfiguration === 1) {
      if (takeData.cameraFile && !disabledFields.has('cameraFile')) {
        const currentRange = rangeData['cameraFile'];
        const isCurrentRange = showRangeMode['cameraFile'] && currentRange?.from && currentRange?.to;
        
        if (isCurrentRange) {
          const currentFrom = parseInt(currentRange.from) || 0;
          const currentTo = parseInt(currentRange.to) || 0;
          const currentMin = Math.min(currentFrom, currentTo);
          const currentMax = Math.max(currentFrom, currentTo);
          
          for (const sheet of projectLogSheets) {
            const data = sheet.data;
            if (!data) continue;
            
            const existingRange = getRangeFromData(data, 'cameraFile');
            if (existingRange) {
              const existingFrom = parseInt(existingRange.from) || 0;
              const existingTo = parseInt(existingRange.to) || 0;
              const existingMin = Math.min(existingFrom, existingTo);
              const existingMax = Math.max(existingFrom, existingTo);
              if (!(currentMax < existingMin || currentMin > existingMax)) {
                let conflictType: 'lower' | 'upper' | 'within';
                if (currentFrom === existingMin) {
                  conflictType = 'lower';
                } else if (currentFrom > existingMin && currentFrom <= existingMax) {
                  conflictType = 'within';
                } else {
                  conflictType = 'upper';
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
            
            if (data.cameraFile && typeof data.cameraFile === 'string' && !data.cameraFile.includes('-')) {
              const existingNum = parseInt(data.cameraFile) || 0;
              if (existingNum >= currentMin && existingNum <= currentMax) {
                const conflictType = existingNum === currentMin ? 'lower' : 'within';
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
          const val = takeData.cameraFile as string;
          const currentNum = parseInt(val) || 0;
          
          for (const sheet of projectLogSheets) {
            const data = sheet.data;
            if (!data) continue;
            
            const existingRange = getRangeFromData(data, 'cameraFile');
            if (existingRange) {
              if (isNumberInRange(currentNum, existingRange.from, existingRange.to)) {
                const existingFrom = parseInt(existingRange.from) || 0;
                const conflictType = currentNum === existingFrom ? 'lower' : 'within';
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
            const currentFrom = parseInt(currentRange.from) || 0;
            const currentTo = parseInt(currentRange.to) || 0;
            const currentMin = Math.min(currentFrom, currentTo);
            const currentMax = Math.max(currentFrom, currentTo);
            
            for (const sheet of projectLogSheets) {
              const data = sheet.data;
              if (!data) continue;
              
              const existingRange = getRangeFromData(data, fieldId);
              if (existingRange) {
                const existingFrom = parseInt(existingRange.from) || 0;
                const existingTo = parseInt(existingRange.to) || 0;
                const existingMin = Math.min(existingFrom, existingTo);
                const existingMax = Math.max(existingFrom, existingTo);
                if (!(currentMax < existingMin || currentMin > existingMax)) {
                  let conflictType: 'lower' | 'upper' | 'within';
                  if (currentFrom === existingMin) {
                    conflictType = 'lower';
                  } else if (currentFrom > existingMin && currentFrom <= existingMax) {
                    conflictType = 'within';
                  } else {
                    conflictType = 'upper';
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
              
              if (data[fieldId] && typeof data[fieldId] === 'string' && !data[fieldId].includes('-')) {
                const existingNum = parseInt(data[fieldId]) || 0;
                if (existingNum >= currentMin && existingNum <= currentMax) {
                  const conflictType = existingNum === currentMin ? 'lower' : 'within';
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
            const currentNum = parseInt(val) || 0;
            
            for (const sheet of projectLogSheets) {
              const data = sheet.data;
              if (!data) continue;
              
              const existingRange = getRangeFromData(data, fieldId);
              if (existingRange) {
                if (isNumberInRange(currentNum, existingRange.from, existingRange.to)) {
                  const existingFrom = parseInt(existingRange.from) || 0;
                  const conflictType = currentNum === existingFrom ? 'lower' : 'within';
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

  // General conflict detector: returns conflict info when current file (single or range)
  // overlaps an existing ranged take. It classifies overlap as 'lower' | 'upper' | 'within'.
  // Only 'upper' and 'within' should block; 'lower' proceeds to Insert Before.
  const findGeneralRangeConflict = () => {
    const projectLogSheets = logSheets.filter(sheet => sheet.projectId === projectId);

    const checkAgainstExistingRanges = (
      fieldId: string,
      label: string,
      currentVal?: string,
      currentRange?: { from?: string; to?: string } | null
    ) => {
      if (disabledFields.has(fieldId)) return null as any;
      const parseNum = (v?: string) => (v ? (parseInt(v, 10) || 0) : 0);
      const inRangeMode = !!(currentRange && currentRange.from && currentRange.to);
      const curFrom = inRangeMode ? parseNum(currentRange?.from) : parseNum(currentVal);
      const curTo = inRangeMode ? parseNum(currentRange?.to) : parseNum(currentVal);
      const curMin = Math.min(curFrom, curTo);
      const curMax = Math.max(curFrom, curTo);

      for (const sheet of projectLogSheets) {
        const data = sheet.data;
        if (!data) continue;
        const existingRange = getRangeFromData(data, fieldId);
        if (existingRange?.from && existingRange?.to) {
          const exFrom = parseNum(existingRange.from);
          const exTo = parseNum(existingRange.to);
          const exMin = Math.min(exFrom, exTo);
          const exMax = Math.max(exFrom, exTo);
          const overlaps = !(curMax < exMin || curMin > exMax);
          if (overlaps) {
            let conflictType: 'lower' | 'upper' | 'within';
            if (curMin === exMin) {
              conflictType = 'lower';
            } else if (curMin > exMin && curMin < exMax) {
              conflictType = 'within';
            } else if (curMin === exMax) {
              conflictType = 'upper';
            } else if (curMin < exMin && curMax >= exMin) {
              conflictType = 'lower';
            } else {
              conflictType = 'within';
            }
            return { fieldId, label, existingEntry: sheet, conflictType } as { fieldId: string; label: string; existingEntry: any; conflictType: 'lower' | 'upper' | 'within' };
          }
        }
      }
      return null as any;
    };

    // Sound
    if (takeData.soundFile) {
      const conflict = checkAgainstExistingRanges('soundFile', 'Sound File', takeData.soundFile as string, rangeData['soundFile'] || null);
      if (conflict) return conflict;
    }

    // Cameras
    const camCount = project?.settings?.cameraConfiguration || 1;
    if (camCount === 1) {
      if (takeData.cameraFile) {
        const conflict = checkAgainstExistingRanges('cameraFile', 'Camera File', takeData.cameraFile as string, rangeData['cameraFile'] || null);
        if (conflict) return conflict;
      }
    } else {
      for (let i = 1; i <= camCount; i++) {
        const fid = `cameraFile${i}`;
        const isRecActive = cameraRecState[fid] ?? true;
        const val = takeData[fid] as string | undefined;
        if (isRecActive && val) {
          const conflict = checkAgainstExistingRanges(fid, `Camera File ${i}`, val, rangeData[fid] || null);
          if (conflict) return conflict;
        }
      }
    }

    return null as any;
  };

  // Helper function to validate mandatory fields
  const validateMandatoryFields = () => {
    const errors = new Set<string>();
    const missingFields: string[] = [];
    const isAmbienceOrSFX = classification === 'Ambience' || classification === 'SFX';
    
    // Scene and Shot are not mandatory when Ambience or SFX
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
      showNotification(`Missing Required Fields: ${fieldList}`, 'error');
      return false;
    }
    
    return true;
  };

  const handleAddTake = (skipDuplicateCheck = false, overrideTakeNumber?: string) => {
    // Check if user can add more logs
    console.log('[handleAddTake] Checking if can add log for project:', projectId);
    const canAdd = canAddLog(projectId);
    console.log('[handleAddTake] canAddLog result:', canAdd);
    
    if (!canAdd) {
      Alert.alert(
        'Out of Free Logs',
        'You have used all your free trial logs. Purchase a token to get unlimited logs for this project.',
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
    
    // If we have an override take number, update the state before proceeding
    if (overrideTakeNumber) {
      setTakeData(prev => ({ ...prev, takeNumber: overrideTakeNumber }));
    }
    
    // Validate mandatory fields first
    if (!validateMandatoryFields()) {
      return;
    }

    // Block only when overlap with an existing range is at upper or within; allow lower for Insert Before
    const generalRangeConflict = findGeneralRangeConflict();
    if (generalRangeConflict && (generalRangeConflict.conflictType === 'upper' || generalRangeConflict.conflictType === 'within')) {
      const e = generalRangeConflict.existingEntry;
      const classification = e.data?.classification;
      let loc: string;
      if (classification === 'SFX') {
        loc = 'SFX';
      } else if (classification === 'Ambience') {
        loc = 'Ambience';
      } else {
        loc = `Scene ${e.data?.sceneNumber || 'Unknown'}, Shot ${e.data?.shotNumber || 'Unknown'}, Take ${e.data?.takeNumber || 'Unknown'}`;
      }
      Alert.alert(
        'Part of Ranged Take',
        `${generalRangeConflict.label} is part of a take that contains a range at ${loc}. Adjust the value(s) to continue.`,
        [{ text: 'OK', style: 'default' }]
      );
      return;
    }
    
    // New logic: only camera AND sound duplicates on the same take allow insert-before
    const getEligibleDuplicateForField = (fieldId: string) => {
      const projectLogSheets = logSheets.filter(sheet => sheet.projectId === projectId);
      const currentVal = takeData[fieldId] as string | undefined;
      if (!currentVal || disabledFields.has(fieldId)) return null;
      const currentRange = rangeData[fieldId];
      const isCurrentRange = showRangeMode[fieldId] && currentRange?.from && currentRange?.to;

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
              if (curFrom === exMin) {
                return { fieldId, number: curFrom, existingEntry: sheet };
              }
            }
          }

          const existingVal = data[fieldId] as string | undefined;
          if (existingVal && typeof existingVal === 'string' && !existingVal.includes('-')) {
            const exNum = parseNum(existingVal);
            if (exNum >= curMin && exNum <= curMax) {
              if (exNum === curMin) {
                return { fieldId, number: curMin, existingEntry: sheet };
              }
            }
          }
        } else {
          if (existingRange) {
            const exFrom = parseNum(existingRange.from);
            const exTo = parseNum(existingRange.to);
            if (isNumberInRange(valNum, String(exFrom), String(exTo))) {
              if (valNum === Math.min(exFrom, exTo)) {
                return { fieldId, number: valNum, existingEntry: sheet };
              }
            }
          }
          if (data[fieldId] === currentVal) {
            return { fieldId, number: valNum, existingEntry: sheet };
          }
        }
      }
      return null;
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

    const isSoundBlank = disabledFields.has('soundFile') || !(takeData.soundFile?.trim());
    const camConfigForBlank = project?.settings?.cameraConfiguration || 1;
    let isCameraBlank = false;
    if (camConfigForBlank === 1) {
      isCameraBlank = disabledFields.has('cameraFile') || !(takeData.cameraFile?.trim());
    } else {
      // Consider cameras blank if all active REC camera fields are blank
      let anyActiveProvided = false;
      for (let i = 1; i <= camConfigForBlank; i++) {
        const fid = `cameraFile${i}`;
        const isRecActive = cameraRecState[fid] ?? true;
        if (isRecActive && !disabledFields.has(fid) && (takeData[fid]?.trim())) {
          anyActiveProvided = true;
          break;
        }
      }
      isCameraBlank = !anyActiveProvided;
    }

    if (soundDup && cameraDup) {
      if (soundDup.existingEntry?.id === cameraDup.existingEntry?.id) {
        const existingEntry = soundDup.existingEntry;
        const classification = existingEntry.data?.classification;
        let location: string;
        if (classification === 'SFX') {
          location = 'SFX';
        } else if (classification === 'Ambience') {
          location = 'Ambience';
        } else {
          const sceneNumber = existingEntry.data?.sceneNumber || 'Unknown';
          const shotNumber = existingEntry.data?.shotNumber || 'Unknown';
          const takeNumber = existingEntry.data?.takeNumber || 'Unknown';
          location = `Scene ${sceneNumber}, Shot ${shotNumber}, Take ${takeNumber}`;
        }
        Alert.alert(
          'Duplicate Detected',
          `Camera and Sound files are duplicates found in ${location}. Do you want to insert before?`,
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Insert Before',
              onPress: () => addLogWithDuplicatePair(existingEntry, soundDup.number, cameraDup!.fieldId, cameraDup!.number),
            },
          ]
        );
        return;
      } else {
        const se = soundDup.existingEntry;
        const ce = cameraDup.existingEntry;
        const sClassification = se.data?.classification;
        const cClassification = ce.data?.classification;
        let sLoc: string;
        let cLoc: string;
        
        if (sClassification === 'SFX') {
          sLoc = 'SFX';
        } else if (sClassification === 'Ambience') {
          sLoc = 'Ambience';
        } else {
          sLoc = `Scene ${se.data?.sceneNumber || 'Unknown'}, Shot ${se.data?.shotNumber || 'Unknown'}, Take ${se.data?.takeNumber || 'Unknown'}`;
        }
        
        if (cClassification === 'SFX') {
          cLoc = 'SFX';
        } else if (cClassification === 'Ambience') {
          cLoc = 'Ambience';
        } else {
          cLoc = `Scene ${ce.data?.sceneNumber || 'Unknown'}, Shot ${ce.data?.shotNumber || 'Unknown'}, Take ${ce.data?.takeNumber || 'Unknown'}`;
        }
        
        Alert.alert(
          'Conflict',
          `Camera and sound file are duplicates but belong to different takes.
Sound: ${sLoc}
Camera: ${cLoc}
The Log cannot be inserted with the current configuration to maintain the logging history and order.`,
          [{ text: 'OK', style: 'default' }]
        );
        return;
      }
    }

    // New rule: allow Insert Before when only one duplicate exists AND the other field is blank
    if (soundDup && isCameraBlank) {
      const e = soundDup.existingEntry;
      const classification = e.data?.classification;
      let loc: string;
      if (classification === 'SFX') {
        loc = 'SFX';
      } else if (classification === 'Ambience') {
        loc = 'Ambience';
      } else {
        loc = `Scene ${e.data?.sceneNumber || 'Unknown'}, Shot ${e.data?.shotNumber || 'Unknown'}, Take ${e.data?.takeNumber || 'Unknown'}`;
      }
      Alert.alert(
        'Duplicate Detected',
        `Sound file is a duplicate at ${loc}. Do you want to insert before?`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Insert Before',
            onPress: () => addLogWithDuplicateHandling('before', { type: 'file', fieldId: 'soundFile', existingEntry: e, number: soundDup.number }),
          },
        ]
      );
      return;
    }

    if (cameraDup && isSoundBlank) {
      const e = cameraDup.existingEntry;
      const classification = e.data?.classification;
      let loc: string;
      if (classification === 'SFX') {
        loc = 'SFX';
      } else if (classification === 'Ambience') {
        loc = 'Ambience';
      } else {
        loc = `Scene ${e.data?.sceneNumber || 'Unknown'}, Shot ${e.data?.shotNumber || 'Unknown'}, Take ${e.data?.takeNumber || 'Unknown'}`;
      }
      Alert.alert(
        'Duplicate Detected',
        `Camera file is a duplicate at ${loc}. Do you want to insert before?`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Insert Before',
            onPress: () => addLogWithDuplicateHandling('before', { type: 'file', fieldId: cameraDup.fieldId, existingEntry: e, number: cameraDup.number }),
          },
        ]
      );
      return;
    }

    if (soundDup || cameraDup) {
      const dup = soundDup || cameraDup!;
      const label = dup.fieldId.startsWith('sound') ? 'Sound' : 'Camera';
      const e = dup.existingEntry;
      const classification = e.data?.classification;
      let loc: string;
      if (classification === 'SFX') {
        loc = 'SFX';
      } else if (classification === 'Ambience') {
        loc = 'Ambience';
      } else {
        loc = `Scene ${e.data?.sceneNumber || 'Unknown'}, Shot ${e.data?.shotNumber || 'Unknown'}, Take ${e.data?.takeNumber || 'Unknown'}`;
      }
      Alert.alert(
        'Duplicate Found',
        `${label} file is a duplicate at ${loc}. The Log cannot be inserted with the current configuration to maintain the logging history and order.`,
        [{ text: 'OK', style: 'default' }]
      );
      return;
    }

    // Only check for duplicate take if not skipping AND no file duplicates were found
    if (!skipDuplicateCheck) {
      const takeDup = findDuplicateTake();
      if (takeDup) {
        const nextTakeNumber = String((takeDup.highest || 0) + 1);
        Alert.alert(
          'Take Number Exists',
          `Take ${takeData.takeNumber} already exists in Scene ${takeData.sceneNumber}, Shot ${takeData.shotNumber}. Use ${nextTakeNumber} instead?`,
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Yes',
              onPress: () => {
                // Pass the new take number directly and skip duplicate check
                handleAddTake(true, nextTakeNumber);
              },
            },
          ]
        );
        return;
      }
    }
    
    // No duplicate, add normally (pass override if provided)
    addNewTake(overrideTakeNumber);
  };
  
  const addLogWithDuplicateHandling = (position: 'before', duplicateInfo: any) => {
    // Only use trial if this is the trial project and not unlocked
    const isTrialProject = tokenStore.isTrialProject(projectId);
    const isUnlocked = tokenStore.isProjectUnlocked(projectId);
    if (isTrialProject && !isUnlocked) {
      tokenStore.useTrial();
    }

    const camCount = project?.settings?.cameraConfiguration || 1;
    const existingEntry = duplicateInfo.existingEntry;

    const projectLogSheets = logSheets.filter(sheet => sheet.projectId === projectId);

    const conflictsWithOtherTakes = (): boolean => {
      const conflicts: string[] = [];
      const excludeId = existingEntry?.id as string | undefined;

      const checkRangeOverlap = (minA: number, maxA: number, minB: number, maxB: number) => !(maxA < minB || minA > maxB);

      const checkField = (fieldId: string, label: string, currentVal?: string, currentRange?: { from: string; to: string } | null) => {
        if (disabledFields.has(fieldId)) return;
        const isRange = !!(showRangeMode[fieldId] && currentRange?.from && currentRange?.to);
        const currentNum = currentVal ? (parseInt(currentVal, 10) || 0) : 0;
        const curFrom = currentRange?.from ? (parseInt(currentRange.from, 10) || 0) : currentNum;
        const curTo = currentRange?.to ? (parseInt(currentRange.to, 10) || 0) : currentNum;
        const curMin = Math.min(curFrom, curTo);
        const curMax = Math.max(curFrom, curTo);

        for (const sheet of projectLogSheets) {
          if (!sheet.data || (excludeId && sheet.id === excludeId)) continue;
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
              conflicts.push(label);
              break;
            }
          }

          const existingVal = sheet.data[fieldId] as string | undefined;
          if (existingVal && typeof existingVal === 'string' && !existingVal.includes('-')) {
            const exNum = parseInt(existingVal, 10) || 0;
            if (exNum >= curMin && exNum <= curMax) {
              conflicts.push(label);
              break;
            }
          }
        }
      };

      if (takeData.soundFile && !disabledFields.has('soundFile')) {
        checkField('soundFile', 'Sound File', takeData.soundFile as string, rangeData['soundFile'] || null);
      }

      if (camCount === 1) {
        if (takeData.cameraFile && !disabledFields.has('cameraFile')) {
          checkField('cameraFile', 'Camera File', takeData.cameraFile as string, rangeData['cameraFile'] || null);
        }
      } else {
        for (let i = 1; i <= camCount; i++) {
          const fid = `cameraFile${i}`;
          const isRecActive = cameraRecState[fid] ?? true;
          if (isRecActive && takeData[fid]) {
            checkField(fid, `Camera File ${i}`, takeData[fid] as string, rangeData[fid] || null);
          }
        }
      }

      if (conflicts.length > 0) {
        Alert.alert(
          'Duplicate Detected',
          'The camera file and/or sound file are already a part of another take. Please adjust the values.',
          [{ text: 'Cancel', style: 'cancel' }]
        );
        return true;
      }
      return false;
    };

    if (duplicateInfo.type === 'take') {
      const hasConflicts = conflictsWithOtherTakes();
      if (hasConflicts) return;
    }

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

      const currentSceneNumber = takeData.sceneNumber;
      const currentShotNumber = takeData.shotNumber;
      const targetSceneNumber = existingEntry.data?.sceneNumber;
      const targetShotNumber = existingEntry.data?.shotNumber;

      if (currentSceneNumber === targetSceneNumber && currentShotNumber === targetShotNumber) {
        const originalTargetTakeNumber = existingEntry.data?.takeNumber;
        if (originalTargetTakeNumber) {
          newLogData.takeNumber = originalTargetTakeNumber;
        }
      } else {
        const projectLogSheets = logSheets.filter(sheet => sheet.projectId === projectId);
        const sameShotTakes = projectLogSheets.filter(sheet =>
          sheet.data?.sceneNumber === currentSceneNumber &&
          sheet.data?.shotNumber === currentShotNumber
        );

        let lastTakeNumber = 0;
        sameShotTakes.forEach(sheet => {
          const takeNum = parseInt(sheet.data?.takeNumber || '0', 10);
          if (!isNaN(takeNum) && takeNum > lastTakeNumber) {
            lastTakeNumber = takeNum;
          }
        });

        newLogData.takeNumber = (lastTakeNumber + 1).toString();
      }
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

      const currentSceneNumber = takeData.sceneNumber;
      const currentShotNumber = takeData.shotNumber;
      const targetSceneNumber = existingEntry.data?.sceneNumber;
      const targetShotNumber = existingEntry.data?.shotNumber;

      if (currentSceneNumber === targetSceneNumber && currentShotNumber === targetShotNumber) {
        if (existingEntry.data?.takeNumber) {
          newLogData.takeNumber = existingEntry.data.takeNumber;
        }
      } else {
        const projectLogSheets = logSheets.filter(sheet => sheet.projectId === projectId);
        const sameShotTakes = projectLogSheets.filter(sheet =>
          sheet.data?.sceneNumber === currentSceneNumber &&
          sheet.data?.shotNumber === currentShotNumber
        );

        let lastTakeNumber = 0;
        sameShotTakes.forEach(sheet => {
          const takeNum = parseInt(sheet.data?.takeNumber || '0', 10);
          if (!isNaN(takeNum) && takeNum > lastTakeNumber) {
            lastTakeNumber = takeNum;
          }
        });

        newLogData.takeNumber = (lastTakeNumber + 1).toString();
      }
    }

    // Increment take numbers for Insert Before when the target is in the same Scene & Shot
    const tScene = existingEntry.data?.sceneNumber as string | undefined;
    const tShot = existingEntry.data?.shotNumber as string | undefined;
    const tTake = parseInt(existingEntry.data?.takeNumber || '0', 10);
    const sameSceneShot = takeData.sceneNumber === tScene && takeData.shotNumber === tShot;
    if (sameSceneShot && !Number.isNaN(tTake)) {
      updateTakeNumbers(projectId, tScene || '', tShot || '', tTake, 1);
    }

    const targetFileNumber = duplicateInfo.number as number;

    if (duplicateInfo.fieldId === 'soundFile') {
      if (existingEntry.data?.soundFile || existingEntry.data?.sound_from) {
        let soundStart = targetFileNumber;
        if (typeof existingEntry.data?.sound_from === 'string') {
          const n = parseInt(existingEntry.data.sound_from, 10);
          if (!Number.isNaN(n)) soundStart = n;
        } else if (typeof existingEntry.data?.soundFile === 'string') {
          const n = parseInt(existingEntry.data.soundFile, 10);
          if (!Number.isNaN(n)) soundStart = n;
        }
        updateFileNumbers(projectId, 'soundFile', soundStart, 1);
      }
    }

    if (duplicateInfo.fieldId === 'cameraFile' || (typeof duplicateInfo.fieldId === 'string' && duplicateInfo.fieldId.startsWith('cameraFile'))) {
      if (camCount === 1) {
        if (existingEntry.data?.cameraFile || existingEntry.data?.camera1_from) {
          let camStart = targetFileNumber;
          if (typeof existingEntry.data?.camera1_from === 'string') {
            const n = parseInt(existingEntry.data.camera1_from, 10);
            if (!Number.isNaN(n)) camStart = n;
          } else if (typeof existingEntry.data?.cameraFile === 'string') {
            const n = parseInt(existingEntry.data.cameraFile, 10);
            if (!Number.isNaN(n)) camStart = n;
          }
          updateFileNumbers(projectId, 'cameraFile', camStart, 1);
        }
      } else {
        for (let i = 1; i <= camCount; i++) {
          const fieldId = `cameraFile${i}`;
          if (existingEntry.data?.[fieldId] || existingEntry.data?.[`camera${i}_from`]) {
            let camStart = targetFileNumber;
            const fromKey = `camera${i}_from` as const;
            const val = existingEntry.data?.[fieldId];
            const fromVal = existingEntry.data?.[fromKey];
            if (typeof fromVal === 'string') {
              const n = parseInt(fromVal, 10);
              if (!Number.isNaN(n)) camStart = n;
            } else if (typeof val === 'string') {
              const n = parseInt(val, 10);
              if (!Number.isNaN(n)) camStart = n;
            }
            updateFileNumbers(projectId, fieldId, camStart, 1);
          }
        }
      }
    }

    const logSheet = addLogSheet(
      `Take ${stats.totalTakes + 1}`,
      'take',
      '',
      projectId
    );

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

    const pad4 = (v?: string) => (v ? String(parseInt(v, 10) || 0).padStart(4, '0') : '');
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
            const base = idx === 1 && camCount === 1 ? 'cameraFile' : `cameraFile${idx}`;
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
            const base = idx === 1 && camCount === 1 ? 'cameraFile' : `cameraFile${idx}`;
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

      if (camCount === 1) {
        const camEnabled = !disabledFields.has('cameraFile');
        handleField('cameraFile', camEnabled, 1);
      } else {
        for (let i = 1; i <= camCount; i++) {
          const fieldId = `cameraFile${i}`;
          const camEnabled = !disabledFields.has(fieldId) && (cameraRecState[fieldId] ?? true);
          handleField(fieldId, camEnabled, i);
        }
      }
      return out;
    };

    finalTakeData = sanitizeDataBeforeSave(finalTakeData, classification);
    finalTakeData = applyRangePersistence(finalTakeData);

    logSheet.data = {
      ...finalTakeData,
      classification,
      shotDetails,
      isGoodTake,
      wasteOptions: classification === 'Waste' ? JSON.stringify(wasteOptions) : '',
      insertSoundSpeed: classification === 'Insert' ? (insertSoundSpeed?.toString() || '') : '',
      cameraRecState: camCount > 1 ? cameraRecState : undefined
    };

    router.back();
  };
  


  const addLogWithDuplicatePair = (
    existingEntry: any,
    soundFromNumber: number,
    cameraFieldId: string,
    cameraFromNumber: number
  ) => {
    // Only use trial if this is the trial project and not unlocked
    const isTrialProject = tokenStore.isTrialProject(projectId);
    const isUnlocked = tokenStore.isProjectUnlocked(projectId);
    if (isTrialProject && !isUnlocked) {
      tokenStore.useTrial();
    }

    const camCount = project?.settings?.cameraConfiguration || 1;

    // Preserve the original scene and shot from before insertion
    const originalSceneNumber = takeData.sceneNumber;
    const originalShotNumber = takeData.shotNumber;

    let newLogData = { ...takeData };
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

    // Always use the original scene and shot values
    newLogData.sceneNumber = originalSceneNumber;
    newLogData.shotNumber = originalShotNumber;

    const targetSceneNumber = existingEntry.data?.sceneNumber;
    const targetShotNumber = existingEntry.data?.shotNumber;

    if (originalSceneNumber === targetSceneNumber && originalShotNumber === targetShotNumber) {
      if (existingEntry.data?.takeNumber) {
        newLogData.takeNumber = existingEntry.data.takeNumber;
      }
    } else {
      const projectLogSheets = logSheets.filter(sheet => sheet.projectId === projectId);
      const sameShotTakes = projectLogSheets.filter(sheet =>
        sheet.data?.sceneNumber === originalSceneNumber &&
        sheet.data?.shotNumber === originalShotNumber
      );
      let lastTakeNumber = 0;
      sameShotTakes.forEach(sheet => {
        const takeNum = parseInt(sheet.data?.takeNumber || '0', 10);
        if (!isNaN(takeNum) && takeNum > lastTakeNumber) {
          lastTakeNumber = takeNum;
        }
      });
      newLogData.takeNumber = (lastTakeNumber + 1).toString();
    }

    const tScene = existingEntry.data?.sceneNumber as string | undefined;
    const tShot = existingEntry.data?.shotNumber as string | undefined;
    const tTake = parseInt(existingEntry.data?.takeNumber || '0', 10);
    const sameSceneShot = originalSceneNumber === tScene && originalShotNumber === tShot;
    if (sameSceneShot && !Number.isNaN(tTake)) {
      updateTakeNumbers(projectId, tScene || '', tShot || '', tTake, 1);
    }

    // Shift subsequent sound and camera files for ALL relevant cameras, not just one
    let soundStart = soundFromNumber;
    if (typeof existingEntry.data?.sound_from === 'string') {
      const n = parseInt(existingEntry.data.sound_from, 10);
      if (!Number.isNaN(n)) soundStart = n;
    } else if (typeof existingEntry.data?.soundFile === 'string') {
      const n = parseInt(existingEntry.data.soundFile, 10);
      if (!Number.isNaN(n)) soundStart = n;
    }
    updateFileNumbers(projectId, 'soundFile', soundStart, 1);

    if (camCount === 1) {
      let camStart = cameraFromNumber;
      if (typeof existingEntry.data?.camera1_from === 'string') {
        const n = parseInt(existingEntry.data.camera1_from, 10);
        if (!Number.isNaN(n)) camStart = n;
      } else if (typeof existingEntry.data?.cameraFile === 'string') {
        const n = parseInt(existingEntry.data.cameraFile, 10);
        if (!Number.isNaN(n)) camStart = n;
      }
      updateFileNumbers(projectId, 'cameraFile', camStart, 1);
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
          updateFileNumbers(projectId, fieldId, camStart, 1);
        }
      }
    }

    const logSheet = addLogSheet(
      `Take ${stats.totalTakes + 1}`,
      'take',
      '',
      projectId
    );

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

    const pad4 = (v?: string) => (v ? String(parseInt(v, 10) || 0).padStart(4, '0') : '');
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
            const base = idx === 1 && camCount === 1 ? 'cameraFile' : `cameraFile${idx}`;
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
            const base = idx === 1 && camCount === 1 ? 'cameraFile' : `cameraFile${idx}`;
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

      if (camCount === 1) {
        const camEnabled = !disabledFields.has('cameraFile');
        handleField('cameraFile', camEnabled, 1);
      } else {
        for (let i = 1; i <= camCount; i++) {
          const fieldId = `cameraFile${i}`;
          const camEnabled = !disabledFields.has(fieldId) && (cameraRecState[fieldId] ?? true);
          handleField(fieldId, camEnabled, i);
        }
      }
      return out;
    };

    finalTakeData = sanitizeDataBeforeSave(finalTakeData, classification);
    finalTakeData = applyRangePersistence(finalTakeData);

    logSheet.data = {
      ...finalTakeData,
      classification,
      shotDetails,
      isGoodTake,
      wasteOptions: classification === 'Waste' ? JSON.stringify(wasteOptions) : '',
      insertSoundSpeed: classification === 'Insert' ? (insertSoundSpeed?.toString() || '') : '',
      cameraRecState: camCount > 1 ? cameraRecState : undefined
    };

    router.back();
  };

  const addNewTake = (overrideTakeNumber?: string) => {
    // Only use trial if this is the trial project and not unlocked
    const isTrialProject = tokenStore.isTrialProject(projectId);
    const isUnlocked = tokenStore.isProjectUnlocked(projectId);
    if (isTrialProject && !isUnlocked) {
      tokenStore.useTrial();
    }
    
    const logSheet = addLogSheet(
      `Take ${stats.totalTakes + 1}`,
      'take',
      '',
      projectId
    );
    
    // Prepare final take data with REC state considerations
    let finalTakeData = { ...takeData };
    
    // Apply override take number if provided
    if (overrideTakeNumber) {
      finalTakeData.takeNumber = overrideTakeNumber;
    }
    
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
    // Final sanitation to enforce business rules and range persistence
    const pad4 = (v?: string) => (v ? String(parseInt(v, 10) || 0).padStart(4, '0') : '');
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

    finalTakeData = sanitizeDataBeforeSave(finalTakeData, classification);
    finalTakeData = applyRangePersistence(finalTakeData);
      
      logSheet.data = {
      ...finalTakeData,
      classification,
      shotDetails,
      isGoodTake,
      wasteOptions: classification === 'Waste' ? JSON.stringify(wasteOptions) : '',
      insertSoundSpeed: classification === 'Insert' ? (insertSoundSpeed?.toString() || '') : '',
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
    const isCurrentlyInRangeMode = showRangeMode[fieldId];
    
    // Update only the specific field's range mode
    setShowRangeMode(prev => ({
      ...prev,
      [fieldId]: !isCurrentlyInRangeMode
    }));
    
    if (!isCurrentlyInRangeMode) {
      // Entering range mode: initialize range data for this field only
      const currentValue = takeData[fieldId] || '';
      setRangeData(prev => ({
        ...prev,
        [fieldId]: { 
          from: currentValue, 
          to: prev[fieldId]?.to || '' // Preserve existing 'to' value if it exists
        }
      }));
    } else {
      // Exiting range mode: set the single value to the 'from' value for this field only
      const range = rangeData[fieldId];
      if (range) {
        updateTakeData(fieldId, range.from);
        // Clear only this field's range data
        setRangeData(prev => {
          const newRangeData = { ...prev };
          delete newRangeData[fieldId];
          return newRangeData;
        });
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
    
    // Calculate new disabled fields based on the new classification
    const prevDisabled = new Set(disabledFields);
    const nextDisabled = new Set<string>();
    
    // Keep existing MOS disabled fields if MOS is still active (but not for Ambience/SFX)
    if (shotDetails.includes('MOS') && newClassification !== 'Ambience' && newClassification !== 'SFX') {
      nextDisabled.add('soundFile');
    }
    
    // Clear MOS when switching to Ambience or SFX
    if (newClassification === 'Ambience' || newClassification === 'SFX') {
      setShotDetails(prev => prev.filter(s => s !== 'MOS'));
      // Sound will be enabled for Ambience/SFX, so don't add to nextDisabled
    }
    
    if (newClassification === 'Waste') {
      setShowWasteModal(true);
      // Don't set disabled fields yet, wait for waste modal confirmation
      return;
    } else if (classification === 'Waste' && newClassification === null) {
      // Toggling Waste OFF - preserve current values, don't auto-fill
      
      // Re-enable Camera Files (check if they were disabled by Waste)
      if (!wasteOptions.camera) {
        // Camera was NOT selected for waste, so it was disabled - re-enable
        if (project?.settings?.cameraConfiguration === 1) {
          if (prevDisabled.has('cameraFile')) {
            nextDisabled.delete('cameraFile');
          }
        } else {
          for (let i = 1; i <= (project?.settings?.cameraConfiguration || 1); i++) {
            const fieldId = `cameraFile${i}`;
            if (prevDisabled.has(fieldId)) {
              nextDisabled.delete(fieldId);
            }
          }
        }
      }
      
      // Re-enable Sound File (check if it was disabled by Waste)
      if (!wasteOptions.sound && prevDisabled.has('soundFile')) {
        // Sound was NOT selected for waste, so it was disabled - re-enable
        nextDisabled.delete('soundFile');
      }
      
      // Reset waste options and clear temporary storage
      setWasteOptions({ camera: false, sound: false });
      wasteTemporaryStorageRef.current = {};
      setDisabledFields(nextDisabled);
      return;
    } else if (newClassification === 'SFX') {
      // Save current values before disabling fields
      savedFieldValuesRef.current = {
        sceneNumber: takeData.sceneNumber,
        shotNumber: takeData.shotNumber,
        takeNumber: takeData.takeNumber,
        soundFile: takeData.soundFile,
        cameraFile: takeData.cameraFile,
      };
      
      // Save camera files for multi-camera setup
      if (project?.settings?.cameraConfiguration && project.settings.cameraConfiguration > 1) {
        for (let i = 1; i <= project.settings.cameraConfiguration; i++) {
          const fieldId = `cameraFile${i}`;
          savedFieldValuesRef.current[fieldId] = takeData[fieldId];
        }
      }
      
      // For SFX: disable camera files and scene/shot/take fields
      if (project?.settings?.cameraConfiguration === 1) {
        nextDisabled.add('cameraFile');
      } else {
        for (let i = 1; i <= (project?.settings?.cameraConfiguration || 1); i++) {
          nextDisabled.add(`cameraFile${i}`);
        }
      }
      
      // Disable scene, shot and take fields
      nextDisabled.add('sceneNumber');
      nextDisabled.add('shotNumber');
      nextDisabled.add('takeNumber');
      
      // Ensure soundFile is NOT disabled for SFX (only camera files are disabled)
      nextDisabled.delete('soundFile');
      
      setDisabledFields(nextDisabled);
      
      // Auto-prefill Sound when transitioning from disabled to enabled
      const soundWasDisabled = prevDisabled.has('soundFile');
      const soundNowEnabled = !nextDisabled.has('soundFile');
      
      if (soundWasDisabled && soundNowEnabled) {
        // Compute next sound file number
        const projectLogSheets = logSheets.filter(sheet => sheet.projectId === projectId);
        const nextNumbers = computeNextFileNumbers(projectLogSheets, project);
        const nextSoundNum = nextNumbers['soundFile'];
        const formattedSound = String(nextSoundNum).padStart(4, '0');
        
        setTakeData(prev => {
          const updated = { ...prev };
          // Auto-prefill sound based on range mode
          if (showRangeMode['soundFile']) {
            // Range mode: set 'from' only, don't overwrite existing 'to'
            setRangeData(prevRange => ({
              ...prevRange,
              soundFile: {
                from: formattedSound,
                to: prevRange['soundFile']?.to || ''
              }
            }));
          } else {
            // Single mode: set sound file
            updated.soundFile = formattedSound;
          }
          return updated;
        });
      }
      
      // Don't clear scene/shot/take fields - they will be hidden but values preserved
      setTakeData(prev => {
        const updated = { ...prev };
        // Only clear camera files that are newly disabled
        if (project?.settings?.cameraConfiguration === 1) {
          if (!prevDisabled.has('cameraFile') && nextDisabled.has('cameraFile')) updated.cameraFile = '';
        } else {
          for (let i = 1; i <= (project?.settings?.cameraConfiguration || 1); i++) {
            const fieldId = `cameraFile${i}`;
            if (!prevDisabled.has(fieldId) && nextDisabled.has(fieldId)) updated[fieldId] = '';
          }
        }
        return updated;
      });
      
      // Clear range data only for newly disabled fields
      setRangeData(prev => {
        const updated = { ...prev };
        if (project?.settings?.cameraConfiguration === 1) {
          if (!prevDisabled.has('cameraFile') && nextDisabled.has('cameraFile')) delete updated['cameraFile'];
        } else {
          for (let i = 1; i <= (project?.settings?.cameraConfiguration || 1); i++) {
            const fieldId = `cameraFile${i}`;
            if (!prevDisabled.has(fieldId) && nextDisabled.has(fieldId)) delete updated[fieldId];
          }
        }
        return updated;
      });
    } else if (newClassification === 'Ambience') {
      // Save current values before disabling fields
      savedFieldValuesRef.current = {
        sceneNumber: takeData.sceneNumber,
        shotNumber: takeData.shotNumber,
        takeNumber: takeData.takeNumber,
        soundFile: takeData.soundFile,
        cameraFile: takeData.cameraFile,
      };
      
      // Save camera files for multi-camera setup
      if (project?.settings?.cameraConfiguration && project.settings.cameraConfiguration > 1) {
        for (let i = 1; i <= project.settings.cameraConfiguration; i++) {
          const fieldId = `cameraFile${i}`;
          savedFieldValuesRef.current[fieldId] = takeData[fieldId];
        }
      }
      
      // For Ambience: disable camera files and scene/shot/take fields
      if (project?.settings?.cameraConfiguration === 1) {
        nextDisabled.add('cameraFile');
      } else {
        for (let i = 1; i <= (project?.settings?.cameraConfiguration || 1); i++) {
          nextDisabled.add(`cameraFile${i}`);
        }
      }
      
      // Disable scene, shot and take fields
      nextDisabled.add('sceneNumber');
      nextDisabled.add('shotNumber');
      nextDisabled.add('takeNumber');
      
      // Ensure soundFile is NOT disabled for Ambience (only camera files are disabled)
      nextDisabled.delete('soundFile');
      
      setDisabledFields(nextDisabled);
      
      // Auto-prefill Sound when transitioning from disabled to enabled
      const soundWasDisabled = prevDisabled.has('soundFile');
      const soundNowEnabled = !nextDisabled.has('soundFile');
      
      if (soundWasDisabled && soundNowEnabled) {
        // Compute next sound file number
        const projectLogSheets = logSheets.filter(sheet => sheet.projectId === projectId);
        const nextNumbers = computeNextFileNumbers(projectLogSheets, project);
        const nextSoundNum = nextNumbers['soundFile'];
        const formattedSound = String(nextSoundNum).padStart(4, '0');
        
        setTakeData(prev => {
          const updated = { ...prev };
          // Auto-prefill sound based on range mode
          if (showRangeMode['soundFile']) {
            // Range mode: set 'from' only, don't overwrite existing 'to'
            setRangeData(prevRange => ({
              ...prevRange,
              soundFile: {
                from: formattedSound,
                to: prevRange['soundFile']?.to || ''
              }
            }));
          } else {
            // Single mode: set sound file
            updated.soundFile = formattedSound;
          }
          return updated;
        });
      }
      
      // Don't clear scene/shot/take fields - they will be hidden but values preserved
      setTakeData(prev => {
        const updated = { ...prev };
        // Only clear camera files that are newly disabled
        if (project?.settings?.cameraConfiguration === 1) {
          if (!prevDisabled.has('cameraFile') && nextDisabled.has('cameraFile')) updated.cameraFile = '';
        } else {
          for (let i = 1; i <= (project?.settings?.cameraConfiguration || 1); i++) {
            const fieldId = `cameraFile${i}`;
            if (!prevDisabled.has(fieldId) && nextDisabled.has(fieldId)) updated[fieldId] = '';
          }
        }
        return updated;
      });
      
      // Clear range data only for newly disabled fields
      setRangeData(prev => {
        const updated = { ...prev };
        if (project?.settings?.cameraConfiguration === 1) {
          if (!prevDisabled.has('cameraFile') && nextDisabled.has('cameraFile')) delete updated['cameraFile'];
        } else {
          for (let i = 1; i <= (project?.settings?.cameraConfiguration || 1); i++) {
            const fieldId = `cameraFile${i}`;
            if (!prevDisabled.has(fieldId) && nextDisabled.has(fieldId)) delete updated[fieldId];
          }
        }
        return updated;
      });
    } else if (newClassification === 'Insert') {
      setShowInsertModal(true);
      // Don't set disabled fields yet, wait for insert modal confirmation
      return;
    } else {
      // No classification selected - restore saved values if coming from SFX/Ambience
      if (classification === 'SFX' || classification === 'Ambience') {
        const restoredData: TakeData = {
          sceneNumber: savedFieldValuesRef.current.sceneNumber || takeData.sceneNumber,
          shotNumber: savedFieldValuesRef.current.shotNumber || takeData.shotNumber,
          takeNumber: savedFieldValuesRef.current.takeNumber || takeData.takeNumber,
          soundFile: savedFieldValuesRef.current.soundFile || takeData.soundFile,
          cameraFile: savedFieldValuesRef.current.cameraFile || takeData.cameraFile,
        };
        
        // Restore camera files for multi-camera setup
        if (project?.settings?.cameraConfiguration && project.settings.cameraConfiguration > 1) {
          for (let i = 1; i <= project.settings.cameraConfiguration; i++) {
            const fieldId = `cameraFile${i}`;
            restoredData[fieldId] = savedFieldValuesRef.current[fieldId] || takeData[fieldId];
          }
        }
        
        setTakeData(prev => ({
          ...prev,
          ...restoredData
        }));
      }
      
      // Only keep MOS disabled fields if MOS is active
      setDisabledFields(nextDisabled);
      
      // Don't auto-prefill when disabling Insert - preserve existing values
      
      // Clear fields that are newly disabled (but not scene/shot/take when restoring)
      setTakeData(prev => {
        const updated = { ...prev };
        // Only clear sound/camera files that are newly disabled
        if (!prevDisabled.has('soundFile') && nextDisabled.has('soundFile')) updated.soundFile = '';
        if (project?.settings?.cameraConfiguration === 1) {
          if (!prevDisabled.has('cameraFile') && nextDisabled.has('cameraFile')) updated.cameraFile = '';
        } else {
          for (let i = 1; i <= (project?.settings?.cameraConfiguration || 1); i++) {
            const fieldId = `cameraFile${i}`;
            if (!prevDisabled.has(fieldId) && nextDisabled.has(fieldId)) updated[fieldId] = '';
          }
        }
        return updated;
      });
      
      // Clear range data only for newly disabled fields
      setRangeData(prev => {
        const updated = { ...prev };
        if (!prevDisabled.has('soundFile') && nextDisabled.has('soundFile')) delete updated['soundFile'];
        if (project?.settings?.cameraConfiguration === 1) {
          if (!prevDisabled.has('cameraFile') && nextDisabled.has('cameraFile')) delete updated['cameraFile'];
        } else {
          for (let i = 1; i <= (project?.settings?.cameraConfiguration || 1); i++) {
            const fieldId = `cameraFile${i}`;
            if (!prevDisabled.has(fieldId) && nextDisabled.has(fieldId)) delete updated[fieldId];
          }
        }
        return updated;
      });
    }
  };

  const handleWasteConfirm = () => {
    if (!wasteOptions.camera && !wasteOptions.sound) {
      Alert.alert('Selection Required', 'Please select at least one option to waste.');
      return;
    }
    
    // Calculate which fields should be disabled
    const prevDisabled = new Set(disabledFields);
    const nextDisabled = new Set(prevDisabled);
    
    // Handle camera file waste - if NOT selected for waste, disable camera fields
    if (!wasteOptions.camera) {
      if (project?.settings?.cameraConfiguration === 1) {
        nextDisabled.add('cameraFile');
      } else {
        for (let i = 1; i <= (project?.settings?.cameraConfiguration || 1); i++) {
          nextDisabled.add(`cameraFile${i}`);
        }
      }
    } else {
      // Camera IS selected for waste - re-enable camera fields
      if (project?.settings?.cameraConfiguration === 1) {
        nextDisabled.delete('cameraFile');
      } else {
        for (let i = 1; i <= (project?.settings?.cameraConfiguration || 1); i++) {
          nextDisabled.delete(`cameraFile${i}`);
        }
      }
    }
    
    // Handle sound file waste - if NOT selected for waste, disable sound field
    if (!wasteOptions.sound) {
      nextDisabled.add('soundFile');
    } else {
      // Sound IS selected for waste - re-enable sound field
      nextDisabled.delete('soundFile');
    }
    
    setDisabledFields(nextDisabled);
    
    // Store current values in temporary storage but DON'T clear them yet
    // They will be cleared only when "Add Log" is clicked
    if (!wasteOptions.camera) {
      if (project?.settings?.cameraConfiguration === 1) {
        if (!prevDisabled.has('cameraFile') && nextDisabled.has('cameraFile')) {
          wasteTemporaryStorageRef.current['cameraFile'] = takeData.cameraFile || '';
        }
      } else {
        for (let i = 1; i <= (project?.settings?.cameraConfiguration || 1); i++) {
          const fieldId = `cameraFile${i}`;
          if (!prevDisabled.has(fieldId) && nextDisabled.has(fieldId)) {
            wasteTemporaryStorageRef.current[fieldId] = takeData[fieldId] || '';
          }
        }
      }
    }
    
    if (!wasteOptions.sound) {
      if (!prevDisabled.has('soundFile') && nextDisabled.has('soundFile')) {
        wasteTemporaryStorageRef.current['soundFile'] = takeData.soundFile || '';
      }
    }
    
    // Auto-prefill fields that are being re-enabled
    const projectLogSheets = logSheets.filter(sheet => sheet.projectId === projectId);
    const nextNumbers = computeNextFileNumbers(projectLogSheets, project);
    
    // Re-enable and auto-fill Sound File if it was disabled and is now enabled
    if (wasteOptions.sound && prevDisabled.has('soundFile') && !nextDisabled.has('soundFile')) {
      setTimeout(() => {
        const nextSoundNum = nextNumbers['soundFile'];
        if (lastAutoIncrementRef.current['soundFile'] === nextSoundNum) {
          return;
        }
        lastAutoIncrementRef.current['soundFile'] = nextSoundNum;
        const formattedSound = String(nextSoundNum).padStart(4, '0');
        
        writingProgrammaticallyRef.current = true;
        setTakeData(prev => {
          const updated = { ...prev };
          if (showRangeMode['soundFile']) {
            setRangeData(prevRange => ({
              ...prevRange,
              soundFile: {
                from: formattedSound,
                to: prevRange['soundFile']?.to || ''
              }
            }));
          } else {
            updated.soundFile = formattedSound;
          }
          return updated;
        });
        setTimeout(() => {
          writingProgrammaticallyRef.current = false;
        }, 100);
      }, 100);
    }
    
    // Re-enable and auto-fill Camera Files if they were disabled and are now enabled
    if (wasteOptions.camera) {
      if (project?.settings?.cameraConfiguration === 1) {
        if (prevDisabled.has('cameraFile') && !nextDisabled.has('cameraFile')) {
          setTimeout(() => {
            const nextCameraNum = nextNumbers['cameraFile'];
            if (lastAutoIncrementRef.current['cameraFile'] === nextCameraNum) {
              return;
            }
            lastAutoIncrementRef.current['cameraFile'] = nextCameraNum;
            const formattedCamera = String(nextCameraNum).padStart(4, '0');
            
            writingProgrammaticallyRef.current = true;
            setTakeData(prev => {
              const updated = { ...prev };
              if (showRangeMode['cameraFile']) {
                setRangeData(prevRange => ({
                  ...prevRange,
                  cameraFile: {
                    from: formattedCamera,
                    to: prevRange['cameraFile']?.to || ''
                  }
                }));
              } else {
                updated.cameraFile = formattedCamera;
              }
              return updated;
            });
            setTimeout(() => {
              writingProgrammaticallyRef.current = false;
            }, 100);
          }, 100);
        }
      } else {
        for (let i = 1; i <= (project?.settings?.cameraConfiguration || 1); i++) {
          const fieldId = `cameraFile${i}`;
          if (prevDisabled.has(fieldId) && !nextDisabled.has(fieldId)) {
            setTimeout(() => {
              const nextCameraNum = nextNumbers[fieldId];
              if (lastAutoIncrementRef.current[fieldId] === nextCameraNum) {
                return;
              }
              lastAutoIncrementRef.current[fieldId] = nextCameraNum;
              const formattedCamera = String(nextCameraNum).padStart(4, '0');
              
              writingProgrammaticallyRef.current = true;
              setTakeData(prev => {
                const updated = { ...prev };
                if (showRangeMode[fieldId]) {
                  setRangeData(prevRange => ({
                    ...prevRange,
                    [fieldId]: {
                      from: formattedCamera,
                      to: prevRange[fieldId]?.to || ''
                    }
                  }));
                } else {
                  updated[fieldId] = formattedCamera;
                }
                return updated;
              });
              setTimeout(() => {
                writingProgrammaticallyRef.current = false;
              }, 100);
            }, 100);
          }
        }
      }
    }
    
    setShowWasteModal(false);
    // DON'T reset wasteOptions here - keep them so we can restore values when Waste is toggled off
  };

  const handleWasteCancel = () => {
    setShowWasteModal(false);
    setWasteOptions({ camera: false, sound: false });
    setClassification(null);
  };

  const handleInsertSoundSpeed = (hasSoundSpeed: boolean) => {
    setInsertSoundSpeed(hasSoundSpeed);
    const prevDisabled = new Set(disabledFields);
    const nextDisabled = new Set(prevDisabled);
    
    if (!hasSoundSpeed) {
      // Only disable soundFile, preserve other enabled fields
      nextDisabled.add('soundFile');
      setDisabledFields(nextDisabled);
      
      // Store the current value in temporary storage but DON'T clear it yet
      // It will be cleared only when "Add Log" is clicked
      if (!prevDisabled.has('soundFile')) {
        wasteTemporaryStorageRef.current['soundFile'] = takeData.soundFile || '';
      }
    } else {
      // If user selects "Yes", remove soundFile from disabled fields and auto-fill
      nextDisabled.delete('soundFile');
      setDisabledFields(nextDisabled);
      
      // Auto-prefill Sound when transitioning from disabled to enabled
      const soundWasDisabled = prevDisabled.has('soundFile');
      const soundNowEnabled = !nextDisabled.has('soundFile');
      
      if (soundWasDisabled && soundNowEnabled) {
        // Small debounce to prevent double increments
        setTimeout(() => {
          // Compute next sound file number
          const projectLogSheets = logSheets.filter(sheet => sheet.projectId === projectId);
          const nextNumbers = computeNextFileNumbers(projectLogSheets, project);
          const nextSoundNum = nextNumbers['soundFile'];
          
          // Guard against double increments
          if (lastAutoIncrementRef.current['soundFile'] === nextSoundNum) {
            return;
          }
          lastAutoIncrementRef.current['soundFile'] = nextSoundNum;
          
          const formattedSound = String(nextSoundNum).padStart(4, '0');
          
          writingProgrammaticallyRef.current = true;
          setTakeData(prev => {
            const updated = { ...prev };
            // Auto-prefill sound based on range mode
            if (showRangeMode['soundFile']) {
              // Range mode: set 'from' only, don't overwrite existing 'to'
              setRangeData(prevRange => ({
                ...prevRange,
                soundFile: {
                  from: formattedSound,
                  to: prevRange['soundFile']?.to || ''
                }
              }));
            } else {
              // Single mode: set sound file
              updated.soundFile = formattedSound;
            }
            return updated;
          });
          setTimeout(() => {
            writingProgrammaticallyRef.current = false;
          }, 100);
        }, 100);
      }
    }
    setShowInsertModal(false);
  };

  const handleInsertCancel = () => {
    setShowInsertModal(false);
    setClassification(null);
    setInsertSoundSpeed(null);
  };

  const toggleCameraRec = (fieldId: string) => {
    setCameraRecState(prev => ({
      ...prev,
      [fieldId]: !prev[fieldId]
    }));
  };

  const handleShotDetailsChange = (type: ShotDetailsType) => {
    let newSelection: ShotDetailsType[];
    const isSelected = shotDetails.includes(type);

    if (type === 'MOS') {
      // Block MOS selection when classification is Ambience or SFX
      if (classification === 'Ambience' || classification === 'SFX') {
        return;
      }
      if (!isSelected) {
        // Enabling MOS - disable soundFile and clear its value
        newSelection = [...shotDetails, type];
        const currentDisabled = new Set(disabledFields);
        currentDisabled.add('soundFile');
        setDisabledFields(currentDisabled);
        setTakeData(prev => ({ ...prev, soundFile: '' }));
        // Clear sound range data when MOS is enabled
        setRangeData(prev => {
          const updated = { ...prev };
          delete updated['soundFile'];
          return updated;
        });
      } else {
        // Disabling MOS - re-enable soundFile if appropriate
        newSelection = shotDetails.filter(s => s !== type);
        const prevDisabled = new Set(disabledFields);
        const currentDisabled = new Set(disabledFields);
        // Only re-enable soundFile if not disabled by other classifications
        if (classification !== 'Waste' || wasteOptions.sound) {
          if (classification !== 'Insert' || insertSoundSpeed !== false) {
            currentDisabled.delete('soundFile');
            
            // Auto-prefill Sound when transitioning from disabled to enabled
            const soundWasDisabled = prevDisabled.has('soundFile');
            const soundNowEnabled = !currentDisabled.has('soundFile');
            
            if (soundWasDisabled && soundNowEnabled) {
              // Compute next sound file number
              const projectLogSheets = logSheets.filter(sheet => sheet.projectId === projectId);
              const nextNumbers = computeNextFileNumbers(projectLogSheets, project);
              const nextSoundNum = nextNumbers['soundFile'];
              const formattedSound = String(nextSoundNum).padStart(4, '0');
              
              setTakeData(prev => {
                const updated = { ...prev };
                // Auto-prefill sound based on range mode
                if (showRangeMode['soundFile']) {
                  // Range mode: set 'from' only, don't overwrite existing 'to'
                  setRangeData(prevRange => ({
                    ...prevRange,
                    soundFile: {
                      from: formattedSound,
                      to: prevRange['soundFile']?.to || ''
                    }
                  }));
                } else {
                  // Single mode: set sound file
                  updated.soundFile = formattedSound;
                }
                return updated;
              });
            }
          }
        }
        setDisabledFields(currentDisabled);
      }
    } else {
      newSelection = isSelected ? shotDetails.filter(s => s !== type) : [...shotDetails, type];
    }

    setShotDetails(newSelection);
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
              const target: any = undefined;
              setTimeout(() => {
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
  const coreFieldOrder = ['sceneNumber', 'shotNumber', 'takeNumber'];
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

  // Add card number fields after camera fields
  if (enabledFields.find(f => f.id === 'cardNumber')) {
    if (cameraConfiguration === 1) {
      allFieldIds.push('cardNumber');
    } else {
      for (let i = 1; i <= cameraConfiguration; i++) {
        allFieldIds.push(`cardNumber${i}`);
      }
    }
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

  const styles = createStyles(colors);

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
                <Text style={[
                  styles.topFieldLabel,
                  disabledFields.has('sceneNumber') && styles.disabledLabel,
                  validationErrors.has('sceneNumber') && styles.errorLabel
                ]}>
                  Scene{!disabledFields.has('sceneNumber') && classification !== 'Ambience' && classification !== 'SFX' && <Text style={styles.asterisk}> *</Text>}
                </Text>
                <TextInput
                  ref={(ref) => { inputRefs.current['sceneNumber'] = ref; }}
                  style={[
                    styles.topFieldInput,
                    disabledFields.has('sceneNumber') && styles.disabledInput,
                    validationErrors.has('sceneNumber') && styles.errorInput
                  ]}
                  value={disabledFields.has('sceneNumber') ? '' : (takeData.sceneNumber || '')}
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
                  editable={!disabledFields.has('sceneNumber')}
                  onSubmitEditing={() => !disabledFields.has('sceneNumber') && focusNextField('sceneNumber', allFieldIds)}
                  onFocus={(event) => {
                    const target: any = undefined;
                    setTimeout(() => {
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
                <Text style={[
                  styles.topFieldLabel,
                  disabledFields.has('shotNumber') && styles.disabledLabel,
                  validationErrors.has('shotNumber') && styles.errorLabel
                ]}>
                  Shot{!disabledFields.has('shotNumber') && classification !== 'Ambience' && classification !== 'SFX' && <Text style={styles.asterisk}> *</Text>}
                </Text>
                <TextInput
                  ref={(ref) => { inputRefs.current['shotNumber'] = ref; }}
                  style={[
                    styles.topFieldInput,
                    disabledFields.has('shotNumber') && styles.disabledInput,
                    validationErrors.has('shotNumber') && styles.errorInput
                  ]}
                  value={disabledFields.has('shotNumber') ? '' : (takeData.shotNumber || '')}
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
                  editable={!disabledFields.has('shotNumber')}
                  onSubmitEditing={() => !disabledFields.has('shotNumber') && focusNextField('shotNumber', allFieldIds)}
                  onFocus={(event) => {
                    const target: any = undefined;
                    setTimeout(() => {
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
                <Text style={[
                  styles.topFieldLabel,
                  disabledFields.has('takeNumber') && styles.disabledLabel,
                  validationErrors.has('takeNumber') && styles.errorLabel
                ]}>
                  Take{!disabledFields.has('takeNumber') && classification !== 'Ambience' && classification !== 'SFX' && <Text style={styles.asterisk}> *</Text>}
                </Text>
                <TextInput
                  ref={(ref) => { inputRefs.current['takeNumber'] = ref; }}
                  style={[
                    styles.topFieldInput,
                    disabledFields.has('takeNumber') && styles.disabledInput,
                    validationErrors.has('takeNumber') && styles.errorInput
                  ]}
                  value={disabledFields.has('takeNumber') ? '' : (takeData.takeNumber || '')}
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
                  editable={!disabledFields.has('takeNumber')}
                  onSubmitEditing={() => !disabledFields.has('takeNumber') && focusNextField('takeNumber', allFieldIds)}
                  onFocus={(event) => {
                    const target: any = undefined;
                    setTimeout(() => {
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
                  <Text style={styles.rangeSeparator}>–</Text>
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
                      const target: any = undefined;
                      setTimeout(() => {
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
          
          {/* Single-camera Card Number (when enabled) */}
          {cameraConfiguration === 1 && (enabledFields.find(f => f.id === 'cardNumber')) && (
            <View style={styles.fieldContainer}>
              <Text style={styles.fieldLabel}>Card Number</Text>
              <TextInput
                ref={(ref) => { inputRefs.current['cardNumber'] = ref; }}
                style={[styles.fieldInput]}
                value={takeData.cardNumber || ''}
                onChangeText={(text) => updateTakeData('cardNumber', text)}
                placeholder="Enter card number"
                placeholderTextColor={colors.subtext}
                returnKeyType="next"
                onSubmitEditing={() => focusNextField('cardNumber', allFieldIds)}
              />
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
                  <Text style={styles.rangeSeparator}>–</Text>
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
                      const target: any = undefined;
                      setTimeout(() => {
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
                        <Text style={styles.rangeSeparator}>–</Text>
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
                            const target: any = undefined;
                            setTimeout(() => {
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

          {/* Multi-camera Card Numbers (when enabled) */}
          {cameraConfiguration > 1 && (enabledFields.find(f => f.id === 'cardNumber')) && (
            <View style={styles.additionalCameraFields}>
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
                      onSubmitEditing={() => focusNextField(fieldId, allFieldIds)}
                    />
                  </View>
                );
              })}
            </View>
          )}
          
          {/* Episode field right before Take Description */}
          {enabledFields.find(f => f.id === 'episodeNumber') && (
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
                onChangeText={(text) => {
                  updateTakeData('episodeNumber', text);
                  if (validationErrors.has('episodeNumber')) {
                    setValidationErrors(prev => {
                      const newErrors = new Set(prev);
                      newErrors.delete('episodeNumber');
                      return newErrors;
                    });
                  }
                }}
                placeholder="Enter episode number"
                placeholderTextColor={colors.subtext}
                returnKeyType="next"
                editable={!disabledFields.has('episodeNumber')}
              />
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
                    shotDetails.includes(type) && styles.shotDetailsButtonActive,
                    isDisabled && styles.shotDetailsButtonDisabled
                  ]}
                  onPress={() => !isDisabled && handleShotDetailsChange(type)}
                  disabled={isDisabled}
                >
                  <Text style={[
                    styles.shotDetailsButtonText,
                    shotDetails.includes(type) && styles.shotDetailsButtonTextActive,
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
              testID="add-take-button"
              style={styles.addTakeButton}
              onPress={() => handleAddTake()}
              activeOpacity={0.8}
            >
              <Text style={styles.addTakeText}>Add Log</Text>
            </TouchableOpacity>
          </View>
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
      
      {/* iOS-style Notification */}
      {notification && (
        <Animated.View
          style={[
            styles.notificationContainer,
            {
              opacity: notificationOpacity,
              transform: [{ translateY: notificationTranslateY }],
            },
          ]}
        >
          <View style={[
            styles.notification,
            notification.type === 'error' ? styles.notificationError : styles.notificationInfo
          ]}>
            <View style={styles.notificationContent}>
              <AlertCircle 
                size={20} 
                color={notification.type === 'error' ? '#DC2626' : '#2563EB'} 
                style={styles.notificationIcon}
              />
              <Text style={[
                styles.notificationText,
                notification.type === 'error' ? styles.notificationTextError : styles.notificationTextInfo
              ]}>
                {notification.message}
              </Text>
            </View>
            <TouchableOpacity onPress={hideNotification} style={styles.notificationClose}>
              <X size={18} color={notification.type === 'error' ? '#DC2626' : '#2563EB'} />
            </TouchableOpacity>
          </View>
        </Animated.View>
      )}
      
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
    padding: 0,
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
  addTakeButton: {
    backgroundColor: '#BDDFEB',
    flex: 1,
    height: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addTakeText: {
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
    gap: 12,
    alignItems: 'center',
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
  notificationContainer: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 100 : 80,
    left: 16,
    right: 16,
    zIndex: 1000,
  },
  notification: {
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  notificationError: {
    backgroundColor: '#FEF2F2',
    borderLeftWidth: 4,
    borderLeftColor: '#DC2626',
  },
  notificationInfo: {
    backgroundColor: '#EFF6FF',
    borderLeftWidth: 4,
    borderLeftColor: '#2563EB',
  },
  notificationContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  notificationIcon: {
    marginRight: 12,
  },
  notificationText: {
    fontSize: 14,
    fontWeight: '500',
    flex: 1,
    lineHeight: 20,
  },
  notificationTextError: {
    color: '#DC2626',
  },
  notificationTextInfo: {
    color: '#2563EB',
  },
  notificationClose: {
    padding: 4,
    marginLeft: 8,
  },
});