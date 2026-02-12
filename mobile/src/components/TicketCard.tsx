import { View, Text, TouchableOpacity, useWindowDimensions } from "react-native";
import { Block } from "../api/client";
import { TicketColors } from "../hooks/useImageColors";

const COLS = 9;
const GAP = 2;

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
            <TouchableOpacity
              key={i}
              activeOpacity={0.6}
              onPress={() => onToggle(n)}
              className="items-center justify-center rounded"
              style={{
                width: cellWidth,
                height: cellHeight,
                backgroundColor: isMatched ? "#B71C1C" : "#fff",
                borderWidth: 1,
                borderColor: isMatched ? "#8B0000" : "#DAA520",
              }}
            >
              <Text
                className="font-condensed text-xl"
                style={{ color: isMatched ? "#fff" : "#333" }}
              >
                {n}
              </Text>
            </TouchableOpacity>
          );
        }
        return (
          <View
            key={i}
            className="rounded"
            style={{
              width: cellWidth,
              height: cellHeight,
              backgroundColor: colors.background,
              borderWidth: 1,
              borderColor: "#DAA520",
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
    <View className="mb-3">
      <Text className="mb-1 text-xs font-bold text-tet-red">
        Tờ {index + 1}
      </Text>
      <TicketRow row={block.row1} cellWidth={cellWidth} cellHeight={cellHeight} matched={matched} onToggle={onToggle} colors={colors} />
      <TicketRow row={block.row2} cellWidth={cellWidth} cellHeight={cellHeight} matched={matched} onToggle={onToggle} colors={colors} />
      <TicketRow row={block.row3} cellWidth={cellWidth} cellHeight={cellHeight} matched={matched} onToggle={onToggle} colors={colors} />
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
}: {
  blocks: Block[];
  ticketId?: string;
  confidence: number;
  matched: Set<number>;
  onToggle: (n: number) => void;
  colors: TicketColors;
}) {
  const { width } = useWindowDimensions();
  const cardPadding = 16;
  const screenPadding = 20;
  const cellWidth = Math.floor(
    (width - screenPadding * 2 - cardPadding * 2 - GAP * (COLS - 1)) / COLS
  );
  const cellHeight = Math.floor(cellWidth * 1.4);

  return (
    <View
      className="w-full rounded-2xl bg-tet-cream p-4 shadow-md"
      style={{ borderWidth: 3, borderColor: colors.accent }}
    >
      <View
        className="mb-3 flex-row items-center justify-between pb-2"
        style={{ borderBottomWidth: 2, borderBottomColor: "#DAA520" }}
      >
        <Text
          className="font-condensed text-2xl tracking-wider"
          style={{ color: colors.primary }}
        >
          🧧 LÔ TÔ 🧧
        </Text>
        {ticketId ? (
          <Text className="text-sm font-semibold text-gray-500">
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
        className="mt-1 items-center pt-2"
        style={{ borderTopWidth: 2, borderTopColor: "#DAA520" }}
      >
        <Text className="text-sm font-semibold text-tet-red">
          {matched.size > 0
            ? `🎯 Đã đánh: ${matched.size} số`
            : "Nhấn vào số để đánh 🎲"}
        </Text>
      </View>
    </View>
  );
}
