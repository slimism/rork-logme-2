import React from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity,
  Alert,
  Platform,
} from 'react-native';
import { Modal } from '@/components/Modal';
import { Button } from '@/components/Button';
import { colors } from '@/constants/colors';
import { Crown, Check, Layers } from 'lucide-react-native';
import { useSubscriptionStore } from '@/store/subscriptionStore';

interface UpgradeModalProps {
  visible: boolean;
  onClose: () => void;
  onUpgrade?: () => void;
}

export const UpgradeModal: React.FC<UpgradeModalProps> = ({
  visible,
  onClose,
  onUpgrade,
}) => {
  const { setPro } = useSubscriptionStore();

  const handlePurchase = async () => {
    try {
      // In a real app, this would integrate with expo-in-app-purchases or similar
      // For now, we'll simulate the purchase
      if (Platform.OS === 'web') {
        // Web simulation
        const confirmed = window.confirm('Simulate purchase of Film Log Pro subscription?');
        if (confirmed) {
          setPro(true, new Date().toISOString());
          Alert.alert('Success!', 'Welcome to Film Log Pro!');
          onUpgrade?.();
          onClose();
        }
      } else {
        // Mobile simulation - in production, use actual IAP
        Alert.alert(
          'Purchase Film Log Pro',
          'Choose your subscription plan to unlock unlimited projects and remove ads.',
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Purchase',
              onPress: () => {
                setPro(true, new Date().toISOString());
                Alert.alert('Success!', 'Welcome to Film Log Pro!');
                onUpgrade?.();
                onClose();
              },
            },
          ]
        );
      }
    } catch (error) {
      Alert.alert('Error', 'Purchase failed. Please try again.');
    }
  };

  const features = [
    { icon: Crown, text: 'Unlimited projects' },
    { icon: null, text: 'Remove all advertisements' },
    { icon: Layers, text: 'Multi-camera configuration' },
    { icon: null, text: 'Episodes field for TV productions' },
    { icon: null, text: 'Custom fields for takes' },
  ];

  return (
    <Modal visible={visible} onClose={onClose} title="">
      <View style={styles.container}>
        <View style={styles.header}>
          <View style={styles.iconContainer}>
            <Crown size={32} color={colors.warning} />
          </View>
          <Text style={styles.title}>Upgrade to Pro</Text>
          <Text style={styles.subtitle}>
            Unlock the full potential of Film Log
          </Text>
        </View>

        <View style={styles.pricingContainer}>
          <View style={styles.pricingOption}>
            <Text style={styles.price}>$6.00</Text>
            <Text style={styles.priceSubtext}>Weekly</Text>
          </View>
          <View style={styles.pricingOption}>
            <Text style={styles.price}>$5.00</Text>
            <Text style={styles.priceSubtext}>Monthly</Text>
          </View>
          <View style={[styles.pricingOption, styles.bestValue]}>
            <Text style={styles.bestValueLabel}>BEST VALUE</Text>
            <Text style={styles.price}>$55.00</Text>
            <Text style={styles.priceSubtext}>Yearly</Text>
          </View>
        </View>

        <View style={styles.featuresContainer}>
          <Text style={styles.featuresTitle}>What you get:</Text>
          {features.map((feature, index) => {
            const IconComponent = feature.icon;
            return (
              <View key={index} style={styles.featureItem}>
                {IconComponent ? (
                  <IconComponent size={16} color={colors.success} />
                ) : (
                  <Check size={16} color={colors.success} />
                )}
                <Text style={styles.featureText}>{feature.text}</Text>
              </View>
            );
          })}
        </View>

        <View style={styles.limitInfo}>
          <Text style={styles.limitText}>
            Free version is limited to 2 projects
          </Text>
        </View>

        <View style={styles.buttons}>
          <Button
            title="Maybe Later"
            onPress={onClose}
            variant="outline"
            style={styles.button}
          />
          <Button
            title="Upgrade Now"
            onPress={handlePurchase}
            style={[styles.button, styles.upgradeButton]}
            icon={<Crown size={18} color="white" />}
          />
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: 24,
  },
  iconContainer: {
    width: 64,
    height: 64,
    backgroundColor: colors.warning + '20',
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: colors.subtext,
    textAlign: 'center',
  },
  pricingContainer: {
    marginBottom: 24,
    width: '100%',
    gap: 8,
  },
  pricingOption: {
    alignItems: 'center',
    padding: 12,
    backgroundColor: colors.primary + '10',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  bestValue: {
    backgroundColor: colors.warning + '20',
    borderColor: colors.warning,
    borderWidth: 2,
  },
  bestValueLabel: {
    fontSize: 12,
    fontWeight: 'bold',
    color: colors.warning,
    marginBottom: 4,
  },
  price: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.primary,
  },
  priceSubtext: {
    fontSize: 14,
    color: colors.subtext,
    marginTop: 2,
  },
  featuresContainer: {
    width: '100%',
    marginBottom: 20,
  },
  featuresTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 12,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  featureText: {
    fontSize: 16,
    color: colors.text,
    marginLeft: 12,
  },
  limitInfo: {
    backgroundColor: colors.warning + '10',
    padding: 12,
    borderRadius: 8,
    width: '100%',
    marginBottom: 24,
  },
  limitText: {
    fontSize: 14,
    color: colors.warning,
    textAlign: 'center',
    fontWeight: '500',
  },
  buttons: {
    flexDirection: 'row',
    width: '100%',
    gap: 12,
  },
  button: {
    flex: 1,
  },
  upgradeButton: {
    backgroundColor: colors.warning,
  },
});