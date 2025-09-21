import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Switch } from 'react-native';
import { colors } from '@/constants/colors';
import { ChevronLeft } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useThemeStore } from '@/store/themeStore';

export default function AboutScreen() {
  const insets = useSafeAreaInsets();

  const { darkMode, setDarkMode } = useThemeStore();

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity style={styles.backButton}>
          <ChevronLeft size={24} color={colors.primary as string} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>About</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <Text style={styles.appVersionTitle}>App Version</Text>
        <View style={styles.versionSection}>
          <View style={styles.versionRow}>
            <Text style={styles.versionLabel}>Version</Text>
            <Text style={styles.versionValue}>1.0.0</Text>
          </View>
          <View style={[styles.versionRow, { marginTop: 16 }]}>
            <Text style={styles.versionLabel}>Dark Mode</Text>
            <Switch
              testID="toggle-dark-mode"
              trackColor={{ false: '#d1d5db', true: (colors.primary as string) + '80' }}
              thumbColor={darkMode ? (colors.primary as string) : '#f4f3f4'}
              ios_backgroundColor="#d1d5db"
              value={darkMode}
              onValueChange={(val) => {
                console.log('[About] Dark mode toggled', val);
                setDarkMode(val);
              }}
            />
          </View>
        </View>

        <Text style={styles.outsideSectionTitle}>KEY FEATURES</Text>
        <View style={styles.featuresContainer}>
          <View style={styles.featureContainer}>
            <Text style={styles.featureItem}>Project Management</Text>
          </View>
          <View style={styles.featureContainer}>
            <Text style={styles.featureItem}>Take Logging</Text>
          </View>
          <View style={styles.featureContainer}>
            <Text style={styles.featureItem}>Smart Filtering</Text>
          </View>
          <View style={styles.featureContainer}>
            <Text style={styles.featureItem}>PDF Export</Text>
          </View>
          <View style={styles.featureContainer}>
            <Text style={styles.featureItem}>Customizable Fields</Text>
          </View>
          <View style={styles.featureContainer}>
            <Text style={styles.featureItem}>Multi-Camera Support</Text>
          </View>
        </View>

        <Text style={styles.outsideSectionTitle}>ABOUT THE APP</Text>
        <View style={styles.whiteContainer}>
          <Text style={styles.aboutText}>
            LogMe is a professional tool designed for film production crews to efficiently manage projects and takes. It offers features like take logging, smart filtering, PDF export, customizable fields, and multi-camera support.
          </Text>
        </View>

        <Text style={styles.outsideSectionTitle}>CONTACT US</Text>
        <View style={styles.whiteContainer}>
          <Text style={styles.contactText}>
            For feedback, bug reports, or concerns, please reach us at logme.film@gmail.com
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background as string,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 16,
    backgroundColor: colors.card as string,
    borderBottomWidth: 1,
    borderBottomColor: colors.border as string,
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text as string,
  },
  headerSpacer: {
    width: 32,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  appVersionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.text as string,
    marginTop: 20,
    marginBottom: 8,
    marginHorizontal: 20,
  },
  versionSection: {
    backgroundColor: colors.card as string,
    marginTop: 0,
    marginHorizontal: 16,
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border as string,
    borderRadius: 8,
  },
  versionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  versionLabel: {
    fontSize: 17,
    color: colors.text as string,
    fontWeight: '400',
  },
  versionValue: {
    fontSize: 17,
    color: colors.subtext as string,
    fontWeight: '400',
  },
  section: {
    backgroundColor: colors.card as string,
    marginTop: 32,
    paddingHorizontal: 20,
    paddingVertical: 20,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.subtext as string,
    marginBottom: 20,
    letterSpacing: 0.5,
  },
  outsideSectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.text as string,
    marginTop: 32,
    marginBottom: 8,
    marginHorizontal: 20,
  },
  whiteContainer: {
    backgroundColor: colors.card as string,
    marginHorizontal: 16,
    paddingHorizontal: 20,
    paddingVertical: 20,
    borderRadius: 8,
  },
  featuresContainer: {
    marginHorizontal: 16,
  },
  featureContainer: {
    backgroundColor: colors.card as string,
    marginBottom: 4,
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderRadius: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.border as string,
  },
  featureItem: {
    fontSize: 17,
    color: colors.text as string,
    fontWeight: '400',
  },
  aboutText: {
    fontSize: 17,
    color: colors.text as string,
    lineHeight: 24,
    fontWeight: '400',
  },
  contactText: {
    fontSize: 17,
    color: colors.text as string,
    lineHeight: 24,
    fontWeight: '400',
  },
});