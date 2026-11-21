import { Schema, model, type ClientSession } from 'mongoose';

const counterSchema = new Schema({
  _id: { type: String, required: true },
  seq: { type: Number, required: true, default: 0 },
});

export const Counter = model('Counter', counterSchema);

const FIRST_REFERENCE = 1001;

/** Next human-friendly order reference: ORD-001001, ORD-001002, ... */
export async function nextOrderReference(session: ClientSession): Promise<string> {
  const counter = await Counter.findOneAndUpdate(
    { _id: 'orderReference' },
    { $inc: { seq: 1 } },
    { upsert: true, returnDocument: 'after', session },
  );
  const number = FIRST_REFERENCE - 1 + counter!.seq;
  return `ORD-${String(number).padStart(6, '0')}`;
}
