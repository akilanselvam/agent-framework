declare module "eventsource" {
  export default class EventSource {
    constructor(url: string, eventSourceInitDict?: any);

    onopen: ((event: any) => void) | null;
    onmessage: ((event: MessageEvent) => void) | null;
    onerror: ((event: any) => void) | null;

    addEventListener(
      type: string,
      listener: (event: MessageEvent) => void
    ): void;

    removeEventListener(
      type: string,
      listener: (event: MessageEvent) => void
    ): void;

    close(): void;
  }
}
