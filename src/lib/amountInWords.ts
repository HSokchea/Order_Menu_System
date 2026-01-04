// Amount in words utilities for English and Khmer

const ones = ['', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine',
  'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
const tens = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];

function convertHundreds(num: number): string {
  if (num === 0) return '';
  if (num < 20) return ones[num];
  if (num < 100) {
    return tens[Math.floor(num / 10)] + (num % 10 !== 0 ? '-' + ones[num % 10] : '');
  }
  return ones[Math.floor(num / 100)] + ' hundred' + (num % 100 !== 0 ? ' ' + convertHundreds(num % 100) : '');
}

/**
 * Convert a number to English words
 * @param num Number to convert (supports decimals)
 * @param currency Currency code (USD, KHR)
 * @returns English words representation
 */
export function numberToWordsEnglish(num: number, currency: 'USD' | 'KHR' = 'USD'): string {
  if (num === 0) return currency === 'USD' ? 'zero dollars' : 'zero riels';
  
  const isNegative = num < 0;
  num = Math.abs(num);
  
  let dollars = Math.floor(num);
  const cents = Math.round((num - dollars) * 100);
  
  let result = '';
  
  if (dollars === 0) {
    result = '';
  } else if (dollars < 1000) {
    result = convertHundreds(dollars);
  } else if (dollars < 1000000) {
    const thousands = Math.floor(dollars / 1000);
    const remainder = dollars % 1000;
    result = convertHundreds(thousands) + ' thousand' + (remainder !== 0 ? ' ' + convertHundreds(remainder) : '');
  } else if (dollars < 1000000000) {
    const millions = Math.floor(dollars / 1000000);
    const remainder = dollars % 1000000;
    result = convertHundreds(millions) + ' million';
    if (remainder >= 1000) {
      result += ' ' + convertHundreds(Math.floor(remainder / 1000)) + ' thousand';
    }
    if (remainder % 1000 !== 0) {
      result += ' ' + convertHundreds(remainder % 1000);
    }
  }
  
  // Capitalize first letter
  result = result.charAt(0).toUpperCase() + result.slice(1);
  
  if (currency === 'USD') {
    result += dollars === 1 ? ' dollar' : ' dollars';
    if (cents > 0) {
      result += ' and ' + convertHundreds(cents) + (cents === 1 ? ' cent' : ' cents');
    }
  } else {
    // KHR - typically no cents
    result += ' riels';
  }
  
  return (isNegative ? 'minus ' : '') + result;
}

// Khmer numerals
const khmerOnes = ['', 'មួយ', 'ពីរ', 'បី', 'បួន', 'ប្រាំ', 'ប្រាំមួយ', 'ប្រាំពីរ', 'ប្រាំបី', 'ប្រាំបួន'];
const khmerTens = ['', 'ដប់', 'ម្ភៃ', 'សាមសិប', 'សែសិប', 'ហាសិប', 'ហុកសិប', 'ចិតសិប', 'ប៉ែតសិប', 'កៅសិប'];

function convertHundredsKhmer(num: number): string {
  if (num === 0) return '';
  if (num < 10) return khmerOnes[num];
  if (num < 100) {
    const ten = Math.floor(num / 10);
    const one = num % 10;
    return khmerTens[ten] + (one !== 0 ? khmerOnes[one] : '');
  }
  const hundred = Math.floor(num / 100);
  const remainder = num % 100;
  return khmerOnes[hundred] + 'រយ' + (remainder !== 0 ? convertHundredsKhmer(remainder) : '');
}

/**
 * Convert a number to Khmer words
 * @param num Number to convert (integer expected for KHR)
 * @returns Khmer words representation
 */
export function numberToWordsKhmer(num: number): string {
  if (num === 0) return 'សូន្យរៀល';
  
  const isNegative = num < 0;
  num = Math.abs(Math.round(num));
  
  let result = '';
  
  if (num < 1000) {
    result = convertHundredsKhmer(num);
  } else if (num < 10000) {
    const thousands = Math.floor(num / 1000);
    const remainder = num % 1000;
    result = khmerOnes[thousands] + 'ពាន់' + (remainder !== 0 ? convertHundredsKhmer(remainder) : '');
  } else if (num < 100000) {
    const tenThousands = Math.floor(num / 10000);
    const remainder = num % 10000;
    result = khmerOnes[tenThousands] + 'ម៉ឺន';
    if (remainder >= 1000) {
      result += khmerOnes[Math.floor(remainder / 1000)] + 'ពាន់';
    }
    if (remainder % 1000 !== 0) {
      result += convertHundredsKhmer(remainder % 1000);
    }
  } else if (num < 1000000) {
    const hundredThousands = Math.floor(num / 100000);
    const remainder = num % 100000;
    result = khmerOnes[hundredThousands] + 'សែន';
    if (remainder >= 10000) {
      result += khmerOnes[Math.floor(remainder / 10000)] + 'ម៉ឺន';
    }
    if ((remainder % 10000) >= 1000) {
      result += khmerOnes[Math.floor((remainder % 10000) / 1000)] + 'ពាន់';
    }
    if (remainder % 1000 !== 0) {
      result += convertHundredsKhmer(remainder % 1000);
    }
  } else {
    // For larger numbers, use a simplified approach
    const millions = Math.floor(num / 1000000);
    const remainder = num % 1000000;
    result = convertHundredsKhmer(millions) + 'លាន';
    if (remainder > 0) {
      result += numberToWordsKhmer(remainder).replace('រៀល', '');
    }
  }
  
  result += 'រៀល';
  
  return (isNegative ? 'ដក' : '') + result;
}

/**
 * Round KHR amount to nearest 100 riels (Cambodia standard)
 * @param khr KHR amount
 * @returns Rounded amount
 */
export function roundKHRto100(khr: number): number {
  return Math.round(khr / 100) * 100;
}

/**
 * Convert USD to KHR with rounding to nearest 100
 * @param usd USD amount
 * @param exchangeRate Exchange rate (1 USD = X KHR)
 * @returns KHR amount rounded to nearest 100
 */
export function convertUSDtoKHR(usd: number, exchangeRate: number): number {
  return roundKHRto100(usd * exchangeRate);
}

/**
 * Format KHR amount with Khmer riel symbol
 * @param amount KHR amount
 * @returns Formatted string with symbol
 */
export function formatKHR(amount: number): string {
  return new Intl.NumberFormat('km-KH', {
    style: 'decimal',
    maximumFractionDigits: 0,
  }).format(amount) + '៛';
}
