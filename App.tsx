import React, { useEffect, useState, useRef } from 'react';
import {
  Text,
  View,
  Platform,
  PermissionsAndroid,
  Button,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { BleManager, State, Device } from 'react-native-ble-plx';

const manager = new BleManager();

export default function App() {
  const [isScanning, setIsScanning] = useState(false);
  const [devices, setDevices] = useState<Record<string, Device>>({});
  const [error, setError] = useState<string | null>(null);
  const subscriptionRef = useRef<{ remove: () => void } | null>(null);
  const scanSubscriptionRef = useRef<{ remove: () => void } | null>(null);

  useEffect(() => {
    requestPermissions();
    return () => {
      // Cleanup subscriptions when component unmounts
      if (subscriptionRef.current) {
        subscriptionRef.current.remove();
      }
      if (scanSubscriptionRef.current) {
        scanSubscriptionRef.current.remove();
      }
      manager.destroy();
    };
  }, []);

  const requestPermissions = async () => {
    if (Platform.OS === 'android') {
      const apiLevel = parseInt(Platform.Version.toString(), 10);

      if (apiLevel >= 31) {
        const granted = await PermissionsAndroid.requestMultiple([
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
        ]);

        const allGranted = Object.values(granted).every(
          (status) => status === PermissionsAndroid.RESULTS.GRANTED
        );

        if (!allGranted) {
          setError('Required permissions not granted');
          return;
        }
      } else {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION
        );

        if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
          setError('Location permission not granted');
          return;
        }
      }
    }
  };

  const startScan = async () => {
    try {
      setDevices({});
      setError(null);

      const state = await manager.state();
      if (state === State.PoweredOn) {
        console.log('✅ Bluetooth is ON — Starting scan...');

        // Start scanning for devices
        manager.startDeviceScan(null, null, (error, device) => {
          if (error) {
            setError(error.message);
            return;
          }

          if (device) {
            console.log('Found device:', device.name || device.localName || 'Unnamed Device');
            setDevices((prevDevices) => ({
              ...prevDevices,
              [device.id]: device,
            }));
          }
        });

        setIsScanning(true);
      } else {
        console.log('⏳ Waiting for Bluetooth...');
        // Subscribe to state changes
        subscriptionRef.current = manager.onStateChange((state) => {
          if (state === State.PoweredOn) {
            startScan(); // Retry scanning when Bluetooth is powered on
            if (subscriptionRef.current) {
              subscriptionRef.current.remove();
              subscriptionRef.current = null;
            }
          }
        }, true);
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to start scanning');
    }
  };

  const stopScan = () => {
    try {
      manager.stopDeviceScan();
      setIsScanning(false);
      if (subscriptionRef.current) {
        subscriptionRef.current.remove();
        subscriptionRef.current = null;
      }
      console.log('⛔ Stopped scanning');
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to stop scanning');
    }
  };

  const toggleScan = () => {
    if (isScanning) {
      stopScan();
    } else {
      startScan();
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>🔍 BLE Scanner</Text>
      <Button
        title={isScanning ? 'Stop Scanning' : 'Start Scanning'}
        onPress={toggleScan}
        color={isScanning ? '#ff4444' : '#4CAF50'}
      />

      {error && (
        <Text style={styles.error}>❌ {error}</Text>
      )}

      <Text style={styles.subtitle}>📡 Nearby Devices:</Text>
      <ScrollView style={styles.deviceList}>
        {Object.values(devices).length === 0 ? (
          <Text style={styles.emptyText}>
            {isScanning ? 'Searching for devices...' : 'No devices found yet...'}
          </Text>
        ) : (
          Object.values(devices).map((device) => (
            <View key={device.id} style={styles.deviceItem}>
              <Text style={styles.deviceName}>
                📱 {device.name || device.localName || 'Unnamed Device'}
              </Text>
              <Text style={styles.deviceId}>ID: {device.id}</Text>
              <Text style={styles.deviceRSSI}>RSSI: {device.rssi}</Text>
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    color: '#333',
  },
  subtitle: {
    fontSize: 18,
    marginTop: 20,
    color: '#333',
  },
  error: {
    color: '#ff4444',
    marginTop: 10,
    marginBottom: 10,
  },
  deviceList: {
    marginTop: 10,
  },
  deviceItem: {
    backgroundColor: 'white',
    padding: 15,
    borderRadius: 8,
    marginBottom: 10,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1,
  },
  deviceName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
  },
  deviceId: {
    color: '#666',
    fontSize: 12,
    marginTop: 4,
  },
  deviceRSSI: {
    color: '#666',
    fontSize: 12,
    marginTop: 4,
  },
  emptyText: {
    color: '#666',
    textAlign: 'center',
    marginTop: 20,
  },
});
