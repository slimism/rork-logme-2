import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, Text, Switch, TextInput, TouchableOpacity, Image, Alert, KeyboardAvoidingView, Modal } from 'react-native';
import { Stack, router } from 'expo-router';
import { ArrowLeft, Film, Info, Camera, AlertTriangle } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import { useProjectStore } from '@/store/projectStore';
import { useTokenStore } from '@/store/subscriptionStore';
import { useThemeStore } from '@/store/themeStore';
import { Button } from '@/components/Button';
import { colors } from '@/constants/colors';

interface LogSheetField {
  id: string;
  label: string;
  enabled: boolean;
  required?: boolean;
}

export default function ProjectSettingsScreen() {
  const { addProject } = useProjectStore();
  const tokenStore = useTokenStore();
  const { tokens, canCreateProject } = tokenStore;
  const { darkMode } = useThemeStore();
  const [projectName, setProjectName] = useState('');
  const [projectLogo, setProjectLogo] = useState('');
  const [directorName, setDirectorName] = useState('');
  const [cinematographerName, setCinematographerName] = useState('');
  const [loggerName, setLoggerName] = useState('');
  const [error, setError] = useState('');
  const [cameraConfiguration, setCameraConfiguration] = useState(1);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  
  const [logSheetFields, setLogSheetFields] = useState<LogSheetField[]>([
    { id: 'sceneNumber', label: 'Scene number', enabled: true, required: true },
    { id: 'shotNumber', label: 'Shot number', enabled: true, required: true },
    { id: 'takeNumber', label: 'Take number', enabled: true, required: true },
    { id: 'cameraFile', label: 'Camera file', enabled: true, required: true },
    { id: 'soundFile', label: 'Sound file', enabled: true, required: true },
    { id: 'cardNumber', label: 'Card number', enabled: false },
    { id: 'episodes', label: 'Episodes', enabled: false },
    { id: 'descriptionOfShot', label: 'Take description', enabled: true, required: true },
    { id: 'notesForTake', label: 'Notes', enabled: true },
  ]);

  const [customFields, setCustomFields] = useState<string[]>(['']);

  const toggleField = (fieldId: string) => {
    const field = logSheetFields.find(f => f.id === fieldId);
    if (field?.required) return;

    setLogSheetFields(prev => 
      prev.map(field => 
        field.id === fieldId
          ? { ...field, enabled: !field.enabled }
          : field
      )
    );
  };

  const addCustomField = () => {
    setCustomFields(prev => [...prev, '']);
  };

  const updateCustomField = (index: number, value: string) => {
    setCustomFields(prev => 
      prev.map((field, i) => i === index ? value : field)
    );
  };

  const removeCustomField = (index: number) => {
    setCustomFields(prev => prev.filter((_, i) => i !== index));
  };

  const handleAddLogo = async () => {
    try {
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      
      if (permissionResult.granted === false) {
        Alert.alert('Permission Required', 'Permission to access camera roll is required!');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        setProjectLogo(result.assets[0].uri);
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'Failed to pick image. Please try again.');
    }
  };

  const handleSaveSettings = () => {
    if (!projectName.trim()) {
      setError('Project name is required');
      return;
    }

    if (!loggerName.trim()) {
      setError('Logger name is required');
      return;
    }

    if (!canCreateProject()) {
      Alert.alert(
        'Cannot Create Project',
        'You need tokens or trial logs remaining to create a new project.',
        [{ text: 'OK' }]
      );
      return;
    }

    setShowConfirmModal(true);
  };

  const handleConfirmSave = () => {
    const enabledFields = logSheetFields.filter(field => field.enabled);
    const validCustomFields = customFields.filter(field => field.trim());
    
    const projectSettings = {
      logSheetFields: enabledFields,
      customFields: validCustomFields,
      cameraConfiguration: cameraConfiguration,
      directorName: directorName.trim(),
      cinematographerName: cinematographerName.trim(),
      loggerName: loggerName.trim(),
    };

    // Consume token if user has tokens
    if (tokens > 0) {
      const tokenConsumed = tokenStore.useToken();
      console.log('Token consumed:', tokenConsumed);
    }

    const project = addProject(projectName, projectSettings, projectLogo);
    setShowConfirmModal(false);
    router.replace(`/project/${project.id}`);
  };

  const handleCancelSave = () => {
    setShowConfirmModal(false);
  };

  const HeaderLeft = () => (
    <TouchableOpacity onPress={() => router.back()} style={styles.headerButton}>
      <ArrowLeft size={24} color={darkMode ? '#FFFFFF' : colors.text} />
    </TouchableOpacity>
  );

  return (
    <KeyboardAvoidingView 
      style={[styles.container, darkMode && styles.containerDark]}
      behavior='padding'
    >
      <Stack.Screen 
        options={{
          title: "Project Settings",
          headerLeft: () => <HeaderLeft />,
          headerBackVisible: false,
        }} 
      />
      
      <ScrollView 
        style={[styles.content, darkMode && styles.contentDark]} 
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={[styles.projectHeader, darkMode && styles.projectHeaderDark]}>
          <TouchableOpacity style={styles.iconContainer} onPress={handleAddLogo}>
            {projectLogo ? (
              <Image source={{ uri: projectLogo }} style={styles.projectLogoImage} />
            ) : (
              <>
                <Film size={24} color={colors.primary} />
                <Camera size={16} color={colors.primary} style={[styles.cameraIcon, darkMode && styles.cameraIconDark]} />
              </>
            )}
          </TouchableOpacity>
          <View style={styles.projectInfo}>
            <TextInput
              style={[styles.projectNameInput, darkMode && styles.projectNameInputDark]}
              value={projectName}
              onChangeText={setProjectName}
              placeholder="Enter project name"
              placeholderTextColor={darkMode ? '#9CA3AF' : colors.subtext}
            />
            <TouchableOpacity onPress={handleAddLogo} style={styles.logoButton}>
              <Text style={[styles.logoButtonText, darkMode && styles.logoButtonTextDark]}>
                {projectLogo ? 'Change Logo' : 'Add Logo'}
              </Text>
            </TouchableOpacity>
            {error && <Text style={[styles.errorText, darkMode && styles.errorTextDark]}>{error}</Text>}
          </View>
        </View>

        <View style={[styles.section, darkMode && styles.sectionDark]}>
          <Text style={[styles.sectionTitle, darkMode && styles.sectionTitleDark]}>Project Information</Text>
          <Text style={[styles.sectionSubtitle, darkMode && styles.sectionSubtitleDark]}>
            Add key personnel information that will appear on exported log sheets.
          </Text>
          
          <View style={styles.fieldContainer}>
            <Text style={[styles.fieldLabel, darkMode && styles.fieldLabelDark]}>Director Name (Optional)</Text>
            <TextInput
              style={[styles.textInput, darkMode && styles.textInputDark]}
              value={directorName}
              onChangeText={setDirectorName}
              placeholder="Enter director name"
              placeholderTextColor={darkMode ? '#9CA3AF' : colors.subtext}
            />
          </View>
          
          <View style={styles.fieldContainer}>
            <Text style={[styles.fieldLabel, darkMode && styles.fieldLabelDark]}>Cinematographer Name (Optional)</Text>
            <TextInput
              style={[styles.textInput, darkMode && styles.textInputDark]}
              value={cinematographerName}
              onChangeText={setCinematographerName}
              placeholder="Enter cinematographer name"
              placeholderTextColor={darkMode ? '#9CA3AF' : colors.subtext}
            />
          </View>
          
          <View style={styles.fieldContainer}>
            <Text style={[styles.fieldLabel, darkMode && styles.fieldLabelDark]}>Logger Name (Required) *</Text>
            <TextInput
              style={[styles.textInput, darkMode && styles.textInputDark]}
              value={loggerName}
              onChangeText={setLoggerName}
              placeholder="Enter your name"
              placeholderTextColor={darkMode ? '#9CA3AF' : colors.subtext}
            />
          </View>
        </View>

        <View style={[styles.section, darkMode && styles.sectionDark]}>
          <Text style={[styles.sectionTitle, darkMode && styles.sectionTitleDark]}>Camera Configuration</Text>
          <Text style={[styles.sectionSubtitle, darkMode && styles.sectionSubtitleDark]}>
            Set the number of cameras used. This will create multiple camera file fields for each take.
          </Text>
          
          <View style={[styles.cameraConfigRow, darkMode && styles.cameraConfigRowDark]}>
            <View style={styles.cameraConfigContent}>
              <View style={styles.checkbox}>
                <Text style={styles.checkmark}>✓</Text>
              </View>
              <Text style={[styles.cameraConfigLabel, darkMode && styles.cameraConfigLabelDark]}>Number of cameras used</Text>
            </View>
            <View style={styles.cameraInputContainer}>
              <TextInput
                style={[styles.cameraInput, darkMode && styles.cameraInputDark]}
                value={cameraConfiguration.toString()}
                onChangeText={(text) => {
                  if (text === '') {
                    setCameraConfiguration(1);
                    return;
                  }
                  const num = parseInt(text, 10);
                  if (!isNaN(num) && num >= 1 && num <= 10) {
                    setCameraConfiguration(num);
                  }
                }}
                keyboardType="numeric"
                maxLength={2}
                selectTextOnFocus={true}
              />
              <Text style={[styles.cameraInputLabel, darkMode && styles.cameraInputLabelDark]}>cameras</Text>
            </View>
          </View>

        </View>

        <View style={[styles.section, darkMode && styles.sectionDark]}>
          <Text style={[styles.sectionTitle, darkMode && styles.sectionTitleDark]}>Log Sheet Fields</Text>
          <Text style={[styles.sectionSubtitle, darkMode && styles.sectionSubtitleDark]}>
            Select the fields you want to include in your log sheets. Required fields cannot be disabled.
          </Text>
          
          {logSheetFields.map((field) => (
            <View key={field.id} style={[styles.fieldRow, darkMode && styles.fieldRowDark]}>
              <View style={styles.fieldInfo}>
                <Text style={[
                  styles.switchFieldLabel,
                  field.required && styles.requiredFieldLabel,
                  darkMode && styles.switchFieldLabelDark
                ]}>
                  {field.label}
                  {field.required && ' *'}
                </Text>
              </View>
              <Switch
                value={field.enabled}
                onValueChange={() => toggleField(field.id)}
                trackColor={{ false: colors.border, true: colors.primary + '40' }}
                thumbColor={field.enabled ? colors.primary : '#f4f3f4'}
                disabled={field.required}
              />
            </View>
          ))}
        </View>

        <View style={[styles.section, darkMode && styles.sectionDark]}>
          <Text style={[styles.sectionTitle, darkMode && styles.sectionTitleDark]}>Custom Fields</Text>
          <Text style={[styles.sectionSubtitle, darkMode && styles.sectionSubtitleDark]}>
            Add custom fields specific to your project needs.
          </Text>
          
          {customFields.map((field, index) => (
            <View key={index} style={styles.customFieldRow}>
              <TextInput
                style={[styles.customFieldInput, darkMode && styles.customFieldInputDark]}
                value={field}
                onChangeText={(value) => updateCustomField(index, value)}
                placeholder="Enter custom field name"
                placeholderTextColor={darkMode ? '#9CA3AF' : colors.subtext}
              />
              {customFields.length > 1 && (
                <TouchableOpacity 
                  onPress={() => removeCustomField(index)}
                  style={styles.removeButton}
                >
                  <Text style={[styles.removeButtonText, darkMode && styles.removeButtonTextDark]}>×</Text>
                </TouchableOpacity>
              )}
            </View>
          ))}
          
          <TouchableOpacity onPress={addCustomField} style={styles.addFieldButton}>
            <Text style={[styles.addFieldText, darkMode && styles.addFieldTextDark]}>+ Add Custom Field</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      <View style={[styles.footer, darkMode && styles.footerDark]}>
        <Button
          title="Save Settings"
          onPress={handleSaveSettings}
          style={styles.saveButton}
        />
      </View>

      <Modal
        visible={showConfirmModal}
        transparent
        animationType="fade"
        onRequestClose={handleCancelSave}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, darkMode && styles.modalContentDark]}>
            <View style={styles.modalHeader}>
              <AlertTriangle size={24} color={colors.warning} />
              <Text style={[styles.modalTitle, darkMode && styles.modalTitleDark]}>Confirm Project Settings</Text>
            </View>
            
            <Text style={[styles.modalMessage, darkMode && styles.modalMessageDark]}>
              Once you create this project, you cannot change these settings later. Are you sure you want to proceed?
            </Text>
            
            {tokens > 0 && (
              <View style={[styles.tokenWarning, darkMode && styles.tokenWarningDark]}>
                <Text style={[styles.tokenWarningText, darkMode && styles.tokenWarningTextDark]}>
                  This will consume 1 token from your account.
                </Text>
              </View>
            )}
            
            <View style={styles.modalButtons}>
              <TouchableOpacity 
                style={[styles.modalButton, styles.cancelButton]} 
                onPress={handleCancelSave}
              >
                <Text style={[styles.cancelButtonText, darkMode && styles.cancelButtonTextDark]}>Cancel</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.modalButton, styles.confirmButton]} 
                onPress={handleConfirmSave}
              >
                <Text style={[styles.confirmButtonText, darkMode && styles.confirmButtonTextDark]}>Create Project</Text>
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
  containerDark: {
    backgroundColor: '#1F2937',
  },
  content: {
    flex: 1,
  },
  contentDark: {
    backgroundColor: '#1F2937',
  },
  headerButton: {
    padding: 8,
    marginLeft: 8,
  },
  projectHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  projectHeaderDark: {
    backgroundColor: '#374151',
    borderBottomColor: '#4B5563',
  },
  iconContainer: {
    width: 64,
    height: 64,
    backgroundColor: colors.primary + '20',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
    position: 'relative',
  },
  projectLogoImage: {
    width: 56,
    height: 56,
    borderRadius: 8,
  },
  cameraIcon: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    backgroundColor: 'white',
    borderRadius: 8,
    padding: 2,
  },
  cameraIconDark: {
    backgroundColor: '#374151',
  },
  logoButton: {
    marginTop: 8,
    paddingVertical: 4,
  },
  logoButtonText: {
    fontSize: 14,
    color: colors.primary,
    fontWeight: '500',
  },
  logoButtonTextDark: {
    color: '#60A5FA',
  },
  projectInfo: {
    flex: 1,
  },
  projectNameInput: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.text,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingVertical: 8,
  },
  projectNameInputDark: {
    color: '#FFFFFF',
    borderBottomColor: '#4B5563',
  },
  errorText: {
    color: colors.error,
    fontSize: 14,
    marginTop: 4,
  },
  errorTextDark: {
    color: '#F87171',
  },
  section: {
    backgroundColor: 'white',
    marginTop: 16,
    padding: 20,
  },
  sectionDark: {
    backgroundColor: '#374151',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 8,
  },
  sectionTitleDark: {
    color: '#FFFFFF',
  },
  sectionSubtitle: {
    fontSize: 14,
    color: colors.subtext,
    marginBottom: 20,
    lineHeight: 20,
  },
  sectionSubtitleDark: {
    color: '#D1D5DB',
  },
  cameraConfigRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border + '50',
  },
  cameraConfigRowDark: {
    borderBottomColor: '#4B5563',
  },
  cameraConfigContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  checkbox: {
    width: 20,
    height: 20,
    backgroundColor: colors.primary,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  checkmark: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  cameraConfigLabel: {
    fontSize: 16,
    color: colors.text,
  },
  cameraConfigLabelDark: {
    color: '#FFFFFF',
  },
  cameraInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cameraInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    fontSize: 16,
    color: colors.text,
    backgroundColor: 'white',
    width: 60,
    textAlign: 'center',
  },
  cameraInputDark: {
    backgroundColor: '#4B5563',
    borderColor: '#6B7280',
    color: '#FFFFFF',
  },
  cameraInputLabel: {
    fontSize: 16,
    color: colors.subtext,
  },
  cameraInputLabelDark: {
    color: '#D1D5DB',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: 12,
    gap: 8,
  },
  infoText: {
    fontSize: 14,
    color: colors.subtext,
    flex: 1,
    lineHeight: 18,
  },
  fieldRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border + '50',
  },
  fieldRowDark: {
    borderBottomColor: '#4B5563',
  },
  fieldInfo: {
    flex: 1,
  },
  switchFieldLabel: {
    fontSize: 16,
    color: colors.text,
  },
  switchFieldLabelDark: {
    color: '#FFFFFF',
  },
  requiredFieldLabel: {
    fontWeight: '500',
  },
  customFieldRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  customFieldInput: {
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
  customFieldInputDark: {
    backgroundColor: '#4B5563',
    borderColor: '#6B7280',
    color: '#FFFFFF',
  },
  removeButton: {
    marginLeft: 12,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.error + '20',
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeButtonText: {
    fontSize: 20,
    color: colors.error,
    fontWeight: 'bold',
  },
  removeButtonTextDark: {
    color: '#F87171',
  },
  addFieldButton: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  addFieldText: {
    fontSize: 16,
    color: colors.primary,
    fontWeight: '500',
  },
  addFieldTextDark: {
    color: '#60A5FA',
  },
  footer: {
    backgroundColor: 'white',
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  footerDark: {
    backgroundColor: '#374151',
    borderTopColor: '#4B5563',
  },
  saveButton: {
    backgroundColor: '#2c3e50',
  },
  fieldContainer: {
    marginBottom: 16,
  },
  fieldLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: colors.text,
    marginBottom: 8,
  },
  fieldLabelDark: {
    color: '#FFFFFF',
  },
  textInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    color: colors.text,
    backgroundColor: 'white',
  },
  textInputDark: {
    backgroundColor: '#4B5563',
    borderColor: '#6B7280',
    color: '#FFFFFF',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 24,
    width: '100%',
    maxWidth: 400,
  },
  modalContentDark: {
    backgroundColor: '#374151',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 12,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
    flex: 1,
  },
  modalTitleDark: {
    color: '#FFFFFF',
  },
  modalMessage: {
    fontSize: 16,
    color: colors.text,
    lineHeight: 22,
    marginBottom: 16,
  },
  modalMessageDark: {
    color: '#D1D5DB',
  },
  tokenWarning: {
    backgroundColor: colors.warning + '20',
    padding: 12,
    borderRadius: 8,
    marginBottom: 20,
  },
  tokenWarningDark: {
    backgroundColor: '#92400E20',
  },
  tokenWarningText: {
    fontSize: 14,
    color: colors.warning,
    fontWeight: '500',
    textAlign: 'center',
  },
  tokenWarningTextDark: {
    color: '#FBBF24',
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: colors.border + '40',
  },
  confirmButton: {
    backgroundColor: colors.primary,
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '500',
    color: colors.text,
  },
  cancelButtonTextDark: {
    color: '#FFFFFF',
  },
  confirmButtonText: {
    fontSize: 16,
    fontWeight: '500',
    color: 'white',
  },
  confirmButtonTextDark: {
    color: 'white',
  },
});