$path = "app/(tabs)/index.tsx"
$content = Get-Content $path -Raw

$missingImports = "import React, { useState } from 'react';
import { View, StyleSheet, FlatList, Text, TextInput, Alert, TouchableOpacity, PanResponder, Animated, Modal, Image } from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Plus, Search, Film, Clock, Trash2, User } from 'lucide-react-native';
import { useProjectStore } from '@/store/projectStore';
"

$newContent = $missingImports + $content
$newContent | Set-Content $path -NoNewline
