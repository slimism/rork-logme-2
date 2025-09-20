import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Linking } from 'react-native';
import { colors } from '@/constants/colors';
import { Mail, MessageCircle } from 'lucide-react-native';
import { TopBar } from '@/components/TopBar';

export default function AboutScreen() {
  const handleContactUs = () => {
    Linking.openURL('mailto:logme.film@gmail.com');
  };

  const handleFeedback = () => {
    Linking.openURL('mailto:logme.film@gmail.com?subject=Feedback');
  };

  return (
    <View style={styles.container}>
      <TopBar />
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {/* App Version Section */}
        <View style={styles.versionSection}>
          <View style={styles.versionRow}>
            <Text style={styles.versionLabel}>App Version</Text>
            <Text style={styles.versionValue}>1.0.0</Text>
          </View>
        </View>

        {/* Key Features Section */}
        <Text style={styles.outsideSectionTitle}>KEY FEATURES</Text>
        <View style={styles.whiteContainer}>
          <View style={styles.featuresList}>
            <Text style={styles.featureItem}>Project Management</Text>
            <View style={styles.separator} />
            <Text style={styles.featureItem}>Take Logging</Text>
            <View style={styles.separator} />
            <Text style={styles.featureItem}>Smart Filtering</Text>
            <View style={styles.separator} />
            <Text style={styles.featureItem}>PDF Export</Text>
            <View style={styles.separator} />
            <Text style={styles.featureItem}>Customizable Fields</Text>
            <View style={styles.separator} />
            <Text style={styles.featureItem}>Multi-Camera Support</Text>
          </View>
        </View>

        {/* About the App Section */}
        <Text style={styles.outsideSectionTitle}>ABOUT THE APP</Text>
        <View style={styles.whiteContainer}>
          <Text style={styles.aboutText}>
            LogMe is a professional tool designed for film production crews to efficiently manage projects and takes. It offers features like take logging, smart filtering, PDF export, customizable fields, and multi-camera support.
          </Text>
        </View>

        {/* Contact Us Section */}
        <Text style={styles.outsideSectionTitle}>CONTACT US</Text>
        <View style={styles.whiteContainer}>
          <TouchableOpacity onPress={handleContactUs} style={styles.contactButton}>
            <Mail size={24} color={colors.text} />
          </TouchableOpacity>
          
          <TouchableOpacity onPress={handleFeedback} style={styles.contactButton}>
            <MessageCircle size={24} color={colors.text} />
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  versionSection: {
    backgroundColor: 'white',
    marginTop: 0,
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  versionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  versionLabel: {
    fontSize: 17,
    color: colors.text,
    fontWeight: '400',
  },
  versionValue: {
    fontSize: 17,
    color: colors.subtext,
    fontWeight: '400',
  },
  section: {
    backgroundColor: 'white',
    marginTop: 32,
    paddingHorizontal: 20,
    paddingVertical: 20,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.subtext,
    marginBottom: 20,
    letterSpacing: 0.5,
  },
  outsideSectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.text,
    marginTop: 32,
    marginBottom: 8,
    marginHorizontal: 20,
  },
  whiteContainer: {
    backgroundColor: 'white',
    paddingHorizontal: 20,
    paddingVertical: 20,
  },
  featuresList: {
    marginTop: 0,
  },
  featureItem: {
    fontSize: 17,
    color: colors.text,
    paddingVertical: 12,
    fontWeight: '400',
  },
  separator: {
    height: 1,
    backgroundColor: colors.border,
    marginLeft: 0,
  },
  aboutText: {
    fontSize: 17,
    color: colors.text,
    lineHeight: 24,
    fontWeight: '400',
  },
  contactButton: {
    paddingVertical: 12,
    marginBottom: 8,
  },
});