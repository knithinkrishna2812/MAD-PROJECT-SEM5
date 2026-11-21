import React, { useState, useEffect, useRef, useContext } from 'react';
import { 
  StyleSheet, 
  View, 
  Text, 
  TouchableOpacity, 
  ActivityIndicator, 
  Image, 
  Platform, 
  Linking 
} from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import MapViewDirections from 'react-native-maps-directions';
import * as Location from 'expo-location';
import { Compass, RefreshCw, Navigation, MapPin } from 'lucide-react-native';
import api from '../services/api';
import { AuthContext } from '../context/AuthContext';

const CHENNAI_COORDINATES = {
  latitude: 13.0827,
  longitude: 80.2707,
  latitudeDelta: 0.15,
  longitudeDelta: 0.15,
};

const FOOD_TYPES = {
  veg: 'Veg 🟢',
  non_veg: 'Non-Veg 🔴',
  produce: 'Fresh Produce 🍎',
  dairy: 'Dairy Products 🥛',
  bakery: 'Bakery Items 🥐',
  other: 'Other 🍽️',
};

// Premium Sleek Dark Map Styling for Glassmorphism UI theme
const darkMapStyle = [
  { "elementType": "geometry", "stylers": [{ "color": "#0f172a" }] },
  { "elementType": "labels.text.fill", "stylers": [{ "color": "#94a3b8" }] },
  { "elementType": "labels.text.stroke", "stylers": [{ "color": "#0f172a" }] },
  { "featureType": "administrative", "elementType": "geometry.stroke", "stylers": [{ "color": "#334155" }] },
  { "featureType": "administrative.land_parcel", "elementType": "labels.text.fill", "stylers": [{ "color": "#475569" }] },
  { "featureType": "landscape.man_made", "elementType": "geometry.stroke", "stylers": [{ "color": "#1e293b" }] },
  { "featureType": "poi", "elementType": "labels.text.fill", "stylers": [{ "color": "#38bdf8" }] },
  { "featureType": "poi.park", "elementType": "geometry", "stylers": [{ "color": "#14532d" }] },
  { "featureType": "poi.park", "elementType": "labels.text.fill", "stylers": [{ "color": "#4ade80" }] },
  { "featureType": "road", "elementType": "geometry", "stylers": [{ "color": "#1e293b" }] },
  { "featureType": "road", "elementType": "geometry.stroke", "stylers": [{ "color": "#334155" }] },
  { "featureType": "road", "elementType": "labels.text.fill", "stylers": [{ "color": "#cbd5e1" }] },
  { "featureType": "road.highway", "elementType": "geometry", "stylers": [{ "color": "#f97316" }, { "weight": 1 }] },
  { "featureType": "road.highway", "elementType": "geometry.stroke", "stylers": [{ "color": "#ea580c" }] },
  { "featureType": "road.highway", "elementType": "labels.text.fill", "stylers": [{ "color": "#ffedd5" }] },
  { "featureType": "water", "elementType": "geometry", "stylers": [{ "color": "#0369a1" }] },
  { "featureType": "water", "elementType": "labels.text.fill", "stylers": [{ "color": "#bae6fd" }] }
];

export default function MapScreen() {
  const mapRef = useRef(null);
  const [listings, setListings] = useState([]);
  const [userLocation, setUserLocation] = useState(null);
  const [mapRegion, setMapRegion] = useState(CHENNAI_COORDINATES);
  const [selectedListing, setSelectedListing] = useState(null);
  const [directionsError, setDirectionsError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const { user } = useContext(AuthContext);

  const requestLocationAndFetchListings = async (showLoading = true) => {
    if (showLoading) setIsLoading(true);
    
    try {
      // 1. Fetch Food Listings (available ones + claimed ones by this user)
      const listingsRes = await api.get('listings/?status=available');
      const availableListings = listingsRes.data.results || listingsRes.data;

      let claimedListings = [];
      try {
        const claimsRes = await api.get('claims/');
        const claimsData = claimsRes.data.results || claimsRes.data;
        claimedListings = claimsData
          .filter(claim => ['pending', 'confirmed', 'in_progress'].includes(claim.status))
          .map(claim => claim.listing)
          .filter(listing => listing !== null && listing !== undefined);
      } catch (claimErr) {
        console.log('Error fetching claims for map:', claimErr);
      }

      // Merge and remove duplicates by ID
      const mergedMap = new Map();
      availableListings.forEach(item => mergedMap.set(item.id, item));
      claimedListings.forEach(item => mergedMap.set(item.id, item));
      
      setListings(Array.from(mergedMap.values()));
    } catch (error) {
      console.log('Error loading coordinates from backend:', error);
    } finally {
      // Release the loading screen immediately so the map renders!
      setIsLoading(false);
    }

    // 2. Fetch User Location asynchronously in the background so it never blocks the map UI!
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          const lastKnown = await Location.getLastKnownPositionAsync({});
          if (lastKnown) {
            setUserLocation({
              latitude: lastKnown.coords.latitude,
              longitude: lastKnown.coords.longitude,
              latitudeDelta: 0.1,
              longitudeDelta: 0.1,
            });
          }
        }
      } catch (locError) {
        console.log('Background location error:', locError);
      }
    })();
  };

  useEffect(() => {
    requestLocationAndFetchListings(true);
  }, []);

  const fitMapToPins = () => {
    if (listings.length > 0) {
      // Filter out invalid coordinates and focus on Chennai/Karur region (ignoring NY/Dubai outliers)
      const points = listings
        .map(l => ({
          latitude: parseFloat(l.latitude),
          longitude: parseFloat(l.longitude),
        }))
        .filter(p => !isNaN(p.latitude) && !isNaN(p.longitude) && p.latitude > 8 && p.latitude < 15); // Chennai/Karur coordinate range
      
      if (points.length > 0) {
        // Calculate bounding box center and delta manually
        let minLat = points[0].latitude;
        let maxLat = points[0].latitude;
        let minLng = points[0].longitude;
        let maxLng = points[0].longitude;
        
        points.forEach(p => {
          if (p.latitude < minLat) minLat = p.latitude;
          if (p.latitude > maxLat) maxLat = p.latitude;
          if (p.longitude < minLng) minLng = p.longitude;
          if (p.longitude > maxLng) maxLng = p.longitude;
        });
        
        const centerLat = (minLat + maxLat) / 2;
        const centerLng = (minLng + maxLng) / 2;
        // Make sure delta is not 0 (adds buffer padding around listings)
        const latDelta = Math.max((maxLat - minLat) * 1.5, 0.08);
        const lngDelta = Math.max((maxLng - minLng) * 1.5, 0.08);
        
        setMapRegion({
          latitude: centerLat,
          longitude: centerLng,
          latitudeDelta: latDelta,
          longitudeDelta: lngDelta,
        });
      }
    }
  };

  useEffect(() => {
    fitMapToPins();
  }, [listings]);

  const handleGetDirections = (lat, lng, address) => {
    const startLat = user?.latitude;
    const startLng = user?.longitude;
    const startAddress = user?.address;

    let url = '';
    let webUrl = '';

    if (startLat && startLng) {
      // Route directly from NGO registered coordinates to Listing coordinates
      url = `https://www.google.com/maps/dir/?api=1&origin=${startLat},${startLng}&destination=${lat},${lng}&travelmode=driving`;
      webUrl = url;
    } else if (startAddress) {
      // Fallback: route from NGO registered text address
      const encodedOrigin = encodeURIComponent(startAddress);
      url = `https://www.google.com/maps/dir/?api=1&origin=${encodedOrigin}&destination=${lat},${lng}&travelmode=driving`;
      webUrl = url;
    } else {
      // Fallback: route from current live GPS
      const scheme = Platform.select({ ios: 'maps://app?daddr=', android: 'google.navigation:q=' });
      url = Platform.select({
        ios: `${scheme}${lat},${lng}`,
        android: `${scheme}${lat},${lng}`
      });
      webUrl = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
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

  const focusRoute = (listing) => {
    const startLat = user?.latitude ? parseFloat(user.latitude) : userLocation?.latitude;
    const startLng = user?.longitude ? parseFloat(user.longitude) : userLocation?.longitude;

    if (startLat && startLng && listing) {
      const endLat = parseFloat(listing.latitude);
      const endLng = parseFloat(listing.longitude);

      if (!isNaN(endLat) && !isNaN(endLng)) {
        const centerLat = (startLat + endLat) / 2;
        const centerLng = (startLng + endLng) / 2;
        const latDelta = Math.max(Math.abs(startLat - endLat) * 1.5, 0.08);
        const lngDelta = Math.max(Math.abs(startLng - endLng) * 1.5, 0.08);

        setMapRegion({
          latitude: centerLat,
          longitude: centerLng,
          latitudeDelta: latDelta,
          longitudeDelta: lngDelta,
        });
      }
    }
  };

  const handleRecenter = () => {
    if (userLocation) {
      setMapRegion(userLocation);
    } else {
      setMapRegion(CHENNAI_COORDINATES);
      requestLocationAndFetchListings(false);
    }
  };

  if (isLoading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#f97316" />
        <Text style={styles.loadingText}>Loading Map Coordinates...</Text>
      </View>
    );
  }

  const startCoords = (user && user.latitude && user.longitude)
    ? { latitude: parseFloat(user.latitude), longitude: parseFloat(user.longitude) }
    : (userLocation ? { latitude: userLocation.latitude, longitude: userLocation.longitude } : null);

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        provider={PROVIDER_GOOGLE}
        style={styles.map}
        region={mapRegion}
        showsUserLocation={true}
        showsMyLocationButton={false}
        zoomEnabled={true}
        zoomControlEnabled={true} // Adds visual zoom + / - buttons on the screen for easy emulator zooming!
        customMapStyle={darkMapStyle}
        onPress={() => setSelectedListing(null)} // Hide card if clicked on empty map space
      >
        {listings.map((item) => (
          <Marker
            key={item.id}
            coordinate={{
              latitude: parseFloat(item.latitude),
              longitude: parseFloat(item.longitude),
            }}
            title={item.title}
            description={item.quantity}
            pinColor="#f97316"
            onPress={(e) => {
              e.stopPropagation();
              setSelectedListing(item);
              setDirectionsError(false); // Reset error status on new selection
              focusRoute(item);
            }}
          />
        ))}

        {/* Draw a real turn-by-turn road route directions using Google Directions API */}
        {startCoords && selectedListing && !directionsError && (
          <MapViewDirections
            origin={startCoords}
            destination={{
              latitude: parseFloat(selectedListing.latitude),
              longitude: parseFloat(selectedListing.longitude),
            }}
            apikey="AIzaSyC4S_qbNOkJz9IRjOgO2yleSB2cE5i8Qx0"
            strokeWidth={4}
            strokeColor="#f97316"
            optimizeWaypoints={true}
            onReady={(result) => {
              if (mapRef.current) {
                mapRef.current.fitToCoordinates(result.coordinates, {
                  edgePadding: {
                    right: 50,
                    bottom: 280, // Pad for details card visibility
                    left: 50,
                    top: 100,
                  },
                  animated: true,
                });
              }
            }}
            onError={(errorMessage) => {
              console.log('Directions API error:', errorMessage);
              setDirectionsError(true);
            }}
          />
        )}

        {/* Fallback to simple dashed line if Directions API fails or is disabled */}
        {startCoords && selectedListing && directionsError && (
          <Polyline
            coordinates={[
              startCoords,
              { latitude: parseFloat(selectedListing.latitude), longitude: parseFloat(selectedListing.longitude) }
            ]}
            strokeColor="#f97316" // Match orange brand color
            strokeWidth={3}
            lineDashPattern={[6, 6]} // Dashed routing line for modern visual look
          />
        )}
      </MapView>

      {/* Recenter & Refresh overlay controls */}
      <View style={styles.mapOverlayControls}>
        <TouchableOpacity style={styles.circleBtn} onPress={handleRecenter}>
          <Compass color="#ffffff" size={20} />
        </TouchableOpacity>
        <TouchableOpacity style={[styles.circleBtn, { marginTop: 12 }]} onPress={() => requestLocationAndFetchListings(false)}>
          <RefreshCw color="#ffffff" size={20} />
        </TouchableOpacity>
      </View>

      {/* Slide-Up details card for selected food listing */}
      {selectedListing && (
        <View style={styles.detailsCardContainer}>
          <View style={styles.detailsCard}>
            <View style={styles.cardHeader}>
              {selectedListing.image ? (
                <Image source={{ uri: selectedListing.image }} style={styles.cardImage} />
              ) : (
                <View style={styles.cardImagePlaceholder}>
                  <Text style={{ fontSize: 32 }}>🥗</Text>
                </View>
              )}
              <View style={styles.cardHeaderInfo}>
                <View style={styles.typeBadge}>
                  <Text style={styles.typeBadgeText}>
                    {FOOD_TYPES[selectedListing.food_type] || FOOD_TYPES.other}
                  </Text>
                </View>
                <Text style={styles.cardTitle} numberOfLines={1}>
                  {selectedListing.title}
                </Text>
                <Text style={styles.cardQuantity}>
                  Quantity: {selectedListing.quantity}
                </Text>
              </View>
            </View>

            <View style={styles.cardMetaContainer}>
              <View style={styles.metaRow}>
                <MapPin size={16} color="#94a3b8" />
                <Text style={styles.metaText} numberOfLines={2}>
                  {selectedListing.address}
                </Text>
              </View>
            </View>

            <View style={styles.buttonGroup}>
              <TouchableOpacity 
                style={styles.directionsBtn}
                onPress={() => handleGetDirections(selectedListing.latitude, selectedListing.longitude, selectedListing.address)}
              >
                <Navigation size={18} color="#ffffff" style={{ marginRight: 8 }} />
                <Text style={styles.btnText}>Get Directions</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
  },
  map: {
    ...StyleSheet.absoluteFillObject,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0f172a',
  },
  loadingText: {
    marginTop: 12,
    color: '#94a3b8',
    fontSize: 16,
  },
  mapOverlayControls: {
    position: 'absolute',
    top: 60,
    right: 16,
    zIndex: 10,
  },
  circleBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(30, 41, 59, 0.95)',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  detailsCardContainer: {
    position: 'absolute',
    bottom: 24,
    left: 16,
    right: 16,
    zIndex: 10,
  },
  detailsCard: {
    backgroundColor: 'rgba(15, 23, 42, 0.95)',
    borderRadius: 20,
    padding: 16,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cardImage: {
    width: 70,
    height: 70,
    borderRadius: 12,
    backgroundColor: '#1e293b',
  },
  cardImagePlaceholder: {
    width: 70,
    height: 70,
    borderRadius: 12,
    backgroundColor: '#1e293b',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardHeaderInfo: {
    flex: 1,
    marginLeft: 16,
  },
  typeBadge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(249, 115, 22, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginBottom: 6,
  },
  typeBadgeText: {
    color: '#f97316',
    fontSize: 11,
    fontWeight: '600',
  },
  cardTitle: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  cardQuantity: {
    color: '#94a3b8',
    fontSize: 13,
    marginTop: 2,
  },
  cardMetaContainer: {
    marginTop: 12,
    borderTopWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
    paddingTop: 12,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  metaText: {
    color: '#cbd5e1',
    fontSize: 13,
    marginLeft: 8,
    flex: 1,
  },
  buttonGroup: {
    marginTop: 16,
  },
  directionsBtn: {
    backgroundColor: '#f97316',
    borderRadius: 12,
    height: 48,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  btnText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: 'bold',
  },
});
