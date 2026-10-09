import { createHash } from 'node:crypto';

export const COLUMNS = 6;
export const MAX_ROWS = 50;
export const seatKey = position => `${position.row}:${position.column}`;
export const layoutRevision = students => createHash('sha256').update(JSON.stringify(students)).digest('hex');
export const validPosition = position => position && Number.isInteger(position.row) &&
  Number.isInteger(position.column) && position.row >= 1 && position.row <= MAX_ROWS &&
  position.column >= 1 && position.column <= COLUMNS;

export function firstFreePosition(students) {
  const occupied = new Set(students.map(student => seatKey(student.position)));
  for (let row = 1; row <= MAX_ROWS; row++) {
    for (let column = 1; column <= COLUMNS; column++) {
      if (!occupied.has(seatKey({ row, column }))) return { row, column };
    }
  }
  throw new ClassroomError('The classroom is full (300 seats).', 409);
}

export class ClassroomError extends Error {
  constructor(message, status = 422) {
    super(message);
    this.status = status;
  }
}
