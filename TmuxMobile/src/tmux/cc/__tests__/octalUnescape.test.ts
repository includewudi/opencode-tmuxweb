import { octalUnescape } from '../octalUnescape';

describe('octalUnescape', () => {
  test('decodes basic octal sequences (ESC)', () => {
    expect(octalUnescape('\\033')).toBe('\u001b');
  });

  test('decodes mixed text + octal (space)', () => {
    expect(octalUnescape('Hello\\040World')).toBe('Hello World');
  });

  test('decodes multiple octal sequences in one string', () => {
    expect(octalUnescape('A\\015\\012B')).toBe('A\r\nB');
  });

  test('leaves invalid/incomplete sequences untouched', () => {
    expect(octalUnescape('\\08')).toBe('\\08');
    expect(octalUnescape('\\0')).toBe('\\0');
    expect(octalUnescape('\\999')).toBe('\\999');
  });

  test('handles empty string', () => {
    expect(octalUnescape('')).toBe('');
  });
});
