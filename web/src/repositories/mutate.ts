import { RepositoryError } from "./types";

/** Reexecuta `fn` (releitura + decisão + gravação versionada) enquanto outra escrita passar na frente (`conflict`). */
export async function retryOnConflict<T>(fn: () => Promise<T>, attempts = 8): Promise<T> {
  for (let i = 0; ; i++) {
    try {
      return await fn();
    } catch (e) {
      if (!(e instanceof RepositoryError && e.code === "conflict") || i + 1 >= attempts) throw e;
    }
  }
}
