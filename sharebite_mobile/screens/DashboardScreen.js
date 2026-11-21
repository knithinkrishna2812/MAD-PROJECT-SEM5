import React, { useState, useEffect, useContext } from 'react';
import { StyleSheet, Text, View, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native';
import api from '../services/api';
import { AuthContext } from '../context/AuthContext';
import { LogOut, Heart, Trash2, Award, Users } from 'lucide-react-native';

export default function DashboardScreen() {
  const [data, setData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const { logout, user } = useContext(AuthContext);

  const fetchDashboardData = async (showLoading = true) => {
    if (showLoading) setIsLoading(true);
    try {
      const res = await api.get('analytics/dashboard/');
      setData(res.data);
    } catch (e) {
      console.log(`Fetch dashboard error: ${e}`);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const onRefresh = () => {
    setIsRefreshing(true);
    fetchDashboardData(false);
  };

  if (isLoading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#f97316" />
      </View>
    );
  }

  const impact = data?.impact || { meals_saved: 0, weight_kg: 0, carbon_footprint_kg: 0 };
  const stats = data?.stats || {};
  const isProvider = user?.role === 'provider';

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>My Impact</Text>
          <Text style={styles.headerSubtitle}>Hi @{user?.username} ({user?.role?.toUpperCase()})</Text>
        </View>
        <TouchableOpacity style={styles.logoutBtn} onPress={logout}>
          <LogOut color="#f87171" size={20} />
        </TouchableOpacity>
      </View>

      <ScrollView 
        contentContainerStyle={styles.scrollContainer}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} tintColor="#f97316" />
        }
      >
        {/* Welcome Card */}
        <View style={styles.welcomeCard}>
          <Award size={36} color="#fbbf24" style={{ marginBottom: 12 }} />
          <Text style={styles.welcomeTitle}>Food Rescue Hero 🌟</Text>
          <Text style={styles.welcomeDesc}>Every donation and claim helps feed our neighbors and support the community.</Text>
        </View>

        {/* Impact Numbers Grid */}
        <Text style={styles.sectionTitle}>Community Impact</Text>
        <View style={styles.statsGrid}>
          <View style={styles.statBox}>
            <Heart size={24} color="#f43f5e" style={styles.statIcon} />
            <Text style={styles.statNum}>{impact.meals_saved}</Text>
            <Text style={styles.statLabel}>Meals Rescued</Text>
          </View>

          <View style={styles.statBox}>
            <Trash2 size={24} color="#10b981" style={styles.statIcon} />
            <Text style={styles.statNum}>{impact.weight_kg.toFixed(1)} kg</Text>
            <Text style={styles.statLabel}>Food Saved</Text>
          </View>

          <View style={[styles.statBox, styles.wideBox]}>
            <Users size={24} color="#38bdf8" style={styles.statIcon} />
            <Text style={styles.statNum}>{impact.meals_saved}</Text>
            <Text style={styles.statLabel}>Estimated People Fed</Text>
          </View>
        </View>

        {/* Activity Summary */}
        <Text style={styles.sectionTitle}>Activity Summary</Text>
        <View style={styles.summaryCard}>
          {user?.role === 'ngo' || user?.role === 'individual' ? (
            <>
              {/* NGO Donation Section */}
              <Text style={styles.summarySubtitle}>Your Donations</Text>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Total Donations Listed:</Text>
                <Text style={styles.summaryValue}>{stats.total_listings || 0}</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Completed Pickups:</Text>
                <Text style={styles.summaryValue}>{stats.completed_listings || 0}</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Active Food Posts:</Text>
                <Text style={[styles.summaryValue, { color: '#f97316' }]}>{stats.active_listings || 0}</Text>
              </View>
              
              <View style={styles.divider} />
              
              {/* NGO Claim Section */}
              <Text style={styles.summarySubtitle}>Your Claims</Text>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Total Food Claimed:</Text>
                <Text style={styles.summaryValue}>{stats.total_claims || 0}</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Rescued & Received:</Text>
                <Text style={styles.summaryValue}>{stats.completed_claims || 0}</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Pending Pickups:</Text>
                <Text style={[styles.summaryValue, { color: '#f97316' }]}>{stats.pending_claims || 0}</Text>
              </View>
            </>
          ) : isProvider ? (
            <>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Total Donations Listed:</Text>
                <Text style={styles.summaryValue}>{stats.total_listings || 0}</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Completed Pickups:</Text>
                <Text style={styles.summaryValue}>{stats.completed_listings || 0}</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Active Food Posts:</Text>
                <Text style={[styles.summaryValue, { color: '#f97316' }]}>{stats.active_listings || 0}</Text>
              </View>
            </>
          ) : (
            <>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Total Food Claimed:</Text>
                <Text style={styles.summaryValue}>{stats.total_claims || 0}</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Rescued & Received:</Text>
                <Text style={styles.summaryValue}>{stats.completed_claims || 0}</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Pending Pickups:</Text>
                <Text style={[styles.summaryValue, { color: '#f97316' }]}>{stats.pending_claims || 0}</Text>
              </View>
            </>
          )}
        </View>
      </ScrollView>
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
  logoutBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#1e293b',
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContainer: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  welcomeCard: {
    backgroundColor: '#1e293b',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: '#334155',
    marginBottom: 24,
  },
  welcomeTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 4,
  },
  welcomeDesc: {
    fontSize: 14,
    color: '#94a3b8',
    lineHeight: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 14,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  statBox: {
    backgroundColor: '#1e293b',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#334155',
    padding: 16,
    width: '48%',
    marginBottom: 16,
  },
  wideBox: {
    width: '100%',
  },
  statIcon: {
    marginBottom: 8,
  },
  statNum: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#64748b',
  },
  summaryCard: {
    backgroundColor: '#1e293b',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#334155',
    padding: 20,
  },
  summarySubtitle: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#f97316',
    marginTop: 8,
    marginBottom: 4,
  },
  divider: {
    height: 1,
    backgroundColor: '#334155',
    marginVertical: 14,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  summaryLabel: {
    fontSize: 14,
    color: '#cbd5e1',
  },
  summaryValue: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0f172a',
  },
});
