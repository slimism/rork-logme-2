import React, { useState, useEffect } from 'react';
import { View, StyleSheet, FlatList, Text, TouchableOpacity, Alert, ScrollView, Modal, TextInput } from 'react-native';
import { useLocalSearchParams, Stack, router } from 'expo-router';
import { Plus, ArrowLeft, Share, Check, SlidersHorizontal, X, Search } from 'lucide-react-native';
import { useProjectStore } from '@/store/projectStore';
import { Button } from '@/components/Button';
import { EmptyState } from '@/components/EmptyState';

import { colors } from '@/constants/colors';
import { exportProjectToPDF } from '@/utils/pdfExport';
import { ClassificationType } from '@/types';

export default function ProjectScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { projects, logSheets } = useProjectStore();

  
  const [project, setProject] = useState(projects.find(p => p.id === id));
  const [projectLogSheets, setProjectLogSheets] = useState(logSheets.filter(l => l.projectId === id));

  const [expandedTakes, setExpandedTakes] = useState<Set<string>>(new Set());
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
      <ArrowLeft size={24} color={colors.text} />
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
    
    // Sort takes within each shot by most recent first
    Object.keys(scenes).forEach(sceneKey => {
      Object.keys(scenes[sceneKey]).forEach(shotKey => {
        scenes[sceneKey][shotKey].sort((a, b) => 
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
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

  const toggleTakeExpansion = (takeId: string) => {
    setExpandedTakes(prev => {
      const newSet = new Set(prev);
      if (newSet.has(takeId)) {
        newSet.delete(takeId);
      } else {
        newSet.add(takeId);
      }
      return newSet;
    });
  };



  const renderTake = ({ item: take, index, totalTakes }: { item: any, index: number, totalTakes: number }) => {
    const isExpanded = expandedTakes.has(take.id);
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
    
    // Format timestamp range - creation to last modified
    const formatTimeRange = () => {
      const createdTime = new Date(take.createdAt);
      const updatedTime = new Date(take.updatedAt || take.createdAt);
      
      const createdFormatted = createdTime.toLocaleTimeString('en-US', { 
        hour: 'numeric', 
        minute: '2-digit',
        hour12: true 
      });
      
      const updatedFormatted = updatedTime.toLocaleTimeString('en-US', { 
        hour: 'numeric', 
        minute: '2-digit',
        hour12: true 
      });
      
      // Show range if created and updated times are different
      if (take.updatedAt && take.updatedAt !== take.createdAt) {
        return `${createdFormatted} - ${updatedFormatted}`;
      }
      
      return createdFormatted;
    };
    
    return (
      <View style={[
        styles.takeCard,
        isFirstTake && styles.takeCardFirst,
        isLastTake && styles.takeCardLast,
        !isFirstTake && !isLastTake && styles.takeCardMiddle
      ]}>
        <TouchableOpacity 
          style={styles.takeMinimalView}
          onPress={() => toggleTakeExpansion(take.id)}
        >
          <View style={styles.takeContent}>
            <View style={styles.takeHeader}>
              <Text style={styles.takeTitle}>Take {takeNumber}</Text>
              {take.data?.isGoodTake && (
                <View style={styles.goodTakeIndicator}>
                  <Check size={16} color="white" />
                </View>
              )}
            </View>
            
            {details.length > 0 && (
              <Text style={styles.takeDetails}>{details.join(', ')}</Text>
            )}
            
            <Text style={styles.takeTime}>{formatTimeRange()}</Text>
          </View>
        </TouchableOpacity>
        
        {/* Expanded view - shows all details */}
        {isExpanded && (
          <View style={styles.takeExpandedView}>
            <View style={styles.expandedDetails}>
              {take.data?.descriptionOfShot && (
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Description:</Text>
                  <Text style={styles.detailValue}>{take.data.descriptionOfShot}</Text>
                </View>
              )}
              {take.data?.notesForTake && (
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Notes:</Text>
                  <Text style={styles.detailValue}>{take.data.notesForTake}</Text>
                </View>
              )}
              {/* Show additional camera files if multiple cameras */}
              {(() => {
                const cameraCount = project?.settings?.cameraConfiguration;
                if (cameraCount && cameraCount > 1) {
                  return Array.from({ length: cameraCount }, (_, i) => {
                    const cameraFieldId = `cameraFile${i + 1}`;
                    const cameraValue = take.data?.[cameraFieldId];
                    if (cameraValue) {
                      return (
                        <View key={`${take.id}-${cameraFieldId}`} style={styles.detailRow}>
                          <Text style={styles.detailLabel}>Camera {i + 1}:</Text>
                          <Text style={styles.detailValue}>{cameraValue}</Text>
                        </View>
                      );
                    }
                    return null;
                  });
                }
                return null;
              })()}
              {/* Show classification and shot details in expanded view */}
              {take.data?.classification && (
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Classification:</Text>
                  <Text style={styles.detailValue}>{take.data.classification}</Text>
                </View>
              )}
              {take.data?.shotDetails && (
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Shot Details:</Text>
                  <Text style={styles.detailValue}>{take.data.shotDetails}</Text>
                </View>
              )}
              {take.data?.isGoodTake && (
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Good Take:</Text>
                  <Text style={styles.detailValue}>Yes</Text>
                </View>
              )}
              {/* Show custom fields */}
              {project?.settings?.customFields?.map((fieldName: string, index: number) => {
                const customValue = take.data?.[`custom_${index}`];
                if (customValue) {
                  return (
                    <View key={`${take.id}-custom_${index}`} style={styles.detailRow}>
                      <Text style={styles.detailLabel}>{fieldName}:</Text>
                      <Text style={styles.detailValue}>{customValue}</Text>
                    </View>
                  );
                }
                return null;
              })}
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Created:</Text>
                <Text style={styles.detailValue}>{new Date(take.createdAt).toLocaleString()}</Text>
              </View>
            </View>
          </View>
        )}
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
    <View style={styles.container}>
      <Stack.Screen 
        options={{
          title: "Film Logs",
          headerLeft: () => <HeaderLeft />,
          headerRight: () => <HeaderRight />,
          headerBackVisible: false,
          headerTitleAlign: 'center',
        }} 
      />
      
      <View style={styles.content}>
        {/* Search Field with Filter Button */}
        <View style={styles.searchRow}>
          <View style={styles.searchContainer}>
            <Search size={20} color={colors.subtext} style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search film logs"
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
            style={[styles.filterButton, showFilters && styles.filterButtonActive]}
          >
            <SlidersHorizontal size={20} color={showFilters ? 'white' : colors.text} />
            <Text style={[styles.filterButtonText, showFilters && styles.filterButtonTextActive]}>Filter</Text>
          </TouchableOpacity>
        </View>
        
        {/* Filter Panel */}
        {showFilters && (
          <View style={styles.filterPanel}>
            {/* Scene Number Filter */}
            <View style={styles.sceneFilterContainer}>
              <Text style={styles.sceneFilterLabel}>Scene:</Text>
              <TextInput
                style={styles.sceneFilterInput}
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
                  filters.goodTakesOnly && styles.filterTagButtonActive
                ]}
                onPress={() => setFilters(prev => ({ ...prev, goodTakesOnly: !prev.goodTakesOnly }))}
              >
                <Check size={16} color={filters.goodTakesOnly ? 'white' : colors.text} />
                <Text style={[
                  styles.filterTagButtonText,
                  filters.goodTakesOnly && styles.filterTagButtonTextActive
                ]}>Good Takes</Text>
              </TouchableOpacity>
              
              {(['Waste', 'Insert', 'Ambience', 'SFX'] as ClassificationType[]).map((type) => (
                <TouchableOpacity
                  key={type}
                  style={[
                    styles.filterTagButton,
                    filters.classification === type && styles.filterTagButtonActive
                  ]}
                  onPress={() => setFilters(prev => ({ 
                    ...prev, 
                    classification: prev.classification === type ? null : type 
                  }))}
                >
                  <Text style={[
                    styles.filterTagButtonText,
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
                <Text style={styles.clearFiltersText}>Clear All</Text>
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
              <View key={sceneNumber} style={styles.sceneContainer}>
                <View style={styles.sceneHeader}>
                  <Text style={styles.sceneTitle}>Scene {sceneNumber}</Text>
                </View>
                {Object.keys(organizedTakes[sceneNumber]).sort((a, b) => {
                  if (a === 'Unknown') return 1;
                  if (b === 'Unknown') return -1;
                  return parseInt(a) - parseInt(b);
                }).map(shotNumber => (
                  <View key={`${sceneNumber}-${shotNumber}`} style={styles.shotContainer}>
                    <View style={styles.shotHeader}>
                      <Text style={styles.shotTitle}>Shot {shotNumber}</Text>
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
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Export Options</Text>
              <TouchableOpacity onPress={() => setShowExportModal(false)} style={styles.modalCloseButton}>
                <X size={24} color={colors.text} />
              </TouchableOpacity>
            </View>
            
            <Text style={styles.modalDescription}>
              Choose your export type:
            </Text>
            
            <View style={styles.exportOptions}>
              <TouchableOpacity 
                style={styles.exportOption}
                onPress={() => handleExportConfirm(false)}
              >
                <Text style={styles.exportOptionTitle}>Regular Export</Text>
                <Text style={styles.exportOptionDescription}>
                  Export all takes as they appear in the project view
                </Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.exportOption}
                onPress={() => handleExportConfirm(true)}
              >
                <Text style={styles.exportOptionTitle}>Smart Export</Text>
                <Text style={styles.exportOptionDescription}>
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
  content: {
    flex: 1,
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
  takeDetails: {
    fontSize: 14,
    color: colors.subtext,
    marginBottom: 4,
  },
  takeTime: {
    fontSize: 14,
    color: colors.subtext,
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
  sceneHeader: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 8,
  },
  sceneTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'black',
  },
  shotContainer: {
    marginBottom: 24,
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
  shotTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
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
    backgroundColor: '#22c55e',
    borderRadius: 12,
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
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
  sceneFilterContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  sceneFilterLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.text,
    marginRight: 8,
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
  filterButtonActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  filterButtonText: {
    fontSize: 14,
    color: colors.text,
    fontWeight: '500',
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
  filterTagButtonActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  filterTagButtonText: {
    fontSize: 14,
    color: colors.text,
    fontWeight: '500',
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
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginTop: 16,
    gap: 12,
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
  searchIcon: {
    marginRight: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: colors.text,
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
  exportOptionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 4,
  },
  exportOptionDescription: {
    fontSize: 14,
    color: colors.subtext,
    lineHeight: 20,
  },
});