import Papa from 'papaparse';
import { collection, doc, writeBatch } from 'firebase/firestore';
import { db } from '../firebase';
import { BATCH_COMMIT_SIZE } from '../config/constants';

export async function importCsvToFirestore(
  file: File,
  collectionName: string,
  mapRow: (row: Record<string, string>) => Record<string, unknown> | null
): Promise<number> {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        try {
          let batch = writeBatch(db);
          let count = 0;
          let totalCount = 0;

          for (const row of results.data as Record<string, string>[]) {
            const data = mapRow(row);
            if (!data) continue;

            const newDocRef = doc(collection(db, collectionName));
            batch.set(newDocRef, data);

            count++;
            totalCount++;

            if (count === BATCH_COMMIT_SIZE) {
              await batch.commit();
              batch = writeBatch(db);
              count = 0;
            }
          }

          if (count > 0) {
            await batch.commit();
          }

          resolve(totalCount);
        } catch (e) {
          reject(e);
        }
      },
      error: (err) => reject(err),
    });
  });
}

export function downloadCsvWithBom(data: object[], filename: string): void {
  const csv = Papa.unparse(data);
  const bom = new Uint8Array([0xEF, 0xBB, 0xBF]);
  const blob = new Blob([bom, csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
