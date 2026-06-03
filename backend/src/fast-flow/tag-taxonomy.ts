export const CHARACTER_TAGS = [
  'boy',
  'girl',
  'mom',
  'dad',
  'cat',
  'dog',
  'bear',
  'rabbit',
] as const;
export const EMOTION_TAGS = ['happy', 'sad', 'scared', 'proud', 'curious'] as const;
export const SCENE_TAGS = ['bedroom', 'forest', 'kitchen', 'park', 'school'] as const;
export const ACTION_TAGS = ['sharing', 'helping', 'playing', 'sleeping'] as const;

export type CharacterTag = (typeof CHARACTER_TAGS)[number];
export type EmotionTag = (typeof EMOTION_TAGS)[number];
export type SceneTag = (typeof SCENE_TAGS)[number];
export type ActionTag = (typeof ACTION_TAGS)[number];

export type IllustrationTag = CharacterTag | EmotionTag | SceneTag | ActionTag;

export const ALL_TAGS: readonly IllustrationTag[] = [
  ...CHARACTER_TAGS,
  ...EMOTION_TAGS,
  ...SCENE_TAGS,
  ...ACTION_TAGS,
];
