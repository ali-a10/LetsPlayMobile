/** Subtle SVG background of a half-court layout viewed from above. */
import React from 'react';
import { StyleSheet, useWindowDimensions } from 'react-native';
import Svg, { Circle, Rect, Line } from 'react-native-svg';
import { colors } from '../../lib/constants/colors';

const LINE_COLOR = colors.secondary;
const OP = 0.15;

export function SportsFieldBackground() {
  const { width, height } = useWindowDimensions();

  /* Court is offset and slightly rotated via transform to feel abstract */
  const courtW = width * 0.9;
  const courtH = height * 0.6;
  const courtX = width * 0.35;
  const courtY = height * 0.15;

  return (
    <Svg
      width={width}
      height={height}
      style={StyleSheet.absoluteFill}
      pointerEvents="none"
    >
      {/* Court boundary rectangle — shifted right so only part is visible */}
      <Rect
        x={courtX}
        y={courtY}
        width={courtW}
        height={courtH}
        stroke={LINE_COLOR}
        strokeWidth={1.5}
        fill="none"
        opacity={OP}
        rx={4}
      />

      {/* Half-court line */}
      <Line
        x1={courtX}
        y1={courtY + courtH / 2}
        x2={courtX + courtW}
        y2={courtY + courtH / 2}
        stroke={LINE_COLOR}
        strokeWidth={1.5}
        opacity={OP}
      />

      {/* Center circle */}
      <Circle
        cx={courtX + courtW / 2}
        cy={courtY + courtH / 2}
        r={width * 0.14}
        stroke={LINE_COLOR}
        strokeWidth={1.5}
        fill="none"
        opacity={OP}
      />

      {/* Top free-throw / key box */}
      <Rect
        x={courtX + courtW / 2 - width * 0.12}
        y={courtY}
        width={width * 0.24}
        height={courtH * 0.3}
        stroke={LINE_COLOR}
        strokeWidth={1}
        fill="none"
        opacity={OP}
      />

      {/* Top free-throw semicircle */}
      <Circle
        cx={courtX + courtW / 2}
        cy={courtY + courtH * 0.3}
        r={width * 0.12}
        stroke={LINE_COLOR}
        strokeWidth={1}
        fill="none"
        opacity={OP}
        strokeDasharray="6 8"
      />

      {/* Bottom free-throw / key box */}
      <Rect
        x={courtX + courtW / 2 - width * 0.12}
        y={courtY + courtH * 0.7}
        width={width * 0.24}
        height={courtH * 0.3}
        stroke={LINE_COLOR}
        strokeWidth={1}
        fill="none"
        opacity={OP}
      />

      {/* Bottom free-throw semicircle */}
      <Circle
        cx={courtX + courtW / 2}
        cy={courtY + courtH * 0.7}
        r={width * 0.12}
        stroke={LINE_COLOR}
        strokeWidth={1}
        fill="none"
        opacity={OP}
        strokeDasharray="6 8"
      />
    </Svg>
  );
}
