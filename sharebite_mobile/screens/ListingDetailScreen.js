import React, { useState, useEffect, useContext } from 'react';
import { StyleSheet, Text, View, ScrollView, Image, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import api from '../services/api';
import { AuthContext } from '../context/AuthContext';
import { MapPin, Phone, Calendar, ArrowLeft, HeartHandshake, CheckCircle } from 'lucide-react-native';

const FOOD_TYPES = {
  prepared: 'Prepared Food 🍳',
  packaged: 'Packaged Goods 📦',
  produce: 'Fresh Produce 🍎',
  dairy: 'Dairy Products 🥛',
  bakery: 'Bakery Items 🥐',
  other: 'Other 🍽️',
};

export default function ListingDetailScreen({ route, navigation }) {
  const { listingId } = route.params;
  const [listing, setListing] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isClaiming, setIsClaiming] = useState(false);
  const { user } = useContext(AuthContext);

  const fetchListing = async () => {
    setIsLoading(true);
    try {
      const res = await api.get(`listings/${listingId}/`);
      setListing(res.data);
    } catch (e) {
      console.log(`Fetch listing detail error: ${e}`);
      Alert.alert('Error', 'Failed to load listing details.');
      navigation.goBack();
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchListing();
  }, [listingId]);

  const handleClaim = async () => {
    Alert.alert(
      'Confirm Claim',
      'Are you sure you want to claim this food item? Please coordinate pickup promptly.',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Claim', 
          onPress: async () => {
            setIsClaiming(true);
            try {
              // Create claim on backend
              await api.post('claims/', {
                listing_id: listing.id,
                message: 'Claimed via ShareBite mobile app'
              });
              
              Alert.alert('Success 🎉', 'Food item claimed successfully! You can track it in your Claims tab.', [
                { text: 'OK', onPress: () => navigation.navigate('HomeTabs', { screen: 'Claims' }) }
              ]);
            } catch (e) {
              const errMsg = e.response?.data?.error || e.response?.data?.detail || e.response?.data?.non_field_errors?.[0] || 'Failed to claim item.';
              Alert.alert('Claim Failed', errMsg);
            } finally {
              setIsClaiming(false);
            }
          }
        }
      ]
    );
  };

  if (isLoading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#f97316" />
      </View>
    );
  }

  if (!listing) return null;

  const isProvider = user?.id === listing.provider?.id;
  const timeRemaining = () => {
    const diff = new Date(listing.expiry_date) - new Date();
    if (diff <= 0) return 'Expired';
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    return hours > 0 ? `${hours}h ${mins}m left` : `${mins}m left`;
  };

  return (
    <View style={styles.container}>
      {/* Custom Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <ArrowLeft color="#ffffff" size={24} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Listing Details</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContainer}>
        {listing.image ? (
          <Image source={{ uri: listing.image }} style={styles.image} />
        ) : (
          <View style={styles.imagePlaceholder}>
            <Text style={{ fontSize: 72 }}>🥗</Text>
          </View>
        )}

        <View style={styles.contentContainer}>
          <View style={styles.titleRow}>
            <Text style={styles.title}>{listing.title}</Text>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{FOOD_TYPES[listing.food_type] || FOOD_TYPES.other}</Text>
            </View>
          </View>

          <Text style={styles.quantity}>Quantity: {listing.quantity}</Text>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Description</Text>
            <Text style={styles.descriptionText}>{listing.description || 'No description provided.'}</Text>
          </View>

          <View style={styles.infoCard}>
            <View style={styles.infoRow}>
              <Calendar size={20} color="#f97316" />
              <View style={styles.infoTextContainer}>
                <Text style={styles.infoLabel}>Expiry Date</Text>
                <Text style={styles.infoVal}>{new Date(listing.expiry_date).toLocaleString()} ({timeRemaining()})</Text>
              </View>
            </View>

            <View style={styles.infoRow}>
              <MapPin size={20} color="#3b82f6" />
              <View style={styles.infoTextContainer}>
                <Text style={styles.infoLabel}>Pickup Location</Text>
                <Text style={styles.infoVal}>{listing.pickup_location}</Text>
              </View>
            </View>

            <View style={styles.infoRow}>
              <Phone size={20} color="#10b981" />
              <View style={styles.infoTextContainer}>
                <Text style={styles.infoLabel}>Contact Number</Text>
                <Text style={styles.infoVal}>{listing.phone_number}</Text>
              </View>
            </View>
          </View>
          
          {listing.dietary_tags && (
            <View style={styles.tagsContainer}>
              {listing.dietary_tags.split(',').map((tag, idx) => (
                <View key={idx} style={styles.tag}>
                  <Text style={styles.tagText}>#{tag.trim()}</Text>
                </View>
              ))}
            </View>
          )}
        </View>
      </ScrollView>

      {/* Claim Action Button */}
      {listing.status === 'available' && !isProvider && (
        <View style={styles.actionContainer}>
          <TouchableOpacity 
            style={[styles.claimButton, isClaiming && styles.disabledButton]} 
            onPress={handleClaim}
            disabled={isClaiming}
          >
            {isClaiming ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <>
                <HeartHandshake color="#ffffff" size={22} style={{ marginRight: 8 }} />
                <Text style={styles.claimButtonText}>Claim Surplus Food</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      )}

      {listing.status !== 'available' && (
        <View style={styles.actionContainer}>
          <View style={styles.statusBanner}>
            <CheckCircle color="#10b981" size={20} style={{ marginRight: 8 }} />
            <Text style={styles.statusBannerText}>This listing status is: {listing.status.toUpperCase()}</Text>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 40,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#1e293b',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  scrollContainer: {
    flexGrow: 1,
  },
  image: {
    width: '100%',
    height: 250,
  },
  imagePlaceholder: {
    width: '100%',
    height: 250,
    backgroundColor: '#334155',
    justifyContent: 'center',
    alignItems: 'center',
  },
  contentContainer: {
    padding: 20,
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#ffffff',
    flex: 1,
    marginRight: 10,
  },
  badge: {
    backgroundColor: '#1e293b',
    borderColor: '#334155',
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  badgeText: {
    color: '#f97316',
    fontSize: 12,
    fontWeight: 'bold',
  },
  quantity: {
    fontSize: 16,
    color: '#94a3b8',
    marginBottom: 20,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 8,
  },
  descriptionText: {
    fontSize: 15,
    color: '#cbd5e1',
    lineHeight: 22,
  },
  infoCard: {
    backgroundColor: '#1e293b',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#334155',
    marginBottom: 20,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  infoTextContainer: {
    marginLeft: 12,
    flex: 1,
  },
  infoLabel: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '500',
  },
  infoVal: {
    fontSize: 14,
    color: '#ffffff',
    marginTop: 2,
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 20,
  },
  tag: {
    backgroundColor: '#1e293b',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginRight: 8,
    marginBottom: 8,
  },
  tagText: {
    color: '#cbd5e1',
    fontSize: 12,
  },
  actionContainer: {
    padding: 20,
    backgroundColor: '#0f172a',
    borderTopWidth: 1,
    borderTopColor: '#1e293b',
  },
  claimButton: {
    backgroundColor: '#f97316',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 16,
    borderRadius: 12,
    shadowColor: '#f97316',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  disabledButton: {
    opacity: 0.6,
  },
  claimButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
  statusBanner: {
    backgroundColor: '#064e3b',
    borderColor: '#065f46',
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 14,
    borderRadius: 12,
  },
  statusBannerText: {
    color: '#34d399',
    fontSize: 15,
    fontWeight: '600',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0f172a',
  },
});
