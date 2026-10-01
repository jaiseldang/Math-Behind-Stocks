/**
 * The few Google Apps Script services this project uses, typed just enough
 * for TypeScript. (Full typings: @types/google-apps-script.)
 */
interface GasBlob {
  getBytes(): number[];
  getDataAsString(): string;
}
interface GasHttpResponse {
  getResponseCode(): number;
  getContentText(): string;
  getHeaders(): Record<string, string>;
}
interface GasProperties {
  getProperty(key: string): string | null;
  setProperty(key: string, value: string): GasProperties;
  setProperties(props: Record<string, string>): GasProperties;
  deleteProperty(key: string): GasProperties;
  getKeys(): string[];
}
interface GasCache {
  get(key: string): string | null;
  put(key: string, value: string, seconds?: number): void;
}
interface GasTextOutput {
  setMimeType(mime: unknown): GasTextOutput;
}
interface GasHtmlOutput {
  setTitle(t: string): GasHtmlOutput;
  addMetaTag(name: string, content: string): GasHtmlOutput;
}
interface GasEvent {
  parameter: Record<string, string>;
  postData?: { contents: string; type: string };
}

declare const UrlFetchApp: { fetch(url: string, params?: { muteHttpExceptions?: boolean; headers?: Record<string, string> }): GasHttpResponse };
declare const PropertiesService: { getScriptProperties(): GasProperties };
declare const CacheService: { getScriptCache(): GasCache };
declare const Utilities: {
  sleep(ms: number): void;
  gzip(blob: GasBlob): GasBlob;
  ungzip(blob: GasBlob): GasBlob;
  newBlob(data: string | number[], contentType?: string): GasBlob;
  base64Encode(bytes: number[]): string;
  base64Decode(text: string): number[];
};
declare const ContentService: { createTextOutput(text: string): GasTextOutput; MimeType: { JSON: unknown } };
declare const HtmlService: { createHtmlOutputFromFile(name: string): GasHtmlOutput };
declare const Session: { getTemporaryActiveUserKey(): string };
declare const ScriptApp: { getService(): { getUrl(): string } };
declare const Logger: { log(...args: unknown[]): void };
