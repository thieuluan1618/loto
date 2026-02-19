import { View, Text, Pressable, useWindowDimensions } from "react-native";
import { Block } from "../api/client";
import { TicketColors } from "../hooks/useImageColors";

const COLS = 9;
const GAP = 2;
const CARD_CHROME = 200; // approximate vertical space for header, footer, labels, margins

function buildGrid(row: number[]): (number | null)[] {
  const cells: (number | null)[] = Array(COLS).fill(null);
  for (const n of row) {
    const col = n === 90 ? 8 : Math.floor(n / 10);
    cells[col] = n;
  }
  return cells;
}

function TicketRow({
  row,
  cellWidth,
  cellHeight,
  matched,
  onToggle,
  colors,
}: {
  row: number[];
  cellWidth: number;
  cellHeight: number;
  matched: Set<number>;
  onToggle: (n: number) => void;
  colors: TicketColors;
}) {
  const cells = buildGrid(row);
  return (
    <View className="flex-row" style={{ gap: GAP, marginBottom: GAP }}>
      {cells.map((n, i) => {
        const isMatched = n !== null && matched.has(n);
        if (n !== null) {
          return (
            <Pressable
              key={i}
              onPress={() => onToggle(n)}
              className="items-center justify-center"
              style={{
                flex: 1,
                height: cellHeight,
                backgroundColor: isMatched ? "#E53935" : "#fff",
                borderWidth: 2,
                borderColor: isMatched ? "#7f1d1d" : "#E65100",
                borderRadius: 6,
              }}
            >
              <Text
                className="font-condensed"
                style={{
                  color: isMatched ? "#fff" : "#333",
                  fontSize: Math.min(
                    cellWidth >= 50 ? 24 : 18,
                    cellHeight * 0.45,
                  ),
                }}
              >
                {n}
              </Text>
            </Pressable>
          );
        }
        return (
          <View
            key={i}
            style={{
              flex: 1,
              height: cellHeight,
              borderWidth: 1,
              borderColor: "#F5DEB3",
              borderRadius: 6,
              backgroundColor: "#FFF8F0",
            }}
          />
        );
      })}
    </View>
  );
}

function TicketBlock({
  block,
  index,
  cellWidth,
  cellHeight,
  matched,
  onToggle,
  colors,
}: {
  block: Block;
  index: number;
  cellWidth: number;
  cellHeight: number;
  matched: Set<number>;
  onToggle: (n: number) => void;
  colors: TicketColors;
}) {
  return (
    <View className="mb-1">
      <Text className="mb-0.5 text-xs font-bold text-tet-red">
        # {index + 1}
      </Text>
      <TicketRow
        row={block.row1}
        cellWidth={cellWidth}
        cellHeight={cellHeight}
        matched={matched}
        onToggle={onToggle}
        colors={colors}
      />
      <TicketRow
        row={block.row2}
        cellWidth={cellWidth}
        cellHeight={cellHeight}
        matched={matched}
        onToggle={onToggle}
        colors={colors}
      />
      <TicketRow
        row={block.row3}
        cellWidth={cellWidth}
        cellHeight={cellHeight}
        matched={matched}
        onToggle={onToggle}
        colors={colors}
      />
    </View>
  );
}

export default function TicketCard({
  blocks,
  ticketId,
  confidence,
  matched,
  onToggle,
  colors,
  isLandscape = false,
}: {
  blocks: Block[];
  ticketId?: string;
  confidence: number;
  matched: Set<number>;
  onToggle: (n: number) => void;
  colors: TicketColors;
  isLandscape?: boolean;
}) {
  const { width, height } = useWindowDimensions();
  const isTablet = width >= 768 && !isLandscape;
  const maxWidth = isLandscape ? height * 0.75 : isTablet ? 600 : 448;
  const containerWidth = Math.min(width, maxWidth);
  const cardPadding = isLandscape ? 8 : 16;
  const screenPadding = isLandscape ? 8 : 20;
  const cellWidth = Math.floor(
    (containerWidth - screenPadding * 2 - cardPadding * 2 - GAP * (COLS - 1)) /
      COLS,
  );
  const totalRows = blocks.length * 3;
  const blockLabels = blocks.length * 18;
  const cardChrome = isLandscape ? 90 + blockLabels : CARD_CHROME;
  const availableHeight = height - cardChrome;
  const maxCellHeight = Math.floor(
    (availableHeight - GAP * totalRows) / totalRows,
  );
  const cellHeight = Math.min(Math.floor(cellWidth * 1.2), maxCellHeight);

  return (
    <View
      className={`rounded-2xl bg-tet-cream ${isLandscape ? "p-2" : "w-full p-3"}`}
      style={{
        borderWidth: 3,
        borderColor: "#E65100",
        borderRadius: 16,
        ...(isLandscape ? { width: containerWidth } : {}),
      }}
    >
      <View
        className={`flex-row items-center justify-between ${isLandscape ? "mb-1 pb-1" : "mb-2 pb-1.5"}`}
        style={{ borderBottomWidth: 2, borderBottomColor: "#FFB74D" }}
      >
        <Text
          className={`font-condensed tracking-wider ${isLandscape ? "text-base" : "text-xl"}`}
          style={{ color: colors.primary }}
        >
          🧧 LÔ TÔ 🧧
        </Text>
        {ticketId ? (
          <Text
            className={`font-semibold text-gray-500 ${isLandscape ? "text-xs" : "text-sm"}`}
          >
            #{ticketId}
          </Text>
        ) : null}
      </View>

      {blocks.map((block, i) => (
        <TicketBlock
          key={i}
          block={block}
          index={i}
          cellWidth={cellWidth}
          cellHeight={cellHeight}
          matched={matched}
          onToggle={onToggle}
          colors={colors}
        />
      ))}

      <View
        className={`items-center ${isLandscape ? "mt-0.5 pt-1" : "mt-1 pt-2"}`}
        style={{ borderTopWidth: 2, borderTopColor: "#FFB74D" }}
      >
        <Text
          className={`font-semibold text-tet-red ${isLandscape ? "text-xs" : "text-sm"}`}
        >
          {matched.size > 0
            ? `🎯 Đã đánh: ${matched.size} số`
            : "Nhấn vào số để đánh 🎲"}
        </Text>
      </View>
    </View>
  );
}
