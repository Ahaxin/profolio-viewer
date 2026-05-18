export function formatNative(value, currency) {
  if (value == null) return '—';
  const c = currency || 'USD';
  switch (c) {
    case 'USD': return `$${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    case 'HKD': return `HK$${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    case 'JPY': return `¥${Math.round(value).toLocaleString('en-US')}`;
    case 'GBp': return `${value.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 2 })}p`;
    case 'GBP': return `£${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    case 'EUR': return `€${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    case 'CNY': return `CN¥${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    case 'KRW': return `₩${Math.round(value).toLocaleString('en-US')}`;
    case 'INR': return `₹${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    default:    return `${c} ${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
}

export function formatUsd(value) {
  if (value == null) return '—';
  return `$${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
