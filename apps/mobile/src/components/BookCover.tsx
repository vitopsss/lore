import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle
} from "react-native";

import { COLORS } from "../theme";

const resolveBorderRadius = (style?: StyleProp<ViewStyle>) => {
  const flattenedStyle = StyleSheet.flatten(style);

  return typeof flattenedStyle?.borderRadius === "number" ? flattenedStyle.borderRadius : 0;
};

export const BookCover = ({
  uri,
  style
}: {
  uri?: string | null;
  style: StyleProp<ViewStyle>;
}) => {
  const [isLoading, setIsLoading] = useState(Boolean(uri));
  const [hasLoaded, setHasLoaded] = useState(false);

  useEffect(() => {
    setIsLoading(Boolean(uri));
    setHasLoaded(false);
  }, [uri]);

  const borderRadius = resolveBorderRadius(style);

  return (
    <View style={[styles.frame, style]}>
      <View style={[styles.placeholder, { borderRadius }]}>
        <View style={styles.icon}>
          <View style={[styles.iconSpine, styles.iconSpineTall]} />
          <View style={[styles.iconSpine, styles.iconSpineWarm]} />
          <View style={[styles.iconSpine, styles.iconSpineCool]} />
        </View>
        {uri && isLoading ? (
          <ActivityIndicator color={COLORS.accentSoft} size="small" style={styles.spinner} />
        ) : null}
      </View>

      {uri ? (
        <Image
          source={{ uri }}
          resizeMode="cover"
          onLoad={() => setHasLoaded(true)}
          onLoadStart={() => {
            setIsLoading(true);
            setHasLoaded(false);
          }}
          onLoadEnd={() => setIsLoading(false)}
          onError={() => {
            setHasLoaded(false);
            setIsLoading(false);
          }}
          style={[
            StyleSheet.absoluteFillObject,
            styles.image,
            {
              borderRadius,
              opacity: hasLoaded ? 1 : 0
            }
          ]}
        />
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  frame: {
    overflow: "hidden",
    position: "relative"
  },
  placeholder: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    backgroundColor: "#252d3a",
    justifyContent: "center"
  },
  icon: {
    alignItems: "center",
    flexDirection: "row",
    gap: 4,
    justifyContent: "center",
    opacity: 0.9
  },
  iconSpine: {
    borderRadius: 999,
    width: 8
  },
  iconSpineTall: {
    backgroundColor: COLORS.textSoft,
    height: 24
  },
  iconSpineWarm: {
    backgroundColor: COLORS.accent,
    height: 30
  },
  iconSpineCool: {
    backgroundColor: COLORS.accentCool,
    height: 20
  },
  spinner: {
    marginTop: 12
  },
  image: {
    backgroundColor: "transparent"
  }
});
