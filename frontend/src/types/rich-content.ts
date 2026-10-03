export interface RichContent {
  rich_html?: string | null;
  image_media_id?: string | null;
  audio_media_id?: string | null;
  image_alt?: string;
  semantic_value?: 'true' | 'false' | null;
}

export interface QuestionBlock extends RichContent {
  block_id?: number;
  kind: 'group' | 'parent';
  title: string;
  question_ids: number[];
  keep_order: boolean;
  keep_together: boolean;
  pinned_position: number | null;
}

export interface QuestionLayout {
  page: number;
  slot: number;
  position: number;
  questions_per_page: number;
  block?: QuestionBlock | null;
  continuation?: boolean;
}
