import React, { useState, useContext, useEffect } from 'react';
import { StyleSheet, Text, View, TextInput, TouchableOpacity, ActivityIndicator, Alert, ScrollView, Image } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import api from '../services/api';
import { AuthContext } from '../context/AuthContext';
import { PlusCircle } from 'lucide-react-native';

const FOOD_TYPES = [
  { label: 'Prepared Food 🍳', value: 'prepared' },
  { label: 'Packaged Goods 📦', value: 'packaged' },
  { label: 'Fresh Produce 🍎', value: 'produce' },
  { label: 'Dairy Products 🥛', value: 'dairy' },
  { label: 'Bakery Items 🥐', value: 'bakery' },
  { label: 'Other 🍽️', value: 'other' },
];

export default function AddListingScreen({ navigation }) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [quantity, setQuantity] = useState('');
  const [foodType, setFoodType] = useState('prepared');
  const [phone, setPhone] = useState('');
  const [location, setLocation] = useState('');
  const [expiryValue, setExpiryValue] = useState('4');
  const [expiryUnit, setExpiryUnit] = useState('hours'); // 'hours' or 'days'
  const [dietaryTags, setDietaryTags] = useState('');
  const [image, setImage] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const { user } = useContext(AuthContext);

  useEffect(() => {
    if (user) {
      setPhone(user.phone_number || '');
      setLocation(user.address || '');
    }
  }, [user]);

  const getQuantityProps = () => {
    switch (foodType) {
      case 'prepared':
        return {
          label: 'Quantity (Servings / Plates)',
          placeholder: "e.g., '10 plates', '5 servings'",
        };
      case 'packaged':
        return {
          label: 'Quantity (Packets / Boxes)',
          placeholder: "e.g., '5 packets', '3 boxes'",
        };
      case 'produce':
        return {
          label: 'Quantity (Weight / Pieces)',
          placeholder: "e.g., '5 kg', '12 apples'",
        };
      case 'dairy':
        return {
          label: 'Quantity (Bottles / Liters / Items)',
          placeholder: "e.g., '10 bottles of juice', '5 liters of milk'",
        };
      case 'bakery':
        return {
          label: 'Quantity (Pieces / Items)',
          placeholder: "e.g., '12 buns', '2 boxes of donuts'",
        };
      default:
        return {
          label: 'Quantity / Portions',
          placeholder: "e.g., '10 plates', '5 kg', '2 boxes'",
        };
    }
  };

  const getTitlePlaceholder = () => {
    switch (foodType) {
      case 'prepared':
        return "e.g., Fried Rice, Pasta, Chicken Curry";
      case 'packaged':
        return "e.g., Canned beans, Biscuit packets";
      case 'produce':
        return "e.g., Fresh Apples, Organic Carrots";
      case 'dairy':
        return "e.g., Orange Juice, Fresh Milk, Yogurt";
      case 'bakery':
        return "e.g., Chocolate Chip Cookies, Sourdough Bread";
      default:
        return "e.g., 10 Servings of Fried Rice";
    }
  };

  const pickImage = async () => {
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    });

    if (!result.canceled) {
      setImage(result.assets[0].uri);
    }
  };

  const handleSubmit = async () => {
    if (!title.trim() || !quantity.trim() || !phone.trim() || !location.trim()) {
      Alert.alert('Incomplete Form', 'Please fill in all required fields (Title, Quantity, Phone, and Location).');
      return;
    }

    // Calculate expiry datetime based on value and unit
    const value = parseFloat(expiryValue);
    if (isNaN(value) || value <= 0) {
      Alert.alert('Invalid Expiry Time', 'Please enter a valid expiry number.');
      return;
    }
    const expiryDate = new Date();
    if (expiryUnit === 'days') {
      expiryDate.setDate(expiryDate.getDate() + value);
    } else {
      expiryDate.setHours(expiryDate.getHours() + value);
    }

    const formData = new FormData();
    formData.append('title', title.trim());
    formData.append('description', description.trim());
    formData.append('food_type', foodType);
    formData.append('quantity', quantity.trim());
    formData.append('phone_number', phone.trim());
    formData.append('pickup_location', location.trim());
    formData.append('expiry_date', expiryDate.toISOString());
    formData.append('dietary_tags', dietaryTags.trim());

    if (image) {
      // Extract file name and type
      const filename = image.split('/').pop();
      const match = /\.(\w+)$/.exec(filename);
      const type = match ? `image/${match[1]}` : `image/jpeg`;
      
      formData.append('image', {
        uri: image,
        name: filename,
        type: type,
      });
    }

    setIsSubmitting(true);
    try {
      await api.post('listings/', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      Alert.alert('Success 🎉', 'Food listing created successfully!', [
        { 
          text: 'OK', 
          onPress: () => {
            // Reset form
            setTitle('');
            setDescription('');
            setQuantity('');
            setFoodType('prepared');
            setExpiryValue('4');
            setExpiryUnit('hours');
            setDietaryTags('');
            setImage(null);
            // Navigate back
            navigation.navigate('Claims');
          } 
        }
      ]);
    } catch (e) {
      console.log(`Add listing error: ${e}`);
      Alert.alert('Error', 'Failed to create food listing. Please check your inputs.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Donate Food</Text>
        <Text style={styles.headerSubtitle}>Share your surplus food with people in need</Text>
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContainer} keyboardShouldPersistTaps="handled">
        <View style={styles.formCard}>
          
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Food Category</Text>
            <View style={styles.typeContainer}>
              {FOOD_TYPES.map((type) => (
                <TouchableOpacity 
                  key={type.value}
                  style={[
                    styles.typeChip, 
                    foodType === type.value && styles.typeChipActive
                  ]}
                  onPress={() => {
                    setFoodType(type.value);
                    setQuantity(''); // Reset quantity to let them see new placeholder example
                  }}
                >
                  <Text style={[
                    styles.typeChipText, 
                    foodType === type.value && styles.typeChipTextActive
                  ]}>
                    {type.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Title <Text style={styles.required}>*</Text></Text>
            <TextInput
              style={styles.input}
              placeholder={getTitlePlaceholder()}
              placeholderTextColor="#94a3b8"
              value={title}
              onChangeText={setTitle}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>{getQuantityProps().label} <Text style={styles.required}>*</Text></Text>
            <TextInput
              style={styles.input}
              placeholder={getQuantityProps().placeholder}
              placeholderTextColor="#94a3b8"
              value={quantity}
              onChangeText={setQuantity}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Expires In <Text style={styles.required}>*</Text></Text>
            <View style={styles.expiryInputContainer}>
              <TextInput
                style={[styles.input, styles.expiryInput]}
                placeholder={expiryUnit === 'hours' ? 'e.g., 4' : 'e.g., 5'}
                placeholderTextColor="#94a3b8"
                value={expiryValue}
                onChangeText={setExpiryValue}
                keyboardType="numeric"
              />
              <View style={styles.unitToggleContainer}>
                <TouchableOpacity 
                  style={[styles.unitChip, expiryUnit === 'hours' && styles.unitChipActive]}
                  onPress={() => setExpiryUnit('hours')}
                >
                  <Text style={[styles.unitChipText, expiryUnit === 'hours' && styles.unitChipTextActive]}>Hours</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.unitChip, expiryUnit === 'days' && styles.unitChipActive]}
                  onPress={() => setExpiryUnit('days')}
                >
                  <Text style={[styles.unitChipText, expiryUnit === 'days' && styles.unitChipTextActive]}>Days</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Pickup Location <Text style={styles.required}>*</Text></Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Full address for collection"
              placeholderTextColor="#94a3b8"
              value={location}
              onChangeText={setLocation}
              multiline
              numberOfLines={2}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Contact Phone <Text style={styles.required}>*</Text></Text>
            <TextInput
              style={styles.input}
              placeholder="e.g., +1 234 567 890"
              placeholderTextColor="#94a3b8"
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Dietary Tags (comma-separated)</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g., vegetarian, gluten-free, dairy-free"
              placeholderTextColor="#94a3b8"
              value={dietaryTags}
              onChangeText={setDietaryTags}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Description</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Any specific instructions (e.g. bring containers, best before date, etc.)"
              placeholderTextColor="#94a3b8"
              value={description}
              onChangeText={setDescription}
              multiline
              numberOfLines={3}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Food Image</Text>
            {image ? (
              <View style={styles.imagePreviewContainer}>
                <Image source={{ uri: image }} style={styles.imagePreview} />
                <TouchableOpacity style={styles.removeImageBtn} onPress={() => setImage(null)}>
                  <Text style={styles.removeImageText}>Remove Image</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity style={styles.imagePickerBtn} onPress={pickImage}>
                <Text style={styles.imagePickerText}>📸 Select Food Image</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity 
          style={[styles.button, isSubmitting && styles.buttonDisabled]} 
          onPress={handleSubmit}
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <>
              <Text style={styles.buttonText}>Submit Donation</Text>
              <PlusCircle color="#ffffff" size={20} style={{ marginLeft: 8 }} />
            </>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  scrollView: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
  scrollContainer: {
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  formCard: {
    backgroundColor: '#1e293b',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#334155',
  },
  inputGroup: {
    marginBottom: 12,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#cbd5e1',
    marginBottom: 4,
  },
  required: {
    color: '#ef4444',
  },
  input: {
    backgroundColor: '#0f172a',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: '#ffffff',
    borderWidth: 1,
    borderColor: '#334155',
  },
  textArea: {
    height: 60,
    textAlignVertical: 'top',
  },
  typeContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -4,
  },
  typeChip: {
    backgroundColor: '#0f172a',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    margin: 3,
    borderWidth: 1,
    borderColor: '#334155',
  },
  typeChipActive: {
    backgroundColor: '#f97316',
    borderColor: '#f97316',
  },
  typeChipText: {
    color: '#cbd5e1',
    fontSize: 12,
    fontWeight: '600',
  },
  typeChipTextActive: {
    color: '#ffffff',
  },
  button: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f97316',
    borderRadius: 10,
    paddingVertical: 12,
    marginTop: 10,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
  imagePickerBtn: {
    backgroundColor: '#0f172a',
    borderRadius: 10,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#f97316',
    paddingVertical: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  imagePickerText: {
    color: '#f97316',
    fontSize: 15,
    fontWeight: '600',
  },
  imagePreviewContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0f172a',
    borderRadius: 10,
    padding: 8,
    borderWidth: 1,
    borderColor: '#334155',
  },
  imagePreview: {
    width: 60,
    height: 60,
    borderRadius: 8,
    marginRight: 12,
  },
  removeImageBtn: {
    backgroundColor: '#3b0712',
    borderWidth: 1,
    borderColor: '#7f1d1d',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  removeImageText: {
    color: '#fca5a5',
    fontSize: 13,
    fontWeight: '600',
  },
  expiryInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  expiryInput: {
    flex: 1,
    marginRight: 12,
  },
  unitToggleContainer: {
    flexDirection: 'row',
    backgroundColor: '#0f172a',
    borderRadius: 10,
    padding: 3,
    borderWidth: 1,
    borderColor: '#334155',
  },
  unitChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  unitChipActive: {
    backgroundColor: '#f97316',
  },
  unitChipText: {
    color: '#94a3b8',
    fontSize: 13,
    fontWeight: '600',
  },
  unitChipTextActive: {
    color: '#ffffff',
  },
  footer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#1e293b',
    borderTopWidth: 1,
    borderTopColor: '#334155',
  },
});
