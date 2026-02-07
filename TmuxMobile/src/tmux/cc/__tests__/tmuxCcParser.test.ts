import { TmuxCcEvent, TmuxCcParser } from '../tmuxCcParser';

function drain(parser: TmuxCcParser, chunk: string): TmuxCcEvent[] {
  const events: TmuxCcEvent[] = [];
  parser.push(chunk, (ev: TmuxCcEvent) => events.push(ev));
  return events;
}

describe('TmuxCcParser', () => {
  test('parses %output with pane id and octal unescaping', () => {
    const parser = new TmuxCcParser();

    const events = drain(parser, '%output %1 Hello\\015\\012\\033[31mRed\\033[0m\\012\n');

    expect(events).toEqual([
      {
        type: 'output',
        paneId: '%1',
        text: 'Hello\r\n\u001b[31mRed\u001b[0m\n',
      },
    ]);
  });

  test('ignores malformed/unknown lines', () => {
    const parser = new TmuxCcParser();
    const events = drain(parser, 'garbage\n%output\n%random %1 hi\n');
    expect(events).toEqual([]);
  });

  test('detects %begin %end %error %pause', () => {
    const parser = new TmuxCcParser();

    const events = [
      ...drain(parser, '%begin 123\n'),
      ...drain(parser, '%pause 123\n'),
      ...drain(parser, '%error 123 something bad\n'),
      ...drain(parser, '%end 123\n'),
    ];

    expect(events).toEqual([
      { type: 'begin', commandId: '123' },
      { type: 'pause', commandId: '123' },
      { type: 'error', commandId: '123', message: 'something bad' },
      { type: 'end', commandId: '123' },
    ]);
  });

  test('handles chunked input (line split across pushes)', () => {
    const parser = new TmuxCcParser();

    const ev1 = drain(parser, '%out');
    const ev2 = drain(parser, 'put %1 hi\\012');
    const ev3 = drain(parser, '\n%pause 9\n');

    expect([...ev1, ...ev2, ...ev3]).toEqual([
      { type: 'output', paneId: '%1', text: 'hi\n' },
      { type: 'pause', commandId: '9' },
    ]);
  });
});
