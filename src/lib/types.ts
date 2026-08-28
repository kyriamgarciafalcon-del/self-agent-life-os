export type Repeat = "none" | "daily" | "weekly";
export type Tag = "work" | "life" | "health";
export type Kind = "event" | "task";

export type AgendaItem = {
  id: string;
  title: string;
  note: string;
  date: string;
  start: string | null;
  end: string | null;
  allDay: boolean;
  repeat: Repeat;
  tag: Tag;
  kind: Kind;
  completedOn: string[];
};

export type Draft = Omit<AgendaItem, "id" | "completedOn">;
