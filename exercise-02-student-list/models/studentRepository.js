import { mkdir, readFile, writeFile, rename } from 'node:fs/promises';
import { dirname } from 'node:path';
import { ClassroomError, firstFreePosition, layoutRevision, seatKey, validPosition } from './classroom.js';

export class DuplicateStudentError extends Error {
  constructor(errors) {
    super('Student already exists');
    this.errors = errors;
  }
}

export function createStudentRepository(filePath) {
  // Serialize read-check-write operations so simultaneous requests cannot lose data.
  // This exercise runs one Node process; multiple processes need a shared lock/store.
  let pending = Promise.resolve();
  async function readStudents() {
    let contents;
    try {
      contents = await readFile(filePath, 'utf8');
    } catch (error) {
      if (error.code === 'ENOENT') return [];
      throw error;
    }
    const students = JSON.parse(contents);
    if (!Array.isArray(students) || students.some(student => !student ||
      !['id', 'name', 'email'].every(field => typeof student[field] === 'string'))) {
      throw new Error('Students.JSON must contain an array of students with id, name, and email.');
    }
    const positioned = students.filter(student => student.position !== undefined);
    if (positioned.some(student => !validPosition(student.position)) ||
      new Set(positioned.map(student => seatKey(student.position))).size !== positioned.length) {
      throw new Error('Student positions must be valid and unique.');
    }
    // Older JSON records get deterministic vacant seats; the next write persists them.
    for (const student of students) {
      if (student.position === undefined) {
        student.position = firstFreePosition(positioned);
        positioned.push(student);
      }
    }
    return students;
  }
  function mutate(change) {
    const operation = pending.then(async () => {
      const students = await readStudents();
      await change(students);
      await mkdir(dirname(filePath), { recursive: true });
      const temporaryPath = `${filePath}.tmp`;
      await writeFile(temporaryPath, `${JSON.stringify(students, null, 2)}\n`, 'utf8');
      await rename(temporaryPath, filePath);
      return students;
    });
    pending = operation.catch(() => {});
    return operation;
  }
  return {
    list: readStudents,
    add(student) {
      return mutate(students => {
        const errors = {};
        if (students.some(item => item.id.toUpperCase() === student.id.toUpperCase())) {
          errors.id = 'This student ID is already in the list.';
        }
        if (students.some(item => item.email.toLowerCase() === student.email.toLowerCase())) {
          errors.email = 'This email address is already in the list.';
        }
        if (Object.keys(errors).length) throw new DuplicateStudentError(errors);
        students.push({ ...student, position: firstFreePosition(students) });
      });
    },
    move(id, position, revision) {
      return mutate(students => {
        if (!validPosition(position)) throw new ClassroomError('Choose a valid classroom seat.');
        if (revision !== layoutRevision(students)) {
          throw new ClassroomError('The classroom changed since you opened it. Review the updated layout and try again.', 409);
        }
        const student = students.find(student => student.id === id);
        if (!student) throw new ClassroomError('This student is no longer in the list.', 404);
        const occupant = students.find(item => seatKey(item.position) === seatKey(position));
        if (occupant && occupant !== student) occupant.position = student.position;
        student.position = position;
      });
    },
  };
}
