import { useState, useRef, useCallback, useEffect } from "react";
import {
  View,
  Text,
  Image,
  ImageBackground,
  Pressable,
  ActivityIndicator,
  Alert,
  ScrollView,
  useWindowDimensions,
  Platform,
  ViewStyle,
} from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from "react-native-reanimated";
import * as ImagePicker from "expo-image-picker";
import ConfettiCannon from "react-native-confetti-cannon";
import { Audio } from "expo-av";
import { scanTicket, ScanResult } from "../api/client";
import TicketCard from "../components/TicketCard";
import { useImageColors } from "../hooks/useImageColors";
import { Ionicons } from "@expo/vector-icons";

function AnimatedButton({
  onPress,
  disabled,
  className: cls,
  style,
  children,
}: {
  onPress: () => void;
  disabled?: boolean;
  className?: string;
  style?: ViewStyle;
  children: React.ReactNode;
}) {
  const scale = useSharedValue(1);
  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));
  return (
    <Pressable
      onPressIn={() => {
        scale.value = withSpring(0.95, { damping: 15, stiffness: 300 });
      }}
      onPressOut={() => {
        scale.value = withSpring(1, { damping: 15, stiffness: 300 });
      }}
      onPress={onPress}
      disabled={disabled}
    >
      <Animated.View style={animStyle}>
        <View className={cls} style={style}>
          {children}
        </View>
      </Animated.View>
    </Pressable>
  );
}

const shadow = (color: string, radius: number): ViewStyle =>
  Platform.OS === "ios"
    ? {
        shadowColor: color,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.35,
        shadowRadius: radius,
      }
    : { elevation: radius };

const winSound = require("../../assets/sounds/win.mp3");
const horseBg = require("../../assets/horse-bg.jpg");

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

  const confirm = (title: string, message: string, onConfirm: () => void) => {
    if (Platform.OS === "web") {
      if (window.confirm(`${title}\n${message}`)) onConfirm();
    } else {
      Alert.alert(title, message, [
        { text: "Huỷ", style: "cancel" },
        { text: "Đồng ý", style: "destructive", onPress: onConfirm },
      ]);
    }
  };

  const confirmClear = () => {
    if (matched.size === 0) return;
    confirm("Xoá tất cả?", `Bạn đã đánh ${matched.size} số. Xoá hết?`, () =>
      setMatched(new Set()),
    );
  };

  const confirmRescan = () => {
    if (matched.size === 0) {
      setResult(null);
      setImageUri(null);
      return;
    }
    confirm("Quét vé khác?", `Bạn đã đánh ${matched.size} số. Thoát sẽ mất dữ liệu.`, () => {
      setResult(null);
      setImageUri(null);
      setMatched(new Set());
    });
  };

  return (
    <>
      <View className="flex-1" style={{ backgroundColor: "#B71C1C", height: windowHeight, maxHeight: windowHeight, overflow: "hidden" }}>
        <ScrollView
          contentContainerStyle={{
            flexGrow: 1,
            alignItems: "center",
          }}
          className="flex-1"
          bounces={false}
        >
          <ImageBackground
            source={horseBg}
            resizeMode="cover"
            style={{
              width: "100%",
              maxWidth: 480,
              height: windowHeight,
              alignSelf: "center",
            }}
          >
            <View
              className="absolute inset-0"
              style={{ backgroundColor: "rgba(0,0,0,0.45)" }}
            />
            <View className="z-10 flex-1 w-full items-center justify-center">
              <View className="w-full max-w-md items-center px-0">
                <Text
                  className="mt-4 font-condensed text-4xl"
                  style={{ color: "#FFD54F", textShadow: "0px 2px 6px rgba(0,0,0,0.7)" }}
                >
                  Quét Vé Số
                </Text>

                {!scanned && (
                  <>
                    <Text
                      className="mt-1 mb-6 text-sm font-semibold"
                      style={{ color: "#FFF8E1", textShadow: "0px 1px 4px rgba(0,0,0,0.6)" }}
                    >
                      Chụp hoặc chọn ảnh vé số để bắt đầu
                    </Text>

                    <View className="w-full gap-4">
                      <AnimatedButton
                        className="w-full flex-row items-center justify-center gap-3 rounded-2xl py-4"
                        style={{
                          backgroundColor: "#FFD54F",
                          borderWidth: 3,
                          borderColor: "#E65100",
                          borderRadius: 16,
                        }}
                        onPress={takePhoto}
                      >
                        <Ionicons name="camera" size={24} color="#5D2E1A" />
                        <Text
                          className="font-condensed text-xl"
                          style={{ color: "#5D2E1A" }}
                        >
                          Chụp ảnh
                        </Text>
                      </AnimatedButton>
                      <AnimatedButton
                        className="w-full flex-row items-center justify-center gap-3 rounded-2xl py-4"
                        style={{
                          backgroundColor: "#FFD54F",
                          borderWidth: 3,
                          borderColor: "#E65100",
                          borderRadius: 16,
                        }}
                        onPress={pickImage}
                      >
                        <Ionicons name="images" size={24} color="#5D2E1A" />
                        <Text
                          className="font-condensed text-xl"
                          style={{ color: "#5D2E1A" }}
                        >
                          Chọn ảnh
                        </Text>
                      </AnimatedButton>
                    </View>

                    {imageUri && (
                      <View className="mt-6 w-full items-center">
                        <View
                          className="w-full items-center rounded-2xl p-3"
                          style={{ backgroundColor: "rgba(255,255,255,0.08)" }}
                        >
                          <Image
                            source={{ uri: imageUri }}
                            className="h-96 w-full rounded-xl"
                            resizeMode="contain"
                          />
                        </View>
                        <AnimatedButton
                          className="mt-5 w-full flex-row items-center justify-center gap-3 rounded-2xl py-4"
                          style={{
                            backgroundColor: "#E53935",
                            borderWidth: 3,
                            borderColor: "#7f1d1d",
                            borderRadius: 16,
                            opacity: loading ? 0.6 : 1,
                          }}
                          onPress={handleScan}
                          disabled={loading}
                        >
                          {loading ? (
                            <ActivityIndicator color="#fff" />
                          ) : (
                            <div className="px-2 flex gap-2">
                              <Ionicons name="scan" size={24} color="#fff" />
                              <Text className="font-condensed text-xl tracking-wide text-white">
                                Quét vé số
                              </Text>
                            </div>
                          )}
                        </AnimatedButton>

                        {loading && (
                          <View
                            className="mt-4 w-full gap-3 rounded-2xl p-4"
                            style={{ backgroundColor: "rgba(0,0,0,0.3)" }}
                          >
                            {scanStages.map((stage, i) => (
                              <View
                                key={i}
                                className="flex-row items-center gap-3"
                              >
                                <View
                                  className="h-3 w-3 rounded-full"
                                  style={{
                                    backgroundColor:
                                      i < scanStage
                                        ? "#FFCC80"
                                        : i <= scanStage
                                          ? ticketColors.primary
                                          : "rgba(255,255,255,0.25)",
                                  }}
                                />
                                <Text
                                  className="text-sm"
                                  style={{
                                    color:
                                      i <= scanStage
                                        ? "#FFCC80"
                                        : "rgba(255,255,255,0.4)",
                                    fontWeight:
                                      i <= scanStage ? "600" : "normal",
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

                    <View className="mt-3 flex-row items-center gap-3">
                      {matched.size > 0 && (
                        <AnimatedButton
                          className="flex-row items-center gap-2 rounded-full px-5 py-2.5"
                          style={{
                            backgroundColor: "#FFD54F",
                            borderWidth: 2,
                            borderColor: "#E65100",
                          }}
                          onPress={confirmClear}
                        >
                          <Ionicons name="refresh" size={16} color="#5D2E1A" />
                          <Text className="text-sm font-bold" style={{ color: "#5D2E1A" }}>
                            Xoá tất cả
                          </Text>
                        </AnimatedButton>
                      )}
                      <AnimatedButton
                        className="flex-row items-center gap-2 rounded-full px-5 py-2.5"
                        style={{
                          backgroundColor: "#E53935",
                          borderWidth: 2,
                          borderColor: "#7f1d1d",
                        }}
                        onPress={confirmRescan}
                      >
                        <Ionicons name="camera-reverse" size={16} color="#fff" />
                        <Text className="text-sm font-bold text-white">
                          Quét vé khác
                        </Text>
                      </AnimatedButton>
                    </View>
                  </View>
                )}
              </View>
            </View>
          </ImageBackground>
        </ScrollView>
      </View>

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
