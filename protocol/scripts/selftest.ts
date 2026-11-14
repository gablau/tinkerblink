// Offline tests of framing and hashing. Usage: npm run selftest
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { unzlibSync, zlibSync } from 'fflate';
import { LegacyClient, Command, encodeMessage, FrameDecoder, parseGraphData, passwordHash, WsCodec, type Transport } from '../src/index.ts';

// Hash: compared with an independent implementation (Node crypto).
{
  const salt = createHash('sha256').update('a@b.it').digest();
  const expected = createHash('sha256').update(Buffer.concat([Buffer.from('prova123'), salt])).digest('base64');
  assert.equal(passwordHash('prova123', 'A@B.it'), expected);
}

// Framing: a HARDWARE and a RESPONSE, split into arbitrary chunks.
{
  const hw = encodeMessage(20, 7, '1-0\0vw\x005\x001');
  const resp = new Uint8Array([0, 0, 9, 0, 0, 0, 200]);
  const all = new Uint8Array([...hw, ...resp]);
  const d = new FrameDecoder();
  const out = [...d.push(all.subarray(0, 4)), ...d.push(all.subarray(4, 12)), ...d.push(all.subarray(12))];
  assert.deepEqual(out, [
    { kind: 'text', command: 20, msgId: 7, body: '1-0\0vw\x005\x001' },
    { kind: 'response', command: 0, msgId: 9, code: 200 },
  ]);
}

// Profile: reply 24 is binary.
{
  const d = new FrameDecoder();
  const [m] = d.push(new Uint8Array([24, 0, 1, 0, 0, 0, 2, 0x1f, 0x8b]));
  assert.equal(m?.kind, 'binary');
}

// WebSocket: 3-byte header, no length; RESPONSE with a u32 code.
{
  const ws = new WsCodec();
  assert.deepEqual([...ws.encode(2, 1, 'ab')], [2, 0, 1, 97, 98]);
  assert.deepEqual(ws.push(new Uint8Array([0, 0, 1, 0, 0, 0, 200])), [
    { kind: 'response', command: 0, msgId: 1, code: 200 },
  ]);
  assert.deepEqual(ws.push(new Uint8Array([20, 0, 5, ...new TextEncoder().encode('1-0\0vw\x001\x002')])), [
    { kind: 'text', command: 20, msgId: 5, body: '1-0\0vw\x001\x002' },
  ]);
  const [bin] = ws.push(new Uint8Array([60, 0, 9, 0x78, 0x9c]));
  assert.equal(bin?.kind, 'binary');
}

// SuperChart: zlib payload with dashId + 2 streams (2 points and 0 points).
{
  const raw = new Uint8Array(4 + 4 + 2 * 16 + 4);
  const v = new DataView(raw.buffer);
  v.setInt32(0, 123);
  v.setInt32(4, 2);
  v.setFloat64(8, 21.5);
  v.setBigInt64(16, 1_700_000_000_000n);
  v.setFloat64(24, -3.25);
  v.setBigInt64(32, 1_700_000_060_000n);
  v.setInt32(40, 0);
  const parsed = parseGraphData(unzlibSync(zlibSync(raw)));
  assert.deepEqual(parsed, {
    dashId: 123,
    streams: [
      [
        { ts: 1_700_000_000_000, value: 21.5 },
        { ts: 1_700_000_060_000, value: -3.25 },
      ],
      [],
    ],
  });
}

// Permissions: in read-only mode only HARDWARE goes through (with allowHardwareWrites), never project changes.
{
  const written: Uint8Array[] = [];
  const fake: Transport = {
    framing: 'ws',
    connect: async () => {},
    write: (d) => void written.push(d),
    close: () => {},
    onData: () => {},
    onClose: () => {},
  };
  const ro = new LegacyClient(fake, { readOnly: true });
  assert.throws(() => ro.writePin(1, 0, 20, ['x']), /bloccato/);
  const hw = new LegacyClient(fake, { readOnly: true, allowHardwareWrites: true });
  hw.writePin(123456789, 0, 20, ['ciao']);
  const [m] = new WsCodec().push(written[0]!);
  assert.deepEqual(m, { kind: 'text', command: Command.HARDWARE, msgId: 1, body: '123456789-0\0vw\x0020\x00ciao' });
  assert.throws(() => hw.send(Command.CREATE_WIDGET, '{}'), /bloccato/);
  // Editor: edit commands only on the allowed dashboards (dashId = first field of the body).
  const ed = new LegacyClient(fake, { readOnly: true, editableDashIds: [123456789] });
  assert.doesNotThrow(() => ed.send(Command.UPDATE_WIDGET, '123456789\0{}'));
  assert.throws(() => ed.send(Command.UPDATE_WIDGET, '999\0{}'), /bloccato/);
  assert.throws(() => ed.send(Command.UPDATE_WIDGET, '1234567890\0{}'), /bloccato/);
  assert.throws(() => ed.send(Command.UPDATE_DASH, '123456789\0{}'), /bloccato/);
  assert.throws(() => ed.writePin(123456789, 0, 20, ['x']), /bloccato/);
  // Projects and devices: same limits; stop without dashId (= all) and CREATE_DASH without the option are blocked.
  assert.doesNotThrow(() => ed.send(Command.DELETE_DEVICE, '123456789\x001'));
  assert.doesNotThrow(() => ed.send(Command.ACTIVATE_DASHBOARD, '123456789'));
  assert.throws(() => ed.send(Command.DELETE_DASH, '999'), /bloccato/);
  assert.throws(() => ed.send(Command.DEACTIVATE_DASHBOARD, ''), /bloccato/);
  assert.throws(() => ed.send(Command.CREATE_DEVICE, ' 123456789\0{}'), /bloccato/);
  assert.throws(() => ed.send(Command.CREATE_DASH, '{"id":5}'), /bloccato/);
  ed.allowEditing(999);
  assert.doesNotThrow(() => ed.send(Command.DELETE_DASH, '999'));
  const cr = new LegacyClient(fake, { readOnly: true, allowCreateDash: true });
  assert.doesNotThrow(() => cr.send(Command.CREATE_DASH, '{"id":5}'));
  assert.throws(() => cr.send(Command.DELETE_DASH, '5'), /bloccato/);
}

console.log('✅ selftest ok');
