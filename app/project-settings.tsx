import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, Text, Switch, TextInput, TouchableOpacity, Image, Alert, KeyboardAvoidingView, Modal } from 'react-native';
import { Stack, router } from 'expo-router';
import { ArrowLeft, Film, Camera, AlertTriangle } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import { useProjectStore } from '@/store/projectStore';
import { useTokenStore } from '@/store/subscriptionStore';

import { Button } from '@/components/Button';
import { useColors } from '@/constants/colors';

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

  const colors = useColors();
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
      <ArrowLeft size={24} color={colors.text} />
    </TouchableOpacity>
  );

  const styles = createStyles(colors);

  return (
    <KeyboardAvoidingView 
      style={styles.container}
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
        style={styles.content} 
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.projectHeader}>
          <TouchableOpacity style={styles.iconContainer} onPress={handleAddLogo}>
            {projectLogo ? (
              <Image source={{ uri: projectLogo }} style={styles.projectLogoImage} />
            ) : (
              <>
                <Film size={24} color={colors.primary} />
                <Camera size={16} color={colors.primary} style={styles.cameraIcon} />
              </>
            )}
          </TouchableOpacity>
          <View style={styles.projectInfo}>
            <TextInput
              style={styles.projectNameInput}
              value={projectName}
              onChangeText={setProjectName}
              placeholder="Enter project name"
              placeholderTextColor={colors.subtext}
            />
            <TouchableOpacity onPress={handleAddLogo} style={styles.logoButton}>
              <Text style={styles.logoButtonText}>
                {projectLogo ? 'Change Logo' : 'Add Logo'}
              </Text>
            </TouchableOpacity>
            {error && <Text style={styles.errorText}>{error}</Text>}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Project Information</Text>
          <Text style={styles.sectionSubtitle}>
            Add key personnel information that will appear on exported log sheets.
          </Text>
          
          <View style={styles.fieldContainer}>
            <Text style={styles.fieldLabel}>Director Name (Optional)</Text>
            <TextInput
              style={styles.textInput}
              value={directorName}
              onChangeText={setDirectorName}
              placeholder="Enter director name"
              placeholderTextColor={colors.subtext}
            />
          </View>
          
          <View style={styles.fieldContainer}>
            <Text style={styles.fieldLabel}>Cinematographer Name (Optional)</Text>
            <TextInput
              style={styles.textInput}
              value={cinematographerName}
              onChangeText={setCinematographerName}
              placeholder="Enter cinematographer name"
              placeholderTextColor={colors.subtext}
            />
          </View>
          
          <View style={styles.fieldContainer}>
            <Text style={styles.fieldLabel}>Logger Name (Required) *</Text>
            <TextInput
              style={styles.textInput}
              value={loggerName}
              onChangeText={setLoggerName}
              placeholder="Enter your name"
              placeholderTextColor={colors.subtext}
            />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Camera Configuration</Text>
          <Text style={styles.sectionSubtitle}>
            Set the number of cameras used. This will create multiple camera file fields for each take.
          </Text>
          
          <View style={styles.cameraConfigRow}>
            <View style={styles.cameraConfigContent}>
              <View style={styles.checkbox}>
                <Text style={styles.checkmark}>✓</Text>
              </View>
              <Text style={styles.cameraConfigLabel}>Number of cameras used</Text>
            </View>
            <View style={styles.cameraInputContainer}>
              <TextInput
                style={styles.cameraInput}
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
              <Text style={styles.cameraInputLabel}>cameras</Text>
            </View>
          </View>

        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Log Sheet Fields</Text>
          <Text style={styles.sectionSubtitle}>
            Select the fields you want to include in your log sheets. Required fields cannot be disabled.
          </Text>
          
          {logSheetFields.map((field) => (
            <View key={field.id} style={styles.fieldRow}>
              <View style={styles.fieldInfo}>
                <Text style={[
                  styles.switchFieldLabel,
                  field.required && styles.requiredFieldLabel
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

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Custom Fields</Text>
          <Text style={styles.sectionSubtitle}>
            Add custom fields specific to your project needs.
          </Text>
          
          {customFields.map((field, index) => (
            <View key={index} style={styles.customFieldRow}>
              <TextInput
                style={styles.customFieldInput}
                value={field}
                onChangeText={(value) => updateCustomField(index, value)}
                placeholder="Enter custom field name"
                placeholderTextColor={colors.subtext}
              />
              {customFields.length > 1 && (
                <TouchableOpacity 
                  onPress={() => removeCustomField(index)}
                  style={styles.removeButton}
                >
                  <Text style={styles.removeButtonText}>×</Text>
                </TouchableOpacity>
              )}
            </View>
          ))}
          
          <TouchableOpacity onPress={addCustomField} style={styles.addFieldButton}>
            <Text style={styles.addFieldText}>+ Add Custom Field</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      <View style={styles.footer}>
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
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <AlertTriangle size={24} color={colors.warning} />
              <Text style={styles.modalTitle}>Confirm Project Settings</Text>
            </View>
            
            <Text style={styles.modalMessage}>
              Once you create this project, you cannot change these settings later. Are you sure you want to proceed?
            </Text>
            
            {tokens > 0 && (
              <View style={styles.tokenWarning}>
                <Text style={styles.tokenWarningText}>
                  This will consume 1 token from your account.
                </Text>
              </View>
            )}
            
            <View style={styles.modalButtons}>
              <TouchableOpacity 
                style={[styles.modalButton, styles.cancelButton]} 
                onPress={handleCancelSave}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.modalButton, styles.confirmButton]} 
                onPress={handleConfirmSave}
              >
                <Text style={styles.confirmButtonText}>Create Project</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const createStyles = (colors: ReturnType<typeof useColors>) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.cardSecondary,
  },
  content: {
    flex: 1,
  },
  headerButton: {
    padding: 8,
    marginLeft: 8,
  },
  projectHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
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
    backgroundColor: colors.card,
    borderRadius: 8,
    padding: 2,
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
  errorText: {
    color: colors.error,
    fontSize: 14,
    marginTop: 4,
  },
  section: {
    backgroundColor: colors.card,
    marginTop: 16,
    padding: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 8,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: colors.subtext,
    marginBottom: 20,
    lineHeight: 20,
  },
  cameraConfigRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border + '50',
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
    backgroundColor: colors.inputBackground,
    width: 60,
    textAlign: 'center',
  },
  cameraInputLabel: {
    fontSize: 16,
    color: colors.subtext,
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
  fieldInfo: {
    flex: 1,
  },
  switchFieldLabel: {
    fontSize: 16,
    color: colors.text,
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
    backgroundColor: colors.inputBackground,
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
  addFieldButton: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  addFieldText: {
    fontSize: 16,
    color: colors.primary,
    fontWeight: '500',
  },
  footer: {
    backgroundColor: colors.card,
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: colors.border,
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
  textInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    color: colors.text,
    backgroundColor: colors.inputBackground,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: colors.modalBackground,
    borderRadius: 12,
    padding: 24,
    width: '100%',
    maxWidth: 400,
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
  modalMessage: {
    fontSize: 16,
    color: colors.text,
    lineHeight: 22,
    marginBottom: 16,
  },
  tokenWarning: {
    backgroundColor: colors.warning + '20',
    padding: 12,
    borderRadius: 8,
    marginBottom: 20,
  },
  tokenWarningText: {
    fontSize: 14,
    color: colors.warning,
    fontWeight: '500',
    textAlign: 'center',
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
  confirmButtonText: {
    fontSize: 16,
    fontWeight: '500',
    color: 'white',
  },
});