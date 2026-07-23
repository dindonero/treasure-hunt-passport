/**
 * Web NFC API type declarations.
 * Not included in TypeScript's standard lib — only supported in Android Chrome 89+.
 * @see https://developer.mozilla.org/en-US/docs/Web/API/Web_NFC_API
 */

interface NDEFRecord {
  readonly recordType: string
  readonly mediaType?: string
  readonly id?: string
  readonly data?: DataView
  readonly encoding?: string
  readonly lang?: string
  toRecords?: () => NDEFRecord[]
}

interface NDEFMessage {
  readonly records: ReadonlyArray<NDEFRecord>
}

interface NDEFReadingEvent extends Event {
  readonly serialNumber: string
  readonly message: NDEFMessage
}

interface NDEFReader extends EventTarget {
  onreading: ((event: NDEFReadingEvent) => void) | null
  onreadingerror: ((event: Event) => void) | null
  scan(options?: { signal?: AbortSignal }): Promise<void>
  write(
    message: string | BufferSource | NDEFMessageInit,
    options?: { signal?: AbortSignal; overwrite?: boolean },
  ): Promise<void>
}

interface NDEFMessageInit {
  records: NDEFRecordInit[]
}

interface NDEFRecordInit {
  recordType: string
  mediaType?: string
  id?: string
  encoding?: string
  lang?: string
  data?: string | BufferSource
}

declare var NDEFReader: {
  prototype: NDEFReader
  new (): NDEFReader
}

interface Window {
  NDEFReader?: typeof NDEFReader
}
