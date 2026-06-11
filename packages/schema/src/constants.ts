export const GROUP_ENGINE = "orderbook-engine";
export const GROUP_DB_SERVICE = "db-poller-service";
export const GROUP_WS_SERVICE = "ws-service";
export const GROUP_MAIN_BACKEND = "main-backend";
export const TAKER_FEE_RATE = 0.0006;
export const MAKER_FEE_RATE = 0.0002;

export const TAKER_FEE_NUMERATOR = 6n;
export const MAKER_FEE_NUMERATOR = 2n;
export const FEE_DENOMINATOR = 10000n;

export const PLATFORM_RISK_NUMERATOR = 8n;
export const PLATFORM_RISK_DENOMINATOR = 10n;

export const INSURANCE_FUND_SEED = 50_000n;

export const SUPPORTED_EXCHANGES = {
  binance: "binance",
};

export const FUNDING_INTERVAL_SECONDS = 60 * 60 * 8;
export const FUNDING_RATE_CAP_BPS = 75n;
export const FUNDING_BPS_DENOMINATOR = 10_000n;
export const FUNDING_HOURS_UTC = [0, 8, 16];

export const INDEX_PRICE_CACHE_KEY = "index-prices";
