$path = "app/(tabs)/index.tsx"
$content = Get-Content $path -Raw

# 1. Fix imports
$content = $content -replace "import React, \{ useState, useEffect \} from 'react';", "import React, { useState } from 'react';"
$content = $content -replace "import \{ View, StyleSheet, FlatList, Text, TextInput, Alert, TouchableOpacity, PanResponder, Animated, Modal, Image, ImageResolvedAssetSource \} from 'react-native';", "import { View, StyleSheet, FlatList, Text, TextInput, Alert, TouchableOpacity, PanResponder, Animated, Modal, Image } from 'react-native';"

# 2. Remove useEffect block
$content = $content -replace "(?s)\s+// Preload both logo images to eliminate loading delay\s+useEffect\(\(\) => \{.+?\}, \[\]\);", ""

# 3. Insert hidden images
$hiddenImages = "
          <View style={{ position: 'absolute', opacity: 0, width: 0, height: 0, overflow: 'hidden' }}>
            <Image source={logoLight} />
            <Image source={logoDark} />
          </View>"

$content = $content -replace "(<View style=\{styles\.header\}>)", "`$1$hiddenImages"

$content | Set-Content $path -NoNewline
