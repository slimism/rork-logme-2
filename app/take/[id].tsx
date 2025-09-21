import React, { useState, useEffect, useRef } from 'react';
import { View, StyleSheet, ScrollView, Text, TextInput, Alert, Modal, TouchableOpacity, KeyboardAvoidingView, Platform, Keyboard } from 'react-native';
import { useLocalSearchParams, Stack, router } from 'expo-router';
import { ArrowLeft, Save, Check } from 'lucide-react-native';
import { useProjectStore } from '@/store/projectStore';
import { Button } from '@/components/Button';
import { colors } from '@/constants/colors';
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
  const [duplicateMessage, setDuplicateMessage] = useState('');
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
      <ArrowLeft size={24} color={colors.text} />
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

  // Helper function to check for duplicate file numbers
  const checkForDuplicateFiles = () => {
    if (!logSheet) return [];
    
    const projectLogSheets = logSheets.filter(sheet => 
      sheet.projectId === logSheet.projectId && sheet.id !== logSheet.id // Exclude current take
    );
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

  const checkForDuplicateTake = () => {
    if (!logSheet) return false;
    
    const sceneNumber = takeData.sceneNumber;
    const shotNumber = takeData.shotNumber;
    const takeNumber = takeData.takeNumber;
    
    // Only check for duplicates if we have scene, shot, and take numbers
    if (!sceneNumber || !shotNumber || !takeNumber) {
      return false;
    }
    
    // Check if there's another take with the same scene, shot, and take number (excluding current take)
    const duplicateTake = logSheets.find(sheet => 
      sheet.id !== logSheet.id && // Exclude current take
      sheet.projectId === logSheet.projectId &&
      sheet.data?.sceneNumber === sceneNumber &&
      sheet.data?.shotNumber === shotNumber &&
      sheet.data?.takeNumber === takeNumber
    );
    
    return duplicateTake;
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
    const duplicateTake = checkForDuplicateTake();
    if (duplicateTake) {
      console.log('Duplicate take detected:', {
        current: { scene: takeData.sceneNumber, shot: takeData.shotNumber, take: takeData.takeNumber },
        duplicate: { scene: duplicateTake.data?.sceneNumber, shot: duplicateTake.data?.shotNumber, take: duplicateTake.data?.takeNumber }
      });
      
      Toast.show({
        type: 'error',
        text1: 'Duplicate Take',
        text2: `Scene ${takeData.sceneNumber}, Shot ${takeData.shotNumber}, Take ${takeData.takeNumber} already exists`,
        position: 'top',
        visibilityTime: 4000,
      });
      return;
    }
    
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
              hasError && styles.errorInput
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
            hasError && styles.errorInput
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
                style={[styles.fieldInput, styles.rangeInput, isDisabled && styles.disabledInput]}
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
                style={[styles.fieldInput, styles.rangeInput, isDisabled && styles.disabledInput]}
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
                validationErrors.has(fieldId) && styles.errorInput
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

  // Filter out camera file field since we handle it separately, and notes field to put it last
  const fieldsToRender = enabledFields.filter((field: FieldType) => field.id !== 'cameraFile' && field.id !== 'notesForTake');
  const notesField = enabledFields.find((field: FieldType) => field.id === 'notesForTake');
  
  // Build ordered field list for navigation
  const allFieldIds: string[] = [];
  fieldsToRender.forEach((field: FieldType) => allFieldIds.push(field.id));
  
  // Add camera fields
  for (let i = 1; i <= cameraConfiguration; i++) {
    const fieldId = cameraConfiguration === 1 ? 'cameraFile' : `cameraFile${i}`;
    allFieldIds.push(fieldId);
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
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      <Stack.Screen 
        options={{
          title: "Edit Take",
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
        <View style={styles.takeInfo}>
          <Text style={styles.takeTitle}>
            Scene {takeData.sceneNumber || 'Unknown'} - Shot {takeData.shotNumber || 'Unknown'}
          </Text>
          <Text style={styles.takeSubtitle}>
            Created: {new Date(logSheet.createdAt).toLocaleDateString()}
          </Text>
          <Text style={styles.takeSubtitle}>
            Last Updated: {new Date(logSheet.updatedAt).toLocaleDateString()}
          </Text>
        </View>

        <View style={styles.fieldsSection}>
          {/* Scene, Shot, Take on same row */}
          <View style={styles.rowContainer}>
            {enabledFields.find((field: FieldType) => field.id === 'sceneNumber') && (
              <View style={styles.thirdWidth}>
                <Text style={[styles.fieldLabel, validationErrors.has('sceneNumber') && styles.errorLabel]}>
                  Scene<Text style={styles.asterisk}> *</Text>
                </Text>
                <TextInput
                  style={[
                    styles.fieldInput, 
                    disabledFields.has('sceneNumber') && styles.disabledInput,
                    validationErrors.has('sceneNumber') && styles.errorInput
                  ]}
                  value={disabledFields.has('sceneNumber') ? '' : (takeData.sceneNumber || '')}
                  onChangeText={(text) => updateTakeData('sceneNumber', text)}
                  placeholder={disabledFields.has('sceneNumber') ? '' : 'Enter scene'}
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
              <View style={styles.thirdWidth}>
                <Text style={[
                  styles.fieldLabel, 
                  disabledFields.has('shotNumber') && styles.disabledLabel,
                  validationErrors.has('shotNumber') && styles.errorLabel
                ]}>
                  Shot<Text style={styles.asterisk}> *</Text>
                </Text>
                <TextInput
                  style={[
                    styles.fieldInput, 
                    disabledFields.has('shotNumber') && styles.disabledInput,
                    validationErrors.has('shotNumber') && styles.errorInput
                  ]}
                  value={disabledFields.has('shotNumber') ? '' : (takeData.shotNumber || '')}
                  onChangeText={(text) => updateTakeData('shotNumber', text)}
                  placeholder={disabledFields.has('shotNumber') ? '' : 'Enter shot'}
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
              <View style={styles.thirdWidth}>
                <Text style={[
                  styles.fieldLabel, 
                  disabledFields.has('takeNumber') && styles.disabledLabel,
                  validationErrors.has('takeNumber') && styles.errorLabel
                ]}>Take</Text>
                <TextInput
                  style={[
                    styles.fieldInput, 
                    disabledFields.has('takeNumber') && styles.disabledInput,
                    validationErrors.has('takeNumber') && styles.errorInput
                  ]}
                  value={disabledFields.has('takeNumber') ? '' : (takeData.takeNumber || '')}
                  onChangeText={(text) => updateTakeData('takeNumber', text)}
                  placeholder={disabledFields.has('takeNumber') ? '' : 'Enter take'}
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
          
          {/* Camera files */}
          {renderCameraFields(cameraConfiguration, allFieldIds)}
          
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
              title="Save Changes"
              onPress={handleSaveTake}
              style={styles.saveButton}
              icon={<Save size={20} color="white" />}
            />
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
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Select Waste Options</Text>
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
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.modalButton}
                onPress={() => {
                  setShowWasteModal(false);
                  setClassification(null);
                  setWasteOptions({ camera: false, sound: false });
                }}
              >
                <Text style={styles.modalButtonText}>Cancel</Text>
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
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Did sound speed in this shot?</Text>
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

      {/* Duplicate Take Modal */}
      <Modal
        visible={showDuplicateModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowDuplicateModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Duplicate Take Detected</Text>
            <Text style={styles.modalDescription}>{duplicateMessage}</Text>
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonPrimary]}
                onPress={() => setShowDuplicateModal(false)}
              >
                <Text style={[styles.modalButtonText, styles.modalButtonTextPrimary]}>OK</Text>
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
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorText: {
    fontSize: 18,
    color: colors.subtext,
  },
  takeInfo: {
    backgroundColor: 'white',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  takeTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 8,
  },
  takeSubtitle: {
    fontSize: 14,
    color: colors.subtext,
    marginBottom: 4,
  },

  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.subtext,
    marginBottom: 12,
    letterSpacing: 0.5,
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
  fieldsSection: {
    backgroundColor: 'white',
    marginTop: 16,
    padding: 20,
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
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    color: colors.text,
    backgroundColor: 'white',
  },
  rangeSeparator: {
    fontSize: 16,
    color: colors.text,
  },
  rangeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'white',
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
  saveButton: {
    backgroundColor: '#2c3e50',
    flex: 1,
    height: 48,
  },
  classificationRow: {
    flexDirection: 'row',
    gap: 12,
    flexWrap: 'wrap',
  },
  classificationTab: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    height: 44,
    minWidth: 80,
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
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 20,
  },
  modalDescription: {
    fontSize: 16,
    color: colors.text,
    marginBottom: 20,
    lineHeight: 22,
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
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: 'white',
  },
  rangeButtonText: {
    fontSize: 12,
    fontWeight: '500',
    color: colors.primary,
  },
  disabledButton: {
    opacity: 0.5,
    borderColor: colors.border,
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
  sectionContainer: {
    backgroundColor: 'white',
    marginTop: 16,
    padding: 20,
  },
  buttonRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  addTakeSection: {
    backgroundColor: 'white',
    marginTop: 16,
    padding: 20,
    marginBottom: 20,
  },
  addTakeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
});