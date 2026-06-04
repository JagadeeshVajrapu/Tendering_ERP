export interface ChunkProcessResult {
  chunkNumber: number;
  startPage: number;
  endPage: number;
  pageNumbers: number[];
  characterCount: number;
  tablesExtracted: number;
  processingTimeMs: number;
  status: 'completed' | 'failed';
  error?: string;
}

export interface ChunkProcessingStatistics {
  totalChunks: number;
  totalPages: number;
  chunksProcessed: number;
  chunksFailed: number;
  totalProcessingTimeMs: number;
  averageChunkProcessingTimeMs: number;
  minChunkProcessingTimeMs: number;
  maxChunkProcessingTimeMs: number;
  totalTablesExtracted: number;
  totalCharacters: number;
  chunks: ChunkProcessResult[];
}
