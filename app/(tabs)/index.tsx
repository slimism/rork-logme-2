import React, { useState } from 'react';
import { View, StyleSheet, FlatList, Text, TextInput, Alert, TouchableOpacity, Image } from 'react-native';
import { router } from 'expo-router';
import { Plus, Search, Film, Clock, Trash2 } from 'lucide-react-native';
import { useProjectStore } from '@/store/projectStore';
import { useTokenStore } from '@/store/subscriptionStore';


import { EmptyState } from '@/components/EmptyState';
import { colors } from '@/constants/colors';

export default function ProjectsScreen() {
  const { projects, logSheets, deleteProject } = useProjectStore();
  const { tokens, canCreateProject, getRemainingTrialLogs } = useTokenStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [isMultiSelectMode, setIsMultiSelectMode] = useState(false);
  const [selectedProjects, setSelectedProjects] = useState<string[]>([]);


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

  const formatLastUpdated = (timestamp: number) => {
    const now = Date.now();
    const diff = now - timestamp;
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    
    if (hours < 1) return 'Updated just now';
    if (hours < 24) return `Updated ${hours}h ago`;
    if (days === 1) return 'Updated 1d ago';
    if (days < 7) return `Updated ${days}d ago`;
    return new Date(timestamp).toLocaleDateString();
  };

  const handleCreateProject = () => {
    if (!canCreateProject()) {
      Alert.alert(
        'No Tokens Available',
        'You need tokens to create new projects. Each token allows you to create one complete project with unlimited logs.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Buy Tokens', onPress: () => router.push('/store') }
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

  const renderItem = ({ item }: { item: any }) => {
    const stats = getProjectStats(item.id);
    const isSelected = selectedProjects.includes(item.id);
    
    return (
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
        style={[
          styles.projectCard,
          isSelected && styles.selectedProjectCard
        ]}
      >
        <View style={styles.projectContent}>
          <View style={styles.projectHeader}>
            <View style={styles.projectIconContainer}>
              {item.logoUri ? (
                <Image source={{ uri: item.logoUri }} style={styles.projectLogo} />
              ) : (
                <Film size={24} color={colors.primary} />
              )}
            </View>
            <View style={styles.projectTitleContainer}>
              <Text style={styles.projectTitle}>{item.name}</Text>
            </View>
            {isMultiSelectMode && (
              <View style={[styles.checkbox, isSelected && styles.checkedBox]}>
                {isSelected && <Text style={styles.checkmark}>✓</Text>}
              </View>
            )}
          </View>
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Film size={16} color={colors.subtext} />
              <Text style={styles.statText}>{stats.shots} shots</Text>
            </View>
            <View style={styles.statItem}>
              <Clock size={16} color={colors.subtext} />
              <Text style={styles.statText}>{formatLastUpdated(stats.lastUpdated)}</Text>
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const renderHeader = () => (
    <View style={styles.header}>
      <View style={styles.titleSection}>
        <View style={styles.appHeader}>
          <Image 
            source={{ uri: 'https://pub-e001eb4506b145aa938b5d3badbff6a5.r2.dev/attachments/sz2mmcka8n69ctz726s7e' }} 
            style={styles.appLogo} 
          />
          <Text style={styles.appTitle}>LogMe</Text>
          <View style={styles.headerActions}>
            <View style={styles.creditsContainer}>
              <Text style={styles.creditsLabel}>Remaining Credits</Text>
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
        <View style={styles.trialInfo}>
          <Text style={styles.trialText}>
            Trial: {remainingTrialLogs} logs remaining
          </Text>
          <TouchableOpacity onPress={() => router.push('/store')}>
            <Text style={styles.buyTokensText}>Buy Tokens</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );

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
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f8f8',
  },
  header: {
    backgroundColor: 'white',
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
    width: 48,
    height: 48,
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
    backgroundColor: '#f5f5f5',
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
  trialInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.primary + '10',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
  },
  trialText: {
    fontSize: 14,
    color: colors.primary,
    fontWeight: '500',
  },
  buyTokensText: {
    fontSize: 14,
    color: colors.primary,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
  listContent: {
    padding: 16,
    paddingBottom: 100,
  },
  projectCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  selectedProjectCard: {
    borderColor: colors.primary,
    borderWidth: 2,
  },
  projectContent: {
    padding: 16,
  },
  projectHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  projectIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: colors.primary + '20',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  projectLogo: {
    width: 32,
    height: 32,
    borderRadius: 6,
  },
  projectTitleContainer: {
    flex: 1,
  },
  projectTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
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