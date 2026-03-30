/** Poll composer prefill from a persisted POLL draft (loader JSON). */

export interface InitialPollRestore {
  question: string;
  options: string[];
  pollType: "singlechoice" | "multiplechoice";
  endsAtUnix?: number;
  selectedHashtags: string;
  hashTagPresetId: string | null;
  queueType: string;
  includeHashtagsInNoteBody?: boolean;
  isRecyclable?: boolean;
}
