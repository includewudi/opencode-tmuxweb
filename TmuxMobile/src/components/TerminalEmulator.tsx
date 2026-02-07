import React, { useEffect, useRef, useState, useCallback, useImperativeHandle, forwardRef } from 'react';
import { View, Text, ScrollView, TextStyle } from 'react-native';
import remoteLogger from '../services/remoteLogger';

interface AnsiStyle {
  color?: string;
  backgroundColor?: string;
  bold?: boolean;
  dim?: boolean;
  italic?: boolean;
  underline?: boolean;
}

interface StyledSegment {
  text: string;
  style: AnsiStyle;
}

interface TerminalLine {
  segments: StyledSegment[];
}

export interface TerminalEmulatorRef {
  write: (data: string) => void;
  clear: () => void;
  scrollToEnd: () => void;
}

interface TerminalEmulatorProps {
  initialContent?: string;
  maxLines?: number;
  fontSize?: number;
  onData?: (data: string) => void;
}

const ANSI_COLORS: Record<number, string> = {
  30: '#1e1e1e', 31: '#cd3131', 32: '#0dbc79', 33: '#e5e510',
  34: '#2472c8', 35: '#bc3fbc', 36: '#11a8cd', 37: '#e5e5e5',
  90: '#666666', 91: '#f14c4c', 92: '#23d18b', 93: '#f5f543',
  94: '#3b8eea', 95: '#d670d6', 96: '#29b8db', 97: '#ffffff',
};

const ANSI_BG_COLORS: Record<number, string> = {
  40: '#1e1e1e', 41: '#cd3131', 42: '#0dbc79', 43: '#e5e510',
  44: '#2472c8', 45: '#bc3fbc', 46: '#11a8cd', 47: '#e5e5e5',
  100: '#666666', 101: '#f14c4c', 102: '#23d18b', 103: '#f5f543',
  104: '#3b8eea', 105: '#d670d6', 106: '#29b8db', 107: '#ffffff',
};

function parseAnsiCode(code: string, currentStyle: AnsiStyle): AnsiStyle {
  const newStyle = { ...currentStyle };
  const params = code.split(';').map(Number);

  for (let i = 0; i < params.length; i++) {
    const param = params[i];

    if (param === 0) {
      return {};
    } else if (param === 1) {
      newStyle.bold = true;
    } else if (param === 2) {
      newStyle.dim = true;
    } else if (param === 3) {
      newStyle.italic = true;
    } else if (param === 4) {
      newStyle.underline = true;
    } else if (param === 22) {
      newStyle.bold = false;
      newStyle.dim = false;
    } else if (param === 23) {
      newStyle.italic = false;
    } else if (param === 24) {
      newStyle.underline = false;
    } else if (param >= 30 && param <= 37) {
      newStyle.color = ANSI_COLORS[param];
    } else if (param >= 90 && param <= 97) {
      newStyle.color = ANSI_COLORS[param];
    } else if (param === 38 && params[i + 1] === 5) {
      newStyle.color = get256Color(params[i + 2]);
      i += 2;
    } else if (param === 39) {
      delete newStyle.color;
    } else if (param >= 40 && param <= 47) {
      newStyle.backgroundColor = ANSI_BG_COLORS[param];
    } else if (param >= 100 && param <= 107) {
      newStyle.backgroundColor = ANSI_BG_COLORS[param];
    } else if (param === 48 && params[i + 1] === 5) {
      newStyle.backgroundColor = get256Color(params[i + 2]);
      i += 2;
    } else if (param === 49) {
      delete newStyle.backgroundColor;
    }
  }

  return newStyle;
}

function get256Color(code: number): string {
  if (code < 16) {
    const basic16 = [
      '#000000', '#cd3131', '#0dbc79', '#e5e510',
      '#2472c8', '#bc3fbc', '#11a8cd', '#e5e5e5',
      '#666666', '#f14c4c', '#23d18b', '#f5f543',
      '#3b8eea', '#d670d6', '#29b8db', '#ffffff',
    ];
    return basic16[code];
  } else if (code < 232) {
    const c = code - 16;
    const r = Math.floor(c / 36) * 51;
    const g = Math.floor((c % 36) / 6) * 51;
    const b = (c % 6) * 51;
    return `rgb(${r},${g},${b})`;
  } else {
    const gray = (code - 232) * 10 + 8;
    return `rgb(${gray},${gray},${gray})`;
  }
}

function parseAnsiText(text: string): StyledSegment[] {
  const segments: StyledSegment[] = [];
  const ansiPattern = /\x1b\[([0-9;]*)m/g;

  let currentStyle: AnsiStyle = {};
  let lastIndex = 0;
  let match;

  while ((match = ansiPattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      const rawText = text.slice(lastIndex, match.index);
      if (rawText) {
        segments.push({ text: rawText, style: { ...currentStyle } });
      }
    }

    currentStyle = parseAnsiCode(match[1] || '0', currentStyle);
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    segments.push({ text: text.slice(lastIndex), style: { ...currentStyle } });
  }

  return segments;
}

function stripControlSequences(text: string): string {
  let result = text
    .replace(/\x1b\[\?25[lh]/g, '')
    .replace(/\x1b\[\?12[lh]/g, '')
    .replace(/\x1b\[\d+ q/g, '')
    .replace(/\x1b\[\d+;\d+H/g, '')
    .replace(/\x1b\[\d+[ABCDJK]/g, '')
    .replace(/\x1b\][^\x07]*\x07/g, '')
    .replace(/\x1b\([AB012]/g, '')
    .replace(/\x1b\(B/g, '')
    .replace(/\x1b[=>]/g, '')
    .replace(/\r\n/g, '\n')
    .replace(/\r(?!\n)/g, '')
    .replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g, '');
  
  const stripped = result.replace(/\x1b\[[0-9;]*m/g, '').trim();
  if (stripped.length === 0) {
    return '';
  }
  
  return result;
}

export const TerminalEmulator = forwardRef<TerminalEmulatorRef, TerminalEmulatorProps>(
  ({ initialContent = '', maxLines = 1000, fontSize = 13 }, ref) => {
    const [lines, setLines] = useState<TerminalLine[]>([]);
    const scrollViewRef = useRef<ScrollView>(null);
    const bufferRef = useRef<string>('');

    const processBuffer = useCallback(() => {
      const buffer = bufferRef.current;
      if (!buffer) return;

      const cleanBuffer = stripControlSequences(buffer);
      const newLines = cleanBuffer.split('\n');

      setLines((prevLines) => {
        const updatedLines = [...prevLines];

        for (let i = 0; i < newLines.length; i++) {
          const lineText = newLines[i];

          if (i === 0 && updatedLines.length > 0) {
            const lastLine = updatedLines[updatedLines.length - 1];
            const existingText = lastLine.segments.map((s) => s.text).join('');
            const combinedText = existingText + lineText;
            updatedLines[updatedLines.length - 1] = {
              segments: parseAnsiText(combinedText),
            };
          } else {
            updatedLines.push({ segments: parseAnsiText(lineText) });
          }
        }

        if (updatedLines.length > maxLines) {
          return updatedLines.slice(-maxLines);
        }

        return updatedLines;
      });

      bufferRef.current = '';
    }, [maxLines]);

    const write = useCallback((data: string) => {
      remoteLogger.log('Terminal', 'write', { dataLength: data.length, preview: data.slice(0, 200) });
      bufferRef.current += data;
      processBuffer();
    }, [processBuffer]);

    const clear = useCallback(() => {
      setLines([]);
      bufferRef.current = '';
    }, []);

    const scrollToEnd = useCallback(() => {
      scrollViewRef.current?.scrollToEnd({ animated: false });
    }, []);

    useImperativeHandle(ref, () => ({
      write,
      clear,
      scrollToEnd,
    }), [write, clear, scrollToEnd]);

    useEffect(() => {
      if (initialContent) {
        write(initialContent);
      }
    }, [initialContent, write]);

    useEffect(() => {
      scrollToEnd();
    }, [lines, scrollToEnd]);

    const getTextStyle = (style: AnsiStyle): TextStyle => {
      const textStyle: TextStyle = {
        fontFamily: 'monospace',
        fontSize,
        color: style.color || '#e5e5e5',
      };

      if (style.backgroundColor) {
        textStyle.backgroundColor = style.backgroundColor;
      }
      if (style.bold) {
        textStyle.fontWeight = 'bold';
      }
      if (style.italic) {
        textStyle.fontStyle = 'italic';
      }
      if (style.underline) {
        textStyle.textDecorationLine = 'underline';
      }
      if (style.dim) {
        textStyle.opacity = 0.5;
      }

      return textStyle;
    };

    return (
      <ScrollView
        ref={scrollViewRef}
        className="flex-1 bg-black px-2 py-1"
        showsVerticalScrollIndicator={true}
        persistentScrollbar={true}
      >
        {lines.map((line, lineIndex) => (
          <View key={lineIndex} className="flex-row flex-wrap min-h-[18px]">
            {line.segments.map((segment, segIndex) => (
              <Text key={segIndex} style={getTextStyle(segment.style)}>
                {segment.text}
              </Text>
            ))}
          </View>
        ))}
      </ScrollView>
    );
  }
);

TerminalEmulator.displayName = 'TerminalEmulator';
