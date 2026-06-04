import { PageText } from '../../types/intelligence';
import {
  documentChunkProcessorService,
  ChunkPipelineArtifacts,
} from './documentChunkProcessorService';

export type { ChunkPipelineArtifacts };

/**
 * Parallel chunk processing — delegates to documentChunkProcessorService.
 */
class ChunkPipelineService {
  async processPages(pages: PageText[]): Promise<ChunkPipelineArtifacts> {
    return documentChunkProcessorService.processPages(pages);
  }
}

export const chunkPipelineService = new ChunkPipelineService();
