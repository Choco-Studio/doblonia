import type { CannonEffect } from './weapons.js'

export type FleetRole = 'collector' | 'support' | 'escort' | 'heavy'
export type FleetClass = 'light' | 'heavy'

export interface FleetShipDef {
  id: string
  name: string
  cost: number
  hp: number
  moveSpeed: number
  role: FleetRole
  fleetClass: FleetClass
  cooldownMs: number
  weapon?: CannonEffect
  minesEffect?: { damage: number; radius: number; reloadMs: number; lifetimeMs: number }
  collectRadius?: number
}

export const FISHING_BOAT: FleetShipDef = {
  id: 'fishing_boat',
  name: 'Barco Pesquero',
  cost: 100,
  hp: 45,
  moveSpeed: 190,
  role: 'collector',
  fleetClass: 'light',
  cooldownMs: 1000,
  collectRadius: 70,
}

export const MINE_DROPPER_FLEET: FleetShipDef = {
  id: 'mine_dropper_fleet',
  name: 'Minador',
  cost: 300,
  hp: 250,
  moveSpeed: 130,
  role: 'support',
  fleetClass: 'light',
  cooldownMs: 30000,
  minesEffect: { damage: 55, radius: 34, reloadMs: 2400, lifetimeMs: 5000 },
}

export const BATTLESHIP: FleetShipDef = {
  id: 'battleship',
  name: 'Acorazado Escolta',
  cost: 500,
  hp: 300,
  moveSpeed: 150,
  role: 'escort',
  fleetClass: 'light',
  cooldownMs: 30000,
  weapon: {
    kind: 'cannon',
    count: 2,
    arcsDeg: [90, -90],
    aimed: false,
    autoAim: true,
    damage: 14,
    reloadMs: 1000,
    bulletSpeed: 360,
    bulletRadius: 4,
    range: 260,
    spreadDeg: 2,
  },
}

export const MAN_OF_WAR: FleetShipDef = {
  id: 'man_of_war',
  name: 'Navío de Línea',
  cost: 1500,
  hp: 500,
  moveSpeed: 120,
  role: 'heavy',
  fleetClass: 'heavy',
  cooldownMs: 60000,
  weapon: {
    kind: 'cannon',
    count: 6,
    arcsDeg: [80, 90, 100, -80, -90, -100],
    aimed: false,
    autoAim: true,
    damage: 16,
    reloadMs: 950,
    bulletSpeed: 380,
    bulletRadius: 4.5,
    range: 280,
    spreadDeg: 2,
  },
}

export const FLEET_SHIPS: FleetShipDef[] = [FISHING_BOAT, MINE_DROPPER_FLEET, BATTLESHIP, MAN_OF_WAR]

export const MAX_LIGHT_FLEET = 3
export const MAX_HEAVY_FLEET = 1

export function findFleetDef(id: string): FleetShipDef | undefined {
  return FLEET_SHIPS.find((f) => f.id === id)
}
