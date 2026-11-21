import React, { createContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../services/api';

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [isLoading, setIsLoading] = useState(true);
  const [userToken, setUserToken] = useState(null);
  const [user, setUser] = useState(null);
  const [error, setError] = useState(null);

  // Check if user is logged in
  const isLoggedIn = async () => {
    try {
      setIsLoading(true);
      const token = await AsyncStorage.getItem('userToken');
      const userData = await AsyncStorage.getItem('userData');
      
      if (token && userData) {
        setUserToken(token);
        setUser(JSON.parse(userData));
        
        // Optionally verify token / refresh profile
        try {
          const res = await api.get('auth/profile/');
          setUser(res.data);
          await AsyncStorage.setItem('userData', JSON.stringify(res.data));
        } catch (e) {
          // Token might have expired, do a logout if refreshing fails
          if (e.response && e.response.status === 401) {
            logout();
          }
        }
      }
    } catch (e) {
      console.log(`isLoggedIn error: ${e}`);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    isLoggedIn();
  }, []);

  const login = async (username, password) => {
    setError(null);
    try {
      const res = await api.post('auth/login/', { username, password });
      const { access, user: loggedUser } = res.data;
      
      setUserToken(access);
      setUser(loggedUser);
      
      await AsyncStorage.setItem('userToken', access);
      await AsyncStorage.setItem('userData', JSON.stringify(loggedUser));
      return true;
    } catch (e) {
      const errMsg = e.response?.data?.detail || 'Invalid username or password';
      setError(errMsg);
      throw new Error(errMsg);
    }
  };

  const register = async (userData) => {
    setError(null);
    try {
      const res = await api.post('auth/register/', userData);
      const { access, user: registeredUser } = res.data;
      
      setUserToken(access);
      setUser(registeredUser);
      
      await AsyncStorage.setItem('userToken', access);
      await AsyncStorage.setItem('userData', JSON.stringify(registeredUser));
      return true;
    } catch (e) {
      // API might return field specific errors (e.g. username already exists)
      const data = e.response?.data;
      let errMsg = 'Registration failed. Please check your inputs.';
      if (data) {
        if (typeof data === 'object') {
          const keys = Object.keys(data);
          if (keys.length > 0) {
            errMsg = `${keys[0]}: ${data[keys[0]][0] || data[keys[0]]}`;
          }
        } else {
          errMsg = data;
        }
      }
      setError(errMsg);
      throw new Error(errMsg);
    }
  };

  const logout = async () => {
    try {
      setIsLoading(true);
      await AsyncStorage.removeItem('userToken');
      await AsyncStorage.removeItem('userData');
      setUserToken(null);
      setUser(null);
    } catch (e) {
      console.log(`logout error: ${e}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthContext.Provider value={{ login, register, logout, isLoading, userToken, user, error }}>
      {children}
    </AuthContext.Provider>
  );
};
