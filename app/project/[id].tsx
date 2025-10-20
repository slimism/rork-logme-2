import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Text, TouchableOpacity, Alert, ScrollView, Modal, TextInput } from 'react-native';
import { useLocalSearchParams, Stack, router } from 'expo-router';
import { Plus, ArrowLeft, Share, Check, SlidersHorizontal, X, Search, FileText } from 'lucide-react-native';
import { useProjectStore } from '@/store/projectStore';
import { useThemeStore } from '@/store/themeStore';
import { useTokenStore } from '@/store/subscriptionStore';
import { Button } from '@/components/Button';
import { EmptyState } from '@/components/EmptyState';

import { colors } from '@/constants/colors';
import { exportProjectToPDF } from '@/utils/pdfExport';
import { ClassificationType } from '@/types';
import { consoleLogger } from '@/utils/consoleLogger';

export default function ProjectScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { projects, logSheets } = useProjectStore();
  const { darkMode } = useThemeStore();
  const { isTrialProject, isProjectUnlocked, consumeTokenForProject, tokens } = useTokenStore();

  
  const [project, setProject] = useState(projects.find(p => p.id === id));
  const [projectLogSheets, setProjectLogSheets] = useState(logSheets.filter(l => l.projectId === id));


  const [isExporting, setIsExporting] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [isExportingLogs, setIsExportingLogs] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({
    scene: '',
    shot: '',
    take: '',
    episode: '',
    classification: null as ClassificationType | null,
    goodTakesOnly: false
  });
  const [sceneFilterInput, setSceneFilterInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    setProject(projects.find(p => p.id === id));
    const sheets = logSheets.filter(l => l.projectId === id);
    console.log('DEBUG ProjectScreen useEffect - Updating log sheets:', {
      projectId: id,
      sheetCount: sheets.length,
      firstSheet: sheets[0] ? {
        id: sheets[0].id,
        camera1_from: sheets[0].data?.camera1_from,
        camera1_to: sheets[0].data?.camera1_to,
        cameraFile: sheets[0].data?.cameraFile,
        classification: sheets[0].data?.classification
      } : null
    });
    setProjectLogSheets(sheets);
  }, [id, projects, logSheets]);

  const HeaderLeft = () => (
    <TouchableOpacity onPress={() => router.back()} style={styles.headerButton}>
      <ArrowLeft size={24} color={darkMode ? '#f2f2f2' : colors.text} />
    </TouchableOpacity>
  );

  const HeaderRight = () => {
    const showConsumeToken = id && isTrialProject(id) && !isProjectUnlocked(id);
    
    return (
      <View style={styles.headerRightContainer}>
        {showConsumeToken && (
          <TouchableOpacity 
            onPress={handleConsumeToken} 
            style={[styles.consumeTokenButton, darkMode && styles.consumeTokenButtonDark]}
          >
            <Text style={styles.consumeTokenText}>Unlock</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity onPress={handleExportLogs} style={styles.exportButton} disabled={isExportingLogs}>
          <FileText size={20} color={isExportingLogs ? colors.subtext : colors.primary} />
        </TouchableOpacity>
        <TouchableOpacity onPress={handleExportPDF} style={styles.exportButton} disabled={isExporting}>
          <Share size={20} color={isExporting ? colors.subtext : colors.primary} />
        </TouchableOpacity>
      </View>
    );
  };

  const handleConsumeToken = () => {
    if (!id) return;
    
    if (tokens === 0) {
      router.push('/(tabs)/store');
      return;
    }
    
    Alert.alert(
      'Unlock Project',
      'Use 1 token to unlock unlimited logs for this project?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Unlock',
          onPress: () => {
            const success = consumeTokenForProject(id);
            if (success) {
              Alert.alert('Success', 'Project unlocked! You can now add unlimited logs.');
            } else {
              Alert.alert('Error', 'Failed to unlock project. Please try again.');
            }
          }
        }
      ]
    );
  };

  const handleExportPDF = () => {
    if (!project) return;
    setShowExportModal(true);
  };

  const handleExportConfirm = async (isSmartExport: boolean) => {
    if (!project) return;
    
    setIsExporting(true);
    setShowExportModal(false);
    
    try {
      const success = await exportProjectToPDF(project, projectLogSheets, isSmartExport);
      if (!success) {
        Alert.alert('Error', 'Failed to export project. Please try again.');
      }
    } catch {
      Alert.alert('Error', 'Failed to export project. Please try again.');
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportLogs = async () => {
    setIsExportingLogs(true);
    try {
      const success = await consoleLogger.exportLogs();
      if (!success) {
        Alert.alert('Error', 'Failed to export console logs. Please try again.');
      } else {
        Alert.alert('Success', 'Console logs exported successfully!');
      }
    } catch {
      Alert.alert('Error', 'Failed to export console logs. Please try again.');
    } finally {
      setIsExportingLogs(false);
    }
  };



  // Get recently created logs (2 most recent)
  const recentlyCreatedLogs = React.useMemo(() => {
    if (projectLogSheets.length === 0) return [];
    
    // Sort by creation date (most recent first) and take the first 2
    return [...projectLogSheets]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 2);
  }, [projectLogSheets]);

  // Split sheets into regular (scene/shot/take) and Ambience + SFX separately, then organize regular ones by scene -> shot -> take
  const { organizedTakes, ambienceTakes, sfxTakes } = React.useMemo(() => {
    const scenes: { [key: string]: { [key: string]: any[] } } = {};
    const ambience: any[] = [];
    const sfx: any[] = [];

    const filteredSheets = projectLogSheets.filter(sheet => {
      const data = sheet.data;

      if (filters.scene && data?.sceneNumber !== filters.scene) return false;
      if (filters.shot && data?.shotNumber !== filters.shot) return false;
      if (filters.take && data?.takeNumber !== filters.take) return false;
      if (filters.episode && data?.episodeNumber !== filters.episode) return false;
      if (filters.classification && data?.classification !== filters.classification) return false;
      if (filters.goodTakesOnly && !data?.isGoodTake) return false;
      if (searchQuery && (!data?.descriptionOfShot || !data.descriptionOfShot.toLowerCase().includes(searchQuery.toLowerCase()))) return false;

      return true;
    });

    filteredSheets.forEach(sheet => {
      const classification = sheet.data?.classification as ClassificationType | undefined;
      if (classification === 'Ambience') {
        ambience.push(sheet);
        return;
      }
      if (classification === 'SFX') {
        sfx.push(sheet);
        return;
      }

      const sceneNumber = sheet.data?.sceneNumber || 'Unknown';
      const shotNumber = sheet.data?.shotNumber || 'Unknown';

      if (!scenes[sceneNumber]) {
        scenes[sceneNumber] = {};
      }
      if (!scenes[sceneNumber][shotNumber]) {
        scenes[sceneNumber][shotNumber] = [];
      }

      scenes[sceneNumber][shotNumber].push(sheet);
    });

    Object.keys(scenes).forEach(sceneKey => {
      Object.keys(scenes[sceneKey]).forEach(shotKey => {
        scenes[sceneKey][shotKey].sort((a, b) => {
          const takeA = parseInt(a.data?.takeNumber || '0');
          const takeB = parseInt(b.data?.takeNumber || '0');
          return takeB - takeA;
        });
      });
    });

    ambience.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    sfx.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return { organizedTakes: scenes, ambienceTakes: ambience, sfxTakes: sfx };
  }, [projectLogSheets, filters, searchQuery]);

  const sortedScenes = Object.keys(organizedTakes).sort((a, b) => {
    if (a === 'Unknown') return 1;
    if (b === 'Unknown') return -1;
    return parseInt(b) - parseInt(a);
  });





  const renderTake = ({ item: take, index, totalTakes, isRecentlyCreated = false, isAmbienceSfx = false }: { item: any, index: number, totalTakes: number, isRecentlyCreated?: boolean, isAmbienceSfx?: boolean }) => {
    const isFirstTake = index === 0;
    const isLastTake = index === totalTakes - 1;

    const classification = (take.data?.classification ?? null) as ClassificationType | null;
    const isAmbSfx = isAmbienceSfx || classification === 'Ambience' || classification === 'SFX';

    const details: string[] = [];
    if (classification) {
      details.push(classification);
    }
    if (take.data?.shotDetails && Array.isArray(take.data.shotDetails)) {
      details.push(...take.data.shotDetails);
    } else if (take.data?.shotDetails) {
      details.push(take.data.shotDetails);
    }

    const cameraFiles: { cameraNumber: number; displayValue: string }[] = (() => {
      const files: { cameraNumber: number; displayValue: string }[] = [];
      const data = take.data ?? {};
      
      // Handle camera files with range support
      const cameraNumbers = new Set<number>();
      
      // Find all camera numbers from various field patterns
      Object.keys(data).forEach(key => {
        if (key.startsWith('cameraFile')) {
          if (key === 'cameraFile') {
            cameraNumbers.add(1);
          } else {
            const match = key.match(/cameraFile(\d+)/);
            if (match) {
              cameraNumbers.add(parseInt(match[1]));
            }
          }
        }
        if (key.match(/camera\d+_from/)) {
          const match = key.match(/camera(\d+)_from/);
          if (match) {
            cameraNumbers.add(parseInt(match[1]));
          }
        }
      });
      
      // Process each camera number
      Array.from(cameraNumbers).sort((a, b) => a - b).forEach(camNum => {
        const fromKey = `camera${camNum}_from`;
        const toKey = `camera${camNum}_to`;
        // Check both cameraFile and cameraFile1 for camera 1
        const fileKey = `cameraFile${camNum}`;
        const altFileKey = camNum === 1 ? 'cameraFile' : null;
        
        const fromValue = data[fromKey];
        const toValue = data[toKey];
        let fileValue = data[fileKey];
        
        // For camera 1, also check the alternative key 'cameraFile'
        if (!fileValue && altFileKey) {
          fileValue = data[altFileKey];
        }
        
        // DEBUG: Log what we're reading for camera ranges
        if (take.data?.classification === 'Waste' && (fromValue || toValue || fileValue)) {
          console.log(`DEBUG ProjectScreen - Rendering camera ${camNum} for waste take:`, {
            takeId: take.id,
            sceneNumber: take.data?.sceneNumber,
            shotNumber: take.data?.shotNumber,
            takeNumber: take.data?.takeNumber,
            fromValue,
            toValue,
            fileValue,
            hasInlineRange: typeof fileValue === 'string' && fileValue.includes('-')
          });
        }
        
        // Handle range format (stable keys)
        if (fromValue && toValue) {
          const from = fromValue.toString().padStart(4, '0');
          const to = toValue.toString().padStart(4, '0');
          const displayValue = from === to ? from : `${from}–${to}`;
          if (take.data?.classification === 'Waste') {
            console.log(`DEBUG - Using range format for waste take: from=${from}, to=${to}, displayValue=${displayValue}`);
          }
          files.push({ cameraNumber: camNum, displayValue });
        }
        // Handle single camera file
        else if (fileValue && typeof fileValue === 'string' && fileValue.trim().length > 0) {
          // Check if it's an inline range format like "004-008"
          if (fileValue.includes('-')) {
            // Parse the inline range
            const [from, to] = fileValue.split('-').map(v => v.trim().padStart(4, '0'));
            const displayValue = from === to ? from : `${from}–${to}`;
            files.push({ cameraNumber: camNum, displayValue });
          } else {
            files.push({ cameraNumber: camNum, displayValue: fileValue });
          }
        }
      });
      
      return files;
    })();

    const titleText = (() => {
      if (isAmbSfx) {
        const cls = classification ?? '';
        return cls ? `${cls}` : 'Ambience / SFX';
      }
      const takeNumber = take.data?.takeNumber || '1';
      const sceneNumber = take.data?.sceneNumber || 'Unknown';
      const shotNumber = take.data?.shotNumber || 'Unknown';
      return isRecentlyCreated ? `Scene ${sceneNumber}, Shot ${shotNumber}, Take ${takeNumber}` : `Take ${takeNumber}`;
    })();

    return (
      <View style={[
        styles.takeCard,
        isFirstTake && styles.takeCardFirst,
        isLastTake && styles.takeCardLast,
        !isFirstTake && !isLastTake && styles.takeCardMiddle,
        darkMode && styles.takeCardDark
      ]}>
        <TouchableOpacity 
          style={styles.takeMinimalView}
          onPress={() => router.push(`/take/${take.id}`)}
        >
          <View style={styles.takeContent}>
            <View style={styles.takeHeader}>
              <Text style={[styles.takeTitle, darkMode && styles.takeTitleDark]}>
                {titleText}
              </Text>
              {take.data?.isGoodTake && !isAmbienceSfx && (
                <View style={styles.goodTakeIndicator}>
                  <Check size={12} color="#10B981" strokeWidth={3} />
                </View>
              )}
            </View>

            {details.length > 0 && (
              <Text style={[styles.takeDetails, darkMode && styles.takeDetailsDark]}>{details.filter(Boolean).join(', ')}</Text>
            )}

            {cameraFiles.length > 0 && (
              <View style={styles.cameraList}>
                {cameraFiles.map((file, idx) => (
                  <Text
                    key={`cam-${file.cameraNumber}`}
                    style={[styles.takeTime, darkMode && styles.takeTimeDark]}
                    testID={`camera-file-${file.cameraNumber}`}
                  >
                    {`Camera ${file.cameraNumber}: ${file.displayValue}`}
                  </Text>
                ))}
              </View>
            )}

            {(() => {
              const data = take.data ?? {};
              const soundFrom = data['sound_from'];
              const soundTo = data['sound_to'];
              const soundFile = data.soundFile;
              
              // Handle range format (stable keys)
              if (soundFrom && soundTo) {
                const from = soundFrom.toString().padStart(4, '0');
                const to = soundTo.toString().padStart(4, '0');
                const displayValue = from === to ? from : `${from}–${to}`;
                return (
                  <Text style={[styles.takeTime, darkMode && styles.takeTimeDark]} testID="sound-file-line">
                    Sound: {displayValue}
                  </Text>
                );
              }
              
              // Handle single sound file
              if (soundFile) {
                return (
                  <Text style={[styles.takeTime, darkMode && styles.takeTimeDark]} testID="sound-file-line">
                    Sound: {soundFile}
                  </Text>
                );
              }
              
              return null;
            })()}

            {take.data?.descriptionOfShot && (
              <Text style={[styles.takeTime, darkMode && styles.takeTimeDark]}>Description: {take.data.descriptionOfShot}</Text>
            )}
          </View>
        </TouchableOpacity>
      </View>
    );
  };

  if (!project) {
    return (
      <EmptyState
        title="Project Not Found"
        message="The project you're looking for doesn't exist."
      />
    );
  }



  return (
    <View style={[styles.container, darkMode && styles.containerDark]}>
      <Stack.Screen 
        options={{
          title: "Film Logs",
          headerLeft: () => <HeaderLeft />,
          headerRight: () => <HeaderRight />,
          headerBackVisible: false,
          headerTitleAlign: 'center',
        }} 
      />
      
      <View style={[styles.content, darkMode && styles.contentDark]}>
        {/* Search Field with Filter Button */}
        <View style={[styles.searchRow, darkMode && styles.searchRowDark]}>
          <View style={[styles.searchContainer, darkMode && styles.searchContainerDark]}>
            <Search size={20} color={colors.subtext} style={styles.searchIcon} />
            <TextInput
              style={[styles.searchInput, darkMode && styles.searchInputDark]}
              placeholder="Search descriptions"
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholderTextColor={colors.subtext}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')} style={styles.clearSearchButton}>
                <X size={16} color={colors.subtext} />
              </TouchableOpacity>
            )}
          </View>
          <TouchableOpacity 
            onPress={() => setShowFilters(!showFilters)} 
            style={[styles.filterButton, darkMode && styles.filterButtonDark, showFilters && styles.filterButtonActive]}
          >
            <SlidersHorizontal size={20} color={showFilters ? 'white' : (darkMode ? '#f2f2f2' : colors.text)} />
            <Text style={[styles.filterButtonText, darkMode && styles.filterButtonTextDark, showFilters && styles.filterButtonTextActive]}>Filter</Text>
          </TouchableOpacity>
        </View>
        
        {/* Filter Panel */}
        {showFilters && (
          <View style={[styles.filterPanel, darkMode && styles.filterPanelDark]}>
            {/* Scene Number Filter */}
            <View style={[styles.sceneFilterContainer, darkMode && styles.sceneFilterContainerDark]}>
              <Text style={[styles.sceneFilterLabel, darkMode && styles.sceneFilterLabelDark]}>Scene:</Text>
              <TextInput
                style={[styles.sceneFilterInput, darkMode && styles.sceneFilterInputDark]}
                placeholder="Enter scene number"
                value={sceneFilterInput}
                onChangeText={setSceneFilterInput}
                onBlur={() => setFilters(prev => ({ ...prev, scene: sceneFilterInput }))}
                placeholderTextColor={colors.subtext}
                keyboardType="numeric"
              />
              {sceneFilterInput.length > 0 && (
                <TouchableOpacity 
                  onPress={() => {
                    setSceneFilterInput('');
                    setFilters(prev => ({ ...prev, scene: '' }));
                  }} 
                  style={styles.clearSceneButton}
                >
                  <X size={14} color={colors.subtext} />
                </TouchableOpacity>
              )}
            </View>
            
            {/* Other Filters */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScrollView}>
              <TouchableOpacity
                style={[
                  styles.filterTagButton,
                  darkMode && styles.filterTagButtonDark,
                  filters.goodTakesOnly && styles.filterTagButtonActive
                ]}
                onPress={() => setFilters(prev => ({ ...prev, goodTakesOnly: !prev.goodTakesOnly }))}
              >
                <Check size={16} color={filters.goodTakesOnly ? 'white' : (darkMode ? '#f2f2f2' : colors.text)} />
                <Text style={[
                  styles.filterTagButtonText,
                  darkMode && styles.filterTagButtonTextDark,
                  filters.goodTakesOnly && styles.filterTagButtonTextActive
                ]}>Good Takes</Text>
              </TouchableOpacity>
              
              {(['Waste', 'Insert', 'Ambience', 'SFX'] as ClassificationType[]).map((type) => (
                <TouchableOpacity
                  key={type}
                  style={[
                    styles.filterTagButton,
                    darkMode && styles.filterTagButtonDark,
                    filters.classification === type && styles.filterTagButtonActive
                  ]}
                  onPress={() => setFilters(prev => ({ 
                    ...prev, 
                    classification: prev.classification === type ? null : type 
                  }))}
                >
                  <Text style={[
                    styles.filterTagButtonText,
                    darkMode && styles.filterTagButtonTextDark,
                    filters.classification === type && styles.filterTagButtonTextActive
                  ]}>{type}</Text>
                </TouchableOpacity>
              ))}
              
              <TouchableOpacity
                style={styles.clearFiltersButton}
                onPress={() => {
                  setFilters({
                    scene: '',
                    shot: '',
                    take: '',
                    episode: '',
                    classification: null,
                    goodTakesOnly: false
                  });
                  setSearchQuery('');
                  setSceneFilterInput('');
                }}
              >
                <Text style={[styles.clearFiltersText, darkMode && styles.clearFiltersTextDark]}>Clear All</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        )}
        
        {Object.keys(organizedTakes).length === 0 && recentlyCreatedLogs.length === 0 && ambienceTakes.length === 0 && sfxTakes.length === 0 ? (
          <EmptyState
            title={projectLogSheets.length === 0 ? "No Takes Yet" : "No Matching Takes"}
            message={projectLogSheets.length === 0 ? "Start logging your film takes by tapping the + button." : searchQuery ? "No takes match your search. Try a different search term." : "Try adjusting your filters to see more takes."}
            icon={<Plus size={48} color={colors.primary} />}
          />
        ) : (
          <ScrollView 
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
          >
            {/* Recently Created Logs Section */}
            {recentlyCreatedLogs.length > 0 && Object.keys(organizedTakes).length > 0 && !filters.goodTakesOnly && !filters.classification && (
              <View style={[styles.recentlyCreatedContainer, darkMode && styles.recentlyCreatedContainerDark]}>
                <View style={[styles.recentlyCreatedHeader, darkMode && styles.recentlyCreatedHeaderDark]}>
                  <Text style={[styles.recentlyCreatedTitle, darkMode && styles.recentlyCreatedTitleDark]}>Recently Created</Text>
                </View>
                <View style={styles.recentlyCreatedList}>
                  {recentlyCreatedLogs.map((take, index) => (
                    <View key={take.id}>
                      {renderTake({ 
                        item: take, 
                        index, 
                        totalTakes: recentlyCreatedLogs.length,
                        isRecentlyCreated: true,
                        isAmbienceSfx: take.data?.classification === 'Ambience' || take.data?.classification === 'SFX'
                      })}
                    </View>
                  ))}
                </View>
              </View>
            )}
            
            {/* Regular Scene Organization */}
            {sortedScenes.map(sceneNumber => (
              <View key={sceneNumber} style={[styles.sceneContainer, darkMode && styles.sceneContainerDark]}>
                <View style={[styles.sceneHeader, darkMode && styles.sceneHeaderDark]}>
                  <Text style={[styles.sceneTitle, darkMode && styles.sceneTitleDark]}>Scene {sceneNumber}</Text>
                </View>
                {Object.keys(organizedTakes[sceneNumber]).sort((a, b) => {
                  if (a === 'Unknown') return 1;
                  if (b === 'Unknown') return -1;
                  return parseInt(b) - parseInt(a);
                }).map(shotNumber => (
                  <View key={`${sceneNumber}-${shotNumber}`} style={[styles.shotContainer, darkMode && styles.shotContainerDark]}>
                    <View style={[styles.shotHeader, darkMode && styles.shotHeaderDark]}>
                      <Text style={[styles.shotTitle, darkMode && styles.shotTitleDark]}>Shot {shotNumber}</Text>
                    </View>
                    <View style={styles.takesContainer}>
                      {organizedTakes[sceneNumber][shotNumber].map((take, index) => (
                        <View key={take.id}>
                          {renderTake({ 
                            item: take, 
                            index, 
                            totalTakes: organizedTakes[sceneNumber][shotNumber].length 
                          })}
                        </View>
                      ))}
                    </View>
                  </View>
                ))}
              </View>
            ))}

            {/* Ambiences Section */}
            {ambienceTakes.length > 0 && (
              <View style={[styles.sceneContainer, darkMode && styles.sceneContainerDark]} testID="ambiences-section">
                <View style={[styles.sceneHeader, darkMode && styles.sceneHeaderDark]}>
                  <Text style={[styles.sceneTitle, darkMode && styles.sceneTitleDark]}>Ambiences</Text>
                </View>
                <View style={styles.takesContainer}>
                  {ambienceTakes.map((take, index) => (
                    <View key={take.id}>
                      {renderTake({ item: take, index, totalTakes: ambienceTakes.length, isAmbienceSfx: true })}
                    </View>
                  ))}
                </View>
              </View>
            )}

            {/* SFX Section */}
            {sfxTakes.length > 0 && (
              <View style={[styles.sceneContainer, darkMode && styles.sceneContainerDark]} testID="sfx-section">
                <View style={[styles.sceneHeader, darkMode && styles.sceneHeaderDark]}>
                  <Text style={[styles.sceneTitle, darkMode && styles.sceneTitleDark]}>SFX</Text>
                </View>
                <View style={styles.takesContainer}>
                  {sfxTakes.map((take, index) => (
                    <View key={take.id}>
                      {renderTake({ item: take, index, totalTakes: sfxTakes.length, isAmbienceSfx: true })}
                    </View>
                  ))}
                </View>
              </View>
            )}
          </ScrollView>
        )}

        <View style={styles.fabContainer}>
          <Button
            title=""
            onPress={() => router.push(`/add-take/${id}`)}
            icon={<Plus size={24} color="white" />}
            style={styles.fab}
          />
        </View>
      </View>
      
      {/* Export Modal */}
      <Modal
        visible={showExportModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowExportModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContainer, darkMode && styles.modalContainerDark]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, darkMode && styles.modalTitleDark]}>Export Options</Text>
              <TouchableOpacity onPress={() => setShowExportModal(false)} style={styles.modalCloseButton}>
                <X size={24} color={darkMode ? '#f2f2f2' : colors.text} />
              </TouchableOpacity>
            </View>
            
            <Text style={[styles.modalDescription, darkMode && styles.modalDescriptionDark]}>
              Choose your export type:
            </Text>
            
            <View style={styles.exportOptions}>
              <TouchableOpacity 
                style={[styles.exportOption, darkMode && styles.exportOptionDark]}
                onPress={() => handleExportConfirm(false)}
              >
                <Text style={[styles.exportOptionTitle, darkMode && styles.exportOptionTitleDark]}>Regular Export</Text>
                <Text style={[styles.exportOptionDescription, darkMode && styles.exportOptionDescriptionDark]}>
                  Export all takes as they appear in the project view
                </Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.exportOption, darkMode && styles.exportOptionDark]}
                onPress={() => handleExportConfirm(true)}
              >
                <Text style={[styles.exportOptionTitle, darkMode && styles.exportOptionTitleDark]}>Smart Export</Text>
                <Text style={[styles.exportOptionDescription, darkMode && styles.exportOptionDescriptionDark]}>
                  Regular export + separate tables for good takes, inserts, wastes, ambiences, and SFX
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f8f8',
  },
  containerDark: {
    backgroundColor: '#0b0b0b',
  },
  content: {
    flex: 1,
  },
  contentDark: {
    backgroundColor: '#0b0b0b',
  },
  headerButton: {
    padding: 8,
    marginHorizontal: 8,
  },
  headerRightContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    position: 'relative',
  },
  exportButton: {
    padding: 8,
    marginHorizontal: 8,
  },
  menuDropdown: {
    position: 'absolute',
    top: 40,
    right: 0,
    backgroundColor: 'white',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 5,
    zIndex: 1000,
    minWidth: 150,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
  },
  menuItemText: {
    fontSize: 16,
    color: colors.text,
  },

  listContent: {
    padding: 16,
    paddingBottom: 100,
  },
  takeCard: {
    backgroundColor: 'white',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
    marginBottom: 0,
  },
  takeCardDark: {
    backgroundColor: '#1a1a1a',
  },
  takeCardFirst: {
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
  },
  takeCardMiddle: {
    borderRadius: 0,
  },
  takeCardLast: {
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
    borderBottomLeftRadius: 8,
    borderBottomRightRadius: 8,
  },
  takeMinimalView: {
    padding: 16,
  },
  takeContent: {
    flex: 1,
  },
  takeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  takeTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
  },
  takeTitleDark: {
    color: '#f2f2f2',
  },
  takeDetails: {
    fontSize: 14,
    color: colors.subtext,
    marginBottom: 4,
  },
  takeDetailsDark: {
    color: '#b0b0b0',
  },
  takeTime: {
    fontSize: 14,
    color: colors.subtext,
  },
  takeTimeDark: {
    color: '#b0b0b0',
  },
  takeFiles: {
    flexDirection: 'row',
    gap: 12,
  },
  fileItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  fileText: {
    fontSize: 12,
    color: colors.subtext,
  },
  takeActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  editButton: {
    padding: 8,
    borderRadius: 6,
    backgroundColor: colors.primary + '10',
  },
  expandIcon: {
    transform: [{ rotate: '0deg' }],
  },
  expandIconRotated: {
    transform: [{ rotate: '90deg' }],
  },
  takeExpandedView: {
    backgroundColor: '#f8f9fa',
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  expandedDetails: {
    padding: 16,
    gap: 12,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  detailLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.text,
    width: 100,
  },
  detailValue: {
    fontSize: 14,
    color: colors.subtext,
    flex: 1,
  },
  fabContainer: {
    position: 'absolute',
    bottom: 70,
    right: 20,
  },
  fab: {
    width: 56,
    height: 56,
    borderRadius: 28,
    paddingHorizontal: 0,
  },
  sceneContainer: {
    marginBottom: 32,
  },
  sceneContainerDark: {
    backgroundColor: 'transparent',
  },
  sceneHeader: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 8,
  },
  sceneHeaderDark: {
    backgroundColor: 'transparent',
  },
  sceneTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'black',
  },
  sceneTitleDark: {
    color: '#f2f2f2',
  },
  shotContainer: {
    marginBottom: 24,
  },
  shotContainerDark: {
    backgroundColor: 'transparent',
  },
  shotHeader: {
    backgroundColor: '#B8E6FF',
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 0,
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
  },
  shotHeaderDark: {
    backgroundColor: '#2a2a2a',
  },
  shotTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
  },
  shotTitleDark: {
    color: '#f2f2f2',
  },
  takesContainer: {
    gap: 0,
  },
  takeTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  goodTakeIndicator: {
    backgroundColor: 'white',
    borderRadius: 10,
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#10B981',
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
    elevation: 2,
  },
  takeMetadata: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 4,
  },
  metadataTag: {
    backgroundColor: colors.primary + '20',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  metadataText: {
    fontSize: 10,
    color: colors.primary,
    fontWeight: '500',
  },
  filterPanel: {
    backgroundColor: 'white',
    marginHorizontal: 16,
    marginTop: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 12,
  },
  filterPanelDark: {
    backgroundColor: '#1a1a1a',
    borderColor: '#2a2a2a',
  },
  sceneFilterContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  sceneFilterContainerDark: {
    backgroundColor: 'transparent',
  },
  sceneFilterLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.text,
    marginRight: 8,
  },
  sceneFilterLabelDark: {
    color: '#f2f2f2',
  },
  sceneFilterInput: {
    flex: 1,
    height: 36,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 14,
    color: colors.text,
  },
  sceneFilterInputDark: {
    backgroundColor: '#2a2a2a',
    borderColor: '#2a2a2a',
    color: '#f2f2f2',
  },
  clearSceneButton: {
    position: 'absolute',
    right: 24,
    padding: 4,
  },
  filterScrollView: {
    paddingHorizontal: 16,
  },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#e8e8e8',
    gap: 8,
  },
  filterButtonDark: {
    backgroundColor: '#2a2a2a',
  },
  filterButtonActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  filterButtonText: {
    fontSize: 14,
    color: colors.text,
    fontWeight: '500',
  },
  filterButtonTextDark: {
    color: '#f2f2f2',
  },
  filterButtonTextActive: {
    color: 'white',
  },
  filterTagButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: 'white',
    marginRight: 8,
    gap: 4,
  },
  filterTagButtonDark: {
    backgroundColor: '#2a2a2a',
    borderColor: '#2a2a2a',
  },
  filterTagButtonActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  filterTagButtonText: {
    fontSize: 14,
    color: colors.text,
    fontWeight: '500',
  },
  filterTagButtonTextDark: {
    color: '#f2f2f2',
  },
  filterTagButtonTextActive: {
    color: 'white',
  },
  clearFiltersButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: colors.subtext + '20',
    marginRight: 8,
  },
  clearFiltersText: {
    fontSize: 14,
    color: colors.subtext,
    fontWeight: '500',
  },
  clearFiltersTextDark: {
    color: '#b0b0b0',
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginTop: 16,
    gap: 12,
  },
  searchRowDark: {
    backgroundColor: 'transparent',
  },
  searchContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#e8e8e8',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
  },
  searchContainerDark: {
    backgroundColor: '#2a2a2a',
  },
  searchIcon: {
    marginRight: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: colors.text,
  },
  searchInputDark: {
    color: '#f2f2f2',
  },
  clearSearchButton: {
    padding: 4,
    marginLeft: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContainer: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 24,
    width: '100%',
    maxWidth: 400,
  },
  modalContainerDark: {
    backgroundColor: '#1a1a1a',
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
  modalTitleDark: {
    color: '#f2f2f2',
  },
  modalCloseButton: {
    padding: 4,
  },
  modalDescription: {
    fontSize: 16,
    color: colors.text,
    marginBottom: 20,
  },
  modalDescriptionDark: {
    color: '#b0b0b0',
  },
  exportOptions: {
    gap: 12,
  },
  exportOption: {
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    backgroundColor: 'white',
  },
  exportOptionDark: {
    backgroundColor: '#2a2a2a',
    borderColor: '#2a2a2a',
  },
  exportOptionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 4,
  },
  exportOptionTitleDark: {
    color: '#f2f2f2',
  },
  exportOptionDescription: {
    fontSize: 14,
    color: colors.subtext,
    lineHeight: 20,
  },
  exportOptionDescriptionDark: {
    color: '#b0b0b0',
  },
  recentlyCreatedContainer: {
    marginBottom: 32,
  },
  recentlyCreatedContainerDark: {
    backgroundColor: 'transparent',
  },
  recentlyCreatedHeader: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 8,
  },
  recentlyCreatedHeaderDark: {
    backgroundColor: 'transparent',
  },
  recentlyCreatedTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.primary,
  },
  recentlyCreatedTitleDark: {
    color: colors.primary,
  },
  recentlyCreatedList: {
    gap: 0,
  },
  cameraList: {
    marginTop: 2,
  },
  consumeTokenButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    marginRight: 8,
  },
  consumeTokenButtonDark: {
    backgroundColor: colors.primary,
  },
  consumeTokenText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
});