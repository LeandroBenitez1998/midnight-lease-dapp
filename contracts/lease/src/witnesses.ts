export type LeasePrivateState = {
  callerAddress: Uint8Array;
};

type WitnessContext = {
  privateState: LeasePrivateState;
};

export const createPrivateState = (callerAddress: Uint8Array): LeasePrivateState => {
  return {
    callerAddress,
  };
};

export const callerAddress = (
  context: WitnessContext,
): [LeasePrivateState, Uint8Array] => {
  return [context.privateState, context.privateState.callerAddress];
};

export const witnesses = {
  callerAddress,
};
