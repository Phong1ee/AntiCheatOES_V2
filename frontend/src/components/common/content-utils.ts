import type { RichContent } from '../../types/rich-content';

/** Meaning belongs to an option identity, never its shuffled array index. */
export function trueFalseSemantic(text: string, index: number, content?: RichContent): 'true' | 'false' {
  if (content?.semantic_value === 'true' || content?.semantic_value === 'false') return content.semantic_value;
  const plain = text.trim().toLowerCase();
  if (plain === 'true' || plain === 'false') return plain;
  return index === 0 ? 'true' : 'false';
}
