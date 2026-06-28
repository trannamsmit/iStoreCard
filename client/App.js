import React, { useRef, useEffect, useState } from 'react';
import { SafeAreaView, StatusBar, BackHandler, StyleSheet, View, Text, TextInput, Button, ActivityIndicator, Alert } from 'react-native';
import { WebView } from 'react-native-webview';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = '@server_ip';

export default function App() {
  const webViewRef = useRef(null);
  const [canGoBack, setCanGoBack] = useState(false);
  
  const [serverIp, setServerIp] = useState('');
  const [tempIp, setTempIp] = useState(''); // For the input field
  const [isLoading, setIsLoading] = useState(true);
  const [showSettings, setShowSettings] = useState(false);

  // Load saved IP on startup
  useEffect(() => {
    const loadIp = async () => {
      try {
        const savedIp = await AsyncStorage.getItem(STORAGE_KEY);
        if (savedIp) {
          setServerIp(savedIp);
          setTempIp(savedIp);
        } else {
          setShowSettings(true); // No IP saved, show settings screen
        }
      } catch (e) {
        console.error('Failed to load IP.', e);
        setShowSettings(true); // Show settings on error
      } finally {
        setIsLoading(false);
      }
    };
    loadIp();
  }, []);

  // Save IP to storage
  const handleSaveIp = async () => {
    if (!tempIp.trim()) {
      Alert.alert('Lỗi', 'Vui lòng nhập địa chỉ IP hợp lệ.');
      return;
    }
    try {
      await AsyncStorage.setItem(STORAGE_KEY, tempIp.trim());
      setServerIp(tempIp.trim());
      setShowSettings(false); // Hide settings and show WebView
    } catch (e) {
      console.error('Failed to save IP.', e);
      Alert.alert('Lỗi', 'Không thể lưu địa chỉ IP.');
    }
  };

  // Handle Android physical back button
  useEffect(() => {
    const onBackPress = () => {
      if (showSettings && serverIp) {
        setShowSettings(false);
        return true;
      }
      if (canGoBack) {
        webViewRef.current?.goBack();
        return true;
      }
      return false; 
    };

    const backHandler = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => backHandler.remove();
  }, [canGoBack, showSettings, serverIp]);

  // Handle messages from WebView
  const handleMessage = (event) => {
    const message = event.nativeEvent.data;
    if (message === 'open-settings') {
      setShowSettings(true);
    }
  };
  
  const injectedJavaScript = `
    if (window.location.pathname.includes('/login')) {
      if (!document.getElementById('native-settings-btn')) {
        const settingsButton = document.createElement('button');
        settingsButton.id = 'native-settings-btn';
        settingsButton.innerHTML = '⚙️ Cài đặt IP Server';
        settingsButton.style.position = 'fixed';
        settingsButton.style.bottom = '20px';
        settingsButton.style.right = '20px';
        settingsButton.style.padding = '10px 15px';
        settingsButton.style.backgroundColor = '#64748b';
        settingsButton.style.color = 'white';
        settingsButton.style.border = 'none';
        settingsButton.style.borderRadius = '8px';
        settingsButton.style.zIndex = '9999';
        settingsButton.style.cursor = 'pointer';
        settingsButton.style.fontSize = '14px';
        settingsButton.onclick = function() {
          window.ReactNativeWebView.postMessage('open-settings');
        };
        document.body.appendChild(settingsButton);
      }
    }
    true;
  `;

  const onNavigationStateChange = (navState) => {
    setCanGoBack(navState.canGoBack);
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#ffffff" />
          <Text style={styles.loadingText}>Đang tải cấu hình...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (showSettings || !serverIp) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor="#0f172a" />
        <View style={styles.settingsContainer}>
          <Text style={styles.settingsTitle}>Cài đặt IP Server</Text>
          <Text style={styles.settingsLabel}>Nhập địa chỉ IP của máy chủ đang chạy iStoreCard:</Text>
          <TextInput
            style={styles.input}
            placeholder="Ví dụ: 192.168.1.10"
            placeholderTextColor="#999"
            value={tempIp}
            onChangeText={setTempIp}
            keyboardType="decimal-pad"
          />
          <Button title="Lưu và Kết nối" onPress={handleSaveIp} />
          {serverIp ? (
             <View style={{marginTop: 20}}>
                <Button title="Hủy" color="grey" onPress={() => setShowSettings(false)} />
             </View>
          ) : null}
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0f172a" />
      
      <WebView
        ref={webViewRef}
        source={{ uri: `http://${serverIp}:5555` }}
        style={styles.webview}
        onNavigationStateChange={onNavigationStateChange}
        onMessage={handleMessage}
        injectedJavaScript={injectedJavaScript}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        allowsInlineMediaPlayback={true}
        mediaPlaybackRequiresUserAction={false}
        originWhitelist={['*']}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  webview: {
    flex: 1,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    color: '#ffffff',
    fontSize: 16,
  },
  settingsContainer: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
  },
  settingsTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'white',
    textAlign: 'center',
    marginBottom: 20,
  },
  settingsLabel: {
    fontSize: 16,
    color: '#ccc',
    marginBottom: 10,
  },
  input: {
    backgroundColor: '#334155',
    color: 'white',
    padding: 15,
    borderRadius: 8,
    fontSize: 18,
    marginBottom: 20,
  },
});