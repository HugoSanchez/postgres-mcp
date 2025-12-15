export type TextSpan = {
  str: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fontSize: number;
};

export type ParsedPage = {
  index: number;
  text: string;
  spans: Array<TextSpan>;
};

export type OutlineItem = {
  title: string;
  pageIndex: number;
};

export type ParsedPdf = {
  numPages: number;
  outline?: Array<OutlineItem>;
  pages: Array<ParsedPage>;
};

