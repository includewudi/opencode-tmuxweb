import { octalUnescape } from './octalUnescape';

export type CcOutputEvent = { type: 'output'; paneId: string; text: string };
export type CcBeginEvent = { type: 'begin'; commandId: string };
export type CcEndEvent = { type: 'end'; commandId: string };
export type CcErrorEvent = { type: 'error'; commandId: string; message: string };
export type CcPauseEvent = { type: 'pause'; commandId: string };

export type TmuxCcEvent =
  | CcOutputEvent
  | CcBeginEvent
  | CcEndEvent
  | CcErrorEvent
  | CcPauseEvent;

export class TmuxCcParser {
  private buffer = '';

  push(chunk: string, onEvent: (event: TmuxCcEvent) => void): void {
    this.buffer += chunk;

    while (true) {
      const idx = this.buffer.indexOf('\n');
      if (idx === -1) return;

      const rawLine = this.buffer.slice(0, idx);
      this.buffer = this.buffer.slice(idx + 1);

      const line = rawLine.endsWith('\r') ? rawLine.slice(0, -1) : rawLine;
      this.parseLine(line, onEvent);
    }
  }

  private parseLine(line: string, onEvent: (event: TmuxCcEvent) => void): void {
    if (!line.startsWith('%')) return;

    if (line.startsWith('%output ')) {
      const firstSpaceAfterCmd = line.indexOf(' ', '%output '.length);
      if (firstSpaceAfterCmd === -1) return;

      const paneId = line.slice('%output '.length, firstSpaceAfterCmd).trim();
      if (paneId.length === 0) return;

      const textRaw = line.slice(firstSpaceAfterCmd + 1);
      const text = octalUnescape(textRaw);
      onEvent({ type: 'output', paneId, text });
      return;
    }

    if (line.startsWith('%begin ')) {
      const commandId = line.slice('%begin '.length).trim();
      if (commandId.length === 0) return;
      onEvent({ type: 'begin', commandId });
      return;
    }

    if (line.startsWith('%end ')) {
      const commandId = line.slice('%end '.length).trim();
      if (commandId.length === 0) return;
      onEvent({ type: 'end', commandId });
      return;
    }

    if (line.startsWith('%pause ')) {
      const commandId = line.slice('%pause '.length).trim();
      if (commandId.length === 0) return;
      onEvent({ type: 'pause', commandId });
      return;
    }

    if (line.startsWith('%error ')) {
      const rest = line.slice('%error '.length);
      const firstSpace = rest.indexOf(' ');
      if (firstSpace === -1) return;
      const commandId = rest.slice(0, firstSpace).trim();
      const message = rest.slice(firstSpace + 1).trim();
      if (commandId.length === 0) return;
      onEvent({ type: 'error', commandId, message });
      return;
    }
  }
}
