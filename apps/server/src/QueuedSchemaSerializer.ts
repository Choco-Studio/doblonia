import { SchemaSerializer } from '@colyseus/core'
import type { Schema } from '@colyseus/schema'

/** Conserva los bytes de cada envío mientras WebSocket termina de escribirlos. */
export class QueuedSchemaSerializer<T extends Schema> extends SchemaSerializer<T> {
  override getFullState(...args: Parameters<SchemaSerializer<T>['getFullState']>) {
    return super.getFullState(...args).slice()
  }

  override applyPatches(...args: Parameters<SchemaSerializer<T>['applyPatches']>) {
    if (this.encoder.hasChanges) {
      this.encoder.sharedBuffer = new Uint8Array(this.encoder.sharedBuffer.byteLength)
    }
    return super.applyPatches(...args)
  }
}
