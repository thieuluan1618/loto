import { View, Text, TouchableOpacity, StyleSheet, useWindowDimensions } from "react-native";
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
    <View style={styles.row}>
      {cells.map((n, i) => {
        const isMatched = n !== null && matched.has(n);
        if (n !== null) {
          return (
            <TouchableOpacity
              key={i}
              activeOpacity={0.6}
              onPress={() => onToggle(n)}
              style={[
                styles.cell,
                { width: cellWidth, height: cellHeight },
                styles.cellFilled,
                isMatched && styles.cellMatched,
              ]}
            >
              <Text style={[styles.cellTextFilled, isMatched && styles.cellTextMatched]}>
                {n}
              </Text>
            </TouchableOpacity>
          );
        }
        return (
          <View
            key={i}
            style={[styles.cell, { width: cellWidth, height: cellHeight }, { backgroundColor: colors.background }]}
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
    <View style={styles.block}>
      <Text style={styles.blockLabel}>Tờ {index + 1}</Text>
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
    <View style={[styles.card, { borderColor: colors.accent }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.primary }]}>LÔ TÔ</Text>
        {ticketId ? <Text style={styles.ticketId}>#{ticketId}</Text> : null}
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

      <View style={styles.footer}>
        <Text style={styles.matchCount}>
          {matched.size > 0 ? `Đã đánh: ${matched.size} số` : "Nhấn vào số để đánh"}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    width: "100%",
    elevation: 3,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    borderWidth: 2,
    borderColor: "#F44336",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#E0E0E0",
  },
  title: {
    fontSize: 22,
    fontWeight: "bold",
    color: "#D32F2F",
    letterSpacing: 2,
  },
  ticketId: {
    fontSize: 14,
    color: "#888",
    fontWeight: "600",
  },
  block: {
    marginBottom: 12,
  },
  blockLabel: {
    fontSize: 12,
    color: "#999",
    marginBottom: 4,
    fontWeight: "600",
  },
  row: {
    flexDirection: "row",
    gap: GAP,
    marginBottom: GAP,
  },
  cell: {
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#FFF8E1",
    borderRadius: 4,
    borderWidth: 1,
    borderColor: "#E0E0E0",
  },
  cellFilled: {
    backgroundColor: "#fff",
    borderColor: "#E0E0E0",
  },
  cellMatched: {
    backgroundColor: "#4CAF50",
    borderColor: "#388E3C",
  },
  cellTextFilled: {
    fontSize: 18,
    color: "#333",
    fontWeight: "bold",
  },
  cellTextMatched: {
    color: "#fff",
  },
  footer: {
    marginTop: 4,
    alignItems: "center",
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "#E0E0E0",
  },
  matchCount: {
    fontSize: 13,
    color: "#888",
  },
});
