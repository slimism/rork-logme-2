import React, { useState, useEffect, useRef } from 'react';
import { View, StyleSheet, ScrollView, Text, TextInput, TouchableOpacity, Alert, KeyboardAvoidingView, Modal, Platform, Keyboard } from 'react-native';
import { useLocalSearchParams, Stack, router } from 'expo-router';
import { ArrowLeft, Camera, Check, X } from 'lucide-react-native';
import { useProjectStore } from '@/store/projectStore';
import { useTokenStore } from '@/store/subscriptionStore';
import { Button } from '@/components/Button';
import { colors } from '@/constants/colors';
import { ClassificationType, ShotDetailsType, TakeData } from '@/types';

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
  const [showWasteModal, setShowWasteModal] = useState<boolean>(false);
  const [wasteOptions, setWasteOptions] = useState<{ camera: boolean; sound: boolean }>({ camera: false, sound: false });
  const [showInsertModal, setShowInsertModal] = useState<boolean>(false);
  const [disabledFields, setDisabledFields] = useState<Set<string>>(new Set());

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

  useEffect(() => {
    setProject(projects.find(p => p.id === projectId));
    
    // Calculate stats
    const projectLogSheets = logSheets.filter(sheet => sheet.projectId === projectId);
    const scenes = new Set(projectLogSheets.map(sheet => sheet.data?.sceneNumber).filter(Boolean));
    
    setStats({
      totalTakes: projectLogSheets.length,
      scenes: scenes.size,
    });
    
    // Auto-fill based on last log entry with smart logic
    if (projectLogSheets.length > 0) {
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
        
        // Auto-increment camera and sound files with 4-digit format (only if not disabled)
        if (lastLog.data?.soundFile && !disabledFields.has('soundFile')) {
          const soundFileValue = lastLog.data.soundFile;
          let nextSoundFileNum = 0;
          
          // Check if it's a range (e.g., "0001-0005")
          if (soundFileValue.includes('-')) {
            const rangeParts = soundFileValue.split('-');
            const endRange = parseInt(rangeParts[1]) || 0;
            nextSoundFileNum = endRange + 1;
          } else {
            nextSoundFileNum = (parseInt(soundFileValue) || 0) + 1;
          }
          
          autoFillData.soundFile = String(nextSoundFileNum).padStart(4, '0');
        }
        
        // Handle camera files based on configuration (only if not disabled)
        if (project?.settings?.cameraConfiguration === 1) {
          if (lastLog.data?.cameraFile && !disabledFields.has('cameraFile')) {
            const cameraFileValue = lastLog.data.cameraFile;
            let nextCameraFileNum = 0;
            
            // Check if it's a range (e.g., "0001-0005")
            if (cameraFileValue.includes('-')) {
              const rangeParts = cameraFileValue.split('-');
              const endRange = parseInt(rangeParts[1]) || 0;
              nextCameraFileNum = endRange + 1;
            } else {
              nextCameraFileNum = (parseInt(cameraFileValue) || 0) + 1;
            }
            
            autoFillData.cameraFile = String(nextCameraFileNum).padStart(4, '0');
          }
        } else {
          // Multiple cameras
          for (let i = 1; i <= (project?.settings?.cameraConfiguration || 1); i++) {
            const fieldId = `cameraFile${i}`;
            if (lastLog.data?.[fieldId] && !disabledFields.has(fieldId)) {
              const cameraFileValue = lastLog.data[fieldId];
              let nextCameraFileNum = 0;
              
              // Check if it's a range (e.g., "0001-0005")
              if (cameraFileValue.includes('-')) {
                const rangeParts = cameraFileValue.split('-');
                const endRange = parseInt(rangeParts[1]) || 0;
                nextCameraFileNum = endRange + 1;
              } else {
                nextCameraFileNum = (parseInt(cameraFileValue) || 0) + 1;
              }
              
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
  }, [projectId, projects, logSheets, project?.settings?.cameraConfiguration, disabledFields]);
  


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
    
    // Update the log sheet with take data including new fields
    logSheet.data = {
      ...takeData,
      classification,
      shotDetails,
      isGoodTake
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
    // For camera and audio files, use previous log values as placeholders
    if (fieldId === 'soundFile' || fieldId.startsWith('cameraFile')) {
      const projectLogSheets = logSheets.filter(sheet => sheet.projectId === projectId);
      if (projectLogSheets.length > 0) {
        const lastLog = projectLogSheets
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
        
        if (lastLog?.data?.[fieldId]) {
          return lastLog.data[fieldId];
        }
      }
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
    
    return (
      <View key={field.id} style={[styles.fieldContainer, style]}>
        <Text style={[styles.fieldLabel, isDisabled && styles.disabledLabel]}>{field.label}</Text>
        <TextInput
          ref={(ref) => { inputRefs.current[field.id] = ref; }}
          style={[
            styles.fieldInput,
            isMultiline && styles.multilineInput,
            isDisabled && styles.disabledInput
          ]}
          value={isDisabled ? '' : value}
          onChangeText={(text) => !isDisabled && updateTakeData(field.id, text)}
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
          title: "Film Logger",
          headerLeft: () => <HeaderLeft />,
          headerBackVisible: false,
        }} 
      />
      
      <ScrollView 
        ref={scrollViewRef}
        style={styles.content} 
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[styles.scrollContent, { paddingBottom: keyboardHeight > 0 ? keyboardHeight + 20 : 20 }]}
      >
        <View style={styles.fieldsSection}>
          {/* Scene, Shot, Take on same row */}
          <View style={styles.rowContainer}>
            {enabledFields.find(f => f.id === 'sceneNumber') && renderField(enabledFields.find(f => f.id === 'sceneNumber'), allFieldIds, styles.thirdWidth)}
            {enabledFields.find(f => f.id === 'shotNumber') && renderField(enabledFields.find(f => f.id === 'shotNumber'), allFieldIds, styles.thirdWidth)}
            {enabledFields.find(f => f.id === 'takeNumber') && renderField(enabledFields.find(f => f.id === 'takeNumber'), allFieldIds, styles.thirdWidth)}
          </View>
          
          {/* Camera file on its own row */}
          {cameraConfiguration === 1 && (
            <View style={styles.fieldContainer}>
              <View style={styles.fieldHeaderRow}>
                <Text style={[styles.fieldLabel, disabledFields.has('cameraFile') && styles.disabledLabel]}>Camera File</Text>
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
                  style={[styles.fieldInput, disabledFields.has('cameraFile') && styles.disabledInput]}
                  value={disabledFields.has('cameraFile') ? '' : (takeData['cameraFile'] || '')}
                  onChangeText={(text) => !disabledFields.has('cameraFile') && updateTakeData('cameraFile', formatFileNumber(text))}
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
          
          {/* Sound file on its own row */}
          {enabledFields.find(f => f.id === 'soundFile') && (
            <View style={styles.fieldContainer}>
              <View style={styles.fieldHeaderRow}>
                <Text style={[styles.fieldLabel, disabledFields.has('soundFile') && styles.disabledLabel]}>Sound File</Text>
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
                  style={[styles.fieldInput, disabledFields.has('soundFile') && styles.disabledInput]}
                  value={disabledFields.has('soundFile') ? '' : (takeData['soundFile'] || '')}
                  onChangeText={(text) => !disabledFields.has('soundFile') && updateTakeData('soundFile', formatFileNumber(text))}
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
                      <Text style={[styles.fieldLabel, isDisabled && styles.disabledLabel]}>{fieldLabel}</Text>
                      <TouchableOpacity 
                        style={[styles.rangeButton, isDisabled && styles.disabledButton]}
                        onPress={() => !isDisabled && toggleRangeMode(fieldId)}
                        disabled={isDisabled}
                      >
                        <Text style={[styles.rangeButtonText, isDisabled && styles.disabledText]}>Range</Text>
                      </TouchableOpacity>
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
                        style={[styles.fieldInput, isDisabled && styles.disabledInput]}
                        value={isDisabled ? '' : (takeData[fieldId] || '')}
                        onChangeText={(text) => !isDisabled && updateTakeData(fieldId, formatFileNumber(text))}
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
          
          {/* Other fields each on their own row */}
          {fieldsToRender
            .filter(field => !['sceneNumber', 'shotNumber', 'takeNumber', 'cameraFile', 'soundFile'].includes(field.id))
            .map(field => renderField(field, allFieldIds))}
          
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
          <Text style={styles.sectionTitle}>Classification</Text>
          <View style={styles.classificationGrid}>
            {(['Waste', 'Insert', 'Ambience', 'SFX'] as ClassificationType[]).map((type) => (
              <TouchableOpacity
                key={type}
                style={[
                  styles.classificationButton,
                  classification === type && styles.classificationButtonActive
                ]}
                onPress={() => handleClassificationChange(type)}
              >
                <Text style={[
                  styles.classificationButtonText,
                  classification === type && styles.classificationButtonTextActive
                ]}>
                  {type}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Shot Details Section */}
        <View style={styles.sectionContainer}>
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
          <View style={styles.addTakeRow}>
            <TouchableOpacity
              style={[
                styles.goodTakeButton,
                isGoodTake && styles.goodTakeButtonActive
              ]}
              onPress={() => setIsGoodTake(!isGoodTake)}
            >
              <Check size={20} color={isGoodTake ? 'white' : colors.success} />
              <Text style={[
                styles.goodTakeButtonText,
                isGoodTake && styles.goodTakeButtonTextActive
              ]}>
                Good Take
              </Text>
            </TouchableOpacity>
            <Button
              title="Add Take"
              onPress={handleAddTake}
              style={styles.addTakeButton}
              icon={<Camera size={20} color="white" />}
            />
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
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f8f8',
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  headerButton: {
    padding: 8,
    marginHorizontal: 8,
  },
  fieldsSection: {
    backgroundColor: 'white',
    padding: 20,
  },
  fieldContainer: {
    marginBottom: 20,
  },
  fieldLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: colors.text,
    marginBottom: 8,
  },
  fieldInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    color: colors.text,
    backgroundColor: 'white',
  },
  multilineInput: {
    height: 80,
    textAlignVertical: 'top',
  },
  addTakeSection: {
    backgroundColor: 'white',
    marginTop: 16,
    padding: 20,
  },
  addTakeButton: {
    backgroundColor: '#2c3e50',
    flex: 1,
    height: 48,
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
    backgroundColor: 'white',
    marginTop: 16,
    padding: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 12,
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
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 6,
    backgroundColor: 'white',
  },
  rangeButtonText: {
    fontSize: 12,
    fontWeight: '500',
    color: colors.primary,
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
  disabledButton: {
    opacity: 0.5,
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
  classificationGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    justifyContent: 'space-between',
  },
  classificationButton: {
    width: '48%',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: 'white',
    alignItems: 'center',
    justifyContent: 'center',
    height: 56,
  },
  classificationButtonActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  classificationButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  classificationButtonTextActive: {
    color: 'white',
  },
  shotDetailsRow: {
    flexDirection: 'row',
    gap: 16,
    justifyContent: 'center',
  },
  shotDetailsButton: {
    paddingHorizontal: 40,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: 'white',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 140,
    height: 56,
  },
  shotDetailsButtonActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  shotDetailsButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
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