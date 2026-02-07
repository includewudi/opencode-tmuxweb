export function octalUnescape(input: string): string {
  if (input.length === 0) return input;

  let out = '';

  for (let i = 0; i < input.length; i++) {
    const ch = input[i];
    if (ch !== '\\') {
      out += ch;
      continue;
    }

    const d1 = input[i + 1];
    const d2 = input[i + 2];
    const d3 = input[i + 3];

    if (d1 === undefined || d2 === undefined || d3 === undefined) {
      out += ch;
      continue;
    }

    if (d1 < '0' || d1 > '7' || d2 < '0' || d2 > '7' || d3 < '0' || d3 > '7') {
      out += ch;
      continue;
    }

    const code = parseInt(d1 + d2 + d3, 8);
    out += String.fromCharCode(code);
    i += 3;
  }

  return out;
}
