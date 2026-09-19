import type { Room } from '@colyseus/sdk'
import type { RoomStateSchema } from '@doblonia/protocol'

/**
 * @colyseus/schema 5.0.33 borra el índice inverso al recibir DELETE, pero conserva
 * la entrada de _collectionIndexes. Miles de disparos acumulan claves de por vida.
 * Limpiamos solo mapas decodificados: en el servidor esos índices pueden estar
 * pendientes de envío. El test de rotación de proyectiles protege esta compatibilidad.
 */
export function pruneDecodedIndexes(state: RoomStateSchema): void {
  for (const map of [state.ships, state.bullets, state.mines, state.coins, state.fleet, state.bosses]) {
    const indexes = map._collectionIndexes
    for (const key of Object.keys(indexes)) {
      if (!map.has(key)) delete indexes[key]
    }
  }
}

export function maintainDecodedState(room: Pick<Room<RoomStateSchema>, 'onStateChange'>): void {
  let patches = 0
  room.onStateChange((state) => {
    if (++patches < 100) return
    patches = 0
    pruneDecodedIndexes(state)
  })
}
