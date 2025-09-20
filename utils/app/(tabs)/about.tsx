import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Linking } from 'react-native';
import { colors } from '@/constants/colors';
import { Film, Camera, List, Download, Settings, Mail } from 'lucide-react-native';

export default function AboutScreen() {
  const handleContactUs = () => {
    Linking.openURL('mailto:logme.film@gmail.com');
  };

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <Film size={48} color={colors.primary} />
          <Text style={styles.title}>LogMe</Text>
          <Text style={styles.subtitle}>
            Professional film production logging tool
          </Text>
        </View>



        <View style={styles.section}>
          <Text style={styles.sectionTitle}>About LogMe</Text>
          <Text style={styles.text}>
            LogMe is a professional tool designed for film production crews to organize and manage their production documentation efficiently. Create projects with customizable log sheet fields, track takes by scene and shot, and maintain detailed production records.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Key Features</Text>
          
          <View style={styles.featureItem}>
            <Film size={24} color={colors.primary} style={styles.featureIcon} />
            <View style={styles.featureContent}>
              <Text style={styles.featureTitle}>Project Management</Text>
              <Text style={styles.featureDescription}>
                Create and organize film projects with customizable settings and field configurations.
              </Text>
            </View>
          </View>
          
          <View style={styles.featureItem}>
            <Camera size={24} color={colors.primary} style={styles.featureIcon} />
            <View style={styles.featureContent}>
              <Text style={styles.featureTitle}>Take Logging</Text>
              <Text style={styles.featureDescription}>
                Log takes with scene numbers, shot numbers, camera files, sound files, card numbers, and detailed notes.
              </Text>
            </View>
          </View>
          
          <View style={styles.featureItem}>
            <List size={24} color={colors.primary} style={styles.featureIcon} />
            <View style={styles.featureContent}>
              <Text style={styles.featureTitle}>Smart Filtering</Text>
              <Text style={styles.featureDescription}>
                Filter and sort your takes by scene and shot numbers for quick access to specific content.
              </Text>
            </View>
          </View>
          
          <View style={styles.featureItem}>
            <Download size={24} color={colors.primary} style={styles.featureIcon} />
            <View style={styles.featureContent}>
              <Text style={styles.featureTitle}>PDF Export</Text>
              <Text style={styles.featureDescription}>
                Export your projects as professional PDF log sheets for sharing and archival.
              </Text>
            </View>
          </View>
          
          <View style={styles.featureItem}>
            <Settings size={24} color={colors.primary} style={styles.featureIcon} />
            <View style={styles.featureContent}>
              <Text style={styles.featureTitle}>Customizable Fields</Text>
              <Text style={styles.featureDescription}>
                Configure which fields appear in your log sheets and add custom fields for your specific needs.
              </Text>
            </View>
          </View>

          <View style={styles.featureItem}>
            <Camera size={24} color={colors.primary} style={styles.featureIcon} />
            <View style={styles.featureContent}>
              <Text style={styles.featureTitle}>Multi-Camera Support</Text>
              <Text style={styles.featureDescription}>
                Configure multiple camera setups and track files from each camera separately.
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Contact Us</Text>
          <Text style={styles.text}>
            Have questions, feedback, or need support? We would love to hear from you!
          </Text>
          
          <TouchableOpacity onPress={handleContactUs} style={styles.contactButton}>
            <Mail size={24} color={colors.primary} style={styles.contactIcon} />
            <View style={styles.contactContent}>
              <Text style={styles.contactTitle}>Email Support</Text>
              <Text style={styles.contactEmail}>logme.film@gmail.com</Text>
            </View>
          </TouchableOpacity>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>
            © 2025 LogMe App
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f8f8',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 20,
  },
  header: {
    alignItems: 'center',
    padding: 24,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.text,
    marginTop: 12,
  },
  subtitle: {
    fontSize: 16,
    color: colors.subtext,
    marginTop: 4,
    textAlign: 'center',
  },

  section: {
    padding: 16,
    backgroundColor: 'white',
    marginTop: 16,
    borderRadius: 8,
    marginHorizontal: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 12,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: colors.subtext,
    marginBottom: 16,
    lineHeight: 20,
  },
  text: {
    fontSize: 16,
    color: colors.subtext,
    lineHeight: 24,
  },
  featureItem: {
    flexDirection: 'row',
    marginBottom: 16,
    alignItems: 'flex-start',
  },
  featureIcon: {
    marginRight: 12,
    marginTop: 2,
  },
  featureContent: {
    flex: 1,
  },
  featureTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 4,
  },
  featureDescription: {
    fontSize: 14,
    color: colors.subtext,
    lineHeight: 20,
  },
  contactButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
    padding: 16,
    backgroundColor: colors.primary + '10',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.primary + '30',
  },
  contactIcon: {
    marginRight: 12,
  },
  contactContent: {
    flex: 1,
  },
  contactTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 4,
  },
  contactEmail: {
    fontSize: 14,
    color: colors.primary,
    fontWeight: '500',
  },
  footer: {
    padding: 24,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 14,
    color: colors.subtext,
  },
});