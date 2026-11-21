import React, { useState, useEffect, useCallback, useContext } from 'react';
import { StyleSheet, Text, View, FlatList, Image, TouchableOpacity, RefreshControl, TextInput, ActivityIndicator } from 'react-native';
import api from '../services/api';
import { AuthContext } from '../context/AuthContext';
import { MapPin, Calendar, Compass, Search, Filter } from 'lucide-react-native';

const FOOD_TYPES = {
  all: 'All Food 🍽️',
  prepared: 'Prepared Food 🍳',
  packaged: 'Packaged Goods 📦',
  produce: 'Fresh Produce 🍎',
  dairy: 'Dairy Products 🥛',
  bakery: 'Bakery Items 🥐',
  other: 'Other 🍽️',
};

export default function BrowseScreen({ navigation }) {
  const [listings, setListings] = useState([]);
  const [filteredListings, setFilteredListings] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState('all');
  
  const { user } = useContext(AuthContext);

  const fetchListings = async (showLoading = true) => {
    if (showLoading) setIsLoading(true);
    try {
      // Fetch only "available" listings
      const res = await api.get('listings/?status=available');
      const dataList = res.data.results || res.data;
      
      // Sort: newest listings first (highest ID or newest created_at)
      dataList.sort((a, b) => {
        const dateA = a.created_at ? new Date(a.created_at) : new Date(0);
        const dateB = b.created_at ? new Date(b.created_at) : new Date(0);
        if (dateA.getTime() !== dateB.getTime()) {
          return dateB - dateA;
        }
        return b.id - a.id;
      });

      setListings(dataList);
      applyFilters(dataList, searchQuery, selectedType);
    } catch (e) {
      console.log(`Fetch listings error: ${e}`);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchListings();
  }, []);

  const onRefresh = useCallback(() => {
    setIsRefreshing(true);
    fetchListings(false);
  }, []);

  const applyFilters = (data, search, type) => {
    let filtered = [...data];
    
    if (search.trim()) {
      const q = search.toLowerCase();
      filtered = filtered.filter(item => 
        (item.title && item.title.toLowerCase().includes(q)) || 
        (item.description && item.description.toLowerCase().includes(q)) ||
        (item.pickup_location && item.pickup_location.toLowerCase().includes(q))
      );
    }
    
    if (type !== 'all') {
      filtered = filtered.filter(item => item.food_type === type);
    }
    
    setFilteredListings(filtered);
  };

  const handleSearch = (text) => {
    setSearchQuery(text);
    applyFilters(listings, text, selectedType);
  };

  const handleTypeSelect = (type) => {
    const newType = selectedType === type ? 'all' : type;
    setSelectedType(newType);
    applyFilters(listings, searchQuery, newType);
  };

  const renderItem = ({ item }) => {
    const timeRemaining = () => {
      if (!item.expiry_date) return 'Expired';
      const diff = new Date(item.expiry_date) - new Date();
      if (isNaN(diff) || diff <= 0) return 'Expired';
      const hours = Math.floor(diff / (1000 * 60 * 60));
      const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      return hours > 0 ? `${hours}h ${mins}m left` : `${mins}m left`;
    };

    return (
      <TouchableOpacity 
        style={styles.card}
        onPress={() => navigation.navigate('ListingDetail', { listingId: item.id })}
      >
        {item.image ? (
          <Image source={{ uri: item.image }} style={styles.cardImage} />
        ) : (
          <View style={styles.cardImagePlaceholder}>
            <Text style={{ fontSize: 40 }}>🥗</Text>
          </View>
        )}
        <View style={styles.cardBadge}>
          <Text style={styles.cardBadgeText}>{FOOD_TYPES[item.food_type] || FOOD_TYPES.other}</Text>
        </View>
        <View style={styles.cardContent}>
          <Text style={styles.cardTitle}>{item.title}</Text>
          <Text style={styles.cardQuantity}>Quantity: {item.quantity}</Text>
          
          <View style={styles.cardMeta}>
            <View style={styles.metaRow}>
              <MapPin size={14} color="#64748b" />
              <Text style={styles.metaText} numberOfLines={1}>{item.pickup_location}</Text>
            </View>
            <View style={styles.metaRow}>
              <Calendar size={14} color="#f97316" />
              <Text style={[styles.metaText, styles.expiryText]}>{timeRemaining()}</Text>
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Available Food</Text>
        <Text style={styles.headerSubtitle}>Discover surplus food near you</Text>
      </View>

      <View style={styles.searchBarContainer}>
        <Search size={20} color="#64748b" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search items, locations..."
          placeholderTextColor="#64748b"
          value={searchQuery}
          onChangeText={handleSearch}
        />
      </View>

      {/* Filter Horizontal Scroll */}
      <View style={{ height: 48, marginBottom: 12 }}>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={Object.keys(FOOD_TYPES)}
          keyExtractor={(item) => item}
          contentContainerStyle={styles.filterList}
          renderItem={({ item }) => (
            <TouchableOpacity 
              style={[
                styles.filterChip, 
                selectedType === item && styles.filterChipActive
              ]}
              onPress={() => handleTypeSelect(item)}
            >
              <Text style={[
                styles.filterChipText, 
                selectedType === item && styles.filterChipTextActive
              ]}>
                {FOOD_TYPES[item]}
              </Text>
            </TouchableOpacity>
          )}
        />
      </View>

      {isLoading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#f97316" />
        </View>
      ) : filteredListings.length === 0 ? (
        <View style={styles.centerContainer}>
          <Compass size={48} color="#475569" style={{ marginBottom: 12 }} />
          <Text style={styles.emptyTitle}>No Listings Found</Text>
          <Text style={styles.emptySubtitle}>Try pulling down to refresh or check back later.</Text>
        </View>
      ) : (
        <FlatList
          data={filteredListings}
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
  searchBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1e293b',
    borderRadius: 12,
    marginHorizontal: 20,
    marginBottom: 16,
    paddingHorizontal: 12,
    height: 48,
    borderWidth: 1,
    borderColor: '#334155',
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    color: '#ffffff',
    fontSize: 16,
  },
  filterList: {
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#1e293b',
    borderRadius: 20,
    marginRight: 10,
    borderWidth: 1,
    borderColor: '#334155',
  },
  filterChipActive: {
    backgroundColor: '#f97316',
    borderColor: '#f97316',
  },
  filterChipText: {
    color: '#cbd5e1',
    fontWeight: '600',
    fontSize: 13,
  },
  filterChipTextActive: {
    color: '#ffffff',
  },
  listContainer: {
    paddingHorizontal: 20,
    paddingBottom: 24,
  },
  card: {
    backgroundColor: '#1e293b',
    borderRadius: 16,
    marginBottom: 18,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#334155',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
  },
  cardImage: {
    width: '100%',
    height: 160,
  },
  cardImagePlaceholder: {
    width: '100%',
    height: 160,
    backgroundColor: '#334155',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardBadge: {
    position: 'absolute',
    top: 12,
    left: 12,
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  cardBadgeText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  cardContent: {
    padding: 16,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 4,
  },
  cardQuantity: {
    fontSize: 14,
    color: '#94a3b8',
    marginBottom: 12,
  },
  cardMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: '#334155',
    paddingTop: 12,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  metaText: {
    fontSize: 13,
    color: '#64748b',
    marginLeft: 4,
  },
  expiryText: {
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
});
