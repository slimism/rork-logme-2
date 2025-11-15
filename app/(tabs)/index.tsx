import React, { useState } from 'react';
import { View, StyleSheet, FlatList, Text, TextInput, Alert, TouchableOpacity, Image, PanResponder, Animated, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Plus, Search, Film, Clock, Trash2, User } from 'lucide-react-native';
import { useProjectStore } from '@/store/projectStore';
import { useTokenStore } from '@/store/subscriptionStore';


import { EmptyState } from '@/components/EmptyState';
import { useColors } from '@/constants/colors';
import { useThemeStore } from '@/store/themeStore';

const logoLight = require('../../assets/images/logo-light.png');
const logoDark = require('../../assets/images/logo-dark.png');

export default function ProjectsScreen() {
  const { projects, logSheets, deleteProject } = useProjectStore();
  const { tokens, canCreateProject, getRemainingTrialLogs } = useTokenStore();
  const colors = useColors();
  const { darkMode } = useThemeStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [isMultiSelectMode, setIsMultiSelectMode] = useState(false);
  const [selectedProjects, setSelectedProjects] = useState<string[]>([]);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [projectToDelete, setProjectToDelete] = useState<string | null>(null);


  const remainingTrialLogs = getRemainingTrialLogs();

  const filteredProjects = projects.filter(project =>
    project.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getProjectStats = (projectId: string) => {
    const projectLogSheets = logSheets.filter(sheet => sheet.projectId === projectId);
    return {
      shots: projectLogSheets.length,
      lastUpdated: projectLogSheets.length > 0 
        ? Math.max(...projectLogSheets.map(sheet => new Date(sheet.updatedAt).getTime()))
        : new Date(projects.find(p => p.id === projectId)?.updatedAt || '').getTime()
    };
  };



  const handleCreateProject = () => {
    const remainingTrialLogs = getRemainingTrialLogs();
    const isOnTrial = tokens === 0 && remainingTrialLogs > 0;

    if (isOnTrial && projects.length >= 1) {
      Alert.alert(
        'Trial Limit Reached',
        'On trial, you can create only 1 project. Buy a token to create more projects.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Buy Token', onPress: () => router.push('/store') }
        ]
      );
      return;
    }

    if (!canCreateProject()) {
      Alert.alert(
        'No Tokens Available',
        'You need tokens to create new projects. Each token allows you to create one complete project with unlimited logs.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Buy Token', onPress: () => router.push('/store') }
        ]
      );
      return;
    }
    
    router.push('/project-settings');
  };

  const handleDeleteSelectedProjects = () => {
    Alert.alert(
      'Delete Projects',
      `Are you sure you want to delete ${selectedProjects.length} project(s)? This will permanently delete all takes and cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            selectedProjects.forEach(projectId => deleteProject(projectId));
            setSelectedProjects([]);
            setIsMultiSelectMode(false);
          },
        },
      ]
    );
  };

  const toggleProjectSelection = (projectId: string) => {
    setSelectedProjects(prev => 
      prev.includes(projectId) 
        ? prev.filter(id => id !== projectId)
        : [...prev, projectId]
    );
  };



  const startMultiSelect = () => {
    setIsMultiSelectMode(true);
  };

  const cancelMultiSelect = () => {
    setIsMultiSelectMode(false);
    setSelectedProjects([]);
  };

  const handleDeleteProject = (projectId: string) => {
    setProjectToDelete(projectId);
    setShowDeleteModal(true);
  };

  const confirmDeleteProject = () => {
    if (projectToDelete) {
      deleteProject(projectToDelete);
      setProjectToDelete(null);
    }
    setShowDeleteModal(false);
  };

  const cancelDeleteProject = () => {
    setProjectToDelete(null);
    setShowDeleteModal(false);
  };

  const SwipeableProjectCard = ({ item }: { item: any }) => {
    const translateX = new Animated.Value(0);
    const stats = getProjectStats(item.id);
    const isSelected = selectedProjects.includes(item.id);
    
    const panResponder = PanResponder.create({
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return Math.abs(gestureState.dx) > 10 && Math.abs(gestureState.dy) < 50;
      },
      onPanResponderMove: (_, gestureState) => {
        if (gestureState.dx < 0) {
          translateX.setValue(Math.max(gestureState.dx, -100));
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dx < -50) {
          Animated.spring(translateX, {
            toValue: -100,
            useNativeDriver: true,
          }).start();
        } else {
          Animated.spring(translateX, {
            toValue: 0,
            useNativeDriver: true,
          }).start();
        }
      },
    });
    
    return (
      <View style={styles.swipeContainer}>
        <View style={styles.deleteAction}>
          <TouchableOpacity
            style={styles.deleteButton}
            onPress={() => handleDeleteProject(item.id)}
          >
            <Trash2 size={24} color="white" />
          </TouchableOpacity>
        </View>
        
        <Animated.View
          style={[
            styles.projectCard,
            isSelected && styles.selectedProjectCard,
            { transform: [{ translateX }] }
          ]}
          {...panResponder.panHandlers}
        >
          <TouchableOpacity
            onPress={() => {
              if (isMultiSelectMode) {
                toggleProjectSelection(item.id);
              } else {
                router.push(`/project/${item.id}`);
              }
            }}
            onLongPress={() => {
              if (!isMultiSelectMode) {
                startMultiSelect();
                toggleProjectSelection(item.id);
              }
            }}
            style={styles.projectContent}
          >
            <View style={styles.projectMainRow}>
              <View style={styles.projectImageContainer}>
                {item.logoUri ? (
                  <Image source={{ uri: item.logoUri }} style={styles.projectImage} />
                ) : (
                  <View style={styles.projectImagePlaceholder}>
                    <Film size={40} color="white" />
                  </View>
                )}
              </View>
              <View style={styles.projectInfo}>
                <Text style={styles.projectTitle}>{item.name}</Text>
                <View style={styles.projectMeta}>
                  <View style={styles.metaItem}>
                    <Film size={14} color={colors.subtext} />
                    <Text style={styles.metaText}>{item.settings?.cameraConfiguration || 1} Camera{(item.settings?.cameraConfiguration || 1) > 1 ? 's' : ''}</Text>
                  </View>
                  <View style={styles.metaItem}>
                    <User size={14} color={colors.subtext} />
                    <Text style={styles.metaText}>Logger: {item.settings?.loggerName || 'Unknown'}</Text>
                  </View>
                  <View style={styles.metaItem}>
                    <Clock size={14} color={colors.subtext} />
                    <Text style={styles.metaText}>Started: {new Date(item.createdAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}</Text>
                  </View>
                  <View style={styles.metaItem}>
                    <Film size={14} color={colors.subtext} />
                    <Text style={styles.metaText}>Total Shots: {stats.shots}</Text>
                  </View>
                </View>
              </View>
              {isMultiSelectMode && (
                <View style={[styles.checkbox, isSelected && styles.checkedBox]}>
                  {isSelected && <Text style={styles.checkmark}>✓</Text>}
                </View>
              )}
            </View>
          </TouchableOpacity>
        </Animated.View>
      </View>
    );
  };

  const renderItem = ({ item }: { item: any }) => {
    return <SwipeableProjectCard item={item} />;
  };

  const renderHeader = () => (
    <SafeAreaView edges={['top']} style={styles.headerSafeArea}>
      <View style={styles.header}>
        <View style={styles.titleSection}>
          <View style={styles.appHeader}>
            <Image 
              source={darkMode ? logoDark : logoLight}
              style={styles.appLogo}
              onError={(error) => {
                console.log('[ProjectsScreen] Image load error:', error.nativeEvent.error);
                console.log('[ProjectsScreen] Attempting to load:', darkMode ? 'logo-dark.png' : 'logo-light.png');
              }}
              onLoad={() => {
                console.log('[ProjectsScreen] Image loaded successfully:', darkMode ? 'logo-dark.png' : 'logo-light.png');
              }}
              resizeMode="contain"
            />
            <Text style={styles.appTitle}>LogMe</Text>
            <View style={styles.headerActions}>
              <View style={styles.creditsContainer}>
                <Text style={styles.creditsLabel}>Remaining Tokens</Text>
                <View style={styles.creditsRow}>
                  <Text style={styles.creditsNumber}>{tokens}</Text>
                </View>
              </View>
              <TouchableOpacity onPress={handleCreateProject} style={styles.addProjectButton}>
                <Plus size={20} color="white" />
              </TouchableOpacity>
            </View>
          </View>
          {isMultiSelectMode ? (
            <View style={styles.multiSelectHeader}>
              <Text style={styles.selectedCountText}>
                {selectedProjects.length} selected
              </Text>
              <View style={styles.multiSelectActions}>
                <TouchableOpacity onPress={cancelMultiSelect} style={styles.cancelButton}>
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
                {selectedProjects.length > 0 && (
                  <TouchableOpacity onPress={handleDeleteSelectedProjects} style={styles.deleteButton}>
                    <Trash2 size={16} color="white" />
                    <Text style={styles.deleteButtonText}>Delete</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          ) : null}
        </View>
        
        {!isMultiSelectMode && (
          <View style={styles.searchContainer}>
            <View style={styles.searchIcon}>
              <Search size={20} color={colors.subtext} />
            </View>
            <TextInput
              style={styles.searchInput}
              placeholder="Search projects..."
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholderTextColor={colors.subtext}
            />
          </View>
        )}

        {remainingTrialLogs > 0 && !isMultiSelectMode && (
          <View style={styles.trialBanner}>
            <View style={styles.trialTextContainer}>
              <Text style={styles.trialTitle}>You&apos;re on a trial</Text>
              <Text style={styles.trialSubtitle}>{remainingTrialLogs} logs remaining</Text>
            </View>
            <TouchableOpacity onPress={() => router.push('/store')} style={styles.buyCreditsButton}>
              <Text style={styles.buyCreditsText}>Buy Token</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </SafeAreaView>
  );

  const styles = createStyles(colors);

  return (
    <View style={styles.container}>
      {renderHeader()}
      
      {filteredProjects.length === 0 ? (
        <EmptyState
          title={searchQuery ? "No Projects Found" : "Get Started"}
          message={searchQuery ? "No projects match your search." : "Create your first film production project to get started."}
          icon={<Film size={48} color={colors.primary} />}
        />
      ) : (
        <FlatList
          data={filteredProjects}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      )}
      
      <Modal
        visible={showDeleteModal}
        transparent={true}
        animationType="slide"
        onRequestClose={cancelDeleteProject}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <Text style={styles.modalTitle}>Project Options</Text>
            
            <TouchableOpacity
              style={styles.deleteOption}
              onPress={confirmDeleteProject}
            >
              <Trash2 size={20} color={colors.error} />
              <Text style={styles.deleteOptionText}>Delete Project</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={styles.cancelOption}
              onPress={cancelDeleteProject}
            >
              <Text style={styles.cancelOptionText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const createStyles = (colors: ReturnType<typeof useColors>) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  headerSafeArea: {
    backgroundColor: colors.card,
  },
  header: {
    backgroundColor: colors.card,
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  titleSection: {
    marginBottom: 20,
  },
  appHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
    width: '100%',
  },
  appLogo: {
    width: 62,
    height: 62,
    marginRight: 12,
  },
  appTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: colors.text,
    flex: 1,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    position: 'relative',
    gap: 12,
  },
  creditsContainer: {
    alignItems: 'flex-end',
    marginRight: 12,
  },
  creditsLabel: {
    fontSize: 12,
    color: colors.subtext,
    marginBottom: 2,
  },
  creditsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  creditsNumber: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  plusButton: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.primary + '20',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addProjectButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  multiSelectHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  selectedCountText: {
    fontSize: 16,
    color: colors.subtext,
  },
  multiSelectActions: {
    flexDirection: 'row',
    gap: 12,
  },
  cancelButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
    backgroundColor: colors.border,
  },
  cancelButtonText: {
    fontSize: 14,
    color: colors.text,
  },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
    backgroundColor: colors.error,
    gap: 6,
  },
  deleteButtonText: {
    fontSize: 14,
    color: 'white',
    fontWeight: '500',
  },
  subtitle: {
    fontSize: 16,
    color: colors.subtext,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.searchBackground,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 16,
  },
  searchIcon: {
    marginRight: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: colors.text,
  },
  trialBanner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.cardSecondary,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  trialTextContainer: {
    flex: 1,
  },
  trialTitle: {
    fontSize: 14,
    color: colors.text,
    fontWeight: '500',
    marginBottom: 2,
  },
  trialSubtitle: {
    fontSize: 12,
    color: colors.subtext,
  },
  buyCreditsButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
  },
  buyCreditsText: {
    fontSize: 14,
    color: 'white',
    fontWeight: '500',
  },
  listContent: {
    padding: 16,
    paddingBottom: 100,
  },
  projectCard: {
    backgroundColor: colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  selectedProjectCard: {
    borderColor: colors.primary,
    borderWidth: 2,
  },
  projectContent: {
    padding: 16,
  },
  projectMainRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  projectImageContainer: {
    marginRight: 16,
  },
  projectImage: {
    width: 80,
    height: 80,
    borderRadius: 8,
  },
  projectImagePlaceholder: {
    width: 80,
    height: 80,
    borderRadius: 8,
    backgroundColor: colors.disabled,
    alignItems: 'center',
    justifyContent: 'center',
  },
  projectInfo: {
    flex: 1,
  },
  projectTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 8,
  },
  projectMeta: {
    gap: 4,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
  },
  metaText: {
    fontSize: 13,
    color: colors.subtext,
    marginLeft: 6,
  },

  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 12,
  },
  checkedBox: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  checkmark: {
    color: 'white',
    fontSize: 14,
    fontWeight: 'bold',
  },
  swipeContainer: {
    position: 'relative',
    marginBottom: 16,
  },
  deleteAction: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: 100,
    backgroundColor: colors.error,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 12,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: colors.modalBackground,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 40,
    minHeight: 200,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
    textAlign: 'center',
    marginBottom: 30,
  },
  deleteOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
    backgroundColor: colors.cardSecondary,
    borderRadius: 12,
    marginBottom: 16,
    gap: 12,
  },
  deleteOptionText: {
    fontSize: 16,
    color: colors.error,
    fontWeight: '500',
  },
  cancelOption: {
    paddingVertical: 16,
    paddingHorizontal: 20,
    backgroundColor: colors.cardSecondary,
    borderRadius: 12,
    alignItems: 'center',
  },
  cancelOptionText: {
    fontSize: 16,
    color: colors.text,
    fontWeight: '500',
  },
  statsRow: {
    flexDirection: 'row',
    gap: 24,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statText: {
    fontSize: 14,
    color: colors.subtext,
    marginLeft: 6,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
  },
  menuItemText: {
    fontSize: 14,
    color: colors.text,
  },

});