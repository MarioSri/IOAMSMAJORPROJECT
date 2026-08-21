import {
  BATCH_SIZE,
  CHUNK_SIZE,
  splitTextIntoChunks,
  summarizeLargeText,
} from './summarizeController';

describe('summarizeController chunking', () => {
  it('splits long text at safe boundaries without dropping or duplicating content', () => {
    const text = Array.from(
      { length: Math.ceil((CHUNK_SIZE * 2.5) / 90) },
      (_, index) => `Section ${index}: This paragraph contains durable source content for coverage validation.`,
    ).join('\n\n');

    const chunks = splitTextIntoChunks(text);

    expect(chunks.length).toBeGreaterThan(2);
    expect(chunks.every((chunk) => chunk.length <= CHUNK_SIZE)).toBe(true);
    expect(chunks.join('')).toBe(text);
    expect(chunks.slice(0, -1).every((chunk) => /(?:\n\n|\n|\. | )$/.test(chunk))).toBe(true);
  });

  it('summarizes every chunk, preserves order, and merges all chunk summaries', async () => {
    const text = Array.from(
      { length: Math.ceil((CHUNK_SIZE * 2.2) / 120) },
      (_, index) => `Section ${index}: Revenue, customer outcomes, and operational decisions are recorded here.`,
    ).join('\n\n');
    const prompts: string[] = [];
    let inFlight = 0;
    let maximumInFlight = 0;

    const result = await summarizeLargeText(text, { title: 'Coverage test', type: 'Test' }, async (prompt) => {
      prompts.push(prompt);
      inFlight += 1;
      maximumInFlight = Math.max(maximumInFlight, inFlight);
      await new Promise((resolve) => setTimeout(resolve, 0));
      inFlight -= 1;

      if (prompt.includes('SECTION SUMMARIES:')) return 'Final merged summary.';
      const sectionNumber = prompt.match(/CONTENT SECTION (\d+):/)?.[1];
      return `Chunk summary ${sectionNumber}`;
    });

    const expectedChunkCount = splitTextIntoChunks(text).length;
    const chunkPrompts = prompts.filter((prompt) => prompt.includes('CONTENT SECTION'));
    const mergePrompt = prompts.find((prompt) => prompt.includes('SECTION SUMMARIES:')) ?? '';

    expect(result).toBe('Final merged summary.');
    expect(chunkPrompts).toHaveLength(expectedChunkCount);
    expect(maximumInFlight).toBeGreaterThan(1);
    expect(maximumInFlight).toBeLessThanOrEqual(BATCH_SIZE);
    for (let index = 1; index <= expectedChunkCount; index += 1) {
      expect(mergePrompt).toContain(`Section ${index}:\nChunk summary ${index}`);
    }
  });
});
