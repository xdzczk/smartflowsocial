declare module "turndown" {
  interface TurndownOptions {
    headingStyle?: "setext" | "atx";
    hr?: string;
    bulletListMarker?: "-" | "+" | "*";
    codeBlockStyle?: "indented" | "fenced";
    fence?: "```" | "~~~";
    emDelimiter?: "_" | "*";
    strongDelimiter?: "__" | "**";
    linkStyle?: "inlined" | "referenced";
  }

  interface TurndownRule {
    filter: string | string[] | ((node: HTMLElement) => boolean);
    replacement?: (content: string, node: HTMLElement) => string;
  }

  class TurndownService {
    constructor(options?: TurndownOptions);
    use(rules: TurndownRule | TurndownRule[]): this;
    turndown(html: string | HTMLElement): string;
  }

  export = TurndownService;
}
