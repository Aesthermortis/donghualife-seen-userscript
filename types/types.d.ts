export type ItemType = "episode" | "series" | "season" | "movie";

export interface SelectorConfig {
  item: string;
  link: string;
  preferKind: "series" | "season" | null;
  validate: (el: Element) => boolean;
}
