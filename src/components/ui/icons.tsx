import React from 'react';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { colors } from '../../theme/tokens';

type IconProps = {
  size?: number;
  color?: string;
};

export function PauseIcon({ size = 32, color = colors.white }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect x="6" y="5" width="4" height="14" rx="1.5" fill={color} />
      <Rect x="14" y="5" width="4" height="14" rx="1.5" fill={color} />
    </Svg>
  );
}

export function PlayIcon({ size = 32, color = colors.white }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M8 5.5v13a0.5 0.5 0 0 0 0.77 0.42l10.2-6.5a0.5 0.5 0 0 0 0-0.84L8.77 5.08A0.5 0.5 0 0 0 8 5.5Z" fill={color} />
    </Svg>
  );
}

export function StopIcon({ size = 32, color = colors.white }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect x="5" y="5" width="14" height="14" rx="3" fill={color} />
    </Svg>
  );
}

export function BookmarkIcon({ size = 24, color = colors.text }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M6 4.5A1.5 1.5 0 0 1 7.5 3h9A1.5 1.5 0 0 1 18 4.5V21l-6-3.6L6 21V4.5Z"
        fill={color}
        opacity={0.9}
      />
    </Svg>
  );
}

export function MicIcon({ size = 24, color = colors.primary }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect x="9" y="3" width="6" height="11" rx="3" fill={color} />
      <Path
        d="M5 11a7 7 0 0 0 14 0M12 18v3"
        stroke={color}
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </Svg>
  );
}

export function BackIcon({ size = 24, color = colors.text }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M15 5l-7 7 7 7"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function InfoIcon({ size = 20, color = colors.muted }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx="12" cy="12" r="9" stroke={color} strokeWidth="1.8" />
      <Path d="M12 11v5" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
      <Circle cx="12" cy="8" r="1.2" fill={color} />
    </Svg>
  );
}

export function ReportsIcon({ size = 20, color = colors.muted }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 20 20" fill="none">
      <Path
        d="M6 2.5H12L16 6V16.5C16 17.0304 15.7893 17.5391 15.4142 17.9142C15.0391 18.2893 14.5304 18.5 14 18.5H6C5.46957 18.5 4.96086 18.2893 4.58579 17.9142C4.21071 17.5391 4 17.0304 4 16.5V4.5C4 3.96957 4.21071 3.46086 4.58579 3.08579C4.96086 2.71071 5.46957 2.5 6 2.5Z"
        stroke={color}
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
      <Path d="M12 2.5V6H16" stroke={color} strokeWidth="1.7" strokeLinejoin="round" />
      <Path d="M8 10H12" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
      <Path d="M8 13.5H12" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
    </Svg>
  );
}

export function NotesIcon(props: IconProps) {
  return ReportsIcon(props);
}

export function FilterIcon({ size = 20, color = colors.primary }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M4 5h16l-6.5 8v5.5L10 21v-8L4 5Z"
        stroke={color}
        strokeWidth="1.8"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <Path d="M9 16h6" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
    </Svg>
  );
}

export function ChevronDownIcon({ size = 18, color = colors.text }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M6 9l6 6 6-6"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function SettingsIcon({ size = 20, color = colors.muted }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M9.594 3.94C9.684 3.398 10.154 3 10.704 3H13.297C13.847 3 14.317 3.398 14.407 3.94L14.62 5.221C14.683 5.595 14.933 5.907 15.265 6.09C15.339 6.13 15.413 6.173 15.485 6.217C15.809 6.413 16.205 6.474 16.56 6.341L17.777 5.885C18.085 5.77 18.429 5.885 18.647 6.17L19.943 8.417C20.161 8.702 20.126 9.076 19.866 9.307L18.863 10.134C18.57 10.374 18.425 10.747 18.432 11.125C18.434 11.21 18.434 11.295 18.432 11.38C18.425 11.758 18.57 12.131 18.863 12.371L19.866 13.198C20.126 13.429 20.161 13.803 19.943 14.088L18.647 16.335C18.429 16.62 18.085 16.735 17.777 16.62L16.56 16.164C16.205 16.031 15.809 16.092 15.485 16.288C15.413 16.332 15.339 16.375 15.265 16.415C14.933 16.598 14.683 16.91 14.62 17.284L14.407 18.565C14.317 19.107 13.847 19.505 13.297 19.505H10.704C10.154 19.505 9.684 19.107 9.594 18.565L9.381 17.284C9.318 16.91 9.068 16.598 8.736 16.415C8.662 16.375 8.588 16.332 8.516 16.288C8.192 16.092 7.796 16.031 7.441 16.164L6.224 16.62C5.916 16.735 5.572 16.62 5.354 16.335L4.058 14.088C3.84 13.803 3.875 13.429 4.135 13.198L5.138 12.371C5.431 12.131 5.576 11.758 5.569 11.38C5.567 11.295 5.567 11.21 5.569 11.125C5.576 10.747 5.431 10.374 5.138 10.134L4.135 9.307C3.875 9.076 3.84 8.702 4.058 8.417L5.354 6.17C5.572 5.885 5.916 5.77 6.224 5.885L7.441 6.341C7.796 6.474 8.192 6.413 8.516 6.217C8.588 6.173 8.662 6.13 8.736 6.09C9.068 5.907 9.318 5.595 9.381 5.221L9.594 3.94Z"
        stroke={color}
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <Circle cx="12" cy="12" r="3" stroke={color} strokeWidth="1.5" />
    </Svg>
  );
}