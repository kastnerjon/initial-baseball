import { describe, expect, it } from 'vitest';
import generatedPitcherSaves from './generated/pitcher-saves.json';
import {
  baseballPlayers,
  coreDailyEligiblePlayers,
  dailyEligiblePlayers,
  extendedDailyEligiblePlayers,
} from './index.js';

const GENERATED_PITCHER_SAVES = generatedPitcherSaves as Record<string, number>;

const DEMO_PLAYER_NAMES = [
  'Ken Griffey Jr.',
  'David Wright',
  'CC Sabathia',
  'Andruw Jones',
  'Jason Varitek',
  'Hideki Matsui',
];

describe('baseballPlayers', () => {
  it('includes complete chronological return stints for sourced many-team careers', () => {
    const rickey = baseballPlayers.find(p => p.displayName === 'Rickey Henderson');
    const edwin = baseballPlayers.find(p => p.displayName === 'Edwin Jackson');
    expect(rickey?.teamsDisplay.split(', ').slice(0, 3)).toEqual(['OAK', 'NYY', 'OAK']);
    expect(rickey?.teamsDisplay.split(', ').at(-1)).toBe('LAD');
    expect(edwin?.teamsDisplay.split(', ').length).toBeGreaterThan(10);
  });


  it('contains a broad searchable player universe', () => {
    expect(baseballPlayers.length).toBeGreaterThanOrEqual(1000);
  });

  it('has unique ids', () => {
    expect(new Set(baseballPlayers.map((player) => player.id)).size).toBe(baseballPlayers.length);
  });

  it('includes required fields for every player', () => {
    for (const player of baseballPlayers) {
      expect(player.id.length).toBeGreaterThan(0);
      expect(player.fullName.length).toBeGreaterThan(0);
      expect(player.¶»§q«^