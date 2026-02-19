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
const tapSound = require("../../assets/sounds/tap.wav");
const horseBg = require("../../assets/horse.png");

export default function HomeScreen() {
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [scanStage, setScanStage] = useState(0);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [matched, setMatched] = useState<Set<number>>(new Set());
  const [showConfetti, setShowConfetti] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const confettiRef = useRef<ConfettiCannon | null>(null);
  const soundRef = useRef<Audio.Sound | null>(null);
  const tapSoundRef = useRef<Audio.Sound | null>(null);
  const ticketColors = useImageColors(imageUri);
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const isLandscape = windowWidth > windowHeight;
  const isTablet = windowWidth >= 768 && !isLandscape;

  useEffect(() => {
    Audio.Sound.createAsync(tapSound)
      .then(({ sound }) => {
        tapSoundRef.current = sound;
      })
      .catch(() => {});
    return () => {
      soundRef.current?.unloadAsync();
      tapSoundRef.current?.unloadAsync();
    };
  }, []);

  const playWinSound = useCallback(async () => {
    if (!soundEnabled) return;
    try {
      const { sound } = await Audio.Sound.createAsync(winSound);
      soundRef.current = sound;
      await sound.playAsync();
    } catch {}
  }, [soundEnabled]);

  const playTapSound = useCallback(async () => {
    if (!soundEnabled || !tapSoundRef.current) return;
    try {
      await tapSoundRef.current.replayAsync();
    } catch {}
  }, [soundEnabled]);

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
      if (res.status === "rejected") {
        Alert.alert(
          "Không nhận diện được",
          "Ảnh không rõ hoặc không phải vé lô tô. Vui lòng chụp lại.",
        );
      } else {
        setResult(res);
      }
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
    playTapSound();
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
    confirm(
      "Quét vé khác?",
      `Bạn đã đánh ${matched.size} số. Thoát sẽ mất dữ liệu.`,
      () => {
        setResult(null);
        setImageUri(null);
        setMatched(new Set());
      },
    );
  };

  return (
    <>
      <View className="flex-1" style={{ backgroundColor: "#F5EDE0" }}>
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
              maxWidth: isLandscape ? windowWidth : isTablet ? 720 : 480,
              minHeight: windowHeight,
              alignSelf: "center",
            }}
          >
            <View
              className="absolute inset-0"
              style={{ backgroundColor: "rgba(245,237,224,0.55)" }}
            />
            <Pressable
              onPress={() => setSoundEnabled((v) => !v)}
              className="absolute right-4 top-12 z-20 items-center justify-center rounded-full p-2.5"
              style={{ backgroundColor: "rgba(0,0,0,0.25)" }}
            >
              <Ionicons
                name={soundEnabled ? "volume-high" : "volume-mute"}
                size={22}
                color="#fff"
              />
            </Pressable>
            <View className="z-10 flex-1 w-full items-center justify-center">
              <View
                className="w-full items-center px-0"
                style={{
                  maxWidth: isLandscape
                    ? windowWidth - 40
                    : isTablet
                      ? 600
                      : 448,
                }}
              >
                {/* ── Pre-scan: Landscape ── */}
                {!scanned && isLandscape && (
                  <>
                    <View className="w-full flex-row items-center justify-between px-4 mt-1">
                      <View className="flex-1">
                        <Text
                          className="font-condensed"
                          style={{
                            color: "#8B0000",
                            textShadow: "0px 2px 8px rgba(0,0,0,0.3)",
                            fontSize: 24,
                          }}
                        >
                          Quét Lô Tô
                        </Text>
                        <Text
                          className="mt-1 text-sm font-semibold"
                          style={{
                            color: "#3E2723",
                            textShadow: "0px 1px 3px rgba(0,0,0,0.2)",
                          }}
                        >
                          Chụp hoặc chọn ảnh vé số để bắt đầu
                        </Text>
                      </View>
                      <View className="flex-row items-center gap-3">
                        <AnimatedButton
                          className="flex-row items-center justify-center gap-2 rounded-xl px-5 py-2.5"
                          style={{
                            backgroundColor: "#8B0000",
                            borderWidth: 2,
                            borderColor: "#5C0000",
                            borderRadius: 12,
                          }}
                          onPress={takePhoto}
                        >
                          <Ionicons name="camera" size={20} color="#fff" />
                          <Text
                            className="font-condensed text-lg"
                            style={{ color: "#fff" }}
                          >
                            Chụp ảnh
                          </Text>
                        </AnimatedButton>
                        <AnimatedButton
                          className="flex-row items-center justify-center gap-2 rounded-xl px-5 py-2.5"
                          style={{
                            backgroundColor: "#8B0000",
                            borderWidth: 2,
                            borderColor: "#5C0000",
                            borderRadius: 12,
                          }}
                          onPress={pickImage}
                        >
                          <Ionicons name="images" size={20} color="#fff" />
                          <Text
                            className="font-condensed text-lg"
                            style={{ color: "#fff" }}
                          >
                            Chọn ảnh
                          </Text>
                        </AnimatedButton>
                      </View>
                    </View>

                    {imageUri && (
                      <View className="mt-4 w-full flex-row items-start gap-4 px-4">
                        <View
                          className="flex-1 items-center rounded-2xl p-2"
                          style={{ backgroundColor: "rgba(255,255,255,0.08)" }}
                        >
                          <Image
                            source={{ uri: imageUri }}
                            style={{
                              width: "100%",
                              height: windowHeight * 0.5,
                            }}
                            className="rounded-xl"
                            resizeMode="contain"
                          />
                        </View>
                        <View
                          className="items-center justify-center gap-3"
                          style={{ width: 180 }}
                        >
                          <AnimatedButton
                            className="w-full flex-row items-center justify-center gap-3 rounded-2xl py-3"
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
                              <View className="px-2 flex-row gap-2">
                                <Ionicons name="scan" size={22} color="#fff" />
                                <Text className="font-condensed text-lg tracking-wide text-white">
                                  Quét vé số
                                </Text>
                              </View>
                            )}
                          </AnimatedButton>

                          {loading && (
                            <View
                              className="w-full gap-2 rounded-2xl p-3"
                              style={{ backgroundColor: "rgba(0,0,0,0.3)" }}
                            >
                              {scanStages.map((stage, i) => (
                                <View
                                  key={i}
                                  className="flex-row items-center gap-2"
                                >
                                  <View
                                    className="h-2.5 w-2.5 rounded-full"
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
                                    className="text-xs"
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
                      </View>
                    )}
                  </>
                )}

                {/* ── Pre-scan: Portrait / tablet ── */}
                {!scanned && !isLandscape && (
                  <>
                    <Text
                      className="mt-4 font-condensed"
                      style={{
                        color: "#8B0000",
                        textShadow: "0px 2px 8px rgba(0,0,0,0.3)",
                        fontSize: isTablet ? 48 : 36,
                      }}
                    >
                      Quét Lô Tô
                    </Text>

                    <Text
                      className="mt-1 mb-6 text-sm font-semibold"
                      style={{
                        color: "#3E2723",
                        textShadow: "0px 1px 3px rgba(0,0,0,0.2)",
                      }}
                    >
                      Chụp hoặc chọn ảnh vé số để bắt đầu
                    </Text>

                    <View className="flex-row items-center justify-center gap-3 px-4 w-full">
                      <View className="flex-1">
                        <AnimatedButton
                          className="flex-row items-center justify-center gap-2 rounded-xl py-2.5"
                          style={{
                            backgroundColor: "#8B0000",
                            borderWidth: 2,
                            borderColor: "#5C0000",
                            borderRadius: 12,
                          }}
                          onPress={takePhoto}
                        >
                          <Ionicons name="camera" size={20} color="#fff" />
                          <Text
                            className="font-condensed text-lg"
                            style={{ color: "#fff" }}
                          >
                            Chụp ảnh
                          </Text>
                        </AnimatedButton>
                      </View>
                      <View className="flex-1">
                        <AnimatedButton
                          className="flex-row items-center justify-center gap-2 rounded-xl py-2.5"
                          style={{
                            backgroundColor: "#8B0000",
                            borderWidth: 2,
                            borderColor: "#5C0000",
                            borderRadius: 12,
                          }}
                          onPress={pickImage}
                        >
                          <Ionicons name="images" size={20} color="#fff" />
                          <Text
                            className="font-condensed text-lg"
                            style={{ color: "#fff" }}
                          >
                            Chọn ảnh
                          </Text>
                        </AnimatedButton>
                      </View>
                    </View>

                    {imageUri && (
                      <View className="mt-6 w-full items-center">
                        <View
                          className="w-full items-center rounded-2xl p-3"
                          style={{
                            backgroundColor: "rgba(255,255,255,0.08)",
                          }}
                        >
                          <Image
                            source={{ uri: imageUri }}
                            className="w-full rounded-xl"
                            style={{ height: windowHeight * 0.35 }}
                            resizeMode="contain"
                          />
                        </View>
                        <AnimatedButton
                          className="mt-5 self-center flex-row items-center justify-center gap-3 rounded-2xl px-10 py-4"
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
                            <View className="px-2 flex-row gap-2">
                              <Ionicons name="scan" size={24} color="#fff" />
                              <Text className="font-condensed text-xl tracking-wide text-white">
                                Quét vé số
                              </Text>
                            </View>
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

                {/* ── Scanned result ── */}
                {scanned && result && isLandscape && (
                  <View className="w-full flex-row items-center justify-center gap-4 mt-1 px-2">
                    <View className="items-center justify-center">
                      <Text
                        className="font-condensed"
                        style={{
                          color: "#8B0000",
                          textShadow: "0px 2px 8px rgba(0,0,0,0.3)",
                          fontSize: 20,
                        }}
                      >
                        Quét Lô Tô
                      </Text>
                    </View>

                    <TicketCard
                      blocks={result.blocks!}
                      ticketId={result.ticket_id}
                      confidence={result.confidence}
                      matched={matched}
                      onToggle={handleToggle}
                      colors={ticketColors}
                      isLandscape={isLandscape}
                    />

                    <View className="items-center gap-3">
                      {matched.size > 0 && (
                        <AnimatedButton
                          className="flex-row items-center gap-2 rounded-full px-4 py-1.5"
                          style={{
                            backgroundColor: "#FFD54F",
                            borderWidth: 2,
                            borderColor: "#E65100",
                          }}
                          onPress={confirmClear}
                        >
                          <Ionicons name="refresh" size={14} color="#5D2E1A" />
                          <Text
                            className="text-xs font-bold"
                            style={{ color: "#5D2E1A" }}
                          >
                            Xoá tất cả
                          </Text>
                        </AnimatedButton>
                      )}
                      <AnimatedButton
                        className="flex-row items-center gap-2 rounded-full px-4 py-1.5"
                        style={{
                          backgroundColor: "#E53935",
                          borderWidth: 2,
                          borderColor: "#7f1d1d",
                        }}
                        onPress={confirmRescan}
                      >
                        <Ionicons
                          name="camera-reverse"
                          size={14}
                          color="#fff"
                        />
                        <Text className="text-xs font-bold text-white">
                          Quét vé khác
                        </Text>
                      </AnimatedButton>
                    </View>
                  </View>
                )}

                {scanned && result && !isLandscape && (
                  <View className="w-full items-center mt-4">
                    <Text
                      className="mb-2 font-condensed"
                      style={{
                        color: "#8B0000",
                        textShadow: "0px 2px 8px rgba(0,0,0,0.3)",
                        fontSize: isTablet ? 48 : 36,
                      }}
                    >
                      Quét Lô Tô
                    </Text>

                    <TicketCard
                      blocks={result.blocks!}
                      ticketId={result.ticket_id}
                      confidence={result.confidence}
                      matched={matched}
                      onToggle={handleToggle}
                      colors={ticketColors}
                      isLandscape={isLandscape}
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
                          <Text
                            className="text-sm font-bold"
                            style={{ color: "#5D2E1A" }}
                          >
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
                        <Ionicons
                          name="camera-reverse"
                          size={16}
                          color="#fff"
                        />
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
