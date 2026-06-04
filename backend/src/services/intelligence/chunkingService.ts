import { env } from '../../config/env';
import { DocumentChunkData, PageText } from '../../types/intelligence';

class ChunkingService {
  createChunks(pages: PageText[]): DocumentChunkData[] {
    if (!pages.length) return [];

    const chunkSize = env.intelligence.chunkSizePages;
    const sorted = [...pages].sort((a, b) => a.pageNumber - b.pageNumber);
    const chunks: DocumentChunkData[] = [];
    let chunkNumber = 1;

    for (let i = 0; i < sorted.length; i += chunkSize) {
      const slice = sorted.slice(i, i + chunkSize);
      const startPage = slice[0].pageNumber;
      const endPage = slice[slice.length - 1].pageNumber;
      const pageNumbers = slice.map((p) => p.pageNumber);

      const text = slice
        .map((p) => `--- PAGE ${p.pageNumber} ---\n${p.text}`)
        .join('\n\n');

      chunks.push({
        chunkNumber,
        startPage,
        endPage,
        text,
        pageNumbers,
      });
      chunkNumber++;
    }

    return chunks;
  }
}

export const chunkingService = new ChunkingService();
