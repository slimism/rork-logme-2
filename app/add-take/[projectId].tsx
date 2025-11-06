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
  const { projects, logSheets, addLogSheet, updateTakeNumbers, updateFileNumbers, updateLogSheet, insertNewLogBefore } = useProjectStore();
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

  const getHighestFileNumber = React.useCallback((fieldId: string, projectLogSheets: any[]) => {
    let highestNum = 0;
    
    projectLogSheets.forEach(sheet => {
      if (sheet.data) {
        if (sheet.data[fieldId]) {
          const fileValue = sheet.data[fieldId];
          if (typeof fileValue === 'string') {
            if (fileValue.includes('-')) {
              const rangeParts = fileValue.split('-');
              const endRange = parseInt(rangeParts[1]) || 0;
              highestNum = Math.max(highestNum, endRange);
            } else {
              const num = parseInt(fileValue) || 0;
              highestNum = Math.max(highestNum, num);
            }
          }
        }
        
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

  const computeNextFileNumbers = React.useCallback((projectLogSheets: any[], currentProject: any) => {
    const nextNumbers: { [key: string]: number } = {};
    
    const highestSound = getHighestFileNumber('soundFile', projectLogSheets);
    nextNumbers['soundFile'] = highestSound + 1;
    
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
    const currentProject = projects.find(p => p.id === projectId);
    if (currentProject) {
      const initialRecState: { [key: string]: boolean } = {};
      if ((currentProject.settings?.cameraConfiguration || 1) > 1) {
        for (let i = 1; i <= (currentProject.settings?.cameraConfiguration || 1); i++) {
          initialRecState[`cameraFile${i}`] = true;
        }
        setCameraRecState(initialRecState);
      }
    }
  }, [projectId, projects]);

  const hasAutoFilledRef = useRef(false);

  useEffect(() => {
    const currentProject = projects.find(p => p.id === projectId);
    setProject(currentProject);
    
    const projectLogSheets = logSheets.filter(sheet => sheet.projectId === projectId);
    const scenes = new Set(projectLogSheets.map(sheet => sheet.data?.sceneNumber).filter(Boolean));
    
    setStats({
      totalTakes: projectLogSheets.length,
      scenes: scenes.size,
    });
    
    const shotDescMap: Record<string, string> = {};
    const episodeMap: Record<string, string> = {};
    projectLogSheets.forEach(sheet => {
      if (sheet.data?.sceneNumber && sheet.data?.shotNumber && sheet.data?.descriptionOfShot) {
        const shotKey = `${sheet.data.sceneNumber}_${sheet.data.shotNumber}`;
        shotDescMap[shotKey] = sheet.data.descriptionOfShot;
      }
      if (sheet.data?.sceneNumber && sheet.data?.shotNumber && sheet.data?.episodeNumber) {
        const shotKey = `${sheet.data.sceneNumber}_${sheet.data.shotNumber}`;
        episodeMap[shotKey] = sheet.data.episodeNumber;
      }
    });
    setLastShotDescriptions(shotDescMap);
    setLastEpisodeNumbers(episodeMap);
    
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
        const sortedLogs = projectLogSheets.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        const lastLog = sortedLogs[0];
        const lastValid = sortedLogs.find(s => s.data?.classification !== 'Ambience' && s.data?.classification !== 'SFX');
        
        if (lastLog?.data || lastValid?.data) {
          const autoFillData: TakeData = {};
          
          const baseData = (lastValid?.data ?? lastLog?.data) as any;
          const episodeNumber = baseData?.episodeNumber;
          const sceneNumber = baseData?.sceneNumber;
          const shotNumber = baseData?.shotNumber;
          
          if (episodeNumber) autoFillData.episodeNumber = episodeNumber;
          autoFillData.sceneNumber = sceneNumber ?? '1';
          autoFillData.shotNumber = shotNumber ?? '1';

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
          
          const nextNumbers = computeNextFileNumbers(projectLogSheets, currentProject);
          
          const nextSoundFileNum = nextNumbers['soundFile'];
          autoFillData.soundFile = String(nextSoundFileNum).padStart(4, '0');
          
          if (currentProject?.settings?.cameraConfiguration === 1) {
            const nextCameraFileNum = nextNumbers['cameraFile'];
            autoFillData.cameraFile = String(nextCameraFileNum).padStart(4, '0');
          } else {
            for (let i = 1; i <= (currentProject?.settings?.cameraConfiguration || 1); i++) {
              const fieldId = `cameraFile${i}`;
              const nextCameraFileNum = nextNumbers[fieldId];
              autoFillData[fieldId] = String(nextCameraFileNum).padStart(4, '0');
            }
          }
          
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
      
      if (fieldId === 'sceneNumber') {
        newData.shotNumber = '';
        newData.takeNumber = '1';
        newData.descriptionOfShot = '';
        newData.notesForTake = '';
        project?.settings?.customFields?.forEach((_, index) => {
          newData[`custom_${index}`] = '';
        });
      } else if (fieldId === 'shotNumber') {
        newData.takeNumber = '1';
        if (value && typeof value === 'string') {
          const shotKey = `${newData.sceneNumber || ''}_${value}`;
          const lastDesc = lastShotDescriptions[shotKey];
          const lastEpisode = lastEpisodeNumbers[shotKey];
          if (lastDesc) {
            newData.descriptionOfShot = lastDesc;
          } else {
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
        project?.settings?.customFields?.forEach((_, index) => {
          newData[`custom_${index}`] = '';
        });
      } else if (fieldId === 'descriptionOfShot') {
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

  const isNumberInRange = (number: number, fromValue: string, toValue: string): boolean => {
    const from = parseInt(fromValue) || 0;
    const to = parseInt(toValue) || 0;
    return number >= Math.min(from, to) && number <= Math.max(from, to);
  };

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
                    conflictType
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

    if (takeData.soundFile) {
      const conflict = checkAgainstExistingRanges('soundFile', 'Sound File', takeData.soundFile as string, rangeData['soundFile'] || null);
      if (conflict) return conflict;
    }

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

  const validateMandatoryFields = () => {
    const errors = new Set<string>();
    const missingFields: string[] = [];
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
    
    if (!disabledFields.has('soundFile') && !takeData.soundFile?.trim()) {
      errors.add('soundFile');
      missingFields.push('Sound File');
    }
    
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
    
    if (overrideTakeNumber) {
      setTakeData(prev => ({ ...prev, takeNumber: overrideTakeNumber }));
    }
    
    if (!validateMandatoryFields()) {
      return;
    }

    const generalRangeConflict = findGeneralRangeConflict();
    if (generalRangeConflict) {
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
    
    const takeDup = !skipDuplicateCheck ? findDuplicateTake() : null;
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
              handleAddTake(true, nextTakeNumber);
            },
          },
        ]
      );
      return;
    }
    
    addNewTake(overrideTakeNumber);
  };

  const addNewTake = (overrideTakeNumber?: string) => {
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
    
    let finalTakeData = { ...takeData };
    
    if (overrideTakeNumber) {
      finalTakeData.takeNumber = overrideTakeNumber;
    }
    
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
    
    const pad4 = (v?: string) => (v ? String(parseInt(v, 10) || 0).padStart(4, '0') : '');
    const applyRangePersistence = (data: Record<string, any>) => {
      const out: Record<string, any> = { ...data };
      const handleField = (fieldId: string, enabled: boolean, idx?: number) => {
        const r = rangeData[fieldId];
        const inRange = showRangeMode[fieldId] === true;
        
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
        
        if (!enabled) {
          if (inRange && r && r.from && r.to) {
            if (fieldId === 'soundFile') {
              out['sound_from'] = pad4(r.from);
              out['sound_to'] = pad4(r.to);
            } else if (idx != null) {
              out[`camera${idx}_from`] = pad4(r.from);
              out[`camera${idx}_to`] = pad4(r.to);
            }
          }
          return;
        }
        
        if (inRange && r && r.from && r.to) {
          if (fieldId === 'soundFile') {
            out['sound_from'] = pad4(r.from);
            out['sound_to'] = pad4(r.to);
          } else if (idx != null) {
            out[`camera${idx}_from`] = pad4(r.from);
            out[`camera${idx}_to`] = pad4(r.to);
          }
        } else if (!inRange) {
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
    
    logSheet.data = {
      ...finalTakeData,
      classification,
      shotDetails,
      isGoodTake,
      wasteOptions: classification === 'Waste' ? JSON.stringify(wasteOptions) : '',
      insertSoundSpeed: classification === 'Insert' ? (insertSoundSpeed?.toString() || '') : '',
      cameraRecState: cameraConfiguration > 1 ? cameraRecState : undefined
    };
    
    try { updateLogSheet(logSheet.id, logSheet.data); } catch {}
    
    router.back();
  };

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
                  Scene
                </Text>
                <Input
                  ref={(ref) => { inputRefs.current['sceneNumber'] = ref; }}
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
                  editable={!disabledFields.has('sceneNumber')}
                  onSubmitEditing={() => !disabledFields.has('sceneNumber') && focusNextField('sceneNumber', allFieldIds)}
                  onFocus={(event) => {
                    const target: any = undefined;
                    setTimeout(() => {
                      target?.measure?.((x: number, y: number, width: number, height: number, pageX: number, pageY: number) => {
                        if (scrollViewRef.current) {
                          scrollViewRef.current.scrollTo({ y: pageY - 100, animated: true });
                        }
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
                <Input
                  ref={(ref) => { inputRefs.current['shotNumber'] = ref; }}
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
                  disabledFields.has('takeNumber') && styles.disabledLabel
                ]}>
                  Take
                </Text>
                <Input
                  ref={(ref) => { inputRefs.current['takeNumber'] = ref; }}
                  value={disabledFields.has('takeNumber') ? '' : (takeData.takeNumber || '')}
                  onChangeText={(text) => updateTakeData('takeNumber', text)}
                  placeholder=""
                  placeholderTextColor={colors.subtext}
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

          {/* Classification */}
          <View style={styles.classificationRow}>
            <TouchableOpacity
              style={[
                styles.classificationTab,
                classification === 'Regular' && styles.classificationTabActive
              ]}
              onPress={() => setClassification('Regular')}
            >
              <Text style={[
                styles.classificationTabText,
                classification === 'Regular' && styles.classificationTabTextActive
              ]}>
                Regular
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.classificationTab,
                classification === 'Waste' && styles.classificationTabActive
              ]}
              onPress={() => setClassification('Waste')}
            >
              <Text style={[
                styles.classificationTabText,
                classification === 'Waste' && styles.classificationTabTextActive
              ]}>
                Waste
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.classificationTab,
                classification === 'Insert' && styles.classificationTabActive
              ]}
              onPress={() => setClassification('Insert')}
            >
              <Text style={[
                styles.classificationTabText,
                classification === 'Insert' && styles.classificationTabTextActive
              ]}>
                Insert
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.classificationTab,
                classification === 'Ambience' && styles.classificationTabActive
              ]}
              onPress={() => setClassification('Ambience')}
            >
              <Text style={[
                styles.classificationTabText,
                classification === 'Ambience' && styles.classificationTabTextActive
              ]}>
                Ambience
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.classificationTab,
                classification === 'SFX' && styles.classificationTabActive
              ]}
              onPress={() => setClassification('SFX')}
            >
              <Text style={[
                styles.classificationTabText,
                classification === 'SFX' && styles.classificationTabTextActive
              ]}>
                SFX
              </Text>
            </TouchableOpacity>
          </View>

          {/* Sound File */}
          {enabledFields.find(f => f.id === 'soundFile') && (
            <View style={styles.fieldContainer}>
              <Text style={[
                styles.fieldLabel,
                disabledFields.has('soundFile') && styles.disabledLabel,
                validationErrors.has('soundFile') && styles.errorLabel
              ]}>
                Sound File{!disabledFields.has('soundFile') && <Text style={styles.asterisk}> *</Text>}
              </Text>
              <Input
                ref={(ref) => { inputRefs.current['soundFile'] = ref; }}
                value={disabledFields.has('soundFile') ? '' : (takeData.soundFile || '')}
                onChangeText={(text) => {
                  updateTakeData('soundFile', text);
                  if (validationErrors.has('soundFile')) {
                    setValidationErrors(prev => {
                      const newErrors = new Set(prev);
                      newErrors.delete('soundFile');
                      return newErrors;
                    });
                  }
                }}
                placeholder=""
                placeholderTextColor={colors.subtext}
                returnKeyType="next"
                editable={!disabledFields.has('soundFile')}
                onSubmitEditing={() => !disabledFields.has('soundFile') && focusNextField('soundFile', allFieldIds)}
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

          {/* Camera File(s) */}
          {cameraConfiguration === 1 ? (
            enabledFields.find(f => f.id === 'cameraFile') && (
              <View style={styles.fieldContainer}>
                <Text style={[
                  styles.fieldLabel,
                  disabledFields.has('cameraFile') && styles.disabledLabel,
                  validationErrors.has('cameraFile') && styles.errorLabel
                ]}>
                  Camera File{!disabledFields.has('cameraFile') && <Text style={styles.asterisk}> *</Text>}
                </Text>
                <Input
                  ref={(ref) => { inputRefs.current['cameraFile'] = ref; }}
                  value={disabledFields.has('cameraFile') ? '' : (takeData.cameraFile || '')}
                  onChangeText={(text) => {
                    updateTakeData('cameraFile', text);
                    if (validationErrors.has('cameraFile')) {
                      setValidationErrors(prev => {
                        const newErrors = new Set(prev);
                        newErrors.delete('cameraFile');
                        return newErrors;
                      });
                    }
                  }}
                  placeholder=""
                  placeholderTextColor={colors.subtext}
                  returnKeyType="next"
                  editable={!disabledFields.has('cameraFile')}
                  onSubmitEditing={() => !disabledFields.has('cameraFile') && focusNextField('cameraFile', allFieldIds)}
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
            )
          ) : (
            Array.from({ length: cameraConfiguration }, (_, i) => i + 1).map((cameraNum) => {
              const fieldId = `cameraFile${cameraNum}`;
              const isRecActive = cameraRecState[fieldId] ?? true;
              if (!enabledFields.find(f => f.id === fieldId) || !isRecActive) return null;
              
              return (
                <View key={fieldId} style={styles.fieldContainer}>
                  <Text style={[
                    styles.fieldLabel,
                    disabledFields.has(fieldId) && styles.disabledLabel,
                    validationErrors.has(fieldId) && styles.errorLabel
                  ]}>
                    Camera File {cameraNum}{!disabledFields.has(fieldId) && <Text style={styles.asterisk}> *</Text>}
                  </Text>
                  <Input
                    ref={(ref) => { inputRefs.current[fieldId] = ref; }}
                    value={disabledFields.has(fieldId) ? '' : (takeData[fieldId] || '')}
                    onChangeText={(text) => {
                      updateTakeData(fieldId, text);
                      if (validationErrors.has(fieldId)) {
                        setValidationErrors(prev => {
                          const newErrors = new Set(prev);
                          newErrors.delete(fieldId);
                          return newErrors;
                        });
                      }
                    }}
                    placeholder=""
                    placeholderTextColor={colors.subtext}
                    returnKeyType="next"
                    editable={!disabledFields.has(fieldId)}
                    onSubmitEditing={() => !disabledFields.has(fieldId) && focusNextField(fieldId, allFieldIds)}
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
              );
            })
          )}

          {/* Add Button */}
          <Button
            title="Add Log"
            onPress={() => handleAddTake()}
            style={styles.addButton}
          />
        </View>
      </ScrollView>
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
