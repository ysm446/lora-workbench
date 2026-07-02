// モック用ダミーデータ。実装時は backend API に置き換える。

export type StepKey =
  | "import"
  | "tag"
  | "curate"
  | "build"
  | "train"
  | "test";

export const STEPS: { key: StepKey; label: string }[] = [
  { key: "import", label: "Import" },
  { key: "tag", label: "Tag" },
  { key: "curate", label: "Curate" },
  { key: "build", label: "Build" },
  { key: "train", label: "Train" },
  { key: "test", label: "Test" },
];

export interface ImageItem {
  id: string;
  name: string;
  hue: number; // サムネイル代わりの色
  keep: boolean;
  tags: string[];
  candidate: boolean; // 剪定候補（高頻度タグ保有）
  blacklisted: boolean; // ブラックリスト該当
}

export interface Project {
  id: string;
  name: string;
  trigger: string;
  baseModel: string;
  status: "未着手" | "タグ付け中" | "学習済み";
  images: ImageItem[];
}

const TAG_POOL = [
  "1girl",
  "smile",
  "blue_eyes",
  "long_hair",
  "looking_at_viewer",
  "outdoors",
  "school_uniform",
  "blush",
];

function makeImages(seed: number, count: number): ImageItem[] {
  const imgs: ImageItem[] = [];
  for (let i = 0; i < count; i++) {
    const n = i + 1;
    const tagCount = 3 + ((seed + i) % 4);
    const tags = TAG_POOL.slice(0, tagCount);
    imgs.push({
      id: `img_${seed}_${n}`,
      name: `img_${String(n).padStart(3, "0")}`,
      hue: (seed * 47 + i * 37) % 360,
      keep: !(i % 7 === 6),
      tags,
      candidate: i % 3 === 0,
      blacklisted: i % 11 === 5,
    });
  }
  return imgs;
}

export const PROJECTS: Project[] = [
  {
    id: "mychar",
    name: "mychar",
    trigger: "mychar",
    baseModel: "Illustrious-XL-v2.0",
    status: "タグ付け中",
    images: makeImages(1, 18),
  },
  {
    id: "style_A",
    name: "style_A",
    trigger: "style_a",
    baseModel: "Illustrious-XL-v2.0",
    status: "未着手",
    images: makeImages(2, 9),
  },
  {
    id: "style_B",
    name: "style_B",
    trigger: "style_b",
    baseModel: "Illustrious-XL-v2.0",
    status: "学習済み",
    images: makeImages(3, 24),
  },
];
