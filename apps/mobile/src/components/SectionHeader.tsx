import { StyleSheet, Text, View } from "react-native";

import { COLORS } from "../theme";

export const SectionHeader = ({
  eyebrow,
  title,
  subtitle
}: {
  eyebrow: string;
  title: string;
  subtitle?: string;
}) => {
  return (
    <View style={styles.wrapper}>
      <View style={styles.eyebrowRow}>
        <View style={styles.eyebrowBadge}>
          <Text style={styles.eyebrow}>{eyebrow}</Text>
        </View>
        <View style={styles.rule} />
      </View>
      <Text style={styles.title}>{title}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    gap: 8
  },
  eyebrowRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10
  },
  eyebrowBadge: {
    backgroundColor: "rgba(197, 139, 91, 0.14)",
    borderColor: COLORS.borderStrong,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6
  },
  eyebrow: {
    color: COLORS.accentSoft,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.2,
    textTransform: "uppercase"
  },
  rule: {
    backgroundColor: COLORS.border,
    flex: 1,
    height: 1
  },
  title: {
    color: COLORS.text,
    fontSize: 28,
    fontWeight: "900",
    lineHeight: 33
  },
  subtitle: {
    color: COLORS.textMuted,
    fontSize: 14,
    lineHeight: 21
  }
});
