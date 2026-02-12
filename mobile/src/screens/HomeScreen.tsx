import { useState, useRef, useCallback, useEffect } from "react";
import {
  View,
  Text,
  Image,
  ImageBackground,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  ScrollView,
  useWindowDimensions,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import ConfettiCannon from "react-native-confetti-cannon";
import { Audio } from "expo-av";
import { scanTicket, ScanResult } from "../api/client";
import TicketCard from "../components/TicketCard";
import { useImageColors } from "../hooks/useImageColors";

const winSound = require("../../assets/sounds/win.mp3");
const horseBg = require("../../assets/horse-bg.png");

export default function HomeScreen() {
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [scanStage, setScanStage] = useState(0);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [matched, setMatched] = useState<Set<number>>(new Set());
  const [showConfetti, setShowConfetti] = useState(false);
  const confettiRef = useRef<ConfettiCannon | null>(null);
  const soundRef = useRef<Audio.Sound | null>(null);
  const ticketColors = useImageColors(imageUri);
  const { height: windowHeight } = useWindowDimensions();

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
    [result],
  );

  const pickImage = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert(
        "Cần quyền truy cập",
        "Cho phép truy cập thư viện ảnh để chọn vé số.",
      );
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
      Alert.alert(
        "Cần quyền camera",
        "Cho phép truy cập camera để chụp vé số.",
      );
      return;
    }
    const photo = await ImagePicker.launchCameraAsync({ quality: 0.8 });
    if (!photo.canceled && photo.assets[0]) {
      setImageUri(photo.assets[0].uri);
      setResult(null);
      setMatched(new Set());
    }
  };

  const scanStages = [
    "Đang phân tích ảnh (OCR)...",
    "Đang xác minh bằng AI...",
    "Đang đối chiếu kết quả...",
  ];

  const handleScan = async () => {
    if (!imageUri) return;
    setLoading(true);
    setResult(null);
    setScanStage(0);
    const stageTimers = [
      setTimeout(() => setScanStage(1), 4000),
      setTimeout(() => setScanStage(2), 14000),
    ];
    try {
      const res = await scanTicket(imageUri);
      setResult(res);
    } catch (err) {
      Alert.alert(
        "Lỗi",
        err instanceof Error ? err.message : "Không thể quét vé số",
      );
    } finally {
      stageTimers.forEach(clearTimeout);
      setLoading(false);
      setScanStage(0);
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

  return (
    <>
      <ImageBackground
        source={horseBg}
        className="flex-1 bg-tet-red"
        resizeMode="cover"
      >
        <ScrollView
          contentContainerStyle={{ minHeight: windowHeight }}
          className="flex-1"
        >
          <View className="flex-1 items-center px-5 pb-8">
            <Text className="mt-2 font-condensed text-3xl text-tet-gold">
              Quét Vé Số
            </Text>

            {!scanned && (
              <>
                <Text className="mt-2 mb-4 text-sm text-tet-pink">
                  Chụp hoặc chọn ảnh vé số để quét
                </Text>
                <Text className="mb-4 text-3xl">🏮🏮🏮</Text>

                <View className="flex-row gap-3">
                  <TouchableOpacity
                    className="rounded-xl bg-tet-gold px-6 py-3.5"
                    onPress={takePhoto}
                  >
                    <Text className="text-base font-bold text-tet-red">
                      📷 Chụp ảnh
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    className="rounded-xl bg-tet-gold px-6 py-3.5"
                    onPress={pickImage}
                  >
                    <Text className="text-base font-bold text-tet-red">
                      🖼️ Chọn ảnh
                    </Text>
                  </TouchableOpacity>
                </View>

                {imageUri && (
                  <View className="mt-6 w-full items-center">
                    <Image
                      source={{ uri: imageUri }}
                      className="h-96 w-72 rounded-xl"
                      resizeMode="contain"
                      style={{ backgroundColor: "rgba(255,255,255,0.1)" }}
                    />
                    <TouchableOpacity
                      className="mt-4 rounded-xl px-12 py-3.5"
                      style={{
                        backgroundColor: ticketColors.primary,
                        opacity: loading ? 0.6 : 1,
                      }}
                      onPress={handleScan}
                      disabled={loading}
                    >
                      {loading ? (
                        <ActivityIndicator color="#fff" />
                      ) : (
                        <Text className="font-condensed text-lg text-white">
                          Quét vé số
                        </Text>
                      )}
                    </TouchableOpacity>

                    {loading && (
                      <View className="mt-5 w-full gap-2.5 px-5">
                        {scanStages.map((stage, i) => (
                          <View
                            key={i}
                            className="flex-row items-center gap-2.5"
                          >
                            <View
                              className="h-2.5 w-2.5 rounded-full"
                              style={{
                                backgroundColor:
                                  i < scanStage
                                    ? "#FFD700"
                                    : i <= scanStage
                                      ? ticketColors.primary
                                      : "rgba(255,255,255,0.3)",
                              }}
                            />
                            <Text
                              className="text-sm"
                              style={{
                                color:
                                  i <= scanStage
                                    ? "#FFD700"
                                    : "rgba(255,255,255,0.5)",
                                fontWeight: i <= scanStage ? "600" : "normal",
                              }}
                            >
                              {stage}
                            </Text>
                          </View>
                        ))}
                      </View>
                    )}
                  </View>
                )}
              </>
            )}

            {scanned && result && (
              <View className="mt-4 w-full items-center">
                <TicketCard
                  blocks={result.blocks!}
                  ticketId={result.ticket_id}
                  confidence={result.confidence}
                  matched={matched}
                  onToggle={handleToggle}
                  colors={ticketColors}
                />

                <View className="mt-4 flex-row items-center gap-4">
                  {matched.size > 0 && (
                    <TouchableOpacity
                      className="rounded-lg bg-tet-gold px-4 py-2.5"
                      onPress={() => setMatched(new Set())}
                    >
                      <Text className="text-sm font-bold text-tet-red">
                        Xoá tất cả
                      </Text>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity className="py-2.5" onPress={handleRescan}>
                    <Text className="text-sm text-tet-pink underline">
                      Quét vé khác
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>
        </ScrollView>
      </ImageBackground>

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
