import React, { useState, useEffect } from 'react';
import { View, Text, Alert } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { useProjectStore } from '@/store/projectStore';
import { DuplicateHandlerService, DuplicateHandlingParams } from '@/services/duplicateHandlerService';
import { LogSheet, Project } from '@/types';

export default function EditTakeScreenRefactored() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { logSheets, updateLogSheet, updateTakeNumbers, updateFileNumbers } = useProjectStore();
  
  const [logSheet, setLogSheet] = useState<LogSheet | null>(null);
  const [project, setProject] = useState<Project | null>(null);
  const [takeData, setTakeData] = useState<any>({});
  const [rangeData, setRangeData] = useState<any>({});
  const [showRangeMode, setShowRangeMode] = useState<any>({});
  const [cameraRecState, setCameraRecState] = useState<any>({});
  const [disabledFields, setDisabledFields] = useState<Set<string>>(new Set());
  const [classification, setClassification] = useState<string>('');
  const [shotDetails, setShotDetails] = useState<string[]>([]);
  const [isGoodTake, setIsGoodTake] = useState<boolean>(false);
  const [wasteOptions, setWasteOptions] = useState<any>(null);
  const [insertSoundSpeed, setInsertSoundSpeed] = useState<number | null>(null);

  useEffect(() => {
    // Initialize log sheet and project data
    const currentLogSheet = logSheets.find(sheet => sheet.id === id);
    if (currentLogSheet) {
      setLogSheet(currentLogSheet);
      setTakeData(currentLogSheet.data || {});
      
      // Find the project
      const currentProject = useProjectStore.getState().projects.find(p => p.id === currentLogSheet.projectId);
      if (currentProject) {
        setProject(currentProject);
      }
    }
  }, [id, logSheets]);

  const handleSaveTake = async () => {
    if (!logSheet || !project) return;

    // Create duplicate handler service
    const duplicateHandlerParams: DuplicateHandlingParams = {
      logSheet,
      project,
      takeData,
      rangeData,
      showRangeMode,
      cameraRecState,
      disabledFields,
      classification,
      shotDetails,
      isGoodTake,
      wasteOptions,
      insertSoundSpeed,
      updateTakeNumbers,
      updateLogSheet,
      router
    };

    const duplicateHandler = new DuplicateHandlerService(duplicateHandlerParams);

    // Check for duplicates and handle them
    const hasDuplicates = await duplicateHandler.checkAndHandleDuplicates(logSheets);
    
    if (hasDuplicates) {
      return; // Duplicate handling is in progress
    }

    // No duplicates, save normally
    saveNormally();
  };

  const saveNormally = () => {
    if (!logSheet) return;

    // Apply range persistence
    const finalTakeData = applyRangePersistence(takeData);

    // Update the log sheet
    const updatedData = {
      ...finalTakeData,
      classification,
      shotDetails,
      isGoodTake,
      wasteOptions: classification === 'Waste' ? JSON.stringify(wasteOptions) : '',
      insertSoundSpeed: classification === 'Insert' ? (insertSoundSpeed?.toString() || '') : '',
      cameraRecState: project?.settings?.cameraConfiguration > 1 ? cameraRecState : undefined
    };

    updateLogSheet(logSheet.id, updatedData);
    router.back();
  };

  const applyRangePersistence = (data: Record<string, any>): Record<string, any> => {
    // Implementation for range persistence
    // This would contain the logic for applying range data
    return data;
  };

  return (
    <View>
      <Text>Refactored Edit Take Screen</Text>
      {/* Your existing UI components would go here */}
    </View>
  );
}
