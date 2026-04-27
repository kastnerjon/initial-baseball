export type BaseState = {
  first: boolean;
  second: boolean;
  third: boolean;
};

export type AdvancementResult = {
  bases: BaseState;
  runsScored: number;
  outsAdded: number;
};

export const EMPTY_BASES: BaseState = {
  first: false,
  second: false,
  third: false,
};
