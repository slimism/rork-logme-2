import React, { useState, useEffect } from 'react';
import { View, StyleSheet, FlatList, Text, TouchableOpacity, Alert, ScrollView, Modal, TextInput } from 'react-native';
import { useLocalSearchParams, Stack, router } from 'expo-router';
import { Plus, ArrowLeft, Share, Check, SlidersHorizontal, X, Search } from 'lucide-react-native';
import { useProjectStore } from '@/store/projectStore';
import { useThemeStore } from '@/store/themeStore';
import { Button } from '@/components/Button';
import { EmptyState } from '@/components/EmptyState';

import { colors } from '@/constants/colors';
import { exportProjectToPDF } from '@/utils/pdfExport';
import { ClassificationType } from '@/types';

export default function ProjectScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { projects, logSheets } = useProjectStore();
  const { darkMode } = useThemeStore();

  
  const [project, setProject] = useState(projects.find(p => p.id === id));
  const [projectLogSheets, setProjectLogSheets] = useState(logSheets.filter(l => l.projectId === id));


  const [isExporting, setIsExporting] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
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
    setProjectLogSheets(logSheets.filter(l => l.projectId === id));
  }, [id, projects, logSheets]);

  const HeaderLeft = () => (
    <TouchableOpacity onPress={() => router.back()} style={styles.headerButton}>
      <ArrowLeft size={24} color={darkMode ? '#f2f2f2' : colors.text} />
    </TouchableOpacity>
  );

  const HeaderRight = () => (
    <View style={styles.headerRightContainer}>
      <TouchableOpacity onPress={handleExportPDF} style={styles.exportButton} disabled={isExporting}>
        <Share size={20} color={isExporting ? colors.subtext : colors.primary} />
      </TouchableOpacity>
    </View>
  );

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



  // Filter and organize takes hierarchically by scene -> shot -> take
  const organizedTakes = React.useMemo(() => {
    const scenes: { [key: string]: { [key: string]: any[] } } = {};
    
    // Apply filters
    const filteredSheets = projectLogSheets.filter(sheet => {
      const data = sheet.data;
      
      // Scene filter
      if (filters.scene && data?.sceneNumber !== filters.scene) return false;
      
      // Shot filter
      if (filters.shot && data?.shotNumber !== filters.shot) return false;
      
      // Take filter
      if (filters.take && data?.takeNumber !== filters.take) return false;
      
      // Episode filter
      if (filters.episode && data?.episodeNumber !== filters.episode) return false;
      
      // Classification filter
      if (filters.classification && data?.classification !== filters.classification) return false;
      
      // Good takes only filter
      if (filters.goodTakesOnly && !data?.isGoodTake) return false;
      
      // Search filter - search in shot description
      if (searchQuery && (!data?.descriptionOfShot || !data.descriptionOfShot.toLowerCase().includes(searchQuery.toLowerCase()))) return false;
      
      return true;
    });
    
    filteredSheets.forEach(sheet => {
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
    
    // Sort takes within each shot by take number in descending order
    Object.keys(scenes).forEach(sceneKey => {
      Object.keys(scenes[sceneKey]).forEach(shotKey => {
        scenes[sceneKey][shotKey].sort((a, b) => {
          const takeA = parseInt(a.data?.takeNumber || '0');
          const takeB = parseInt(b.data?.takeNumber || '0');
          return takeB - takeA; // Descending order (highest take number first)
        });
      });
    });
    
    return scenes;
  }, [projectLogSheets, filters, searchQuery]);
  
  // Get sorted scene and shot keys for display
  const sortedScenes = Object.keys(organizedTakes).sort((a, b) => {
    if (a === 'Unknown') return 1;
    if (b === 'Unknown') return -1;
    return parseInt(a) - parseInt(b);
  });





  const renderTake = ({ item: take, index, totalTakes }: { item: any, index: number, totalTakes: number }) => {
    const takeNumber = take.data?.takeNumber || '1';
    const isFirstTake = index === 0;
    const isLastTake = index === totalTakes - 1;

    // Format classification and shot details in one row
    const details = [];
    if (take.data?.classification) {
      details.push(take.data.classification);
    }
    if (take.data?.shotDetails && Array.isArray(take.data.shotDetails)) {
      details.push(...take.data.shotDetails);
    } else if (take.data?.shotDetails) {
      details.push(take.data.shotDetails);
    }
    

    
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
              <Text style={[styles.takeTitle, darkMode && styles.takeTitleDark]}>Take {takeNumber}</Text>
              {take.data?.isGoodTake && (
                <View style={styles.goodTakeIndicator}>
                  <Check size={12} color="#10B981" strokeWidth={3} />
                </View>
              )}
            </View>
            
            {details.length > 0 && (
              <Text style={[styles.takeDetails, darkMode && styles.takeDetailsDark]}>{details.filter(Boolean).join(', ')}</Text>
            )}
            
            {/* Camera Files */}
            {take.data?.cameraFile && (
              <Text style={[styles.takeTime, darkMode && styles.takeTimeDark]}>
                Camera: {Array.isArray(take.data.cameraFile) ? take.data.cameraFile.join(', ') : take.data.cameraFile}
              </Text>
            )}
            
            {/* Sound File */}
            {take.data?.soundFile && (
              <Text style={[styles.takeTime, darkMode && styles.takeTimeDark]}>Sound: {take.data.soundFile}</Text>
            )}
            
            {/* Description */}
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
        
        {Object.keys(organizedTakes).length === 0 ? (
          <EmptyState
            title={projectLogSheets.length === 0 ? "No Takes Yet" : "No Matching Takes"}
            message={projectLogSheets.length === 0 ? "Start logging your film takes by tapping the + button." : searchQuery ? "No takes match your search. Try a different search term." : "Try adjusting your filters to see more takes."}
            icon={<Plus size={48} color={colors.primary} />}
          />
        ) : (
          <FlatList
            data={sortedScenes}
            renderItem={({ item: sceneNumber }) => (
              <View key={sceneNumber} style={[styles.sceneContainer, darkMode && styles.sceneContainerDark]}>
                <View style={[styles.sceneHeader, darkMode && styles.sceneHeaderDark]}>
                  <Text style={[styles.sceneTitle, darkMode && styles.sceneTitleDark]}>Scene {sceneNumber}</Text>
                </View>
                {Object.keys(organizedTakes[sceneNumber]).sort((a, b) => {
                  if (a === 'Unknown') return 1;
                  if (b === 'Unknown') return -1;
                  return parseInt(a) - parseInt(b);
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
            )}
            keyExtractor={(item) => item}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
          />
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
});