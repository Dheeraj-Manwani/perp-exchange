export type AccountParams = {
  userId: string;
  username: string;
  maxLeverage?: number;
  available?: bigint;
  locked?: bigint;
};
