import { useState, useRef, useCallback, useEffect } from "react";
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  Alert,
  ScrollView,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import ConfettiCannon from "react-native-confetti-cannon";
import { Audio } from "expo-av";
import { scanTicket, ScanResult, Block } from "../api/client";
import TicketCard from "../components/TicketCard";

const winSound = require("../../assets/sounds/win.mp3");

export default function HomeScreen() {
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [matched, setMatched] = useState<Set<number>>(new Set());
  const [showConfetti, setShowConfetti] = useState(false);
  const confettiRef = useRef<ConfettiCannon | null>(null);
  const soundRef = useRef<Audio.Sound | null>(null);

  useEffect(() => {
    return () => {
      soundRef.current?.unloadAsync();
    };
  }, []);

  const playWinSound = useCallback(async () => {
    try {
      const { sound } = await Audio.Sound.createAsync(winSound);
      soundRef.current = sound;
      await sound.playAsync();
    } catch {}
  }, []);

  const scanned = result && result.blocks && result.blocks.length > 0;

  const checkRowWin = useCallback(
    (newMatched: Set<number>) => {
      if (!result?.blocks) return false;
      for (const block of result.blocks) {
        for (const row of [block.row1, block.row2, block.row3]) {
          if (row.length === 5 && row.every((n) => newMatched.has(n))) {
            return true;
          }
        }
      }
      return false;
    },
    [result]
  );

  const pickImage = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("Cần quyền truy cập", "Cho phép truy cập thư viện ảnh để chọn vé số.");
      return;
    }

    const picked = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.8,
    });

    if (!picked.canceled && picked.assets[0]) {
      setImageUri(picked.assets[0].uri);
      setResult(null);
      setMatched(new Set());
    }
  };

  const takePhoto = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("Cần quyền camera", "Cho phép truy cập camera để chụp vé số.");
      return;
    }

    const photo = await ImagePicker.launchCameraAsync({
      quality: 0.8,
    });

    if (!photo.canceled && photo.assets[0]) {
      setImageUri(photo.assets[0].uri);
      setResult(null);
      setMatched(new Set());
    }
  };

  const handleScan = async () => {
    if (!imageUri) return;

    setLoading(true);
    setResult(null);

    try {
      const res = await scanTicket(imageUri);
      setResult(res);
    } catch (err) {
      Alert.alert("Lỗi", err instanceof Error ? err.message : "Không thể quét vé số");
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = (n: number) => {
    setMatched((prev) => {
      const next = new Set(prev);
      if (next.has(n)) {
        next.delete(n);
      } else {
        next.add(n);
      }

      const hadWin = checkRowWin(prev);
      const hasWin = checkRowWin(next);
      if (hasWin && !hadWin) {
        setShowConfetti(true);
        playWinSound();
        setTimeout(() => setShowConfetti(false), 3000);
      }

      return next;
    });
  };

  const handleRescan = () => {
    setResult(null);
    setImageUri(null);
    setMatched(new Set());
  };

  return (<>
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Quét Vé Số</Text>

      {!scanned && (
        <>
          <Text style={styles.subtitle}>Chụp hoặc chọn ảnh vé số để quét</Text>

          <View style={styles.buttonRow}>
            <TouchableOpacity style={styles.button} onPress={takePhoto}>
              <Text style={styles.buttonText}>📷 Chụp ảnh</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.button} onPress={pickImage}>
              <Text style={styles.buttonText}>🖼️ Chọn ảnh</Text>
            </TouchableOpacity>
          </View>

          {imageUri && (
            <View style={styles.previewContainer}>
              <Image source={{ uri: imageUri }} style={styles.preview} />
              <TouchableOpacity
                style={[styles.scanButton, loading && styles.scanButtonDisabled]}
                onPress={handleScan}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.scanButtonText}>Quét vé số</Text>
                )}
              </TouchableOpacity>
            </View>
          )}
        </>
      )}

      {scanned && result && (
        <View style={styles.resultSection}>
          <TicketCard
            blocks={result.blocks!}
            ticketId={result.ticket_id}
            confidence={result.confidence}
            matched={matched}
            onToggle={handleToggle}
          />

          <View style={styles.bottomRow}>
            {matched.size > 0 && (
              <TouchableOpacity style={styles.clearButton} onPress={() => setMatched(new Set())}>
                <Text style={styles.clearButtonText}>Xoá tất cả</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={styles.rescanButton} onPress={handleRescan}>
              <Text style={styles.rescanButtonText}>Quét vé khác</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </ScrollView>
    {showConfetti && (
      <ConfettiCannon
        count={200}
        origin={{ x: -10, y: 0 }}
        autoStart
        fadeOut
        ref={confettiRef}
      />
    )}
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    padding: 20,
    backgroundColor: "#f5f5f5",
    alignItems: "center",
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    marginTop: 60,
    color: "#333",
  },
  subtitle: {
    fontSize: 14,
    color: "#888",
    marginTop: 8,
    marginBottom: 24,
  },
  buttonRow: {
    flexDirection: "row",
    gap: 12,
  },
  button: {
    backgroundColor: "#fff",
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 12,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: "600",
  },
  previewContainer: {
    marginTop: 24,
    alignItems: "center",
    width: "100%",
  },
  preview: {
    width: 280,
    height: 400,
    borderRadius: 12,
    resizeMode: "contain",
    backgroundColor: "#e0e0e0",
  },
  scanButton: {
    marginTop: 16,
    backgroundColor: "#2196F3",
    paddingHorizontal: 48,
    paddingVertical: 14,
    borderRadius: 12,
  },
  scanButtonDisabled: {
    backgroundColor: "#90CAF9",
  },
  scanButtonText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "bold",
  },
  resultSection: {
    marginTop: 16,
    width: "100%",
    alignItems: "center",
  },
  bottomRow: {
    flexDirection: "row",
    gap: 16,
    marginTop: 16,
    alignItems: "center",
  },
  clearButton: {
    backgroundColor: "#F44336",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
  },
  clearButtonText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "bold",
  },
  rescanButton: {
    paddingVertical: 10,
  },
  rescanButtonText: {
    color: "#888",
    fontSize: 14,
    textDecorationLine: "underline",
  },
});
