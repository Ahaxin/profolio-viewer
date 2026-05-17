const axios = require('axios');
const { fetchStockPrices } = require('../services/yahooFinance');

let axiosGetSpy;

beforeEach(() => {
  axiosGetSpy = vi.spyOn(axios, 'get');
});

afterEach(() => {
  axiosGetSpy.mockRestore();
});

describe('fetchStockPrices', () => {
  it('returns {price, currency} from chart meta', async () => {
    axiosGetSpy.mockResolvedValue({
      data: { chart: { result: [{ meta: { regularMarketPrice: 192.5, currency: 'USD' } }] } },
    });
    const res = await fetchStockPrices(['AAPL']);
    expect(res.AAPL).toEqual({ price: 192.5, currency: 'USD' });
  });

  it('detects HKD for .HK suffix when meta.currency missing', async () => {
    axiosGetSpy.mockResolvedValue({
      data: { chart: { result: [{ meta: { regularMarketPrice: 320 } }] } },
    });
    const res = await fetchStockPrices(['0700.HK']);
    expect(res['0700.HK']).toEqual({ price: 320, currency: 'HKD' });
  });

  it('uses suffix table for JP/UK/EU when meta.currency missing', async () => {
    axiosGetSpy.mockResolvedValue({
      data: { chart: { result: [{ meta: { regularMarketPrice: 1000 } }] } },
    });
    const res = await fetchStockPrices(['7203.T']);
    expect(res['7203.T'].currency).toBe('JPY');
  });

  it('falls back to USD when no meta.currency and no suffix match', async () => {
    axiosGetSpy.mockResolvedValue({
      data: { chart: { result: [{ meta: { regularMarketPrice: 50 } }] } },
    });
    const res = await fetchStockPrices(['SOMETHING']);
    expect(res.SOMETHING.currency).toBe('USD');
  });

  it('omits symbols with no price', async () => {
    axiosGetSpy.mockResolvedValue({
      data: { chart: { result: [{ meta: {} }] } },
    });
    const res = await fetchStockPrices(['NOPRICE']);
    expect(res.NOPRICE).toBeUndefined();
  });
});
