import React, { useState, useEffect, useCallback, useContext } from 'react';
import { StyleSheet, Text, View, FlatList, TouchableOpacity, RefreshControl, ActivityIndicator, Alert, Image, Platform, Linking } from 'react-native';
import api from '../services/api';
import { AuthContext } from '../context/AuthContext';
import { CheckCircle2, AlertCircle, Clock, ShoppingBag, Trash2, Navigation } from 'lucide-react-native';

const STATUS_BADGES = {
  pending: { bg: '#3b0712', border: '#7f1d1d', text: '#fca5a5', label: 'Pending Approval' },
  confirmed: { bg: '#022c22', border: '#064e3b', text: '#6ee7b7', label: 'Approved / Ready' },
  in_progress: { bg: '#1c1917', border: '#44403c', text: '#fdba74', label: 'In Progress' },
  completed: { bg: '#064e3b', border: '#065f46', text: '#34d399', label: 'Completed' },
  cancelled: { bg: '#180202', border: '#450a0a', text: '#f87171', label: 'Cancelled' },
};

export default function ClaimsScreen({ navigation }) {
  const [activeTab, setActiveTab] = useState('claims'); // 'claims' or 'listings'
  const [claims, setClaims] = useState([]);
  const [listings, setListings] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const { user } = useContext(AuthContext);

  const fetchClaims = async (showLoading = true) => {
    if (showLoading) setIsLoading(true);
    try {
      const res = await api.get('claims/');
      const dataList = res.data.results || res.data;
      setClaims(dataList);
    } catch (e) {
      console.log(`Fetch claims error: ${e}`);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  const fetchMyListings = async (showLoading = true) => {
    if (showLoading) setIsLoading(true);
    try {
      const res = await api.get('listings/my_listings/');
      const dataList = res.data.results || res.data;
      setListings(dataList);
    } catch (e) {
      console.log(`Fetch myListings error: ${e}`);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  const fetchData = (showLoading = true) => {
    if ((user?.role === 'provider' || user?.role === 'ngo' || user?.role === 'individual') && activeTab === 'listings') {
      fetchMyListings(showLoading);
    } else {
      fetchClaims(showLoading);
    }
  };

  useEffect(() => {
    fetchData();
    if ((user?.role === 'provider' || user?.role === 'ngo' || user?.role === 'individual') && listings.length === 0) {
      // Quietly fetch listings to count them for the tab badge
      api.get('listings/my_listings/')
        .then(res => setListings(res.data.results || res.data))
        .catch(err => console.log(err));
    }
  }, [activeTab]);

  const onRefresh = useCallback(() => {
    setIsRefreshing(true);
    fetchData(false);
  }, [activeTab]);

  const handleUpdateStatus = async (claimId, newStatus) => {
    Alert.alert(
      'Update Claim Status',
      `Are you sure you want to mark this claim as ${newStatus}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm',
          onPress: async () => {
            try {
              await api.patch(`claims/${claimId}/`, { status: newStatus });
              Alert.alert('Status Updated', 'The claim status has been successfully updated.');
              fetchClaims(false);
            } catch (e) {
              const errMsg = e.response?.data?.detail || 'Failed to update status.';
              Alert.alert('Error', errMsg);
            }
          }
        }
      ]
    );
  };

  const handleDeleteListing = async (listingId) => {
    Alert.alert(
      'Delete Listing',
      'Are you sure you want to permanently delete this listing? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.delete(`listings/${listingId}/`);
              Alert.alert('Success', 'Listing deleted successfully.');
              fetchMyListings(false);
            } catch (e) {
              const errMsg = e.response?.data?.detail || 'Failed to delete listing.';
              Alert.alert('Error', errMsg);
            }
          }
        }
      ]
    );
  };

  const renderListingItem = ({ item }) => {
    const statusBadges = {
      available: { bg: '#022c22', border: '#064e3b', text: '#6ee7b7', label: 'Available' },
      claimed: { bg: '#1c1917', border: '#44403c', text: '#fdba74', label: 'Claimed' },
      completed: { bg: '#0f172a', border: '#1e293b', text: '#94a3b8', label: 'Completed' },
    };
    const badge = statusBadges[item.status] || statusBadges.available;

    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.foodTitle} numberOfLines={1}>{item.title}</Text>
          <View style={[styles.statusBadge, { backgroundColor: badge.bg, borderColor: badge.border }]}>
            <Text style={[styles.statusBadgeText, { color: badge.text }]}>{badge.label}</Text>
          </View>
        </View>

        <View style={styles.cardBodyContainer}>
          {item.image ? (
            <Image source={{ uri: item.image }} style={styles.cardThumbnail} />
          ) : null}
          <View style={styles.cardDetails}>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Quantity:</Text>
              <Text style={styles.detailValue}>{item.quantity}</Text>
            </View>

            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Food Type:</Text>
              <Text style={styles.detailValue}>{item.food_type?.toUpperCase()}</Text>
            </View>

            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Listed on:</Text>
              <Text style={styles.detailValue}>{new Date(item.created_at).toLocaleDateString()}</Text>
            </View>

            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Expires:</Text>
              <Text style={styles.detailValue}>{new Date(item.expiry_date).toLocaleString()}</Text>
            </View>
          </View>
        </View>

        {item.status === 'available' && (
          <View style={styles.cardFooter}>
            <TouchableOpacity 
              style={[styles.actionBtn, styles.declineBtn, { flexDirection: 'row', width: '100%' }]}
              onPress={() => handleDeleteListing(item.id)}
            >
              <Trash2 color="#f87171" size={16} style={{ marginRight: 6 }} />
              <Text style={styles.declineBtnText}>Delete Listing</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };

  const handleGetDirections = (listing) => {
    if (!listing) return;
    const startLat = user?.latitude;
    const startLng = user?.longitude;
    const startAddress = user?.address;
    const destLat = listing.latitude;
    const destLng = listing.longitude;

    let url = '';
    let webUrl = '';

    if (startLat && startLng && destLat && destLng) {
      url = `https://www.google.com/maps/dir/?api=1&origin=${startLat},${startLng}&destination=${destLat},${destLng}&travelmode=driving`;
      webUrl = url;
    } else if (startAddress && destLat && destLng) {
      const encodedOrigin = encodeURIComponent(startAddress);
      url = `https://www.google.com/maps/dir/?api=1&origin=${encodedOrigin}&destination=${destLat},${destLng}&travelmode=driving`;
      webUrl = url;
    } else {
      const scheme = Platform.select({ ios: 'maps://app?daddr=', android: 'google.navigation:q=' });
      if (destLat && destLng) {
        if (startAddress) {
          const encodedOrigin = encodeURIComponent(startAddress);
          url = `https://www.google.com/maps/dir/?api=1&origin=${encodedOrigin}&destination=${destLat},${destLng}&travelmode=driving`;
          webUrl = url;
        } else {
          url = Platform.select({
            ios: `${scheme}${destLat},${destLng}`,
            android: `${scheme}${destLat},${destLng}`
          });
          webUrl = `https://www.google.com/maps/dir/?api=1&destination=${destLat},${destLng}`;
        }
      } else {
        const encodedAddress = encodeURIComponent(listing.pickup_location || 'Food Pickup Location');
        if (startAddress) {
          const encodedOrigin = encodeURIComponent(startAddress);
          url = `https://www.google.com/maps/dir/?api=1&origin=${encodedOrigin}&destination=${encodedAddress}&travelmode=driving`;
          webUrl = url;
        } else {
          url = Platform.select({
            ios: `${scheme}${encodedAddress}`,
            android: `${scheme}${encodedAddress}`
          });
          webUrl = `https://www.google.com/maps/dir/?api=1&destination=${encodedAddress}`;
        }
      }
    }

    Linking.canOpenURL(url).then(supported => {
      if (supported) {
        Linking.openURL(url);
      } else {
        Linking.openURL(webUrl);
      }
    }).catch(() => {
      Linking.openURL(webUrl);
    });
  };

  const renderItem = ({ item }) => {
    const isProviderOfClaim = user?.username === item.listing?.provider_name;
    const isReceiverOfClaim = user?.username === item.receiver?.username;
    const badge = STATUS_BADGES[item.status] || STATUS_BADGES.pending;

    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.foodTitle} numberOfLines={1}>{item.listing?.title || 'Surplus Food'}</Text>
          <View style={[styles.statusBadge, { backgroundColor: badge.bg, borderColor: badge.border }]}>
            <Text style={[styles.statusBadgeText, { color: badge.text }]}>{badge.label}</Text>
          </View>
        </View>

        <View style={styles.cardBodyContainer}>
          {item.listing?.image ? (
            <Image source={{ uri: item.listing.image }} style={styles.cardThumbnail} />
          ) : null}
          <View style={styles.cardDetails}>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Quantity:</Text>
              <Text style={styles.detailValue}>{item.listing?.quantity || 'N/A'}</Text>
            </View>

            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>{isReceiverOfClaim ? 'Provider:' : 'Receiver:'}</Text>
              <Text style={styles.detailValue}>@{isReceiverOfClaim ? item.listing?.provider_name : item.receiver?.username}</Text>
            </View>

            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Contact Phone:</Text>
              <Text style={styles.detailValue}>{item.listing?.phone_number || 'N/A'}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Pickup Location:</Text>
              <Text style={styles.detailValue} numberOfLines={2}>{item.listing?.pickup_location || 'N/A'}</Text>
            </View>
          </View>
        </View>
        
        {item.message && (
          <View style={styles.messageBox}>
            <Text style={styles.messageText}>"{item.message}"</Text>
          </View>
        )}

        {/* Action Button for changing status */}
        <View style={styles.cardFooter}>
          {isProviderOfClaim && item.status === 'pending' && (
            <View style={styles.buttonGroup}>
              <TouchableOpacity 
                style={[styles.actionBtn, styles.declineBtn]}
                onPress={() => handleUpdateStatus(item.id, 'cancelled')}
              >
                <Text style={styles.declineBtnText}>Reject</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.actionBtn, styles.approveBtn]}
                onPress={() => handleUpdateStatus(item.id, 'confirmed')}
              >
                <Text style={styles.approveBtnText}>Approve</Text>
              </TouchableOpacity>
            </View>
          )}

          {isReceiverOfClaim && item.status === 'confirmed' && (
            <View style={styles.actionRowContainer}>
              <TouchableOpacity 
                style={[styles.actionBtn, styles.completeBtn, { flex: 1 }]}
                onPress={() => handleUpdateStatus(item.id, 'completed')}
              >
                <CheckCircle2 color="#ffffff" size={16} style={{ marginRight: 6 }} />
                <Text style={styles.completeBtnText}>Mark as Picked Up</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.iconRoutingBtn}
                onPress={() => handleGetDirections(item.listing)}
              >
                <Navigation color="#38bdf8" size={18} />
              </TouchableOpacity>
            </View>
          )}

          {item.status === 'completed' && (
            <View style={styles.completedBannerContainer}>
              <View style={styles.completedBanner}>
                <CheckCircle2 color="#10b981" size={16} style={{ marginRight: 6 }} />
                <Text style={styles.completedText}>Claim complete, food rescued!</Text>
              </View>
              {isReceiverOfClaim && (
                <TouchableOpacity 
                  style={styles.iconRoutingBtn}
                  onPress={() => handleGetDirections(item.listing)}
                >
                  <Navigation color="#38bdf8" size={18} />
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Rescued Claims</Text>
        <Text style={styles.headerSubtitle}>Track claims and pickup coordination</Text>
      </View>

      {(user?.role === 'provider' || user?.role === 'ngo' || user?.role === 'individual') && (
        <View style={styles.tabContainer}>
          <TouchableOpacity 
            style={[styles.tabButton, activeTab === 'claims' && styles.activeTabButton]}
            onPress={() => setActiveTab('claims')}
          >
            <Text style={[styles.tabButtonText, activeTab === 'claims' && styles.activeTabButtonText]}>
              Claim Requests
            </Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.tabButton, activeTab === 'listings' && styles.activeTabButton]}
            onPress={() => setActiveTab('listings')}
          >
            <Text style={[styles.tabButtonText, activeTab === 'listings' && styles.activeTabButtonText]}>
              My Listings ({listings.length})
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {isLoading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#f97316" />
        </View>
      ) : activeTab === 'listings' ? (
        listings.length === 0 ? (
          <View style={styles.centerContainer}>
            <ShoppingBag size={48} color="#475569" style={{ marginBottom: 12 }} />
            <Text style={styles.emptyTitle}>No Listings Found</Text>
            <Text style={styles.emptySubtitle}>You haven't posted any food listings yet.</Text>
          </View>
        ) : (
          <FlatList
            data={listings}
            renderItem={renderListingItem}
            keyExtractor={(item) => item.id.toString()}
            contentContainerStyle={styles.listContainer}
            refreshControl={
              <RefreshControl 
                refreshing={isRefreshing} 
                onRefresh={onRefresh} 
                tintColor="#f97316"
                colors={['#f97316']}
              />
            }
          />
        )
      ) : claims.length === 0 ? (
        <View style={styles.centerContainer}>
          <ShoppingBag size={48} color="#475569" style={{ marginBottom: 12 }} />
          <Text style={styles.emptyTitle}>No Claims Found</Text>
          <Text style={styles.emptySubtitle}>You haven't made or received any claims yet.</Text>
        </View>
      ) : (
        <FlatList
          data={claims}
          renderItem={renderItem}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={styles.listContainer}
          refreshControl={
            <RefreshControl 
              refreshing={isRefreshing} 
              onRefresh={onRefresh} 
              tintColor="#f97316"
              colors={['#f97316']}
            />
          }
        />
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
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 12,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#64748b',
    marginTop: 4,
  },
  listContainer: {
    paddingHorizontal: 20,
    paddingBottom: 24,
  },
  card: {
    backgroundColor: '#1e293b',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#334155',
    marginBottom: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
    paddingBottom: 12,
    marginBottom: 12,
  },
  foodTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#ffffff',
    flex: 1,
    marginRight: 10,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: 'bold',
  },
  cardBody: {
    marginBottom: 12,
  },
  detailRow: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  detailLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#64748b',
    width: 120,
  },
  detailValue: {
    fontSize: 14,
    color: '#cbd5e1',
    flex: 1,
  },
  messageBox: {
    backgroundColor: '#0f172a',
    borderRadius: 8,
    padding: 8,
    marginTop: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#f97316',
  },
  messageText: {
    color: '#94a3b8',
    fontSize: 13,
    fontStyle: 'italic',
  },
  cardFooter: {
    borderTopWidth: 1,
    borderTopColor: '#334155',
    paddingTop: 12,
  },
  buttonGroup: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  actionBtn: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: 10,
    flex: 1,
  },
  declineBtn: {
    backgroundColor: '#3b0712',
    borderWidth: 1,
    borderColor: '#7f1d1d',
    marginRight: 8,
  },
  declineBtnText: {
    color: '#f87171',
    fontWeight: 'bold',
  },
  approveBtn: {
    backgroundColor: '#064e3b',
    borderWidth: 1,
    borderColor: '#065f46',
    marginLeft: 8,
  },
  approveBtnText: {
    color: '#34d399',
    fontWeight: 'bold',
  },
  completeBtn: {
    backgroundColor: '#f97316',
  },
  completeBtnText: {
    color: '#ffffff',
    fontWeight: 'bold',
  },
  completedBanner: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 8,
  },
  completedText: {
    color: '#10b981',
    fontSize: 14,
    fontWeight: '600',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 4,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#64748b',
    textAlign: 'center',
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 4,
    marginHorizontal: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#334155',
  },
  tabButton: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 8,
  },
  activeTabButton: {
    backgroundColor: '#f97316',
  },
  tabButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#94a3b8',
  },
  activeTabButtonText: {
    color: '#ffffff',
  },
  cardBodyContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  cardThumbnail: {
    width: 80,
    height: 80,
    borderRadius: 8,
    marginRight: 12,
    backgroundColor: '#0f172a',
  },
  cardDetails: {
    flex: 1,
  },
  actionRowContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
  },
  completedBannerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
  },
  iconRoutingBtn: {
    width: 38,
    height: 38,
    borderRadius: 8,
    backgroundColor: '#1e293b',
    borderWidth: 1,
    borderColor: '#334155',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 12,
  },
});
