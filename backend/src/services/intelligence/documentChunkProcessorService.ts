import { Types } from 'mongoose';
import { DocumentChunkData, PageText } from '../../types/intelligence';
import {
  ChunkProcessResult,
  ChunkProcessingStatistics,
} from '../../types/chunkProcessing';
import { chunkingService } from './chunkingService';
import { tableExtractionService, ExtractedTable } from './tableExtractionService';
import { documentMapBuilder, DocumentMap, emptyDocumentMap } from './documentMapBuilder';
import { DocumentChunk, ChunkExtraction } from '../../models/DocumentChunk';

export interface ChunkPipelineArtifacts {
  structuredTables: ExtractedTable[];
  documentMap: DocumentMap;
  chunkCount: number;
  processingTimeMs: number;
  statistics: ChunkProcessingStatistics;
}

export interface ChunkProcessContext {
  documentId: Types.ObjectId;
  tenderId: Types.ObjectId;
  jobId: Types.ObjectId;
}

class DocumentChunkProcessorService {
  /**
   * Split pages into chunks, persist to MongoDB, and process all chunks in parallel.
   */
  async splitStoreAndProcess(
    pages: PageText[],
    ctx: ChunkProcessContext
  ): Promise<{ chunks: DocumentChunkData[]; artifacts: ChunkPipelineArtifacts }> {
    const pipelineStarted = Date.now();
    const chunks = chunkingService.createChunks(pages);
    const pageMap = new Map(pages.map((p) => [p.pageNumber, p]));

    await DocumentChunk.deleteMany({ jobId: ctx.jobId });
    await ChunkExtraction.deleteMany({ jobId: ctx.jobId });

    await DocumentChunk.insertMany(
      chunks.map((c) => ({
        documentId: ctx.documentId,
        tenderId: ctx.tenderId,
        jobId: ctx.jobId,
        chunkNumber: c.chunkNumber,
        startPage: c.startPage,
        endPage: c.endPage,
        text: c.text,
        pageNumbers: c.pageNumbers,
        characterCount: c.text.length,
        status: 'pending',
      }))
    );

    const chunkResults = await Promise.all(
      chunks.map((chunk) => this.processChunk(chunk, pageMap))
    );

    await Promise.all(
      chunkResults.map((result) =>
        DocumentChunk.updateOne(
          { jobId: ctx.jobId, chunkNumber: result.chunkNumber },
          {
            $set: {
              processingTimeMs: result.processingTimeMs,
              tablesExtracted: result.tablesExtracted,
              status: result.status,
              errorMessage: result.error || '',
            },
          }
        )
      )
    );

    const structuredTables = chunkResults.flatMap((r) => r.tables);
    const partialMaps = chunkResults.map((r) => r.documentMap);
    const documentMap = documentMapBuilder.mergeMaps(partialMaps, pages.length);
    const statistics = this.buildStatistics(pages, chunks, chunkResults, pipelineStarted);

    console.log('[Pipeline] Chunk statistics', {
      totalChunks: statistics.totalChunks,
      totalPages: statistics.totalPages,
      chunksProcessed: statistics.chunksProcessed,
      chunksFailed: statistics.chunksFailed,
      totalProcessingTimeMs: statistics.totalProcessingTimeMs,
      averageChunkProcessingTimeMs: statistics.averageChunkProcessingTimeMs,
      totalTablesExtracted: statistics.totalTablesExtracted,
    });

    return {
      chunks,
      artifacts: {
        structuredTables,
        documentMap,
        chunkCount: chunks.length,
        processingTimeMs: Date.now() - pipelineStarted,
        statistics,
      },
    };
  }

  /** Process pages without persistence (for tests / lightweight callers). */
  async processPages(pages: PageText[]): Promise<ChunkPipelineArtifacts> {
    const pipelineStarted = Date.now();
    if (!pages.length) {
      return this.emptyArtifacts();
    }

    const chunks = chunkingService.createChunks(pages);
    const pageMap = new Map(pages.map((p) => [p.pageNumber, p]));
    const chunkResults = await Promise.all(
      chunks.map((chunk) => this.processChunk(chunk, pageMap))
    );

    const structuredTables = chunkResults.flatMap((r) => r.tables);
    const documentMap = documentMapBuilder.mergeMaps(
      chunkResults.map((r) => r.documentMap),
      pages.length
    );
    const statistics = this.buildStatistics(pages, chunks, chunkResults, pipelineStarted);

    return {
      structuredTables,
      documentMap,
      chunkCount: chunks.length,
      processingTimeMs: Date.now() - pipelineStarted,
      statistics,
    };
  }

  private async processChunk(
    chunk: DocumentChunkData,
    pageMap: Map<number, PageText>
  ): Promise<{
    chunkNumber: number;
    startPage: number;
    endPage: number;
    pageNumbers: number[];
    tables: ExtractedTable[];
    documentMap: DocumentMap;
    processingTimeMs: number;
    characterCount: number;
    tablesExtracted: number;
    status: 'completed' | 'failed';
    error?: string;
  }> {
    const started = Date.now();
    console.log('[Chunk] Start', {
      chunkNumber: chunk.chunkNumber,
      startPage: chunk.startPage,
      endPage: chunk.endPage,
      pageNumbers: chunk.pageNumbers,
    });

    try {
      const chunkPages = chunk.pageNumbers
        .map((n) => pageMap.get(n))
        .filter((p): p is PageText => Boolean(p));

      const tables = tableExtractionService.extractFromPages(chunkPages);
      const documentMap = documentMapBuilder.build(chunkPages);
      const processingTimeMs = Date.now() - started;

      console.log('[Chunk] End', {
        chunkNumber: chunk.chunkNumber,
        startPage: chunk.startPage,
        endPage: chunk.endPage,
        tablesExtracted: tables.length,
        characterCount: chunk.text.length,
        processingTimeMs,
      });

      return {
        chunkNumber: chunk.chunkNumber,
        startPage: chunk.startPage,
        endPage: chunk.endPage,
        pageNumbers: chunk.pageNumbers,
        tables,
        documentMap,
        processingTimeMs,
        characterCount: chunk.text.length,
        tablesExtracted: tables.length,
        status: 'completed',
      };
    } catch (err) {
      const processingTimeMs = Date.now() - started;
      const error = err instanceof Error ? err.message : String(err);

      console.log('[Chunk] End', {
        chunkNumber: chunk.chunkNumber,
        startPage: chunk.startPage,
        endPage: chunk.endPage,
        status: 'failed',
        error,
        processingTimeMs,
      });

      return {
        chunkNumber: chunk.chunkNumber,
        startPage: chunk.startPage,
        endPage: chunk.endPage,
        pageNumbers: chunk.pageNumbers,
        tables: [],
        documentMap: emptyDocumentMap(),
        processingTimeMs,
        characterCount: chunk.text.length,
        tablesExtracted: 0,
        status: 'failed',
        error,
      };
    }
  }

  private buildStatistics(
    pages: PageText[],
    chunks: DocumentChunkData[],
    results: Array<{
      chunkNumber: number;
      startPage: number;
      endPage: number;
      pageNumbers: number[];
      processingTimeMs: number;
      characterCount: number;
      tablesExtracted: number;
      status: 'completed' | 'failed';
      error?: string;
    }>,
    pipelineStarted: number
  ): ChunkProcessingStatistics {
    const times = results.map((r) => r.processingTimeMs);
    const completed = results.filter((r) => r.status === 'completed');
    const failed = results.filter((r) => r.status === 'failed');

    const chunkSummaries: ChunkProcessResult[] = results.map((r) => ({
      chunkNumber: r.chunkNumber,
      startPage: r.startPage,
      endPage: r.endPage,
      pageNumbers: r.pageNumbers,
      characterCount: r.characterCount,
      tablesExtracted: r.tablesExtracted,
      processingTimeMs: r.processingTimeMs,
      status: r.status,
      error: r.error,
    }));

    return {
      totalChunks: chunks.length,
      totalPages: pages.length,
      chunksProcessed: completed.length,
      chunksFailed: failed.length,
      totalProcessingTimeMs: Date.now() - pipelineStarted,
      averageChunkProcessingTimeMs: times.length
        ? Math.round(times.reduce((s, t) => s + t, 0) / times.length)
        : 0,
      minChunkProcessingTimeMs: times.length ? Math.min(...times) : 0,
      maxChunkProcessingTimeMs: times.length ? Math.max(...times) : 0,
      totalTablesExtracted: results.reduce((s, r) => s + r.tablesExtracted, 0),
      totalCharacters: chunks.reduce((s, c) => s + c.text.length, 0),
      chunks: chunkSummaries,
    };
  }

  private emptyArtifacts(): ChunkPipelineArtifacts {
    return {
      structuredTables: [],
      documentMap: emptyDocumentMap(),
      chunkCount: 0,
      processingTimeMs: 0,
      statistics: {
        totalChunks: 0,
        totalPages: 0,
        chunksProcessed: 0,
        chunksFailed: 0,
        totalProcessingTimeMs: 0,
        averageChunkProcessingTimeMs: 0,
        minChunkProcessingTimeMs: 0,
        maxChunkProcessingTimeMs: 0,
        totalTablesExtracted: 0,
        totalCharacters: 0,
        chunks: [],
      },
    };
  }
}

export const documentChunkProcessorService = new DocumentChunkProcessorService();
