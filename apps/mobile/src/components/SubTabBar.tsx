import { Pressable, ScrollView, StyleSheet, Text } from "react-native";

import { COLORS } from "../theme";

export const SubTabBar = <T extends string,>({
  options,
  value,
  onChange
}: {
  options: Array<{ key: T; label: string }>;
  value: T;
  onChange: (nextValue: T) => void;
}) => {
  return (
    <ScrollView
      horizontal
      contentContainerStyle={styles.row}
      showsHorizontalScrollIndicator={false}
    >
      {options.map((option) => {
        const active = option.key === value;

        return (
          <Pressable
            key={option.key}
            onPress={() => onChange(option.key)}
            style={[styles.pill, active && styles.pillActive]}
          >
            <Text style={[styles.label, active && styles.labelActive]}>{option.label}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  row: {
    gap: 10,
    paddingRight: 10
  },
  pill: {
    backgroundColor: COLORS.panel,
    borderColor: COLORS.border,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10
  },
  pillActive: {
    backgroundColor: COLORS.backgroundRaised,
    borderColor: COLORS.borderStrong
  },
  label: {
    color: COLORS.textSoft,
    fontSize: 13,
    fontWeight: "800"
  },
  labelActive: {
    color: "#ffffff"
  }
});
